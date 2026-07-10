import { isPlatformBrowser } from '@angular/common';
import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { FoodItem } from '../models/food-item.model';
import { Recipe } from '../models/recipe.model';
import {
  SmartSuggestion,
  SuggestionFilters,
} from '../models/smart-suggestion.model';
import {
  applyDailyFeatured,
  dailyFeaturedStatesEqual,
  DAILY_FEATURED_STORAGE_KEY,
  DailyFeaturedState,
  isDailyFeaturedState,
  resolveDailyFeatured,
} from '../../shared/utils/daily-featured-suggestion.utils';
import {
  getCurrentWeekEndDate,
  getCurrentWeekStartDate,
  toISODate,
} from '../../shared/utils/meal-plan.utils';
import { buildSuggestion } from '../../shared/utils/suggestion-scoring.utils';
import {
  applyProfileScoring,
  recipeContainsAllergen,
} from '../../shared/utils/user-profile-suggestion.utils';
import { UserProfileFacadeService } from '../../features/user-profile/services/user-profile-facade.service';
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
  private readonly profileFacade = inject(UserProfileFacadeService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly plannedRecipeIdsSignal = signal<Set<string>>(new Set());
  private readonly dailyFeaturedState = signal<DailyFeaturedState | null>(this.loadDailyFeaturedState());

  readonly plannedRecipeIds = this.plannedRecipeIdsSignal.asReadonly();

  readonly dailySuggestions = computed(() =>
    applyDailyFeatured(this.allSuggestions(), this.dailyFeaturedState()?.recipeId ?? null)
  );

  constructor() {
    effect(() => {
      const suggestions = this.allSuggestions();
      if (suggestions.length === 0) {
        return;
      }

      const resolved = resolveDailyFeatured(
        suggestions,
        this.dailyFeaturedState(),
        toISODate(new Date())
      );

      if (!resolved || dailyFeaturedStatesEqual(this.dailyFeaturedState(), resolved)) {
        return;
      }

      this.dailyFeaturedState.set(resolved);
      this.persistDailyFeaturedState(resolved);
    });
  }

  readonly allSuggestions = computed(() => {
    const recipes = this.recipeService.recipes();
    const inventory = this.foodInventoryService.items();
    const planned = this.plannedRecipeIdsSignal();
    const profile = this.profileFacade.getProfileForSuggestions();

    const suggestions = recipes
      .map((recipe) => buildSuggestion(recipe, inventory, planned))
      .filter((suggestion) => {
        if (!profile?.allergies.length) {
          return true;
        }
        return !recipeContainsAllergen(suggestion.recipe, profile.allergies);
      })
      .map((suggestion) => {
        if (!profile) {
          return suggestion;
        }
        return {
          ...suggestion,
          score: applyProfileScoring(suggestion.score, suggestion.recipe, {
            favorites: profile.favoriteIngredients,
            disliked: profile.dislikedIngredients,
            dietaryPreferences: profile.dietaryPreferences,
          }),
        };
      });

    return this.sortSuggestionsByScore(suggestions);
  });

  async refresh(): Promise<void> {
    await Promise.all([
      this.foodInventoryService.loadItems(),
      this.recipeService.loadRecipes(),
      this.loadPlannedRecipeIds(),
      this.profileFacade.loadAll(),
    ]);
  }

  async loadPlannedRecipeIds(): Promise<void> {
    const entries = await this.mealPlanService.fetchMealPlanForDateRange(
      getCurrentWeekStartDate(),
      getCurrentWeekEndDate()
    );

    const ids = new Set<string>();
    for (const entry of entries) {
      if (entry.item_type === 'recipe' && entry.recipe_id) {
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
    const suggestions = filters ? this.allSuggestions() : this.dailySuggestions();
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

  private loadDailyFeaturedState(): DailyFeaturedState | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const raw = localStorage.getItem(DAILY_FEATURED_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);
      return isDailyFeaturedState(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private persistDailyFeaturedState(state: DailyFeaturedState): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      localStorage.setItem(DAILY_FEATURED_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode) — featured pick just won't persist.
    }
  }
}
