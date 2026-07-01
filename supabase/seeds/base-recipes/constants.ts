export const RECIPE_CATEGORIES = [
  'Burgers',
  'Healthy',
  'Oriental',
  'Chicken',
  'Meat',
  'Breakfast',
  'Asian',
  'Dessert',
  'Italian',
  'Oats',
  'Yogurt Bowl',
  'Eggs',
  'Toast',
  'Cereal',
  'Smoothie',
  'Rice Bowl',
  'Pasta',
  'Soup',
  'Salad',
  'Wrap',
  'Sandwich',
  'Main Dish',
  'Light Dinner',
  'Dinner Main',
  'Snack',
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const STARTER_RECIPE_TAG_FILTERS = [
  'quick',
  'high protein',
  'vegetarian',
  'meal prep friendly',
  'budget friendly',
  'no cook',
] as const;
