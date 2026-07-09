import { MealType } from '../../core/models/meal-plan.model';

/**
 * Suggests a meal slot based on the current time of day.
 */
export function getDefaultMealTypeForNow(now: Date = new Date()): MealType {
  const hour = now.getHours();

  if (hour >= 5 && hour < 11) {
    return 'breakfast';
  }
  if (hour >= 11 && hour < 15) {
    return 'lunch';
  }
  if (hour >= 17 && hour < 22) {
    return 'dinner';
  }
  return 'snack';
}
