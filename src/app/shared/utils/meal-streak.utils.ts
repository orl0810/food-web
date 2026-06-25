import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import {
  DEFAULT_MEAL_STREAK_RULE,
  MealStreakRule,
} from '../../core/models/meal-streak.model';
import { MEAL_TYPES } from '../../core/models/meal-plan.model';
import {
  calculateDayProgress,
  getItemsForSlot,
  isSlotCompleted,
} from '../../features/meal-plan/utils/meal-slot-completion.utils';
import { addDays, toISODate } from './meal-plan.utils';

export function getLocalDateKey(date: Date = new Date()): string {
  return toISODate(date);
}

export function evaluateStreakRule(
  items: MealSlotItem[],
  date: string,
  rule: MealStreakRule = DEFAULT_MEAL_STREAK_RULE
): boolean {
  if (rule === 'all_planned_meals_completed') {
    const progress = calculateDayProgress(date, items, MEAL_TYPES);
    return progress.isComplete;
  }

  return MEAL_TYPES.some((mealType) => {
    const slotItems = getItemsForSlot(items, date, mealType);
    return isSlotCompleted(slotItems);
  });
}

export function getStreakDaysFromItems(
  items: MealSlotItem[],
  rule: MealStreakRule = DEFAULT_MEAL_STREAK_RULE
): Set<string> {
  const dates = new Set<string>();
  for (const item of items) {
    dates.add(item.date);
  }

  const streakDays = new Set<string>();
  for (const date of dates) {
    if (evaluateStreakRule(items, date, rule)) {
      streakDays.add(date);
    }
  }

  return streakDays;
}

export function isStreakDayForDate(
  date: string,
  items: MealSlotItem[],
  rule: MealStreakRule = DEFAULT_MEAL_STREAK_RULE
): boolean {
  return evaluateStreakRule(items, date, rule);
}

export function computeCurrentStreak(
  streakDays: Set<string>,
  today: string = getLocalDateKey()
): number {
  if (streakDays.size === 0) {
    return 0;
  }

  let checkDate = today;
  if (!streakDays.has(today)) {
    checkDate = addDays(today, -1);
  }

  let streak = 0;
  while (streakDays.has(checkDate)) {
    streak++;
    checkDate = addDays(checkDate, -1);
  }

  return streak;
}

export function computeLongestStreak(streakDays: Set<string>): number {
  if (streakDays.size === 0) {
    return 0;
  }

  const sortedDates = [...streakDays].sort();
  let longest = 1;
  let current = 1;

  for (let index = 1; index < sortedDates.length; index++) {
    const previous = sortedDates[index - 1];
    const currentDate = sortedDates[index];
    const expectedNext = addDays(previous, 1);

    if (currentDate === expectedNext) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

export function getMostRecentStreakDay(streakDays: Set<string>): string | null {
  if (streakDays.size === 0) {
    return null;
  }

  return [...streakDays].sort().at(-1) ?? null;
}

export function computeStreakFromItems(
  items: MealSlotItem[],
  rule: MealStreakRule = DEFAULT_MEAL_STREAK_RULE,
  today: string = getLocalDateKey()
): { currentStreak: number; longestStreak: number; lastCompletedDate: string | null } {
  const streakDays = getStreakDaysFromItems(items, rule);
  return {
    currentStreak: computeCurrentStreak(streakDays, today),
    longestStreak: computeLongestStreak(streakDays),
    lastCompletedDate: getMostRecentStreakDay(streakDays),
  };
}

export function getStreakFeedback(
  previousStreak: number,
  currentStreak: number,
  date: string,
  today: string = getLocalDateKey()
): string | null {
  if (date !== today || currentStreak <= previousStreak) {
    return null;
  }

  if (previousStreak === 0 && currentStreak === 1) {
    return 'Nice! Your streak has started.';
  }

  if (currentStreak > previousStreak) {
    return 'Great job! Your streak continues.';
  }

  return null;
}
