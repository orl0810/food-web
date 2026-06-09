export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type { MealSlotItem, MealSlotItemInput, MealSlotItemType, MealPlanEntry } from './meal-slot-item.model';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const MEAL_TYPE_TIME_RANGES: Record<MealType, string> = {
  breakfast: '7:00 – 9:00 AM',
  lunch: '12:00 – 2:00 PM',
  dinner: '6:00 – 8:00 PM',
  snack: 'Anytime',
};
