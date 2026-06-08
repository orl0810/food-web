import { FoodItem } from '../../core/models/food-item.model';

export interface NamedIngredient {
  name: string;
}

const DESCRIPTOR_WORDS = new Set([
  'fresh',
  'organic',
  'raw',
  'cooked',
  'dried',
  'frozen',
  'chopped',
  'sliced',
  'diced',
  'minced',
  'ground',
  'whole',
  'large',
  'small',
  'medium',
  'ripe',
  'boneless',
  'skinless',
]);

function singularize(token: string): string {
  if (token.length <= 3) {
    return token;
  }
  if (token.endsWith('ies')) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('es')) {
    return token.slice(0, -2);
  }
  if (token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

export function normalizeIngredientName(name: string): string {
  if (!name) {
    return '';
  }

  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return base
    .split(' ')
    .filter((token) => token.length > 0 && !DESCRIPTOR_WORDS.has(token))
    .map(singularize)
    .join(' ')
    .trim();
}

export function ingredientMatches(
  recipeIngredientName: string,
  inventoryFoodName: string
): boolean {
  const a = normalizeIngredientName(recipeIngredientName);
  const b = normalizeIngredientName(inventoryFoodName);

  if (!a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }

  const aTokens = a.split(' ');
  const bTokens = b.split(' ');
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);

  const everyAInB = aTokens.every((token) => bSet.has(token));
  const everyBInA = bTokens.every((token) => aSet.has(token));

  return everyAInB || everyBInA;
}

export function findMatchingInventoryItem(
  recipeIngredient: NamedIngredient,
  inventoryItems: FoodItem[]
): FoodItem | null {
  const matches = inventoryItems.filter((item) =>
    ingredientMatches(recipeIngredient.name, item.name)
  );

  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort((a, b) => {
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

export function calculateIngredientMatchPercentage(
  recipeIngredients: NamedIngredient[],
  inventoryItems: FoodItem[]
): number {
  if (recipeIngredients.length === 0) {
    return 0;
  }

  const matched = recipeIngredients.filter(
    (ingredient) => findMatchingInventoryItem(ingredient, inventoryItems) !== null
  ).length;

  return Math.round((matched / recipeIngredients.length) * 100);
}
