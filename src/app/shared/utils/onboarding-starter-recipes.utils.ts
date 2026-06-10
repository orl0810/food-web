import { MealType } from '../../core/models/meal-plan.model';
import { PendingOnboardingRecipe } from '../../features/onboarding/models/onboarding.model';

const STARTER_RECIPES: Omit<PendingOnboardingRecipe, 'tempKey' | 'source'>[] = [
  {
    title: 'Quick Veggie Pasta',
    description: 'Simple pasta with vegetables and olive oil.',
    prepTimeMinutes: 20,
    portions: 4,
    tags: ['quick', 'cheap', 'vegetarian'],
    ingredients: [
      { name: 'Pasta', quantity: 400, unit: 'g' },
      { name: 'Vegetables', quantity: 2, unit: 'cups' },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'Garlic', quantity: 2, unit: 'cloves' },
    ],
    steps: ['Boil pasta.', 'Sauté vegetables with garlic.', 'Toss together and serve.'],
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
      { name: 'Vegetables', quantity: 2, unit: 'cups' },
    ],
    steps: ['Cook rice.', 'Pan-fry seasoned chicken.', 'Serve with vegetables.'],
  },
  {
    title: 'Tuna Couscous Salad',
    description: 'No-cook lunch with pantry staples.',
    prepTimeMinutes: 15,
    portions: 2,
    tags: ['quick', 'cheap'],
    ingredients: [
      { name: 'Couscous', quantity: 1, unit: 'cup' },
      { name: 'Tuna', quantity: 1, unit: 'can' },
      { name: 'Vegetables', quantity: 1, unit: 'cup' },
    ],
    steps: ['Steep couscous.', 'Fluff and mix with tuna and vegetables.'],
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
      { name: 'Vegetables', quantity: 1, unit: 'cup' },
    ],
    steps: ['Scramble eggs.', 'Stir-fry with rice and vegetables.'],
  },
  {
    title: 'Yogurt Parfait',
    description: 'Simple breakfast with yogurt and toppings.',
    prepTimeMinutes: 5,
    portions: 1,
    tags: ['quick', 'healthy'],
    ingredients: [
      { name: 'Yogurt', quantity: 1, unit: 'cup' },
      { name: 'Bread', quantity: 1, unit: 'slice' },
    ],
    steps: ['Layer yogurt in a bowl.', 'Add toppings and serve with toast.'],
  },
  {
    title: 'Cheese Toast with Salad',
    description: 'Light dinner with melted cheese on bread.',
    prepTimeMinutes: 15,
    portions: 2,
    tags: ['quick', 'cheap'],
    ingredients: [
      { name: 'Bread', quantity: 4, unit: 'slices' },
      { name: 'Cheese', quantity: 100, unit: 'g' },
      { name: 'Vegetables', quantity: 2, unit: 'cups' },
    ],
    steps: ['Toast bread with cheese.', 'Serve with a simple salad.'],
  },
  {
    title: 'Chicken Stir Fry',
    description: 'One-pan dinner with chicken and vegetables.',
    prepTimeMinutes: 25,
    portions: 4,
    tags: ['quick', 'meal-prep'],
    ingredients: [
      { name: 'Chicken', quantity: 500, unit: 'g' },
      { name: 'Vegetables', quantity: 3, unit: 'cups' },
      { name: 'Rice', quantity: 2, unit: 'cups' },
    ],
    steps: ['Cook rice.', 'Stir-fry chicken and vegetables.', 'Serve together.'],
  },
  {
    title: 'Pasta with Tuna',
    description: 'Pantry-friendly pasta dinner.',
    prepTimeMinutes: 20,
    portions: 3,
    tags: ['quick', 'cheap'],
    ingredients: [
      { name: 'Pasta', quantity: 300, unit: 'g' },
      { name: 'Tuna', quantity: 2, unit: 'cans' },
      { name: 'Vegetables', quantity: 1, unit: 'cup' },
    ],
    steps: ['Cook pasta.', 'Warm tuna with vegetables.', 'Combine and serve.'],
  },
];

const MEAL_TYPE_TAGS: Partial<Record<MealType, string[]>> = {
  breakfast: ['quick', 'healthy'],
  lunch: ['quick', 'cheap'],
  dinner: ['meal-prep', 'quick'],
  snack: ['quick'],
};

export function getStarterRecipesForMealType(
  mealType: MealType,
  count: number,
  startIndex = 0
): PendingOnboardingRecipe[] {
  const preferredTags = MEAL_TYPE_TAGS[mealType] ?? [];
  const sorted = [...STARTER_RECIPES].sort((a, b) => {
    const aScore = a.tags.filter((t) => preferredTags.includes(t)).length;
    const bScore = b.tags.filter((t) => preferredTags.includes(t)).length;
    return bScore - aScore;
  });

  const results: PendingOnboardingRecipe[] = [];
  for (let i = 0; i < count; i++) {
    const recipe = sorted[(startIndex + i) % sorted.length];
    results.push({
      ...recipe,
      tempKey: `starter-${mealType}-${startIndex + i}`,
      source: 'starter',
    });
  }
  return results;
}

export function getAllStarterRecipes(): PendingOnboardingRecipe[] {
  return STARTER_RECIPES.map((recipe, index) => ({
    ...recipe,
    tempKey: `starter-${index}`,
    source: 'starter' as const,
  }));
}
