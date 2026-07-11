import { MealNutritionEstimate } from './meal-photo-analysis.model';
import { MealSlotItemStatus } from './meal-slot-item.model';
import { MealType } from './meal-plan.model';

export interface DetectedFoodSummary {
  name: string;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
}

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
  /** Explicit status; overrides markAsConsumed when set. */
  status?: MealSlotItemStatus;
  analysisId?: string;
  nutritionEstimate?: MealNutritionEstimate | null;
  detectedItemsSummary?: DetectedFoodSummary[];
}
