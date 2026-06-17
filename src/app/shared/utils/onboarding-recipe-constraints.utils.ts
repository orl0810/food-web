import { DietaryPreference } from '../../core/models/user-profile.model';
import { OnboardingState } from '../../features/onboarding/models/onboarding.model';
import { normalizeNameKey } from './name-normalization.utils';

export interface RecipeIngredientLike {
  name: string;
}

const MEAT_INGREDIENTS = [
  'chicken',
  'beef',
  'pork',
  'lamb',
  'turkey',
  'bacon',
  'sausage',
  'ham',
];

const FISH_INGREDIENTS = ['tuna', 'salmon', 'fish', 'shrimp', 'shellfish', 'cod', 'sardine'];

const DAIRY_INGREDIENTS = [
  'milk',
  'cheese',
  'yogurt',
  'butter',
  'cream',
  'dairy',
  'mozzarella',
  'parmesan',
];

const ANIMAL_INGREDIENTS = [
  ...MEAT_INGREDIENTS,
  ...FISH_INGREDIENTS,
  ...DAIRY_INGREDIENTS,
  'egg',
  'eggs',
  'honey',
];

const GLUTEN_INGREDIENTS = [
  'wheat',
  'bread',
  'pasta',
  'couscous',
  'flour',
  'noodle',
  'barley',
  'rye',
  'tortilla',
];

function getIngredientNames(ingredients: RecipeIngredientLike[]): string[] {
  return ingredients.map((ingredient) => normalizeNameKey(ingredient.name));
}

function ingredientMatchesAny(name: string, targets: string[]): boolean {
  return targets.some(
    (target) => name.includes(normalizeNameKey(target)) || normalizeNameKey(target).includes(name)
  );
}

function ingredientsMatchAny(
  ingredients: RecipeIngredientLike[],
  targets: string[]
): boolean {
  const names = getIngredientNames(ingredients);
  return names.some((name) => ingredientMatchesAny(name, targets));
}

function violatesDietaryPreference(
  ingredients: RecipeIngredientLike[],
  preferences: DietaryPreference[]
): boolean {
  const active = preferences.filter((preference) => preference !== 'none' && preference !== 'flexitarian');
  if (active.length === 0) {
    return false;
  }

  for (const preference of active) {
    switch (preference) {
      case 'vegetarian':
        if (ingredientsMatchAny(ingredients, [...MEAT_INGREDIENTS, ...FISH_INGREDIENTS])) {
          return true;
        }
        break;
      case 'vegan':
        if (ingredientsMatchAny(ingredients, ANIMAL_INGREDIENTS)) {
          return true;
        }
        break;
      case 'pescatarian':
        if (ingredientsMatchAny(ingredients, MEAT_INGREDIENTS)) {
          return true;
        }
        break;
      case 'gluten_free':
        if (ingredientsMatchAny(ingredients, GLUTEN_INGREDIENTS)) {
          return true;
        }
        break;
      case 'dairy_free':
        if (ingredientsMatchAny(ingredients, DAIRY_INGREDIENTS)) {
          return true;
        }
        break;
      default:
        break;
    }
  }

  return false;
}

export function recipeViolatesOnboardingConstraints(
  ingredients: RecipeIngredientLike[],
  state: OnboardingState
): boolean {
  const allergyKeys = state.allergies.map((allergy) => normalizeNameKey(allergy));
  const dislikedKeys = state.dislikedIngredients.map((name) => normalizeNameKey(name));
  const names = getIngredientNames(ingredients);

  if (
    allergyKeys.some((allergy) =>
      names.some((name) => name.includes(allergy) || allergy.includes(name))
    )
  ) {
    return true;
  }

  if (
    dislikedKeys.some((disliked) =>
      names.some((name) => name.includes(disliked) || disliked.includes(name))
    )
  ) {
    return true;
  }

  return violatesDietaryPreference(ingredients, state.dietaryPreferences);
}
