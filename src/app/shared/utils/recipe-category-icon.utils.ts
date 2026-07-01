import {
  RECIPE_CATEGORIES,
  RecipeCategory,
} from '../../core/models/recipe.model';

export const RECIPE_CATEGORY_ICON_SLUGS: Partial<Record<RecipeCategory, string>> = {
  Burgers: 'burger',
  Healthy: 'healthy',
  Oriental: 'oriental',
  Chicken: 'chicken',
  Meat: 'meet',
  Breakfast: 'breakfast',
  Asian: 'asian',
  Dessert: 'dessert',
  Italian: 'italian',
  'Yogurt Bowl': 'yogurt',
  Toast: 'toast',
  Cereal: 'cereal',
  Smoothie: 'smoothie',
  'Rice Bowl': 'bowl',
  Soup: 'soup',
  Salad: 'salad',
  Wrap: 'wrap',
  Sandwich: 'sandwich',
  'Main Dish': 'main-dish',
  'Light Dinner': 'light-dinner',
  Snack: 'snack',
};

export const SLIDER_RECIPE_CATEGORIES = RECIPE_CATEGORIES.filter(
  (category): category is RecipeCategory => category in RECIPE_CATEGORY_ICON_SLUGS
);

export function recipeCategoryIconUrl(category: RecipeCategory): string {
  const slug = RECIPE_CATEGORY_ICON_SLUGS[category];
  if (!slug) {
    return '';
  }
  return `/assets/icons/categories/${slug}.png`;
}

export function hasRecipeCategoryIcon(category: RecipeCategory): boolean {
  return category in RECIPE_CATEGORY_ICON_SLUGS;
}
