import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import {
  buildNutritionProgressItems,
  calculateDailyNutritionConsumed,
} from './nutrition-consumed.utils';
import { DailyNutritionTargets } from '../../core/models/nutrition.model';

describe('nutrition-consumed.utils', () => {
  const targets: DailyNutritionTargets = {
    userId: 'user-1',
    proteinGrams: 120,
    fiberGrams: 30,
    carbsGrams: 220,
    fatsGrams: 70,
    sugarLimitGrams: 50,
    source: 'estimated',
    calculatedAt: '2026-07-10T00:00:00.000Z',
  };

  function buildItem(overrides: Partial<MealSlotItem>): MealSlotItem {
    return {
      id: 'item-1',
      user_id: 'user-1',
      date: '2026-07-10',
      meal_type: 'lunch',
      item_type: 'custom',
      recipe_id: null,
      prepared_portion_id: null,
      inventory_item_id: null,
      product_id: null,
      custom_name: 'Snack',
      quantity: null,
      unit: null,
      portions_used: 1,
      notes: null,
      sort_order: 0,
      status: 'eaten',
      completed_at: null,
      source: 'manual',
      image_url: null,
      transcript: null,
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
      created_at: '2026-07-10T00:00:00.000Z',
      ...overrides,
    };
  }

  it('only counts eaten items for the selected date', () => {
    const consumed = calculateDailyNutritionConsumed('2026-07-10', [
      buildItem({
        item_type: 'product',
        protein_snapshot: 20,
        fiber_snapshot: 5,
        carbohydrates_snapshot: 30,
        fat_snapshot: 10,
        sugar_snapshot: 8,
        calories_snapshot: 300,
      }),
      buildItem({ status: 'planned', item_type: 'product', protein_snapshot: 99 }),
      buildItem({ date: '2026-07-09', item_type: 'product', protein_snapshot: 99 }),
    ]);

    expect(consumed.proteinGrams).toBe(20);
    expect(consumed.fiberGrams).toBe(5);
    expect(consumed.hasMissingNutritionData).toBeFalse();
  });

  it('scales recipe nutrition by portions used', () => {
    const consumed = calculateDailyNutritionConsumed('2026-07-10', [
      buildItem({
        item_type: 'recipe',
        portions_used: 2,
        recipe: {
          id: 'recipe-1',
          title: 'Chicken bowl',
          description: null,
          tags: [],
          prep_time_minutes: 10,
          portions: 4,
          image_url: null,
          image_status: 'pending',
          image_storage_key: null,
          meal_type: 'lunch',
          category: null,
          nutrition: {
            calories: 400,
            fat_g: 12,
            cholesterol_mg: null,
            protein_g: 30,
            sugar_g: 4,
            sodium_mg: null,
            carbs_g: 35,
            fiber_g: 6,
            calculated_at: null,
          },
        },
      }),
    ]);

    expect(consumed.proteinGrams).toBe(60);
    expect(consumed.carbsGrams).toBe(70);
    expect(consumed.hasMissingNutritionData).toBeFalse();
  });

  it('flags missing nutrition data for custom food logs', () => {
    const consumed = calculateDailyNutritionConsumed('2026-07-10', [buildItem({})]);

    expect(consumed.proteinGrams).toBe(0);
    expect(consumed.hasMissingNutritionData).toBeTrue();
  });

  it('treats sugars as an upper limit in progress items', () => {
    const items = buildNutritionProgressItems(
      {
        date: '2026-07-10',
        proteinGrams: 65,
        fiberGrams: 18,
        carbsGrams: 140,
        fatsGrams: 45,
        sugarsGrams: 55,
      },
      targets
    );

    const sugars = items.find((item) => item.key === 'sugars');
    expect(sugars?.isUpperLimit).toBeTrue();
    expect(sugars?.status).toBe('over');
    expect(sugars?.hint).toContain('sugar target');
  });
});
