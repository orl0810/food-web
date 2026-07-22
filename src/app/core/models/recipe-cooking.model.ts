import { StorageLocation } from './food-item.model';

export type IngredientReconciliationStatus =
  | 'sufficient'
  | 'short'
  | 'missing'
  | 'manual';

export interface InventoryQuantityChange {
  itemId: string;
  name: string;
  expectedQuantity: number;
  remainingQuantity: number;
  unit: string | null;
}

export interface IngredientReconciliationLine {
  key: string;
  name: string;
  requiredQuantity: number | null;
  unit: string | null;
  availableQuantity: number;
  status: IngredientReconciliationStatus;
  changes: InventoryQuantityChange[];
  matchingItemIds: string[];
  actualRemaining: number;
  remainingUnit: string | null;
  location: StorageLocation;
}

export interface ReadyPortionRemainder {
  name: string;
  recipeId: string;
  portions: number;
  storageLocation: StorageLocation;
  expiresAt: string | null;
}

export interface CompleteRecipeCookingCommand {
  recipeId: string;
  mealPlanItemIds: string[];
  inventoryChanges: InventoryQuantityChange[];
  inventoryCreates: {
    name: string;
    quantity: number;
    unit: string | null;
    location: StorageLocation;
  }[];
  readyPortion: ReadyPortionRemainder | null;
}

export interface CompleteRecipeCookingResult {
  updatedMealPlanItemIds: string[];
}

export interface RecipeCookingOccurrenceLabel {
  dateLabel: string;
  mealTypeLabel: string;
}

export interface RecipeCookingDraft {
  recipeId: string;
  recipeTitle: string;
  recipeYield: number;
  mealPlanItemIds: string[];
  batches: number;
  portionsCovered: number;
  extraPortions: number;
  coveredOccurrences: RecipeCookingOccurrenceLabel[];
  reconciliationLines: IngredientReconciliationLine[];
  readyPortionStorage: StorageLocation;
  readyPortionExpiresAt: string | null;
}
