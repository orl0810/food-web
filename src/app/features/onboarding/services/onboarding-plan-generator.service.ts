import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { AiRecipeSuggestion } from '../../../core/models/ai-recipe-suggestion.model';
import { MealType } from '../../../core/models/meal-plan.model';
import { Recipe } from '../../../core/models/recipe.model';
import { AiRecipeService } from '../../../core/services/ai-recipe.service';
import { RecipeService } from '../../../core/services/recipe.service';
import {
  addDays,
  getCurrentWeekStartDate,
  getWeekDates,
} from '../../../shared/utils/meal-plan.utils';
import { getStarterRecipesForMealType } from '../../../shared/utils/onboarding-starter-recipes.utils';
import { buildSuggestion } from '../../../shared/utils/suggestion-scoring.utils';
import {
  applyProfileScoring,
  recipeContainsAllergen,
  recipeContainsDisliked,
} from '../../../shared/utils/user-profile-suggestion.utils';
import { normalizeNameKey } from '../../../shared/utils/name-normalization.utils';
import {
  CookingEffortPreference,
  GeneratedOnboardingMealPlan,
  GeneratedMealSlotItem,
  mealSlotToMealType,
  MealSlotType,
  OnboardingInventoryInput,
  OnboardingState,
  PendingOnboardingRecipe,
} from '../models/onboarding.model';

interface ScoredRecipe {
  recipe: Recipe | PendingOnboardingRecipe;
  score: number;
  isPending: boolean;
  mealType: MealType;
}

@Injectable({ providedIn: 'root' })
export class OnboardingPlanGeneratorService {
  private readonly recipeService = inject(RecipeService);
  private readonly aiRecipeService = inject(AiRecipeService);

  async generate(state: OnboardingState): Promise<GeneratedOnboardingMealPlan> {
    await this.recipeService.loadRecipes();
    const existingRecipes = this.recipeService.recipes();
    const weekStart = getCurrentWeekStartDate();
    const weekDates = getWeekDates(weekStart).slice(0, state.planningDays);
    const mealSlots = state.selectedMealSlots;
    const slotsPerDay = mealSlots.length;
    const totalSlots = weekDates.length * slotsPerDay;

    const cookingSessionCount = this.getCookingSessionCount(state.cookingEffort);
    const pool = await this.buildRecipePool(state, existingRecipes, mealSlots, totalSlots);

    const pendingRecipes: PendingOnboardingRecipe[] = pool
      .filter((item) => item.isPending)
      .map((item) => item.recipe as PendingOnboardingRecipe);

    const days = weekDates.map((date, dayIndex) => {
      const parsed = new Date(`${date}T00:00:00`);
      return {
        date,
        dayName: parsed.toLocaleDateString(undefined, { weekday: 'long' }),
        meals: mealSlots.map((slot) => {
          const mealType = mealSlotToMealType(slot);
          const recipe = this.pickRecipeForSlot(pool, slot, dayIndex, state.cookingEffort);
          const items: GeneratedMealSlotItem[] = [];

          if (recipe) {
            if (recipe.isPending) {
              const pending = recipe.recipe as PendingOnboardingRecipe;
              items.push({
                type: 'recipe',
                name: pending.title,
                tempRecipeKey: pending.tempKey,
                portionsUsed: 1,
              });
            } else {
              const existing = recipe.recipe as Recipe;
              items.push({
                type: 'recipe',
                name: existing.title,
                recipeId: existing.id,
                portionsUsed: 1,
              });
            }
          }

          const inventoryMatch = this.matchInventoryForSlot(
            state.availableInventoryItems,
            slot,
            dayIndex
          );
          if (inventoryMatch && items.length === 0) {
            items.push({
              type: 'inventoryItem',
              name: inventoryMatch.name,
              notes: 'Use from your kitchen',
            });
          }

          return { slot, items };
        }),
      };
    });

    const cookingDates = this.distributeCookingDates(weekDates, cookingSessionCount);
    const cookingSessions = cookingDates.map((date, index) => {
      const dayMeals = days.find((d) => d.date === date);
      const mealNames =
        dayMeals?.meals.flatMap((m) => m.items.map((i) => i.name)).filter(Boolean) ?? [];
      const batchCook = state.cookingEffort === 'batch_cooking' || cookingSessionCount <= 2;
      return {
        date,
        title: `Cooking session ${index + 1}`,
        estimatedMinutes: batchCook ? 60 : 40,
        tasks: [
          {
            title: batchCook ? 'Batch cook main meals' : 'Prepare today\'s meals',
            relatedMealNames: mealNames.slice(0, 4),
            createsPreparedPortions: batchCook,
            portionsCreated: batchCook ? 2 : undefined,
          },
        ],
      };
    });

    const preparedPortionSuggestions =
      state.cookingEffort === 'batch_cooking' || state.cookingEffort === 'minimal_cooking'
        ? cookingSessions.slice(0, 2).map((session, i) => ({
            name: session.tasks[0]?.relatedMealNames?.[0] ?? `Batch meal ${i + 1}`,
            portions: 2,
            usedOnDays: weekDates.slice(i + 1, i + 3).map((d) => {
              const parsed = new Date(`${d}T00:00:00`);
              return parsed.toLocaleDateString(undefined, { weekday: 'short' });
            }),
            storageLocation: 'fridge' as const,
          }))
        : [];

    const shoppingListItems = this.buildShoppingList(days, pool, state.availableInventoryItems);
    const mealsPlanned = days.reduce(
      (sum, day) => sum + day.meals.filter((m) => m.items.length > 0).length,
      0
    );

    const firstCook = cookingSessions[0];
    const firstSmartAction = {
      title: firstCook
        ? `Today's focus: ${firstCook.tasks[0]?.title ?? 'Start cooking'}`
        : 'Your meal plan is ready',
      description: firstCook?.tasks[0]?.relatedMealNames?.length
        ? `Cook ${firstCook.tasks[0].relatedMealNames.join(', ')}. Save portions for later this week.`
        : 'Open your meal plan and start with today\'s meals.',
      ctaLabel: 'View meal plan',
      route: '/meal-plan',
      priority: 'high' as const,
    };

    return {
      weekStartDate: weekStart,
      days,
      shoppingListItems,
      preparedPortionSuggestions,
      cookingSessions,
      pendingRecipes,
      summary: {
        mealsPlanned,
        cookingSessions: cookingSessions.length,
        estimatedTimeSavedMinutes: Math.max(30, mealsPlanned * 12),
        inventoryItemsUsed: state.availableInventoryItems.length,
        generatedAt: new Date().toISOString(),
      },
      firstSmartAction,
    };
  }

  private async buildRecipePool(
    state: OnboardingState,
    existingRecipes: Recipe[],
    mealSlots: MealSlotType[],
    totalSlots: number
  ): Promise<ScoredRecipe[]> {
    const allergies = state.allergies.map((a) => ({
      id: '',
      name: a,
      normalizedName: normalizeNameKey(a),
      strictExclusion: true as const,
    }));
    const disliked = state.dislikedIngredients.map((name) => ({
      id: '',
      ingredientName: name,
      normalizedName: normalizeNameKey(name),
      source: 'manual' as const,
    }));

    const pool: ScoredRecipe[] = [];
    const inventoryNames = state.availableInventoryItems.map((i) => i.name);

    for (const slot of mealSlots) {
      const mealType = mealSlotToMealType(slot);
      const scoredExisting = existingRecipes
        .filter((recipe) => !recipeContainsAllergen(recipe, allergies))
        .filter((recipe) => !recipeContainsDisliked(recipe, disliked))
        .map((recipe) => {
          let score = buildSuggestion(recipe, [], new Set()).score;
          score = applyProfileScoring(score, recipe, {
            favorites: [],
            disliked,
            dietaryPreferences: state.dietaryPreferences,
          });
          if (state.goals.includes('use_existing_ingredients')) {
            const usesInventory = (recipe.ingredients ?? []).some((ing) =>
              inventoryNames.some(
                (n) => normalizeNameKey(n) === normalizeNameKey(ing.name)
              )
            );
            if (usesInventory) score += 15;
          }
          if (state.goals.includes('save_time') || state.dietaryPreferences.includes('quick_meals')) {
            if ((recipe.prep_time_minutes ?? 60) <= 30) score += 10;
          }
          if (state.cookingEffort === 'batch_cooking' && recipe.tags?.includes('meal-prep')) {
            score += 12;
          }
          return { recipe, score, isPending: false, mealType };
        })
        .sort((a, b) => b.score - a.score);

      pool.push(...scoredExisting.slice(0, 3));

      const needed = Math.max(1, Math.ceil(totalSlots / mealSlots.length / 2));
      const existingForSlot = scoredExisting.length;
      if (existingForSlot < needed) {
        const gap = needed - existingForSlot;
        const aiRecipes = await this.fetchAiRecipes(state, mealType, gap);
        const pending =
          aiRecipes.length > 0
            ? aiRecipes.map((s, i) => this.aiToPending(s, mealType, i))
            : getStarterRecipesForMealType(mealType, gap, pool.length);

        for (const p of pending) {
          pool.push({ recipe: p, score: 50, isPending: true, mealType });
        }
      }
    }

    if (pool.length === 0) {
      for (const slot of mealSlots) {
        const mealType = mealSlotToMealType(slot);
        const starters = getStarterRecipesForMealType(mealType, 2, 0);
        for (const s of starters) {
          pool.push({ recipe: s, score: 40, isPending: true, mealType });
        }
      }
    }

    return pool;
  }

  private async fetchAiRecipes(
    state: OnboardingState,
    mealType: MealType,
    count: number
  ): Promise<AiRecipeSuggestion[]> {
    if (environment.useLocalApi) {
      return [];
    }

    const maxPrep =
      state.goals.includes('save_time') || state.dietaryPreferences.includes('quick_meals')
        ? 25
        : 35;

    const response = await this.aiRecipeService.generateRecipesFromInventory({
      mealType,
      maxPrepTimeMinutes: maxPrep,
      prioritizeExpiringIngredients: state.goals.includes('reduce_food_waste'),
      includeMissingIngredients: true,
      numberOfSuggestions: Math.min(count, 3),
      onboardingContext: {
        dietaryPreferences: state.dietaryPreferences,
        allergies: state.allergies,
        dislikedIngredients: state.dislikedIngredients,
        goals: state.goals,
        cookingEffort: state.cookingEffort,
        extraInventory: state.availableInventoryItems.map((i) => i.name),
      },
    });

    return response.suggestions.filter(
      (s) =>
        !state.allergies.some((a) =>
          (s.ingredients ?? []).some((ing) =>
            normalizeNameKey(ing.name).includes(normalizeNameKey(a))
          )
        )
    );
  }

  private aiToPending(
    suggestion: AiRecipeSuggestion,
    mealType: MealType,
    index: number
  ): PendingOnboardingRecipe {
    return {
      tempKey: `ai-${mealType}-${index}-${normalizeNameKey(suggestion.title)}`,
      source: 'ai',
      title: suggestion.title,
      description: suggestion.description,
      prepTimeMinutes: suggestion.prepTimeMinutes,
      portions: suggestion.portions,
      tags: suggestion.tags,
      ingredients: suggestion.ingredients,
      steps: suggestion.steps,
    };
  }

  private pickRecipeForSlot(
    pool: ScoredRecipe[],
    slot: MealSlotType,
    dayIndex: number,
    effort: CookingEffortPreference
  ): ScoredRecipe | null {
    const mealType = mealSlotToMealType(slot);
    const candidates = pool.filter((p) => p.mealType === mealType);
    if (candidates.length === 0) {
      const fallback = pool[dayIndex % pool.length];
      return fallback ?? null;
    }

    const repeatIndex =
      effort === 'batch_cooking' || effort === 'minimal_cooking'
        ? Math.floor(dayIndex / 2) % candidates.length
        : dayIndex % candidates.length;

    return candidates[repeatIndex] ?? candidates[0];
  }

  private matchInventoryForSlot(
    inventory: OnboardingInventoryInput[],
    slot: MealSlotType,
    dayIndex: number
  ): OnboardingInventoryInput | null {
    if (inventory.length === 0) return null;
    if (slot === 'breakfast' && dayIndex % 3 === 0) {
      return inventory.find((i) => /egg|yogurt|bread/i.test(i.name)) ?? inventory[0];
    }
    return null;
  }

  private getCookingSessionCount(effort: CookingEffortPreference): number {
    switch (effort) {
      case 'minimal_cooking':
        return 1;
      case 'two_cooking_sessions':
        return 2;
      case 'three_cooking_sessions':
        return 3;
      case 'daily_cooking':
        return 5;
      case 'batch_cooking':
        return 2;
      default:
        return 2;
    }
  }

  private distributeCookingDates(dates: string[], sessionCount: number): string[] {
    if (dates.length === 0) return [];
    const step = Math.max(1, Math.floor(dates.length / sessionCount));
    const result: string[] = [];
    for (let i = 0; i < sessionCount && i * step < dates.length; i++) {
      result.push(dates[Math.min(i * step, dates.length - 1)]);
    }
    return result.length > 0 ? result : [dates[0]];
  }

  private buildShoppingList(
    days: GeneratedOnboardingMealPlan['days'],
    pool: ScoredRecipe[],
    inventory: OnboardingInventoryInput[]
  ) {
    const inventoryKeys = new Set(inventory.map((i) => normalizeNameKey(i.name)));
    const items = new Map<string, { name: string; quantity: number | null; unit: string | null }>();

    for (const day of days) {
      for (const meal of day.meals) {
        for (const item of meal.items) {
          if (item.type !== 'recipe') continue;
          let recipe: PendingOnboardingRecipe | Recipe | undefined;
          if (item.tempRecipeKey) {
            recipe = pool.find(
              (p) => p.isPending && (p.recipe as PendingOnboardingRecipe).tempKey === item.tempRecipeKey
            )?.recipe as PendingOnboardingRecipe;
          } else if (item.recipeId) {
            recipe = pool.find(
              (p) => !p.isPending && (p.recipe as Recipe).id === item.recipeId
            )?.recipe as Recipe;
          }
          if (!recipe) continue;
          const ingredients =
            'ingredients' in recipe && recipe.ingredients
              ? recipe.ingredients
              : (recipe as Recipe).ingredients ?? [];
          for (const ing of ingredients) {
            const key = normalizeNameKey(ing.name);
            if (inventoryKeys.has(key) || items.has(key)) continue;
            items.set(key, {
              name: ing.name,
              quantity: ing.quantity ?? null,
              unit: ing.unit ?? null,
            });
          }
        }
      }
    }

    return [...items.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
