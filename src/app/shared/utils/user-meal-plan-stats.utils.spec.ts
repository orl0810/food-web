import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import {
  buildUserMealPlanningStats,
  computePlanningStreak,
  computeWeeklyStats,
  groupItemsByWeekStart,
} from './user-meal-plan-stats.utils';

function slotItem(overrides: Partial<MealSlotItem>): MealSlotItem {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    date: '2026-06-09',
    meal_type: 'lunch',
    item_type: 'recipe',
    recipe_id: 'r1',
    prepared_portion_id: null,
    inventory_item_id: null,
    custom_name: null,
    quantity: null,
    unit: null,
    portions_used: 1,
    notes: null,
    sort_order: 0,
    status: 'planned',
    completed_at: null,
    source: null,
    image_url: null,
    transcript: null,
    created_at: '',
    ...overrides,
  };
}

describe('user-meal-plan-stats.utils', () => {
  it('counts planned and completed slots for the current week', () => {
    const items = [
      slotItem({ date: '2026-06-09', meal_type: 'lunch', status: 'eaten' }),
      slotItem({ date: '2026-06-09', meal_type: 'dinner', status: 'planned' }),
      slotItem({ date: '2026-06-10', meal_type: 'lunch', status: 'eaten' }),
    ];

    const stats = computeWeeklyStats(items, [], 'u1');
    expect(stats.mealsPlannedThisWeek).toBe(3);
    expect(stats.mealsCompletedThisWeek).toBe(2);
    expect(stats.weeklyCompletionPercentage).toBe(67);
  });

  it('computes planning streak from grouped weeks', () => {
    const itemsByWeek = new Map<string, MealSlotItem[]>([
      ['2026-06-08', Array.from({ length: 5 }, (_, index) => slotItem({ date: `2026-06-0${9 + index}`, meal_type: 'lunch' }))],
      ['2026-06-01', Array.from({ length: 6 }, (_, index) => slotItem({ date: `2026-06-0${2 + index}`, meal_type: 'dinner' }))],
      ['2026-05-25', [slotItem({ date: '2026-05-26', meal_type: 'lunch' })]],
    ]);

    expect(computePlanningStreak(itemsByWeek, 5)).toBe(2);
  });

  it('groups items by week start', () => {
    const grouped = groupItemsByWeekStart([
      slotItem({ date: '2026-06-10' }),
      slotItem({ date: '2026-06-11' }),
      slotItem({ date: '2026-06-03' }),
    ]);

    expect(grouped.size).toBe(2);
  });
});
