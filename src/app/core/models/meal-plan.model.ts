import { Recipe } from './recipe.model';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealPlanEntry {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  recipe_id: string | null;
  created_at: string;
  recipe?: Pick<Recipe, 'id' | 'title' | 'tags' | 'prep_time_minutes'>;
}

export interface MealPlanEntryInput {
  date: string;
  meal_type: MealType;
  recipe_id: string;
}

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
