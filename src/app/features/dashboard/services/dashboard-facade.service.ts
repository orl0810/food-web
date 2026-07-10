import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FoodInventoryService } from '../../../core/services/food-inventory.service';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { PreparedPortionService } from '../../../core/services/prepared-portion.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { ShoppingListService } from '../../../core/services/shopping-list.service';
import { SmartSuggestionService } from '../../../core/services/smart-suggestion.service';
import { normalizeNameKey } from '../../../shared/utils/name-normalization.utils';
import {
  ActionCompletionPayload,
  DashboardAction,
  InventoryDeduction,
} from '../models/dashboard-action.model';
import { DashboardActionEngineService } from './dashboard-action-engine.service';
import { UserProfileFacadeService } from '../../user-profile/services/user-profile-facade.service';
import { toISODate } from '../../../shared/utils/meal-plan.utils';

const DISMISSED_STORAGE_KEY = 'pantryflow.smartAction.dismissed';
const SUCCESS_MESSAGE_MS = 4000;

interface DismissedState {
  date: string;
  ids: string[];
}

@Injectable({ providedIn: 'root' })
export class DashboardFacadeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly actionEngine = inject(DashboardActionEngineService);
  private readonly inventoryService = inject(FoodInventoryService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly preparedPortionService = inject(PreparedPortionService);
  private readonly recipeService = inject(RecipeService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly suggestionService = inject(SmartSuggestionService);
  private readonly profileFacade = inject(UserProfileFacadeService);

  private readonly dismissedIdsSignal = signal<string[]>(this.loadDismissedIds());
  private readonly completingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly successMessageSignal = signal<string | null>(null);
  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly completing = this.completingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly successMessage = this.successMessageSignal.asReadonly();

  /** The single best action for the user right now, or null when all set. */
  readonly currentSmartAction = computed<DashboardAction | null>(() => {
    const dismissed = new Set(this.dismissedIdsSignal());
    const todayISO = toISODate();
    const profile = this.profileFacade.profile();

    if (profile?.onboardingFirstSmartAction && profile.onboardingStatus === 'completed') {
      const stored = profile.onboardingFirstSmartAction;
      const starterAction: DashboardAction = {
        id: `onboarding_starter_action:stored:${todayISO}`,
        type: 'onboarding_starter_action',
        priority:
          stored.priority === 'high'
            ? 'high'
            : stored.priority === 'medium'
              ? 'medium'
              : 'low',
        title: stored.title,
        message: stored.description,
        chips: ['meal-plan'],
        primaryLabel: stored.ctaLabel ?? 'View meal plan',
        primaryKind: 'navigate',
        primaryRoute: stored.route ?? '/meal-plan',
      };
      if (!dismissed.has(starterAction.id)) {
        return starterAction;
      }
    }

    const weekItems = this.mealPlanService.weekSlotItems();
    const hasPlannedMeals = [...weekItems.values()].some((items) => items.length > 0);
    if (profile?.onboardingStatus === 'skipped' && !hasPlannedMeals) {
      const skipAction: DashboardAction = {
        id: `create_first_meal_plan:${todayISO}`,
        type: 'create_first_meal_plan',
        priority: 'low',
        title: 'Create your first meal plan',
        message: 'Start quick planning to get a useful weekly plan in minutes.',
        chips: ['meal-plan'],
        primaryLabel: 'Start quick planning',
        primaryKind: 'navigate',
        primaryRoute: '/onboarding?restart=true',
      };
      if (!dismissed.has(skipAction.id)) {
        return skipAction;
      }
    }

    return (
      this.actionEngine.actions().find((action) => !dismissed.has(action.id)) ?? null
    );
  });

  async loadDashboardData(): Promise<void> {
    await Promise.all([
      this.mealPlanService.getTodayMeals(),
      this.mealPlanService.getMealPlanForWeek(this.mealPlanService.weekStart()),
      this.mealPlanService.loadRecentRecipeHistory(),
      this.preparedPortionService.loadPortions(),
      this.suggestionService.refresh(),
      this.shoppingListService.getShoppingItems(),
      this.profileFacade.loadAll(),
    ]);
  }

  dismiss(action: DashboardAction): void {
    this.markActionHandled(action.id);
  }

  /**
   * Builds the editable confirmation draft for a 'complete' action:
   * which slot to update, which inventory lines to reduce, which portion to use.
   */
  buildCompletionDraft(action: DashboardAction): ActionCompletionPayload {
    const draft: ActionCompletionPayload = {};

    if (action.relatedSlotItemId) {
      draft.slotItemId = action.relatedSlotItemId;
      draft.slotStatus = action.type === 'use_prepared_portion' ? 'eaten' : 'prepared';
    }

    if (action.type === 'cook_recipe_today' && action.relatedRecipeId) {
      draft.inventoryDeductions = this.buildRecipeDeductions(action.relatedRecipeId);
    }

    if (action.type === 'use_expiring_inventory' && action.relatedInventoryItemIds?.length) {
      draft.inventoryDeductions = this.buildItemDeductions(action.relatedInventoryItemIds);
    }

    // Portions linked to a meal slot were already reserved when planned,
    // so only standalone portion actions consume portions here.
    if (action.relatedPortionId && !action.relatedSlotItemId) {
      const portion = this.preparedPortionService.getPortionById(action.relatedPortionId);
      if (portion) {
        draft.portionId = portion.id;
        draft.portionName = portion.name;
        draft.portionsAvailable = portion.available_portions;
        draft.portionsUsed = 1;
      }
    }

    return draft;
  }

  async completeAction(
    action: DashboardAction,
    payload: ActionCompletionPayload
  ): Promise<{ error: string | null }> {
    this.completingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (payload.slotItemId && payload.slotStatus) {
        const { error } = await this.mealPlanService.updateSlotItemStatus(
          payload.slotItemId,
          payload.slotStatus
        );
        if (error) {
          return this.fail(error);
        }
      }

      for (const deduction of payload.inventoryDeductions ?? []) {
        if (deduction.quantityUsed <= 0) {
          continue;
        }
        const remaining = deduction.available - deduction.quantityUsed;
        const { error } =
          remaining > 0
            ? await this.inventoryService.updateItem(deduction.itemId, {
                quantity: remaining,
              })
            : await this.inventoryService.deleteItem(deduction.itemId);
        if (error) {
          return this.fail(error);
        }
      }

      if (payload.portionId && (payload.portionsUsed ?? 0) > 0) {
        const { error } = await this.preparedPortionService.markAsEaten(
          payload.portionId,
          payload.portionsUsed ?? 1
        );
        if (error) {
          return this.fail(error);
        }
      }

      this.markActionHandled(action.id);
      this.showSuccess('Nice! Your plan is updated.');
      return { error: null };
    } finally {
      this.completingSignal.set(false);
    }
  }

  clearSuccess(): void {
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
      this.successTimeout = null;
    }
    this.successMessageSignal.set(null);
  }

  private fail(message: string): { error: string | null } {
    this.errorSignal.set(message);
    return { error: message };
  }

  private showSuccess(message: string): void {
    this.clearSuccess();
    this.successMessageSignal.set(message);
    this.successTimeout = setTimeout(() => {
      this.successMessageSignal.set(null);
      this.successTimeout = null;
    }, SUCCESS_MESSAGE_MS);
  }

  private buildRecipeDeductions(recipeId: string): InventoryDeduction[] {
    const recipe = this.recipeService.recipes().find((r) => r.id === recipeId);
    if (!recipe?.ingredients?.length) {
      return [];
    }

    const inventory = this.inventoryService.items();
    const deductions: InventoryDeduction[] = [];

    for (const ingredient of recipe.ingredients) {
      const key = normalizeNameKey(ingredient.name);
      const item = inventory.find((entry) => normalizeNameKey(entry.name) === key);
      if (!item || item.quantity <= 0) {
        continue;
      }

      const sameUnit =
        !ingredient.unit ||
        !item.unit ||
        normalizeNameKey(ingredient.unit) === normalizeNameKey(item.unit);
      const wanted = sameUnit && ingredient.quantity != null ? ingredient.quantity : 1;

      deductions.push({
        itemId: item.id,
        name: item.name,
        available: item.quantity,
        quantityUsed: Math.min(wanted, item.quantity),
        unit: item.unit,
      });
    }

    return deductions;
  }

  private buildItemDeductions(itemIds: string[]): InventoryDeduction[] {
    const inventory = this.inventoryService.items();
    return itemIds
      .map((id) => inventory.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => !!item && item.quantity > 0)
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        available: item.quantity,
        quantityUsed: item.quantity,
        unit: item.unit,
      }));
  }

  private markActionHandled(actionId: string): void {
    this.dismissedIdsSignal.update((ids) =>
      ids.includes(actionId) ? ids : [...ids, actionId]
    );
    this.persistDismissedIds();
  }

  private loadDismissedIds(): string[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    try {
      const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const state = JSON.parse(raw) as DismissedState;
      if (state.date !== toISODate(new Date())) {
        localStorage.removeItem(DISMISSED_STORAGE_KEY);
        return [];
      }
      return Array.isArray(state.ids) ? state.ids : [];
    } catch {
      return [];
    }
  }

  private persistDismissedIds(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const state: DismissedState = {
      date: toISODate(new Date()),
      ids: this.dismissedIdsSignal(),
    };
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode) — dismissals just won't persist.
    }
  }
}
