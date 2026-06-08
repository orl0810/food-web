import { computed, inject, Injectable, signal } from '@angular/core';
import { FoodItem } from '../models/food-item.model';
import { Recipe } from '../models/recipe.model';
import {
  SmartSuggestion,
  SuggestionFilters,
} from '../models/smart-suggestion.model';
import {
  getCurrentWeekEndDate,
  getCurrentWeekStartDate,
} from '../../shared/utils/meal-plan.utils';
import { buildSuggestion } from '../../shared/utils/suggestion-scoring.utils';
import { FoodInventoryService } from './food-inventory.service';
import { MealPlanService } from './meal-plan.service';
import { RecipeService } from './recipe.service';

const AVAILABLE_INVENTORY_MATCH_THRESHOLD = 50;
const LOW_MISSING_INGREDIENT_LIMIT = 2;
const DEFAULT_QUICK_PREP_TIME = 30;

@Injectable({ providedIn: 'root' })
export class SmartSuggestionService {
  private readonly foodInventoryService = inject(FoodInventoryService);
  private readonly recipeService = inject(RecipeService);
  private readonly mealPlanService = inject(MealPlanService);

  private readonly plannedRecipeIdsSignal = signal<Set<string>>(new Set());

  readonly plannedRecipeIds = this.plannedRecipeIdsSignal.asReadonly();

  readonly allSuggestions = computed(() => {
    const recipes = this.recipeService.recipes();
    const inventory = this.foodInventoryService.items();
    const planned = this.plannedRecipeIdsSignal();

    return this.sortSuggestionsByScore(
      recipes.map((recipe) => buildSuggestion(recipe, inventory, planned))
    );
  });

  async refresh(): Promise<void> {
    await Promise.all([
      this.foodInventoryService.loadItems(),
      this.recipeService.loadRecipes(),
      this.loadPlannedRecipeIds(),
    ]);
  }

  async loadPlannedRecipeIds(): Promise<void> {
    const entries = await this.mealPlanService.fetchMealPlanForDateRange(
      getCurrentWeekStartDate(),
      getCurrentWeekEndDate()
    );

    const ids = new Set<string>();
    for (const entry of entries) {
      if (entry.recipe_id) {
        ids.add(entry.recipe_id);
      }
    }
    this.plannedRecipeIdsSignal.set(ids);
  }

  calculateRecipeSuggestion(
    recipe: Recipe,
    inventoryItems: FoodItem[],
    plannedRecipeIds: Set<string>
  ): SmartSuggestion {
    return buildSuggestion(recipe, inventoryItems, plannedRecipeIds);
  }

  getSmartSuggestions(filters?: SuggestionFilters): SmartSuggestion[] {
    const suggestions = this.allSuggestions();
    return filters ? this.filterSuggestions(suggestions, filters) : suggestions;
  }

  getSuggestionsForExpiringFoods(): SmartSuggestion[] {
    return this.allSuggestions()
      .filter((suggestion) => suggestion.expiringIngredientsUsed.length > 0)
      .sort((a, b) => b.score - a.score);
  }

  getSuggestionsFromAvailableInventory(): SmartSuggestion[] {
    return this.allSuggestions().filter(
      (suggestion) =>
        suggestion.recipe.ingredients?.length &&
        suggestion.matchPercentage >= AVAILABLE_INVENTORY_MATCH_THRESHOLD
    );
  }

  getQuickMealSuggestions(maxPrepTime = DEFAULT_QUICK_PREP_TIME): SmartSuggestion[] {
    return this.allSuggestions().filter((suggestion) => {
      const prep = suggestion.recipe.prep_time_minutes;
      const isQuickTag = (suggestion.recipe.tags ?? []).includes('quick');
      return isQuickTag || (prep !== null && prep <= maxPrepTime);
    });
  }

  getMealPrepSuggestions(): SmartSuggestion[] {
    return this.allSuggestions().filter((suggestion) =>
      (suggestion.recipe.tags ?? []).includes('meal-prep')
    );
  }

  getLowMissingIngredientSuggestions(): SmartSuggestion[] {
    return this.allSuggestions().filter(
      (suggestion) =>
        suggestion.recipe.ingredients?.length &&
        suggestion.missingIngredients.length <= LOW_MISSING_INGREDIENT_LIMIT
    );
  }

  sortSuggestionsByScore(suggestions: SmartSuggestion[]): SmartSuggestion[] {
    return [...suggestions].sort((a, b) => b.score - a.score);
  }

  filterSuggestions(
    suggestions: SmartSuggestion[],
    filters: SuggestionFilters
  ): SmartSuggestion[] {
    const planned = this.plannedRecipeIdsSignal();

    let result = suggestions;

    if (filters.maxPrepTime !== undefined) {
      const max = filters.maxPrepTime;
      result = result.filter((suggestion) => {
        const prep = suggestion.recipe.prep_time_minutes;
        return prep !== null && prep <= max;
      });
    }

    if (filters.includeAlreadyPlanned === false) {
      result = result.filter((suggestion) => !planned.has(suggestion.recipe.id));
    }

    if (filters.onlyUseAvailableIngredients) {
      result = result.filter(
        (suggestion) =>
          (suggestion.recipe.ingredients?.length ?? 0) > 0 &&
          suggestion.missingIngredients.length === 0
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      const wanted = filters.tags;
      result = result.filter((suggestion) => {
        const tags = suggestion.recipe.tags ?? [];
        return wanted.some((tag) => tags.includes(tag));
      });
    }

    if (filters.prioritizeExpiringSoon) {
      result = [...result].sort((a, b) => {
        const aExpiring = a.expiringIngredientsUsed.length > 0 ? 1 : 0;
        const bExpiring = b.expiringIngredientsUsed.length > 0 ? 1 : 0;
        if (aExpiring !== bExpiring) {
          return bExpiring - aExpiring;
        }
        return b.score - a.score;
      });
    }

    return result;
  }
}
