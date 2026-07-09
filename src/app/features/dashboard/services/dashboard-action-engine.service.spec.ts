import { FoodItem } from '../../../core/models/food-item.model';
import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import { PreparedPortion } from '../../../core/models/prepared-portion.model';
import {
  ActionEngineInput,
  buildDashboardActions,
} from './dashboard-action-engine.service';

const TODAY = new Date(2026, 5, 10); // 2026-06-10 (Wednesday)
const TODAY_ISO = '2026-06-10';

function makeFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'food-1',
    user_id: 'user-1',
    name: 'Spinach',
    category: null,
    quantity: 1,
    unit: 'kg',
    expiration_date: null,
    location: 'fridge',
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function makePortion(overrides: Partial<PreparedPortion> = {}): PreparedPortion {
  return {
    id: 'portion-1',
    user_id: 'user-1',
    name: 'Roasted Vegetables',
    source_type: 'custom',
    recipe_id: null,
    total_portions: 4,
    available_portions: 2,
    cooked_at: '2026-06-07',
    expires_at: null,
    storage_location: 'fridge',
    notes: null,
    status: 'available',
    created_at: '2026-06-07T00:00:00Z',
    updated_at: '2026-06-07T00:00:00Z',
    ...overrides,
  };
}

function makeSlotItem(overrides: Partial<MealSlotItem> = {}): MealSlotItem {
  return {
    id: 'slot-1',
    user_id: 'user-1',
    date: TODAY_ISO,
    meal_type: 'lunch',
    item_type: 'recipe',
    recipe_id: 'recipe-1',
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
    created_at: '2026-06-09T00:00:00Z',
    recipe: {
      id: 'recipe-1',
      title: 'Chicken Omelette',
      description: null,
      tags: [],
      prep_time_minutes: 15,
      image_url: null,
      image_status: 'pending',
      image_storage_key: null,
      meal_type: 'breakfast',
      category: null,
    },
    ...overrides,
  };
}

function makeInput(overrides: Partial<ActionEngineInput> = {}): ActionEngineInput {
  return {
    todaySlotItems: [],
    inventoryItems: [],
    portions: [],
    uncheckedShoppingCount: 0,
    ...overrides,
  };
}

/** Inventory that triggers no expiration or low-stock actions. */
function calmInventory(): FoodItem[] {
  return [1, 2, 3, 4, 5].map((n) =>
    makeFoodItem({ id: `food-${n}`, name: `Item ${n}`, expiration_date: '2026-07-01' })
  );
}

describe('buildDashboardActions', () => {
  it('returns no actions when everything is on track', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [makeSlotItem({ status: 'eaten' })],
    });

    expect(buildDashboardActions(input, TODAY)).toEqual([]);
  });

  it('generates an urgent action when inventory items are expired', () => {
    const input = makeInput({
      inventoryItems: [
        ...calmInventory(),
        makeFoodItem({ id: 'expired-1', name: 'Milk', expiration_date: '2026-06-08' }),
      ],
      todaySlotItems: [makeSlotItem()],
    });

    const [first] = buildDashboardActions(input, TODAY);

    expect(first.type).toBe('use_expiring_inventory');
    expect(first.priority).toBe('urgent');
    expect(first.title).toContain('Milk');
    expect(first.primaryKind).toBe('navigate');
    expect(first.relatedInventoryItemIds).toEqual(['expired-1']);
  });

  it('generates an urgent action for prepared food expiring today', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [makeSlotItem()],
      portions: [makePortion({ expires_at: TODAY_ISO })],
    });

    const [first] = buildDashboardActions(input, TODAY);

    expect(first.type).toBe('prepared_food_expiring');
    expect(first.priority).toBe('urgent');
    expect(first.relatedPortionId).toBe('portion-1');
    expect(first.chips).toContain('today');
  });

  it('generates a high priority action for inventory expiring within two days', () => {
    const input = makeInput({
      inventoryItems: [
        ...calmInventory(),
        makeFoodItem({ id: 'soon-1', name: 'Spinach', expiration_date: '2026-06-12' }),
      ],
      todaySlotItems: [makeSlotItem({ status: 'eaten' })],
    });

    const [first] = buildDashboardActions(input, TODAY);

    expect(first.type).toBe('use_expiring_inventory');
    expect(first.priority).toBe('high');
    expect(first.primaryKind).toBe('complete');
    expect(first.relatedInventoryItemIds).toEqual(['soon-1']);
  });

  it('suggests cooking the first planned recipe of the day', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [
        makeSlotItem({ id: 'slot-dinner', meal_type: 'dinner', sort_order: 1 }),
        makeSlotItem({ id: 'slot-breakfast', meal_type: 'breakfast' }),
      ],
    });

    const [first] = buildDashboardActions(input, TODAY);

    expect(first.type).toBe('cook_recipe_today');
    expect(first.priority).toBe('medium');
    expect(first.relatedSlotItemId).toBe('slot-breakfast');
    expect(first.message).toContain('Chicken Omelette');
    expect(first.message).toContain('breakfast');
  });

  it('skips recipes that are already prepared or eaten', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [
        makeSlotItem({ id: 'slot-done', status: 'prepared' }),
        makeSlotItem({ id: 'slot-eaten', meal_type: 'dinner', status: 'eaten' }),
      ],
    });

    const actions = buildDashboardActions(input, TODAY);

    expect(actions.some((a) => a.type === 'cook_recipe_today')).toBeFalse();
  });

  it('prioritizes a planned ready portion for today over cooking a recipe', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [
        makeSlotItem({ id: 'slot-recipe' }),
        makeSlotItem({
          id: 'slot-portion',
          meal_type: 'dinner',
          item_type: 'prepared_portion',
          recipe_id: null,
          recipe: undefined,
          prepared_portion_id: 'portion-1',
          prepared_portion: {
            id: 'portion-1',
            name: 'Roasted Vegetables',
            available_portions: 2,
            expires_at: null,
            storage_location: 'fridge',
          },
        }),
      ],
    });

    const [first] = buildDashboardActions(input, TODAY);

    expect(first.type).toBe('use_prepared_portion');
    expect(first.priority).toBe('high');
    expect(first.relatedSlotItemId).toBe('slot-portion');
    expect(first.relatedPortionId).toBe('portion-1');
  });

  it('suggests planning meals when today is empty', () => {
    const input = makeInput({ inventoryItems: calmInventory() });

    const actions = buildDashboardActions(input, TODAY);
    const planAction = actions.find((a) => a.type === 'no_meal_planned_today');

    expect(planAction).toBeDefined();
    expect(planAction?.priority).toBe('low');
    expect(planAction?.primaryRoute).toBe('/meal-plan');
  });

  it('warns when inventory is low and mentions pending shopping items', () => {
    const input = makeInput({
      inventoryItems: [makeFoodItem({ expiration_date: '2026-07-01' })],
      todaySlotItems: [makeSlotItem({ status: 'eaten' })],
      uncheckedShoppingCount: 4,
    });

    const actions = buildDashboardActions(input, TODAY);
    const lowAction = actions.find((a) => a.type === 'inventory_low');

    expect(lowAction).toBeDefined();
    expect(lowAction?.priority).toBe('low');
    expect(lowAction?.message).toContain('4 items waiting');
    expect(lowAction?.primaryRoute).toBe('/shopping-list');
  });

  it('orders actions by priority: urgent, high, medium, low', () => {
    const input = makeInput({
      inventoryItems: [
        makeFoodItem({ id: 'expired-1', name: 'Milk', expiration_date: '2026-06-01' }),
        makeFoodItem({ id: 'soon-1', name: 'Spinach', expiration_date: '2026-06-11' }),
      ],
      todaySlotItems: [makeSlotItem()],
    });

    const priorities = buildDashboardActions(input, TODAY).map((a) => a.priority);
    const sorted = [...priorities].sort((a, b) => {
      const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
      return rank[a] - rank[b];
    });

    expect(priorities).toEqual(sorted);
    expect(priorities[0]).toBe('urgent');
  });

  it('produces deterministic ids that include the date', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [makeSlotItem()],
    });

    const first = buildDashboardActions(input, TODAY)[0];
    const second = buildDashboardActions(input, TODAY)[0];

    expect(first.id).toBe(second.id);
    expect(first.id).toContain(TODAY_ISO);
    expect(first.id).toContain('slot-1');
  });

  it('ignores meal plan items from other days', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [makeSlotItem({ date: '2026-06-11' })],
    });

    const actions = buildDashboardActions(input, TODAY);

    expect(actions.some((a) => a.type === 'cook_recipe_today')).toBeFalse();
    expect(actions.some((a) => a.type === 'no_meal_planned_today')).toBeTrue();
  });

  it('suggests using available portions as a low priority fallback', () => {
    const input = makeInput({
      inventoryItems: calmInventory(),
      todaySlotItems: [makeSlotItem({ status: 'eaten' })],
      portions: [makePortion({ expires_at: '2026-06-20' })],
    });

    const [first] = buildDashboardActions(input, TODAY);

    expect(first.type).toBe('use_prepared_portion');
    expect(first.priority).toBe('low');
    expect(first.relatedPortionId).toBe('portion-1');
    expect(first.relatedSlotItemId).toBeUndefined();
  });
});
