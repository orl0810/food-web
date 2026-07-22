import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  CompleteRecipeCookingCommand,
  RecipeCookingDraft,
  RecipeCookingOccurrenceLabel,
} from '../models/recipe-cooking.model';
import { AuthService } from './auth.service';
import { FoodInventoryService } from './food-inventory.service';
import { LocalApiService } from './local-api.service';
import { PreparedPortionService } from './prepared-portion.service';
import { RecipeService } from './recipe.service';
import { SupabaseService } from './supabase.service';
import {
  buildIngredientReconciliation,
  buildReconciledInventoryMutations,
} from '../../shared/utils/recipe-cooking.utils';
import { CookBatchSelection } from '../../features/meal-plan/utils/meal-slot-status.utils';
import { MealSlotItem } from '../models/meal-slot-item.model';
import { MEAL_TYPE_LABELS } from '../models/meal-plan.model';
import { formatSlotDateLabel } from '../../features/meal-plan/utils/meal-slot-status.utils';

@Injectable({ providedIn: 'root' })
export class RecipeCookingService {
  private readonly inventoryService = inject(FoodInventoryService);
  private readonly recipeService = inject(RecipeService);
  private readonly preparedPortionService = inject(PreparedPortionService);
  private readonly localApiService = inject(LocalApiService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  async buildDraftFromMealItem(
    item: MealSlotItem
  ): Promise<{ draft: RecipeCookingDraft | null; error: string | null }> {
    if (!item.recipe_id) {
      return { draft: null, error: 'This meal is not linked to a recipe.' };
    }

    const recipeYield = Math.max(1, item.recipe?.portions ?? 1);
    const portionsUsed = Math.max(1, item.portions_used || 1);
    const batches = Math.ceil(portionsUsed / recipeYield);
    const selection: CookBatchSelection = {
      itemIds: [item.id],
      portionsCovered: portionsUsed,
      batches,
      extraPortions: batches * recipeYield - portionsUsed,
    };

    return this.buildDraft({
      recipeId: item.recipe_id,
      recipeTitle: item.recipe?.title ?? item.custom_name ?? 'Recipe',
      recipeYield,
      selection,
      coveredOccurrences: [
        {
          dateLabel: formatSlotDateLabel(item.date),
          mealTypeLabel: MEAL_TYPE_LABELS[item.meal_type],
        },
      ],
    });
  }

  async buildDraft(params: {
    recipeId: string;
    recipeTitle: string;
    recipeYield: number;
    selection: CookBatchSelection;
    coveredOccurrences: RecipeCookingOccurrenceLabel[];
  }): Promise<{ draft: RecipeCookingDraft | null; error: string | null }> {
    const { recipe, error } = await this.recipeService.getVisibleRecipeById(params.recipeId);
    if (error || !recipe) {
      return { draft: null, error: error ?? 'Recipe not found.' };
    }

    if (this.inventoryService.items().length === 0) {
      await this.inventoryService.loadItems();
    }

    const reconciliationLines = buildIngredientReconciliation(
      recipe.ingredients ?? [],
      this.inventoryService.items(),
      params.selection.batches
    );

    return {
      draft: {
        recipeId: params.recipeId,
        recipeTitle: params.recipeTitle,
        recipeYield: params.recipeYield,
        mealPlanItemIds: params.selection.itemIds,
        batches: params.selection.batches,
        portionsCovered: params.selection.portionsCovered,
        extraPortions: params.selection.extraPortions,
        coveredOccurrences: params.coveredOccurrences,
        reconciliationLines,
        readyPortionStorage: 'fridge',
        readyPortionExpiresAt: null,
      },
      error: null,
    };
  }

  async completeCooking(draft: RecipeCookingDraft): Promise<{ error: string | null }> {
    const { changes, creates } = buildReconciledInventoryMutations(
      draft.reconciliationLines,
      this.inventoryService.items()
    );

    const command: CompleteRecipeCookingCommand = {
      recipeId: draft.recipeId,
      mealPlanItemIds: draft.mealPlanItemIds,
      inventoryChanges: changes,
      inventoryCreates: creates,
      readyPortion:
        draft.extraPortions > 0
          ? {
              name: draft.recipeTitle,
              recipeId: draft.recipeId,
              portions: draft.extraPortions,
              storageLocation: draft.readyPortionStorage,
              expiresAt: draft.readyPortionExpiresAt,
            }
          : null,
    };

    if (environment.useLocalApi) {
      try {
        await this.localApiService.completeRecipeCooking(
          command as unknown as Record<string, unknown>
        );
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Could not complete cooking.',
        };
      }
    } else {
      const client = this.supabaseService.getClient();
      const userId = this.authService.user()?.id;
      if (!client || !userId) {
        return { error: 'You must be signed in to mark recipes as cooked.' };
      }

      const { error } = await client.rpc('complete_recipe_cooking', {
        p_recipe_id: command.recipeId,
        p_meal_plan_item_ids: command.mealPlanItemIds,
        p_inventory_changes: command.inventoryChanges,
        p_inventory_creates: command.inventoryCreates,
        p_ready_portion: command.readyPortion,
      });

      if (error) {
        return { error: error.message };
      }
    }

    await Promise.all([
      this.inventoryService.loadItems(),
      this.preparedPortionService.loadPortions(),
    ]);

    return { error: null };
  }
}
