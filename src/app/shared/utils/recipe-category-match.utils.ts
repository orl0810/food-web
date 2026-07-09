import {
  RECIPE_CATEGORIES,
  Recipe,
  RecipeCategory,
} from '../../core/models/recipe.model';

/** Keywords used when a recipe's `category` field does not match exactly. */
export const CATEGORY_KEYWORDS: Record<RecipeCategory, readonly string[]> = {
  Burgers: ['burger', 'hamburger', 'cheeseburger'],
  Healthy: ['healthy', 'light meal', 'low calorie'],
  Oriental: ['oriental', 'middle eastern', 'falafel', 'hummus', 'shawarma'],
  Chicken: ['chicken'],
  Meat: ['beef', 'pork', 'steak', 'meatball', 'lamb', 'ground beef', 'sausage'],
  Breakfast: ['breakfast', 'brunch'],
  Asian: ['asian', 'stir fry', 'teriyaki', 'ramen', 'sushi', 'soy sauce'],
  Dessert: ['dessert', 'cake', 'cookie', 'brownie', 'pudding'],
  Italian: ['italian', 'pizza', 'risotto', 'carbonara', 'pesto', 'marinara'],
  Oats: ['oats', 'oatmeal', 'porridge', 'overnight oats'],
  'Yogurt Bowl': ['yogurt', 'parfait', 'yoghurt'],
  Eggs: ['egg', 'omelette', 'omelet', 'frittata', 'scramble'],
  Toast: ['toast', 'avocado toast'],
  Cereal: ['cereal', 'granola', 'muesli'],
  Smoothie: ['smoothie'],
  'Rice Bowl': ['rice bowl', 'bibimbap', 'fried rice'],
  Pasta: ['pasta', 'spaghetti', 'noodle', 'penne', 'linguine', 'macaroni'],
  Soup: ['soup', 'stew', 'broth', 'chowder', 'bisque'],
  Salad: ['salad'],
  Wrap: ['wrap', 'tortilla wrap'],
  Sandwich: ['sandwich', 'panini', 'sub sandwich', 'blt'],
  'Main Dish': ['main dish', 'entree', 'entrée'],
  'Light Dinner': ['light dinner'],
  'Dinner Main': ['dinner main'],
  Snack: ['snack'],
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textContainsKeyword(text: string, keyword: string): boolean {
  const kw = keyword.toLowerCase().trim();
  if (!kw) {
    return false;
  }

  if (kw.length <= 4) {
    return new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i').test(text);
  }

  return text.toLowerCase().includes(kw);
}

function recipeSearchText(recipe: Recipe): string {
  const parts = [
    recipe.title,
    ...(recipe.tags ?? []),
    ...(recipe.ingredients ?? []).map((ingredient) => ingredient.name),
  ];
  return parts.join(' ');
}

export function recipeMatchesCategory(recipe: Recipe, category: RecipeCategory): boolean {
  const field = recipe.category?.trim().toLowerCase() ?? '';
  if (field && field === category.toLowerCase()) {
    return true;
  }

  const searchText = recipeSearchText(recipe);
  return CATEGORY_KEYWORDS[category].some((keyword) => textContainsKeyword(searchText, keyword));
}

export function buildRecipeCategoryIndex(
  recipes: Recipe[]
): Map<RecipeCategory, Set<string>> {
  const index = new Map<RecipeCategory, Set<string>>();

  for (const category of RECIPE_CATEGORIES) {
    index.set(category, new Set());
  }

  for (const recipe of recipes) {
    for (const category of RECIPE_CATEGORIES) {
      if (recipeMatchesCategory(recipe, category)) {
        index.get(category)?.add(recipe.id);
      }
    }
  }

  return index;
}

export function getCategoriesWithRecipes(
  recipes: Recipe[],
  index = buildRecipeCategoryIndex(recipes)
): RecipeCategory[] {
  return RECIPE_CATEGORIES.filter((category) => (index.get(category)?.size ?? 0) > 0);
}
