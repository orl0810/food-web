import { FoodItem } from '../../core/models/food-item.model';
import { RecipeIngredient } from '../../core/models/recipe.model';
import {
  buildIngredientReconciliation,
  buildReconciledInventoryMutations,
  convertFoodQuantity,
} from './recipe-cooking.utils';

function ingredient(
  name: string,
  quantity: number | null,
  unit: string | null
): RecipeIngredient {
  return { id: crypto.randomUUID(), recipe_id: 'r1', name, quantity, unit };
}

function food(overrides: Partial<FoodItem>): FoodItem {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    name: 'Pasta',
    category: null,
    quantity: 1,
    unit: 'kg',
    expiration_date: null,
    location: 'pantry',
    created_at: '',
    ...overrides,
  };
}

describe('recipe-cooking.utils', () => {
  it('converts compatible mass and volume units', () => {
    expect(convertFoodQuantity(1, 'kg', 'g')).toBe(1000);
    expect(convertFoodQuantity(500, 'ml', 'L')).toBe(0.5);
    expect(convertFoodQuantity(2, 'pieces', 'pcs')).toBe(2);
    expect(convertFoodQuantity(1, 'g', 'ml')).toBeNull();
  });

  it('deducts a 500 g recipe requirement from 1 kg in inventory', () => {
    const inventory = [food({ id: 'pasta', quantity: 1, unit: 'kg' })];

    const [line] = buildIngredientReconciliation(
      [ingredient('Pasta', 500, 'gr')],
      inventory,
      1
    );

    expect(line.status).toBe('sufficient');
    expect(line.requiredQuantity).toBe(500);
    expect(line.changes[0].remainingQuantity).toBe(0.5);
  });

  it('multiplies and aggregates duplicate ingredient requirements by batch', () => {
    const inventory = [food({ id: 'pasta', quantity: 2, unit: 'kg' })];

    const [line] = buildIngredientReconciliation(
      [ingredient('Pasta', 200, 'g'), ingredient(' pasta ', 50, 'grams')],
      inventory,
      2
    );

    expect(line.requiredQuantity).toBe(500);
    expect(line.changes[0].remainingQuantity).toBe(1.5);
  });

  it('uses earliest-expiring matching stock first', () => {
    const inventory = [
      food({ id: 'later', quantity: 400, unit: 'g', expiration_date: '2026-08-01' }),
      food({ id: 'sooner', quantity: 300, unit: 'g', expiration_date: '2026-07-23' }),
    ];

    const [line] = buildIngredientReconciliation(
      [ingredient('Pasta', 500, 'g')],
      inventory,
      1
    );

    expect(line.changes).toEqual([
      jasmine.objectContaining({ itemId: 'sooner', remainingQuantity: 0 }),
      jasmine.objectContaining({ itemId: 'later', remainingQuantity: 200 }),
    ]);
  });

  it('asks for an actual balance when stock is missing or short', () => {
    const inventory = [food({ id: 'pasta', quantity: 300, unit: 'g' })];
    const lines = buildIngredientReconciliation(
      [ingredient('Pasta', 500, 'g'), ingredient('Eggs', 2, 'pcs')],
      inventory,
      1
    );

    expect(lines.map((line) => line.status)).toEqual(['short', 'missing']);

    lines[0].actualRemaining = 100;
    lines[1].actualRemaining = 4;
    const mutations = buildReconciledInventoryMutations(lines, inventory);

    expect(mutations.changes[0]).toEqual(
      jasmine.objectContaining({ itemId: 'pasta', remainingQuantity: 100 })
    );
    expect(mutations.creates[0]).toEqual(
      jasmine.objectContaining({ name: 'Eggs', quantity: 4, unit: 'pcs' })
    );
  });
});
