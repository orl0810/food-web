import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import {
  calculateDayProgress,
  getPlannedSlotsForDay,
  isSlotCompleted,
  shouldTriggerDayCompletedCelebration,
} from './meal-slot-completion.utils';

function slotItem(overrides: Partial<MealSlotItem>): MealSlotItem {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    date: '2026-06-25',
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

describe('meal-slot-completion.utils', () => {
  const date = '2026-06-25';

  describe('isSlotCompleted', () => {
    it('returns false for empty slot', () => {
      expect(isSlotCompleted([])).toBe(false);
    });

    it('returns false when only some items are eaten', () => {
      const items = [
        slotItem({ status: 'eaten' }),
        slotItem({ id: '2', status: 'planned' }),
      ];
      expect(isSlotCompleted(items)).toBe(false);
    });

    it('returns true when all items are eaten', () => {
      const items = [
        slotItem({ status: 'eaten' }),
        slotItem({ id: '2', status: 'eaten' }),
      ];
      expect(isSlotCompleted(items)).toBe(true);
    });
  });

  describe('getPlannedSlotsForDay', () => {
    it('excludes empty meal types', () => {
      const items = [
        slotItem({ meal_type: 'breakfast' }),
        slotItem({ meal_type: 'lunch' }),
        slotItem({ meal_type: 'dinner' }),
      ];
      expect(getPlannedSlotsForDay(date, items)).toEqual(['breakfast', 'lunch', 'dinner']);
    });
  });

  describe('calculateDayProgress', () => {
    it('returns zero progress for empty day', () => {
      const progress = calculateDayProgress(date, []);
      expect(progress.plannedCount).toBe(0);
      expect(progress.completedCount).toBe(0);
      expect(progress.percentage).toBe(0);
      expect(progress.isComplete).toBe(false);
      expect(progress.message).toBe('No meals planned yet');
    });

    it('returns 0% when planned slots exist but none completed', () => {
      const items = [
        slotItem({ meal_type: 'breakfast' }),
        slotItem({ meal_type: 'lunch' }),
        slotItem({ meal_type: 'dinner' }),
      ];
      const progress = calculateDayProgress(date, items);
      expect(progress.plannedCount).toBe(3);
      expect(progress.completedCount).toBe(0);
      expect(progress.percentage).toBe(0);
      expect(progress.message).toBe("Let's start the day");
    });

    it('returns 67% for 2 of 3 completed', () => {
      const items = [
        slotItem({ meal_type: 'breakfast', status: 'eaten' }),
        slotItem({ meal_type: 'lunch', status: 'eaten' }),
        slotItem({ meal_type: 'dinner', status: 'planned' }),
      ];
      const progress = calculateDayProgress(date, items);
      expect(progress.plannedCount).toBe(3);
      expect(progress.completedCount).toBe(2);
      expect(progress.percentage).toBe(67);
      expect(progress.message).toBe('Nice progress');
    });

    it('returns 100% when all planned slots completed', () => {
      const items = [
        slotItem({ meal_type: 'breakfast', status: 'eaten' }),
        slotItem({ meal_type: 'lunch', status: 'eaten' }),
        slotItem({ meal_type: 'dinner', status: 'eaten' }),
      ];
      const progress = calculateDayProgress(date, items);
      expect(progress.isComplete).toBe(true);
      expect(progress.percentage).toBe(100);
      expect(progress.message).toBe('Great job, day completed!');
    });

    it('does not count empty snack slot', () => {
      const items = [
        slotItem({ meal_type: 'breakfast', status: 'eaten' }),
        slotItem({ meal_type: 'lunch', status: 'planned' }),
        slotItem({ meal_type: 'dinner', status: 'planned' }),
      ];
      const progress = calculateDayProgress(date, items);
      expect(progress.plannedCount).toBe(3);
    });
  });

  describe('shouldTriggerDayCompletedCelebration', () => {
    it('triggers on transition to 100%', () => {
      const previous = calculateDayProgress(date, [
        slotItem({ meal_type: 'breakfast', status: 'eaten' }),
        slotItem({ meal_type: 'lunch', status: 'eaten' }),
        slotItem({ meal_type: 'dinner', status: 'planned' }),
      ]);
      const current = calculateDayProgress(date, [
        slotItem({ meal_type: 'breakfast', status: 'eaten' }),
        slotItem({ meal_type: 'lunch', status: 'eaten' }),
        slotItem({ meal_type: 'dinner', status: 'eaten' }),
      ]);
      expect(shouldTriggerDayCompletedCelebration(previous, current)).toBe(true);
    });

    it('does not trigger when already at 100%', () => {
      const complete = calculateDayProgress(date, [
        slotItem({ meal_type: 'breakfast', status: 'eaten' }),
        slotItem({ meal_type: 'lunch', status: 'eaten' }),
      ]);
      expect(shouldTriggerDayCompletedCelebration(complete, complete)).toBe(false);
    });

    it('does not trigger when staying incomplete', () => {
      const incomplete = calculateDayProgress(date, [
        slotItem({ meal_type: 'breakfast', status: 'planned' }),
      ]);
      const stillIncomplete = calculateDayProgress(date, [
        slotItem({ meal_type: 'breakfast', status: 'planned' }),
        slotItem({ meal_type: 'lunch', status: 'planned' }),
      ]);
      expect(shouldTriggerDayCompletedCelebration(incomplete, stillIncomplete)).toBe(false);
    });
  });
});
