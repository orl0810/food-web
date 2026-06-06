export interface NamedItem {
  name: string;
}

export type IngredientAvailabilityVariant = 'ready' | 'partial' | 'none' | 'empty';

export interface IngredientAvailability {
  available: number;
  total: number;
  missing: number;
  label: string;
  variant: IngredientAvailabilityVariant;
}

export function getIngredientAvailability(
  recipeIngredients: NamedItem[],
  inventoryItems: NamedItem[]
): IngredientAvailability {
  const { available, total } = countAvailableIngredients(recipeIngredients, inventoryItems);
  const missing = total - available;

  if (total === 0) {
    return {
      available,
      total,
      missing,
      label: 'No ingredients listed',
      variant: 'empty',
    };
  }

  if (missing === 0) {
    return {
      available,
      total,
      missing,
      label: 'All ingredients ready',
      variant: 'ready',
    };
  }

  return {
    available,
    total,
    missing,
    label: missing === 1 ? '1 item needed' : `${missing} items needed`,
    variant: 'partial',
  };
}

export function countAvailableIngredients(
  recipeIngredients: NamedItem[],
  inventoryItems: NamedItem[]
): { available: number; total: number } {
  const total = recipeIngredients.length;
  if (total === 0) {
    return { available: 0, total: 0 };
  }

  const inventoryNames = inventoryItems.map((item) => item.name.toLowerCase().trim());

  const available = recipeIngredients.filter((ingredient) => {
    const name = ingredient.name.toLowerCase().trim();
    return inventoryNames.some(
      (inventoryName) => inventoryName.includes(name) || name.includes(inventoryName)
    );
  }).length;

  return { available, total };
}
