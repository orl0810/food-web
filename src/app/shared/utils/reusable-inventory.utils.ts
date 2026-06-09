import { FoodItemHistory } from '../../core/models/food-item-history.model';
import { FoodItem } from '../../core/models/food-item.model';
import { ReusableInventoryItem } from '../../core/models/reusable-inventory-item.model';
import { normalizeNameKey } from './name-normalization.utils';

export type FoodIconResolver = (name: string, category?: string | null) => string;

function pickActiveInventoryItem(items: FoodItem[]): FoodItem | null {
  if (items.length === 0) {
    return null;
  }

  return [...items].sort((a, b) => {
    if (a.expiration_date && b.expiration_date) {
      return a.expiration_date.localeCompare(b.expiration_date);
    }
    if (a.expiration_date) {
      return -1;
    }
    if (b.expiration_date) {
      return 1;
    }
    return 0;
  })[0];
}

function buildInventoryByName(items: FoodItem[]): Map<string, FoodItem[]> {
  const map = new Map<string, FoodItem[]>();

  for (const item of items) {
    const key = normalizeNameKey(item.name);
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  }

  return map;
}

export function buildReusableInventoryItems(
  history: FoodItemHistory[],
  inventoryItems: FoodItem[],
  resolveIcon: FoodIconResolver
): ReusableInventoryItem[] {
  const inventoryByName = buildInventoryByName(inventoryItems);

  const reusableItems = history.map((entry): ReusableInventoryItem => {
    const normalizedName = normalizeNameKey(entry.name);
    const matchingItems = inventoryByName.get(normalizedName) ?? [];
    const activeItem = pickActiveInventoryItem(matchingItems);

    return {
      id: entry.id,
      name: entry.name,
      normalizedName,
      category: entry.category ?? undefined,
      defaultUnit: entry.unit ?? undefined,
      defaultQuantity: entry.default_quantity,
      defaultLocation: entry.location,
      icon: resolveIcon(entry.name, entry.category),
      lastAddedAt: entry.last_used_at,
      timesAdded: entry.times_added ?? 1,
      currentlyInInventory: matchingItems.length > 0,
      activeInventoryItemId: activeItem?.id,
    };
  });

  return reusableItems.sort((a, b) =>
    (b.lastAddedAt ?? '').localeCompare(a.lastAddedAt ?? '')
  );
}

export function filterReusableItems(
  items: ReusableInventoryItem[],
  query: string
): ReusableInventoryItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return items;
  }

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.category?.toLowerCase().includes(normalizedQuery)
  );
}

export function findHistoryEntryForReusableItem(
  history: FoodItemHistory[],
  item: ReusableInventoryItem
): FoodItemHistory | null {
  return history.find((entry) => entry.id === item.id) ?? null;
}
