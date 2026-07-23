import { MealType } from '../../core/models/meal-plan.model';
import { DietaryPreference } from '../../core/models/user-profile.model';
import {
  OnboardingState,
  PendingOnboardingRecipe,
} from '../../features/onboarding/models/onboarding.model';
import { recipeViolatesOnboardingConstraints } from './onboarding-recipe-constraints.utils';
import { normalizeNameKey } from './name-normalization.utils';

interface MockRecipeTemplate {
  title: string;
  description: string;
  prepTimeMinutes: number;
  portions: number;
  tags: string[];
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  steps: string[];
  dietCategories: DietCategory[];
  mealTypes: MealType[];
}

type DietCategory = 'meat' | 'fish' | 'dairy' | 'vegetarian' | 'vegan';

const MOCK_TEMPLATES: MockRecipeTemplate[] = [
  {
    title: 'Quick Veggie Pasta',
    description: 'Simple pasta with vegetables and olive oil.',
    prepTimeMinutes: 20,
    portions: 4,
    tags: ['quick', 'cheap', 'vegetarian'],
    ingredients: [
      { name: 'Pasta', quantity: 400, unit: 'g' },
      { name: 'Bell peppers', quantity: 2, unit: 'cups' },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'Garlic', quantity: 2, unit: 'cloves' },
    ],
    steps: ['Boil pasta.', 'Sauté peppers with garlic.', 'Toss together and serve.'],
    dietCategories: ['vegetarian', 'dairy'],
    mealTypes: ['lunch', 'dinner'],
  },
  {
    title: 'Rice and Chicken Bowl',
    description: 'Protein bowl with rice and simple seasoning.',
    prepTimeMinutes: 30,
    portions: 4,
    tags: ['meal-prep', 'high-protein'],
    ingredients: [
      { name: 'Rice', quantity: 2, unit: 'cups' },
      { name: 'Chicken', quantity: 500, unit: 'g' },
      { name: 'Carrots', quantity: 2, unit: 'cups' },
    ],
    steps: ['Cook rice.', 'Pan-fry seasoned chicken.', 'Serve with carrots.'],
    dietCategories: ['meat'],
    mealTypes: ['lunch', 'dinner'],
  },
  {
    title: 'Tuna Couscous Salad',
    description: 'No-cook lunch with pantry staples.',
    prepTimeMinutes: 15,
    portions: 2,
    tags: ['quick', 'cheap', 'pescatarian'],
    ingredients: [
      { name: 'Couscous', quantity: 1, unit: 'cup' },
      { name: 'Tuna', quantity: 1, unit: 'can' },
      { name: 'Cucumber', quantity: 1, unit: 'cup' },
    ],
    steps: ['Steep couscous.', 'Fluff and mix with tuna and cucumber.'],
    dietCategories: ['fish'],
    mealTypes: ['lunch'],
  },
  {
    title: 'Egg Fried Rice',
    description: 'Fast breakfast or lunch using eggs and rice.',
    prepTimeMinutes: 15,
    portions: 2,
    tags: ['quick', 'cheap'],
    ingredients: [
      { name: 'Rice', quantity: 2, unit: 'cups' },
      { name: 'Eggs', quantity: 3, unit: null },
      { name: 'Peas', quantity: 1, unit: 'cup' },
    ],
    steps: ['Scramble eggs.', 'Stir-fry with rice and peas.'],
    dietCategories: ['dairy', 'vegetarian'],
    mealTypes: ['breakfast', 'lunch'],
  },
  {
    title: 'Yogurt Parfait',
    description: 'Simple breakfast with yogurt and fruit.',
    prepTimeMinutes: 5,
    portions: 1,
    tags: ['quick', 'healthy'],
    ingredients: [
      { name: 'Yogurt', quantity: 1, unit: 'cup' },
      { name: 'Berries', quantity: 0.5, unit: 'cup' },
      { name: 'Granola', quantity: 0.25, unit: 'cup' },
    ],
    steps: ['Layer yogurt in a bowl.', 'Add berries and granola.'],
    dietCategories: ['dairy', 'vegetarian'],
    mealTypes: ['breakfast', 'snack'],
  },
  {
    title: 'Cheese Toast with Salad',
    description: 'Light dinner with melted cheese on bread.',
    prepTimeMinutes: 15,
    portions: 2,
    tags: ['quick', 'cheap', 'vegetarian'],
    ingredients: [
      { name: 'Bread', quantity: 4, unit: 'slices' },
      { name: 'Cheese', quantity: 100, unit: 'g' },
      { name: 'Lettuce', quantity: 2, unit: 'cups' },
    ],
    steps: ['Toast bread with cheese.', 'Serve with a simple salad.'],
    dietCategories: ['dairy', 'vegetarian'],
    mealTypes: ['lunch', 'dinner'],
  },
  {
    title: 'Chickpea Grain Bowl',
    description: 'Hearty vegan bowl with grains and legumes.',
    prepTimeMinutes: 25,
    portions: 3,
    tags: ['vegan', 'healthy', 'meal-prep'],
    ingredients: [
      { name: 'Rice', quantity: 2, unit: 'cups' },
      { name: 'Chickpeas', quantity: 1, unit: 'can' },
      { name: 'Spinach', quantity: 2, unit: 'cups' },
      { name: 'Olive oil', quantity: 1, unit: 'tbsp' },
    ],
    steps: ['Cook rice.', 'Warm chickpeas with spinach.', 'Combine and drizzle with oil.'],
    dietCategories: ['vegan', 'vegetarian'],
    mealTypes: ['lunch', 'dinner'],
  },
  {
    title: 'Avocado Toast',
    description: 'Quick snack with mashed avocado on toast.',
    prepTimeMinutes: 10,
    portions: 1,
    tags: ['quick', 'vegan', 'healthy'],
    ingredients: [
      { name: 'Bread', quantity: 2, unit: 'slices' },
      { name: 'Avocado', quantity: 1, unit: null },
      { name: 'Lemon juice', quantity: 1, unit: 'tsp' },
    ],
    steps: ['Toast bread.', 'Mash avocado with lemon.', 'Spread and serve.'],
    dietCategories: ['vegan', 'vegetarian'],
    mealTypes: ['breakfast', 'snack'],
  },
  {
    title: 'Salmon Rice Bowl',
    description: 'Light pescatarian dinner with rice and greens.',
    prepTimeMinutes: 25,
    portions: 2,
    tags: ['healthy', 'pescatarian'],
    ingredients: [
      { name: 'Rice', quantity: 1.5, unit: 'cups' },
      { name: 'Salmon', quantity: 300, unit: 'g' },
      { name: 'Spinach', quantity: 2, unit: 'cups' },
    ],
    steps: ['Cook rice.', 'Pan-sear salmon.', 'Serve over spinach and rice.'],
    dietCategories: ['fish'],
    mealTypes: ['dinner'],
  },
  {
    title: 'Oatmeal with Fruit',
    description: 'Warm breakfast oats with seasonal fruit.',
    prepTimeMinutes: 10,
    portions: 2,
    tags: ['quick', 'healthy', 'vegetarian'],
    ingredients: [
      { name: 'Oats', quantity: 1, unit: 'cup' },
      { name: 'Milk', quantity: 2, unit: 'cups' },
      { name: 'Apple', quantity: 1, unit: null },
    ],
    steps: ['Cook oats with milk.', 'Top with diced apple.'],
    dietCategories: ['dairy', 'vegetarian'],
    mealTypes: ['breakfast'],
  },
];

const MEAL_TYPE_TAGS: Partial<Record<MealType, string[]>> = {
  breakfast: ['quick', 'healthy'],
  lunch: ['quick', 'cheap'],
  dinner: ['meal-prep', 'quick'],
  snack: ['quick'],
};

function isTemplateAllowed(
  template: MockRecipeTemplate,
  preferences: DietaryPreference[]
): boolean {
  const active = preferences.filter((preference) => preference !== 'none' && preference !== 'flexitarian');
  if (active.length === 0) {
    return true;
  }

  const categories = new Set(template.dietCategories);

  if (active.includes('vegan') && (categories.has('meat') || categories.has('fish') || categories.has('dairy'))) {
    return false;
  }
  if (active.includes('vegetarian') && (categories.has('meat') || categories.has('fish'))) {
    return false;
  }
  if (active.includes('pescatarian') && categories.has('meat')) {
    return false;
  }
  if (active.includes('dairy_free') && categories.has('dairy')) {
    return false;
  }
  if (active.includes('gluten_free')) {
    const glutenIngredients = ['bread', 'pasta', 'couscous', 'oats', 'granola'];
    if (template.ingredients.some((ing) => glutenIngredients.some((g) => ing.name.toLowerCase().includes(g)))) {
      return false;
    }
  }

  return true;
}

function preferInventoryIngredient(
  inventoryNames: string[],
  fallback: string,
  exclude: string[]
): string {
  const excludeKeys = new Set(exclude.map((name) => normalizeNameKey(name)));
  const match = inventoryNames.find((name) => !excludeKeys.has(normalizeNameKey(name)));
  return match ?? fallback;
}

function applyInventoryAndDislikes(
  template: MockRecipeTemplate,
  state: OnboardingState
): MockRecipeTemplate {
  const inventoryNames = state.availableInventoryItems.map((item) => item.name);
  const dislikedKeys = new Set(state.dislikedIngredients.map((name) => normalizeNameKey(name)));

  const ingredients = template.ingredients
    .filter((ingredient) => !dislikedKeys.has(normalizeNameKey(ingredient.name)))
    .map((ingredient) => {
      if (ingredient.name === 'Carrots' || ingredient.name === 'Bell peppers' || ingredient.name === 'Peas') {
        const replacement = preferInventoryIngredient(
          inventoryNames.filter((name) => /vegetable|carrot|pepper|pea|spinach|lettuce|cucumber/i.test(name)),
          ingredient.name,
          state.dislikedIngredients
        );
        return { ...ingredient, name: replacement };
      }
      return ingredient;
    });

  if (ingredients.length === 0) {
    return template;
  }

  return { ...template, ingredients };
}

function templateToPending(
  template: MockRecipeTemplate,
  mealType: MealType,
  index: number,
  startIndex: number
): PendingOnboardingRecipe {
  const preferredTags = MEAL_TYPE_TAGS[mealType] ?? [];
  const tagScore = template.tags.filter((tag) => preferredTags.includes(tag)).length;

  return {
    tempKey: `mock-${mealType}-${startIndex + index}-${normalizeNameKey(template.title)}`,
    mealType,
    source: 'mock',
    title: template.title,
    description: template.description,
    prepTimeMinutes: template.prepTimeMinutes,
    portions: template.portions,
    tags: [...template.tags, ...(tagScore > 0 ? [] : preferredTags.slice(0, 1))],
    ingredients: template.ingredients,
    steps: template.steps,
  };
}

export function generateMockOnboardingRecipes(
  state: OnboardingState,
  mealType: MealType,
  count: number,
  startIndex = 0,
  excludeTitles: string[] = []
): PendingOnboardingRecipe[] {
  const excludedTitleKeys = new Set(excludeTitles.map((title) => normalizeNameKey(title)));
  const candidates = MOCK_TEMPLATES.filter(
    (template) =>
      template.mealTypes.includes(mealType) &&
      isTemplateAllowed(template, state.dietaryPreferences) &&
      !excludedTitleKeys.has(normalizeNameKey(template.title))
  )
    .map((template) => applyInventoryAndDislikes(template, state))
    .filter(
      (template) => !recipeViolatesOnboardingConstraints(template.ingredients, state)
    )
    .sort((a, b) => {
      const preferredTags = MEAL_TYPE_TAGS[mealType] ?? [];
      const aScore = a.tags.filter((tag) => preferredTags.includes(tag)).length;
      const bScore = b.tags.filter((tag) => preferredTags.includes(tag)).length;
      return bScore - aScore;
    });

  if (candidates.length === 0) {
    return [];
  }

  const results: PendingOnboardingRecipe[] = [];
  for (let i = 0; i < count; i++) {
    const template = candidates[(startIndex + i) % candidates.length];
    results.push(templateToPending(template, mealType, i, startIndex));
  }

  return results;
}
