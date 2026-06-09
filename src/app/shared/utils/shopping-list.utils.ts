import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import { Recipe } from '../../core/models/recipe.model';
import { ShoppingItem } from '../../core/models/shopping-item.model';
import { NamedItem } from './recipe-availability.utils';

export interface MissingIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export function normalizeShoppingName(name: string): string {
  return name.toLowerCase().trim();
}

export function isIngredientInInventory(
  ingredientName: string,
  inventory: NamedItem[]
): boolean {
  const target = normalizeShoppingName(ingredientName);
  return inventory.some((item) => normalizeShoppingName(item.name) === target);
}

export function computeMissingIngredients(
  entries: MealSlotItem[],
  recipes: Recipe[],
  inventory: NamedItem[]
): MissingIngredient[] {
  const recipeIds = new Set<string>();
  for (const entry of entries) {
    if (entry.item_type === 'recipe' && entry.recipe_id) {
      recipeIds.add(entry.recipe_id);
    }
  }

  const missingByName = new Map<string, MissingIngredient>();

  for (const recipeId of recipeIds) {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe?.ingredients) {
      continue;
    }

    for (const ingredient of recipe.ingredients) {
      const name = ingredient.name.trim();
      if (!name) {
        continue;
      }

      const key = normalizeShoppingName(name);
      if (missingByName.has(key) || isIngredientInInventory(name, inventory)) {
        continue;
      }

      missingByName.set(key, {
        name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      });
    }
  }

  return [...missingByName.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function filterNewShoppingItems(
  missing: MissingIngredient[],
  existingItems: ShoppingItem[]
): MissingIngredient[] {
  const existingNames = new Set(
    existingItems.map((item) => normalizeShoppingName(item.name))
  );

  return missing.filter(
    (item) => !existingNames.has(normalizeShoppingName(item.name))
  );
}
