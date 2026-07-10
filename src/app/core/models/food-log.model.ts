import { MealSlotItemStatus } from './meal-slot-item.model';
import { MealType } from './meal-plan.model';

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
}
