import { Recipe } from '../../core/models/recipe.model';
import {
  DietaryPreference,
  UserAllergy,
  UserIngredientPreference,
} from '../../core/models/user-profile.model';
import { normalizeNameKey } from './name-normalization.utils';

const DIETARY_TAG_MAP: Partial<Record<DietaryPreference, string[]>> = {
  vegetarian: ['vegetarian', 'healthy'],
  vegan: ['vegan', 'healthy'],
  pescatarian: ['pescatarian', 'healthy'],
  high_protein: ['high-protein', 'healthy'],
  low_carb: ['low-carb', 'healthy'],
  gluten_free: ['gluten-free'],
  dairy_free: ['dairy-free'],
  mediterranean: ['mediterranean', 'healthy'],
  budget_friendly: ['cheap'],
  quick_meals: ['quick'],
  meal_prep_focused: ['meal-prep'],
};

export const PROFILE_SUGGESTION_SCORING = {
  favoriteIngredient: 8,
  dislikedIngredient: -12,
  dietaryMatch: 6,
} as const;

function getRecipeIngredientNames(recipe: Recipe): string[] {
  return (recipe.ingredients ?? []).map((ingredient) => normalizeNameKey(ingredient.name));
}

function ingredientMatches(name: string, target: string): boolean {
  return name.includes(target) || target.includes(name);
}

export function recipeContainsAllergen(recipe: Recipe, allergies: UserAllergy[]): boolean {
  if (allergies.length === 0) {
    return false;
  }
  const ingredientNames = getRecipeIngredientNames(recipe);
  return allergies.some((allergy) =>
    ingredientNames.some((name) => ingredientMatches(name, allergy.normalizedName))
  );
}

export function recipeContainsDisliked(
  recipe: Recipe,
  disliked: UserIngredientPreference[]
): boolean {
  if (disliked.length === 0) {
    return false;
  }
  const ingredientNames = getRecipeIngredientNames(recipe);
  return disliked.some((item) =>
    ingredientNames.some((name) => ingredientMatches(name, item.normalizedName))
  );
}

export function scoreFavoriteIngredientBoost(
  recipe: Recipe,
  favorites: UserIngredientPreference[]
): number {
  if (favorites.length === 0) {
    return 0;
  }
  const ingredientNames = getRecipeIngredientNames(recipe);
  let boost = 0;
  for (const favorite of favorites) {
    if (ingredientNames.some((name) => ingredientMatches(name, favorite.normalizedName))) {
      boost += PROFILE_SUGGESTION_SCORING.favoriteIngredient;
    }
  }
  return boost;
}

export function scoreDislikedIngredientPenalty(
  recipe: Recipe,
  disliked: UserIngredientPreference[]
): number {
  if (disliked.length === 0) {
    return 0;
  }
  const ingredientNames = getRecipeIngredientNames(recipe);
  let penalty = 0;
  for (const item of disliked) {
    if (ingredientNames.some((name) => ingredientMatches(name, item.normalizedName))) {
      penalty += PROFILE_SUGGESTION_SCORING.dislikedIngredient;
    }
  }
  return penalty;
}

export function scoreDietaryPreferenceBoost(
  recipe: Recipe,
  preferences: DietaryPreference[]
): number {
  const active = preferences.filter((preference) => preference !== 'none');
  if (active.length === 0) {
    return 0;
  }

  const recipeTags = new Set((recipe.tags ?? []).map((tag) => tag.toLowerCase()));
  let boost = 0;

  for (const preference of active) {
    const mappedTags = DIETARY_TAG_MAP[preference] ?? [];
    if (mappedTags.some((tag) => recipeTags.has(tag))) {
      boost += PROFILE_SUGGESTION_SCORING.dietaryMatch;
    }
  }

  return boost;
}

export function applyProfileScoring(
  baseScore: number,
  recipe: Recipe,
  options: {
    favorites: UserIngredientPreference[];
    disliked: UserIngredientPreference[];
    dietaryPreferences: DietaryPreference[];
  }
): number {
  return (
    baseScore +
    scoreFavoriteIngredientBoost(recipe, options.favorites) +
    scoreDislikedIngredientPenalty(recipe, options.disliked) +
    scoreDietaryPreferenceBoost(recipe, options.dietaryPreferences)
  );
}
