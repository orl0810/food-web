import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import { MEAL_TYPES, MealType } from '../../../core/models/meal-plan.model';
import { DayMealProgress } from '../models/day-meal-progress.model';

export function isSlotCompleted(items: MealSlotItem[]): boolean {
  return items.length > 0 && items.every((item) => item.status === 'eaten');
}

export function getItemsForSlot(
  items: MealSlotItem[],
  date: string,
  mealType: MealType
): MealSlotItem[] {
  return items.filter((item) => item.date === date && item.meal_type === mealType);
}

export function getPlannedSlotsForDay(
  date: string,
  items: MealSlotItem[],
  activeMealTypes: MealType[] = MEAL_TYPES
): MealType[] {
  return activeMealTypes.filter((mealType) => getItemsForSlot(items, date, mealType).length > 0);
}

export function getProgressMessage(percentage: number, plannedCount: number): string {
  if (plannedCount === 0) {
    return 'No meals planned yet';
  }
  if (percentage === 0) {
    return "Let's start the day";
  }
  if (percentage === 100) {
    return 'Great job, day completed!';
  }
  if (percentage >= 75) {
    return 'Almost done';
  }
  return 'Nice progress';
}

export function calculateDayProgress(
  date: string,
  items: MealSlotItem[],
  activeMealTypes: MealType[] = MEAL_TYPES
): DayMealProgress {
  const plannedSlots = getPlannedSlotsForDay(date, items, activeMealTypes);
  const plannedCount = plannedSlots.length;
  const completedCount = plannedSlots.filter((mealType) =>
    isSlotCompleted(getItemsForSlot(items, date, mealType))
  ).length;

  const percentage =
    plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  return {
    plannedCount,
    completedCount,
    percentage,
    isComplete: plannedCount > 0 && completedCount === plannedCount,
    message: getProgressMessage(percentage, plannedCount),
  };
}

export function shouldTriggerDayCompletedCelebration(
  previous: DayMealProgress,
  current: DayMealProgress
): boolean {
  return !previous.isComplete && current.isComplete && current.plannedCount > 0;
}

export function getDayProgressTitle(date: string, isTodayDate: boolean): string {
  if (isTodayDate) {
    return "Today's progress";
  }

  const weekday = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
  });
  return `${weekday}'s progress`;
}
