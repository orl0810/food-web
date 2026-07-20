import { MealType } from './meal-plan.model';

export interface MealPlanAutogenerateRequest {
  dates: string[];
  mealTypes: MealType[];
}

export interface MealPlanAutogenerateUnfilledSlot {
  date: string;
  mealType: MealType;
  reason: string;
}

export interface MealPlanAutogenerateResult {
  generatedCount: number;
  occupiedSlotsSkipped: number;
  unfilledSlots: MealPlanAutogenerateUnfilledSlot[];
}
