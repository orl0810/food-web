import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import {
  getPendingMealsToPrepare,
  getSlotDisplayStatus,
  getTargetStatusForPrimaryAction,
  getTargetStatusForSecondaryAction,
} from './meal-slot-status.utils';

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
    created_at: '',
    ...overrides,
  };
}

describe('meal-slot-status.utils', () => {
  describe('getSlotDisplayStatus', () => {
    it('returns empty for no items', () => {
      expect(getSlotDisplayStatus([])).toBe('empty');
    });

    it('returns planned for all planned items', () => {
      expect(getSlotDisplayStatus([slotItem({ status: 'planned' })])).toBe('planned');
    });

    it('returns ready when all items are prepared', () => {
      expect(getSlotDisplayStatus([slotItem({ status: 'prepared' })])).toBe('ready');
    });

    it('returns ready when mix of prepared and eaten with at least one prepared', () => {
      const items = [
        slotItem({ id: '1', status: 'prepared' }),
        slotItem({ id: '2', status: 'eaten' }),
      ];
      expect(getSlotDisplayStatus(items)).toBe('ready');
    });

    it('returns consumed when all items are eaten', () => {
      const items = [
        slotItem({ status: 'eaten' }),
        slotItem({ id: '2', status: 'eaten' }),
      ];
      expect(getSlotDisplayStatus(items)).toBe('consumed');
    });

    it('returns planned for mixed planned and prepared', () => {
      const items = [
        slotItem({ id: '1', status: 'planned' }),
        slotItem({ id: '2', status: 'prepared' }),
      ];
      expect(getSlotDisplayStatus(items)).toBe('planned');
    });
  });

  describe('status actions', () => {
    it('maps planned to prepared on primary action', () => {
      expect(getTargetStatusForPrimaryAction('planned')).toBe('prepared');
    });

    it('maps ready to eaten on primary action', () => {
      expect(getTargetStatusForPrimaryAction('ready')).toBe('eaten');
    });

    it('maps consumed undo to prepared', () => {
      expect(getTargetStatusForSecondaryAction('consumed')).toBe('prepared');
    });

    it('maps ready back to planned on secondary action', () => {
      expect(getTargetStatusForSecondaryAction('ready')).toBe('planned');
    });
  });

  describe('getPendingMealsToPrepare', () => {
    it('includes only planned slots in date range', () => {
      const items = [
        slotItem({ date: '2026-06-25', meal_type: 'lunch', status: 'planned' }),
        slotItem({ id: '2', date: '2026-06-25', meal_type: 'dinner', status: 'prepared' }),
        slotItem({ id: '3', date: '2026-06-26', meal_type: 'breakfast', status: 'eaten' }),
        slotItem({ id: '4', date: '2026-06-20', meal_type: 'lunch', status: 'planned' }),
      ];

      const pending = getPendingMealsToPrepare(items, '2026-06-25', '2026-06-30');
      expect(pending.length).toBe(1);
      expect(pending[0].mealType).toBe('lunch');
      expect(pending[0].date).toBe('2026-06-25');
    });

    it('sorts by date then meal type order', () => {
      const items = [
        slotItem({ id: '1', date: '2026-06-26', meal_type: 'dinner', status: 'planned' }),
        slotItem({ id: '2', date: '2026-06-25', meal_type: 'lunch', status: 'planned' }),
        slotItem({ id: '3', date: '2026-06-25', meal_type: 'breakfast', status: 'planned' }),
      ];

      const pending = getPendingMealsToPrepare(items, '2026-06-25', '2026-06-30');
      expect(pending.map((slot) => `${slot.date}|${slot.mealType}`)).toEqual([
        '2026-06-25|breakfast',
        '2026-06-25|lunch',
        '2026-06-26|dinner',
      ]);
    });
  });
});
