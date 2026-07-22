import { FoodItem, StorageLocation } from '../../core/models/food-item.model';
import {
  IngredientReconciliationLine,
  InventoryQuantityChange,
} from '../../core/models/recipe-cooking.model';
import { RecipeIngredient } from '../../core/models/recipe.model';
import { normalizeNameKey } from './name-normalization.utils';

interface CanonicalUnit {
  dimension: 'mass' | 'volume' | 'count';
  factor: number;
  symbol: string;
}

const UNIT_ALIASES: Record<string, CanonicalUnit> = {
  kg: { dimension: 'mass', factor: 1_000_000, symbol: 'kg' },
  kilogram: { dimension: 'mass', factor: 1_000_000, symbol: 'kg' },
  kilograms: { dimension: 'mass', factor: 1_000_000, symbol: 'kg' },
  g: { dimension: 'mass', factor: 1_000, symbol: 'g' },
  gr: { dimension: 'mass', factor: 1_000, symbol: 'g' },
  gram: { dimension: 'mass', factor: 1_000, symbol: 'g' },
  grams: { dimension: 'mass', factor: 1_000, symbol: 'g' },
  mg: { dimension: 'mass', factor: 1, symbol: 'mg' },
  milligram: { dimension: 'mass', factor: 1, symbol: 'mg' },
  milligrams: { dimension: 'mass', factor: 1, symbol: 'mg' },
  l: { dimension: 'volume', factor: 1_000, symbol: 'L' },
  liter: { dimension: 'volume', factor: 1_000, symbol: 'L' },
  liters: { dimension: 'volume', factor: 1_000, symbol: 'L' },
  litre: { dimension: 'volume', factor: 1_000, symbol: 'L' },
  litres: { dimension: 'volume', factor: 1_000, symbol: 'L' },
  ml: { dimension: 'volume', factor: 1, symbol: 'ml' },
  milliliter: { dimension: 'volume', factor: 1, symbol: 'ml' },
  milliliters: { dimension: 'volume', factor: 1, symbol: 'ml' },
  millilitre: { dimension: 'volume', factor: 1, symbol: 'ml' },
  millilitres: { dimension: 'volume', factor: 1, symbol: 'ml' },
  pc: { dimension: 'count', factor: 1, symbol: 'pcs' },
  pcs: { dimension: 'count', factor: 1, symbol: 'pcs' },
  piece: { dimension: 'count', factor: 1, symbol: 'pcs' },
  pieces: { dimension: 'count', factor: 1, symbol: 'pcs' },
};

function unitDefinition(unit: string | null | undefined): CanonicalUnit | null {
  return UNIT_ALIASES[unit?.trim().toLowerCase() ?? ''] ?? null;
}

export function canonicalizeFoodUnit(unit: string | null | undefined): string | null {
  return unitDefinition(unit)?.symbol ?? (unit?.trim() || null);
}

export function convertFoodQuantity(
  quantity: number,
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined
): number | null {
  const from = unitDefinition(fromUnit);
  const to = unitDefinition(toUnit);
  if (from && to && from.dimension === to.dimension) {
    return (quantity * from.factor) / to.factor;
  }

  const normalizedFrom = fromUnit?.trim().toLowerCase() ?? '';
  const normalizedTo = toUnit?.trim().toLowerCase() ?? '';
  return normalizedFrom === normalizedTo ? quantity : null;
}

function inventoryOrder(a: FoodItem, b: FoodItem): number {
  return (a.expiration_date ?? '9999-12-31').localeCompare(
    b.expiration_date ?? '9999-12-31'
  );
}

function roundQuantity(value: number): number {
  return Math.max(0, Math.round(value * 1_000_000_000) / 1_000_000_000);
}

export function buildIngredientReconciliation(
  ingredients: RecipeIngredient[],
  inventory: FoodItem[],
  batches: number
): IngredientReconciliationLine[] {
  const grouped = new Map<
    string,
    { name: string; quantity: number | null; unit: string | null }
  >();

  for (const ingredient of ingredients) {
    const nameKey = normalizeNameKey(ingredient.name);
    const unit = canonicalizeFoodUnit(ingredient.unit);
    const key = `${nameKey}|${unit?.toLowerCase() ?? ''}`;
    const existing = grouped.get(key);
    const quantity =
      ingredient.quantity == null ? null : Math.max(0, ingredient.quantity) * batches;
    if (existing) {
      existing.quantity =
        existing.quantity == null || quantity == null
          ? null
          : existing.quantity + quantity;
    } else {
      grouped.set(key, { name: ingredient.name.trim(), quantity, unit });
    }
  }

  return [...grouped.entries()].map(([key, requirement]) => {
    const sameName = inventory
      .filter((item) => normalizeNameKey(item.name) === key.split('|')[0] && item.quantity > 0)
      .sort(inventoryOrder);
    const compatible = sameName.filter(
      (item) =>
        requirement.unit != null &&
        convertFoodQuantity(item.quantity, item.unit, requirement.unit) != null
    );
    const defaultLocation: StorageLocation = sameName[0]?.location ?? 'pantry';
    const defaultUnit = requirement.unit ?? sameName[0]?.unit ?? null;

    if (requirement.quantity == null || requirement.quantity <= 0 || !requirement.unit) {
      return {
        key,
        name: requirement.name,
        requiredQuantity: requirement.quantity,
        unit: requirement.unit,
        availableQuantity: 0,
        status: 'manual',
        changes: [],
        matchingItemIds: sameName.map((item) => item.id),
        actualRemaining: 0,
        remainingUnit: defaultUnit,
        location: defaultLocation,
      };
    }

    const availableQuantity = compatible.reduce(
      (total, item) =>
        total + (convertFoodQuantity(item.quantity, item.unit, requirement.unit) ?? 0),
      0
    );

    if (availableQuantity + 1e-9 < requirement.quantity) {
      return {
        key,
        name: requirement.name,
        requiredQuantity: requirement.quantity,
        unit: requirement.unit,
        availableQuantity: roundQuantity(availableQuantity),
        status:
          sameName.length === 0
            ? 'missing'
            : compatible.length === 0
              ? 'manual'
              : 'short',
        changes: [],
        matchingItemIds: compatible.map((item) => item.id),
        actualRemaining: 0,
        remainingUnit: defaultUnit,
        location: defaultLocation,
      };
    }

    let requiredRemaining = requirement.quantity;
    const changes: InventoryQuantityChange[] = [];
    for (const item of compatible) {
      if (requiredRemaining <= 1e-9) {
        break;
      }
      const availableInRequiredUnit =
        convertFoodQuantity(item.quantity, item.unit, requirement.unit) ?? 0;
      const usedInRequiredUnit = Math.min(requiredRemaining, availableInRequiredUnit);
      const usedInInventoryUnit =
        convertFoodQuantity(usedInRequiredUnit, requirement.unit, item.unit) ?? 0;
      changes.push({
        itemId: item.id,
        name: item.name,
        expectedQuantity: item.quantity,
        remainingQuantity: roundQuantity(item.quantity - usedInInventoryUnit),
        unit: item.unit,
      });
      requiredRemaining -= usedInRequiredUnit;
    }

    return {
      key,
      name: requirement.name,
      requiredQuantity: requirement.quantity,
      unit: requirement.unit,
      availableQuantity: roundQuantity(availableQuantity),
      status: 'sufficient',
      changes,
      matchingItemIds: compatible.map((item) => item.id),
      actualRemaining: roundQuantity(availableQuantity - requirement.quantity),
      remainingUnit: requirement.unit,
      location: defaultLocation,
    };
  });
}

export function buildReconciledInventoryMutations(
  lines: IngredientReconciliationLine[],
  inventory: FoodItem[]
): {
  changes: InventoryQuantityChange[];
  creates: {
    name: string;
    quantity: number;
    unit: string | null;
    location: StorageLocation;
  }[];
} {
  const changes = lines.flatMap((line) => line.status === 'sufficient' ? line.changes : []);
  const creates: {
    name: string;
    quantity: number;
    unit: string | null;
    location: StorageLocation;
  }[] = [];

  for (const line of lines.filter((entry) => entry.status !== 'sufficient')) {
    const remaining = Math.max(0, line.actualRemaining);
    const matching = line.matchingItemIds
      .map((id) => inventory.find((item) => item.id === id))
      .filter((item): item is FoodItem => !!item);
    const target = matching.find(
      (item) => convertFoodQuantity(remaining, line.remainingUnit, item.unit) != null
    );

    if (target) {
      changes.push({
        itemId: target.id,
        name: target.name,
        expectedQuantity: target.quantity,
        remainingQuantity:
          convertFoodQuantity(remaining, line.remainingUnit, target.unit) ?? remaining,
        unit: target.unit,
      });
      for (const duplicate of matching.filter((item) => item.id !== target.id)) {
        changes.push({
          itemId: duplicate.id,
          name: duplicate.name,
          expectedQuantity: duplicate.quantity,
          remainingQuantity: 0,
          unit: duplicate.unit,
        });
      }
    } else if (remaining > 0) {
      creates.push({
        name: line.name,
        quantity: remaining,
        unit: line.remainingUnit,
        location: line.location,
      });
    }
  }

  return { changes, creates };
}
