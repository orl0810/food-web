import { FoodItem } from './food-item.model';
import { MealType } from './meal-plan.model';
import { PreparedPortion } from './prepared-portion.model';
import { RecipeMealPlanSummary } from './recipe.model';

export type MealSlotItemType = 'recipe' | 'prepared_portion' | 'inventory_item' | 'custom';

export type MealSlotItemStatus = 'planned' | 'prepared' | 'eaten' | 'skipped';

export type FoodLogSource = 'manual' | 'voice' | 'photo';

export interface MealSlotItem {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  item_type: MealSlotItemType;
  recipe_id: string | null;
  prepared_portion_id: string | null;
  inventory_item_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  portions_used: number;
  notes: string | null;
  sort_order: number;
  status: MealSlotItemStatus;
  completed_at: string | null;
  source: FoodLogSource | null;
  image_url: string | null;
  transcript: string | null;
  created_at: string;
  recipe?: RecipeMealPlanSummary;
  prepared_portion?: Pick<PreparedPortion, 'id' | 'name' | 'available_portions' | 'expires_at' | 'storage_location'>;
  inventory_item?: Pick<FoodItem, 'id' | 'name' | 'quantity' | 'unit' | 'location' | 'expiration_date'>;
}

export interface MealSlotItemInput {
  date: string;
  meal_type: MealType;
  item_type: MealSlotItemType;
  recipe_id?: string | null;
  prepared_portion_id?: string | null;
  inventory_item_id?: string | null;
  custom_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  portions_used?: number;
  notes?: string | null;
  sort_order?: number;
  status?: MealSlotItemStatus;
  completed_at?: string | null;
  source?: FoodLogSource | null;
  image_url?: string | null;
  transcript?: string | null;
  /** Skip expired-portion warning when user confirmed */
  allow_expired?: boolean;
}

/** @deprecated Use MealSlotItem — kept for gradual migration */
export type MealPlanEntry = MealSlotItem;
