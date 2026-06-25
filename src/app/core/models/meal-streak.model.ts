export type MealStreakRule =
  | 'at_least_one_meal_completed'
  | 'all_planned_meals_completed';

export interface UserMealStreak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  streakRule: MealStreakRule;
  updatedAt: string;
}

export const MEAL_STREAK_LOOKBACK_DAYS = 365;
export const DEFAULT_MEAL_STREAK_RULE: MealStreakRule = 'at_least_one_meal_completed';
