import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import {
  getCookBatchSelection,
  getGroupedPendingCookItems,
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
    source: null,
    image_url: null,
    transcript: null,
    product_id: null,
    grams_consumed: null,
    servings: null,
    calories_snapshot: null,
    protein_snapshot: null,
    carbohydrates_snapshot: null,
    fat_snapshot: null,
    sugar_snapshot: null,
    fiber_snapshot: null,
    sodium_mg_snapshot: null,
    product_name_snapshot: null,
    brand_snapshot: null,
    product_image_url_snapshot: null,
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

    it('keeps recipe image metadata on pending slot items', () => {
      const items = [
        slotItem({
          date: '2026-06-25',
          meal_type: 'lunch',
          status: 'planned',
          recipe: {
            id: 'r1',
            title: 'Pasta',
            description: null,
            tags: [],
            prep_time_minutes: 15,
            image_url: 'https://cdn.example.com/pasta.jpg',
            image_status: 'completed',
            image_storage_key: 'recipes/pasta.jpg',
            meal_type: 'lunch',
            category: 'Pasta',
          },
        }),
      ];

      const pending = getPendingMealsToPrepare(items, '2026-06-25', '2026-06-30');
      expect(pending[0].items[0].recipe?.image_url).toBe('https://cdn.example.com/pasta.jpg');
      expect(pending[0].items[0].recipe?.image_status).toBe('completed');
    });
  });

  describe('getGroupedPendingCookItems', () => {
    it('groups the same recipe across multiple days into one card', () => {
      const items = [
        slotItem({ id: '1', date: '2026-06-27', meal_type: 'dinner', recipe_id: 'r1', status: 'planned' }),
        slotItem({ id: '2', date: '2026-06-25', meal_type: 'breakfast', recipe_id: 'r1', status: 'planned' }),
        slotItem({ id: '3', date: '2026-06-26', meal_type: 'lunch', recipe_id: 'r1', status: 'planned' }),
      ];

      const grouped = getGroupedPendingCookItems(items, '2026-06-25', '2026-06-30');
      expect(grouped.length).toBe(1);
      expect(grouped[0].count).toBe(3);
      expect(grouped[0].occurrences.map((entry) => entry.itemId)).toEqual(['2', '3', '1']);
    });

    it('uses recipe yield to calculate one batch for two planned portions', () => {
      const recipe = {
        id: 'r1',
        title: 'Pasta Carbonara',
        description: null,
        tags: [],
        prep_time_minutes: 10,
        image_url: null,
        image_status: 'pending' as const,
        image_storage_key: null,
        meal_type: 'dinner' as const,
        category: 'Pasta',
        portions: 2,
      };
      const items = [
        slotItem({ id: '1', date: '2026-06-25', recipe }),
        slotItem({ id: '2', date: '2026-06-27', recipe }),
      ];

      const [group] = getGroupedPendingCookItems(items, '2026-06-25', '2026-06-30');

      expect(group.plannedPortions).toBe(2);
      expect(group.recipeYield).toBe(2);
      expect(group.batchCount).toBe(1);
      expect(getCookBatchSelection(group, 'next')).toEqual({
        itemIds: ['1', '2'],
        portionsCovered: 2,
        batches: 1,
        extraPortions: 0,
      });
    });

    it('selects the next full batch and reports leftovers', () => {
      const recipe = {
        id: 'r1',
        title: 'Soup',
        description: null,
        tags: [],
        prep_time_minutes: 10,
        image_url: null,
        image_status: 'pending' as const,
        image_storage_key: null,
        meal_type: 'dinner' as const,
        category: 'Soup',
        portions: 3,
      };
      const items = [
        slotItem({ id: '1', date: '2026-06-25', recipe }),
        slotItem({ id: '2', date: '2026-06-26', recipe }),
        slotItem({ id: '3', date: '2026-06-27', recipe }),
        slotItem({ id: '4', date: '2026-06-28', recipe }),
      ];

      const [group] = getGroupedPendingCookItems(items, '2026-06-25', '2026-06-30');

      expect(group.batchCount).toBe(2);
      expect(getCookBatchSelection(group, 'next').itemIds).toEqual(['1', '2', '3']);
      expect(getCookBatchSelection(group, 'all')).toEqual({
        itemIds: ['1', '2', '3', '4'],
        portionsCovered: 4,
        batches: 2,
        extraPortions: 2,
      });
    });

    it('excludes prepared items from grouped cook items', () => {
      const items = [
        slotItem({ id: '1', date: '2026-06-25', recipe_id: 'r1', status: 'planned' }),
        slotItem({ id: '2', date: '2026-06-26', recipe_id: 'r1', status: 'prepared' }),
      ];

      const grouped = getGroupedPendingCookItems(items, '2026-06-25', '2026-06-30');
      expect(grouped.length).toBe(1);
      expect(grouped[0].count).toBe(1);
      expect(grouped[0].occurrences[0].itemId).toBe('1');
    });

    it('groups non-recipe items by display name', () => {
      const items = [
        slotItem({
          id: '1',
          date: '2026-06-25',
          item_type: 'custom',
          recipe_id: null,
          custom_name: 'Berry Yogurt Parfait',
          status: 'planned',
        }),
        slotItem({
          id: '2',
          date: '2026-06-26',
          item_type: 'custom',
          recipe_id: null,
          custom_name: 'Berry Yogurt Parfait',
          status: 'planned',
        }),
      ];

      const grouped = getGroupedPendingCookItems(items, '2026-06-25', '2026-06-30');
      expect(grouped.length).toBe(1);
      expect(grouped[0].count).toBe(2);
      expect(grouped[0].displayName).toBe('Berry Yogurt Parfait');
    });

    it('keeps different recipes as separate groups', () => {
      const items = [
        slotItem({ id: '1', date: '2026-06-25', recipe_id: 'r1', status: 'planned' }),
        slotItem({ id: '2', date: '2026-06-25', recipe_id: 'r2', status: 'planned' }),
      ];

      const grouped = getGroupedPendingCookItems(items, '2026-06-25', '2026-06-30');
      expect(grouped.length).toBe(2);
    });
  });
});
