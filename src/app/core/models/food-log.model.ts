import { MealType } from '../models/meal-plan.model';

export interface CreateFoodLogInput {
  name: string;
  date: string;
  mealType: MealType;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  markAsConsumed?: boolean;
}

export interface CreateVoiceFoodLogInput extends CreateFoodLogInput {
  transcript: string;
}

export interface CreatePhotoFoodLogInput extends CreateFoodLogInput {
  imageUrl: string;
}
