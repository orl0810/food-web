import type { MealType } from './meal-plan.model';

export type RecipeDifficulty = 'easy' | 'medium' | 'hard';
export type RecipeMealType = MealType;

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

export type RecipeSourceTab = 'all' | 'mine' | 'starter';

export type RecipeImageStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface RecipeImageMetadata {
  image_url?: string | null;
  image_status?: RecipeImageStatus;
  image_prompt?: string | null;
  image_provider?: string | null;
  image_version?: number;
  image_generated_at?: string | null;
  image_error?: string | null;
  image_storage_provider?: string | null;
  image_storage_key?: string | null;
}

export type RecipeImageMetadataUpdate = RecipeImageMetadata;

export interface RecipeSearchFilters {
  sourceTab?: RecipeSourceTab;
  mealType?: RecipeMealType | null;
  category?: string | null;
  tags?: string[];
  search?: string;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface RecipeNutrition {
  calories: number | null;
  fat_g: number | null;
  cholesterol_mg: number | null;
  protein_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  carbs_g: number | null;
  fiber_g: number | null;
  calculated_at: string | null;
}

export interface RecipeNutritionEstimateRequest {
  title: string;
  description?: string | null;
  portions?: number | null;
  ingredients: RecipeIngredientInput[];
}

export interface Recipe {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  portions: number | null;
  tags: string[];
  rating: number | null;
  image_url: string | null;
  image_status: RecipeImageStatus;
  image_prompt?: string | null;
  image_provider?: string | null;
  image_version?: number;
  image_generated_at?: string | null;
  image_error?: string | null;
  image_storage_provider?: string | null;
  image_storage_key?: string | null;
  is_base_recipe: boolean;
  base_recipe_id: string | null;
  meal_type: RecipeMealType | null;
  category: string | null;
  difficulty: RecipeDifficulty | null;
  instructions: string[];
  nutrition?: RecipeNutrition | null;
  created_at: string;
  updated_at?: string;
  ingredients?: RecipeIngredient[];
}

export type RecipeMealPlanSummary = Pick<
  Recipe,
  | 'id'
  | 'title'
  | 'description'
  | 'tags'
  | 'prep_time_minutes'
  | 'image_url'
  | 'image_status'
  | 'image_storage_key'
  | 'meal_type'
  | 'category'
> & {
  portions?: number | null;
  nutrition?: RecipeNutrition | null;
};

export interface RecipeInput {
  title: string;
  description?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  portions?: number | null;
  tags: string[];
  base_recipe_id?: string | null;
  meal_type?: RecipeMealType | null;
  category?: string | null;
  difficulty?: RecipeDifficulty | null;
  instructions?: string[];
}

export interface RecipeIngredientInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}
