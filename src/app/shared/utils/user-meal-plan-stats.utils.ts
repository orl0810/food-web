import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import { Recipe } from '../../core/models/recipe.model';
import {
  PLANNING_STREAK_LOOKBACK_WEEKS,
  PLANNING_STREAK_MIN_SLOTS,
  UserMealPlanningStats,
} from '../../core/models/user-profile.model';
import { getDaysUntilExpiration } from './expiration.utils';
import {
  addDays,
  getCurrentWeekEndDate,
  getCurrentWeekStartDate,
  getMondayOfWeek,
} from './meal-plan.utils';

const EXPIRING_SOON_DAYS = 3;

function countUniquePlannedSlots(items: MealSlotItem[]): number {
  const slots = new Set<string>();
  for (const item of items) {
    slots.add(`${item.date}|${item.meal_type}`);
  }
  return slots.size;
}

function countCompletedSlots(items: MealSlotItem[]): number {
  const slots = new Set<string>();
  for (const item of items) {
    if (item.status === 'eaten') {
      slots.add(`${item.date}|${item.meal_type}`);
    }
  }
  return slots.size;
}

function countPreparedPortionsUsed(items: MealSlotItem[]): number {
  return items.filter(
    (item) => item.item_type === 'prepared_portion' && item.status === 'eaten'
  ).length;
}

function countInventorySavedFromWaste(items: MealSlotItem[]): number {
  const saved = new Set<string>();
  for (const item of items) {
    if (item.status !== 'eaten' || !item.inventory_item) {
      continue;
    }
    const daysUntil = getDaysUntilExpiration(item.inventory_item.expiration_date ?? null);
    if (daysUntil !== null && daysUntil <= EXPIRING_SOON_DAYS) {
      saved.add(item.inventory_item.id);
    }
  }
  return saved.size;
}

function sumPrepTimeSaved(items: MealSlotItem[], recipes: Recipe[]): number {
  let total = 0;
  for (const item of items) {
    if (item.status !== 'eaten' || item.item_type !== 'recipe' || !item.recipe_id) {
      continue;
    }
    const recipe = recipes.find((entry) => entry.id === item.recipe_id);
    if (recipe?.prep_time_minutes) {
      total += recipe.prep_time_minutes;
    }
  }
  return total;
}

function countRecipesCooked(items: MealSlotItem[]): number {
  return items.filter((item) => item.item_type === 'recipe' && item.status === 'eaten').length;
}

export function computeWeeklyStats(
  weekItems: MealSlotItem[],
  recipes: Recipe[],
  userId: string
): Omit<
  UserMealPlanningStats,
  'completedWeeksStreak' | 'userId'
> & { userId: string } {
  const mealsPlannedThisWeek = countUniquePlannedSlots(weekItems);
  const mealsCompletedThisWeek = countCompletedSlots(weekItems);
  const weeklyCompletionPercentage =
    mealsPlannedThisWeek > 0
      ? Math.round((mealsCompletedThisWeek / mealsPlannedThisWeek) * 100)
      : 0;

  return {
    userId,
    mealsPlannedThisWeek,
    mealsCompletedThisWeek,
    preparedPortionsUsedThisWeek: countPreparedPortionsUsed(weekItems),
    inventoryItemsSavedFromWasteThisWeek: countInventorySavedFromWaste(weekItems),
    weeklyCompletionPercentage,
    totalRecipesCooked: countRecipesCooked(weekItems),
    estimatedTimeSavedMinutes: sumPrepTimeSaved(weekItems, recipes),
  };
}

export function computePlanningStreak(
  itemsByWeek: Map<string, MealSlotItem[]>,
  minSlots = PLANNING_STREAK_MIN_SLOTS
): number {
  const today = new Date();
  let streak = 0;

  for (let weekOffset = 0; weekOffset < PLANNING_STREAK_LOOKBACK_WEEKS; weekOffset++) {
    const referenceDate = addDays(getMondayOfWeek(today), -7 * weekOffset);
    const weekStart = getMondayOfWeek(referenceDate);
    const weekItems = itemsByWeek.get(weekStart) ?? [];
    const plannedSlots = countUniquePlannedSlots(weekItems);

    if (plannedSlots >= minSlots) {
      streak++;
    } else if (weekOffset === 0) {
      break;
    } else {
      break;
    }
  }

  return streak;
}

export function groupItemsByWeekStart(items: MealSlotItem[]): Map<string, MealSlotItem[]> {
  const map = new Map<string, MealSlotItem[]>();
  for (const item of items) {
    const weekStart = getMondayOfWeek(item.date);
    const existing = map.get(weekStart) ?? [];
    existing.push(item);
    map.set(weekStart, existing);
  }
  return map;
}

export function getStatsDateRange(): { start: string; end: string } {
  const end = getCurrentWeekEndDate();
  const start = addDays(getCurrentWeekStartDate(), -7 * (PLANNING_STREAK_LOOKBACK_WEEKS - 1));
  return { start, end };
}

export function buildUserMealPlanningStats(
  allItems: MealSlotItem[],
  recipes: Recipe[],
  userId: string,
  minSlots = PLANNING_STREAK_MIN_SLOTS
): UserMealPlanningStats {
  const weekStart = getCurrentWeekStartDate();
  const weekEnd = getCurrentWeekEndDate();
  const currentWeekItems = allItems.filter(
    (item) => item.date >= weekStart && item.date <= weekEnd
  );

  const weekly = computeWeeklyStats(currentWeekItems, recipes, userId);
  const itemsByWeek = groupItemsByWeekStart(allItems);
  const completedWeeksStreak = computePlanningStreak(itemsByWeek, minSlots);

  return {
    ...weekly,
    completedWeeksStreak,
  };
}
