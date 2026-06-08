import { FoodItem } from '../../core/models/food-item.model';
import { Recipe, RecipeIngredient } from '../../core/models/recipe.model';
import {
  RecipeDifficulty,
  SmartSuggestion,
  SmartSuggestionType,
  SuggestedIngredientMatch,
  SuggestionScoreBreakdown,
} from '../../core/models/smart-suggestion.model';
import { getDaysUntilExpiration } from './expiration.utils';
import { findMatchingInventoryItem } from './ingredient-matching.utils';

export const SUGGESTION_SCORING = {
  availableIngredient: 10,
  missingIngredient: -5,
  expiring: {
    today: 25,
    withinOneDay: 20,
    withinThreeDays: 15,
    withinFiveDays: 10,
  },
  prepTime: {
    under15: 10,
    under30: 7,
    under45: 3,
  },
  tags: {
    quick: 10,
    'meal-prep': 10,
    cheap: 7,
    healthy: 5,
  } as Record<string, number>,
  alreadyPlanned: -15,
  missingCount: {
    zero: 15,
    one: 10,
    two: 5,
  },
} as const;

const EXPIRING_SOON_DAYS = 5;

function expiringBonus(daysUntilExpiration: number): number {
  if (daysUntilExpiration <= 0) {
    return SUGGESTION_SCORING.expiring.today;
  }
  if (daysUntilExpiration <= 1) {
    return SUGGESTION_SCORING.expiring.withinOneDay;
  }
  if (daysUntilExpiration <= 3) {
    return SUGGESTION_SCORING.expiring.withinThreeDays;
  }
  if (daysUntilExpiration <= EXPIRING_SOON_DAYS) {
    return SUGGESTION_SCORING.expiring.withinFiveDays;
  }
  return 0;
}

function prepTimeBonus(prepTime: number | null): number {
  if (prepTime === null) {
    return 0;
  }
  if (prepTime <= 15) {
    return SUGGESTION_SCORING.prepTime.under15;
  }
  if (prepTime <= 30) {
    return SUGGESTION_SCORING.prepTime.under30;
  }
  if (prepTime <= 45) {
    return SUGGESTION_SCORING.prepTime.under45;
  }
  return 0;
}

function missingCountBonus(missingCount: number): number {
  if (missingCount === 0) {
    return SUGGESTION_SCORING.missingCount.zero;
  }
  if (missingCount === 1) {
    return SUGGESTION_SCORING.missingCount.one;
  }
  if (missingCount === 2) {
    return SUGGESTION_SCORING.missingCount.two;
  }
  return 0;
}

const TIME_SCORE_MAX_MINUTES = 60;
const VARIETY_TARGET_TAGS = 3;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function deriveDifficulty(prepTime: number | null): RecipeDifficulty | null {
  if (prepTime === null) {
    return null;
  }
  if (prepTime <= 15) {
    return 'Easy';
  }
  if (prepTime <= 40) {
    return 'Medium';
  }
  return 'Hard';
}

function timeScore(prepTime: number | null): number {
  if (prepTime === null) {
    return 0;
  }
  return clampPercent((1 - prepTime / TIME_SCORE_MAX_MINUTES) * 100);
}

function expiringScore(soonestDaysUntilExpiration: number | null): number {
  if (soonestDaysUntilExpiration === null) {
    return 0;
  }
  return clampPercent((expiringBonus(soonestDaysUntilExpiration) / SUGGESTION_SCORING.expiring.today) * 100);
}

function varietyScore(tagCount: number): number {
  return clampPercent((tagCount / VARIETY_TARGET_TAGS) * 100);
}

function expiringLabel(days: number): string {
  if (days <= 0) {
    return 'expiring today';
  }
  if (days === 1) {
    return 'expiring tomorrow';
  }
  return `expiring in ${days} days`;
}

function determineSuggestionType(
  expiringUsed: SuggestedIngredientMatch[],
  available: SuggestedIngredientMatch[],
  missing: RecipeIngredient[],
  recipe: Recipe
): SmartSuggestionType {
  const tags = recipe.tags ?? [];
  const isQuick = tags.includes('quick') || (recipe.prep_time_minutes ?? Infinity) <= 15;

  if (expiringUsed.length > 0) {
    return 'use_expiring_soon';
  }
  if (missing.length === 0 && available.length > 0) {
    return 'cook_with_available_items';
  }
  if (isQuick) {
    return 'quick_meal';
  }
  if (tags.includes('meal-prep')) {
    return 'meal_prep';
  }
  if (missing.length <= 2 && available.length > 0) {
    return 'low_missing_ingredients';
  }
  return 'not_planned_this_week';
}

export function buildSuggestion(
  recipe: Recipe,
  inventoryItems: FoodItem[],
  plannedRecipeIds: Set<string>
): SmartSuggestion {
  const ingredients = recipe.ingredients ?? [];

  const availableIngredients: SuggestedIngredientMatch[] = [];
  const missingIngredients: RecipeIngredient[] = [];
  const expiringIngredientsUsed: SuggestedIngredientMatch[] = [];
  const reasons: string[] = [];

  let score = 0;

  for (const ingredient of ingredients) {
    const match = findMatchingInventoryItem(ingredient, inventoryItems);

    if (!match) {
      missingIngredients.push(ingredient);
      score += SUGGESTION_SCORING.missingIngredient;
      continue;
    }

    const daysUntilExpiration = getDaysUntilExpiration(match.expiration_date);
    const suggestedMatch: SuggestedIngredientMatch = {
      recipeIngredientName: ingredient.name,
      inventoryFoodId: match.id,
      inventoryFoodName: match.name,
      expirationDate: match.expiration_date,
      daysUntilExpiration,
    };

    availableIngredients.push(suggestedMatch);
    score += SUGGESTION_SCORING.availableIngredient;

    if (
      daysUntilExpiration !== null &&
      daysUntilExpiration >= 0 &&
      daysUntilExpiration <= EXPIRING_SOON_DAYS
    ) {
      expiringIngredientsUsed.push(suggestedMatch);
      score += expiringBonus(daysUntilExpiration);
    }
  }

  const prepBonus = prepTimeBonus(recipe.prep_time_minutes);
  score += prepBonus;

  const tags = recipe.tags ?? [];
  for (const tag of tags) {
    score += SUGGESTION_SCORING.tags[tag] ?? 0;
  }

  const isPlanned = plannedRecipeIds.has(recipe.id);
  if (isPlanned) {
    score += SUGGESTION_SCORING.alreadyPlanned;
  }

  if (ingredients.length > 0) {
    score += missingCountBonus(missingIngredients.length);
  }

  const total = ingredients.length;
  const matchPercentage =
    total === 0 ? 0 : Math.round((availableIngredients.length / total) * 100);

  if (expiringIngredientsUsed.length > 0) {
    const soonest = [...expiringIngredientsUsed].sort(
      (a, b) => (a.daysUntilExpiration ?? 0) - (b.daysUntilExpiration ?? 0)
    )[0];
    reasons.push(
      `Uses ${soonest.inventoryFoodName} ${expiringLabel(soonest.daysUntilExpiration ?? 0)}`
    );
  }

  if (total > 0 && missingIngredients.length === 0) {
    reasons.push('You have all ingredients');
  } else if (availableIngredients.length > 0) {
    reasons.push(
      `${availableIngredients.length} of ${total} ingredients ready`
    );
  }

  if (missingIngredients.length > 0 && missingIngredients.length <= 2) {
    reasons.push(
      missingIngredients.length === 1
        ? 'Only 1 item missing'
        : 'Only 2 items missing'
    );
  }

  if ((recipe.prep_time_minutes ?? Infinity) <= 15 || tags.includes('quick')) {
    reasons.push('Quick to make');
  }
  if (tags.includes('meal-prep')) {
    reasons.push('Great for meal prep');
  }
  if (tags.includes('cheap')) {
    reasons.push('Budget-friendly');
  }
  if (tags.includes('healthy')) {
    reasons.push('Healthy choice');
  }

  if (isPlanned) {
    reasons.push('Already planned this week');
  }

  const soonestExpiringDays =
    expiringIngredientsUsed.length > 0
      ? Math.min(
          ...expiringIngredientsUsed.map((match) => match.daysUntilExpiration ?? 0)
        )
      : null;

  const scoreBreakdown: SuggestionScoreBreakdown = {
    inventory: matchPercentage,
    expiring: expiringScore(soonestExpiringDays),
    time: timeScore(recipe.prep_time_minutes),
    variety: varietyScore(tags.length),
  };

  const difficulty = deriveDifficulty(recipe.prep_time_minutes);

  const suggestionType = determineSuggestionType(
    expiringIngredientsUsed,
    availableIngredients,
    missingIngredients,
    recipe
  );

  return {
    recipe,
    score,
    matchPercentage,
    difficulty,
    scoreBreakdown,
    availableIngredients,
    missingIngredients,
    expiringIngredientsUsed,
    reasons,
    suggestionType,
  };
}
