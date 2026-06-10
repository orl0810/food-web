import { MealSlotItemStatus } from '../../../core/models/meal-slot-item.model';

/**
 * All supported smart action types. Only a core subset is generated today;
 * the rest are reserved so new generators can be added without model changes.
 */
export type DashboardActionType =
  | 'cook_recipe_today'
  | 'prepare_component_for_tomorrow'
  | 'use_prepared_portion'
  | 'use_expiring_inventory'
  | 'inventory_low'
  | 'shopping_list_pending'
  | 'no_meal_planned_today'
  | 'meal_plan_incomplete'
  | 'prepared_food_expiring'
  | 'weekly_plan_progress'
  | 'onboarding_starter_action'
  | 'create_first_meal_plan';

export type DashboardActionPriority = 'low' | 'medium' | 'high' | 'urgent';

export type DashboardActionChip =
  | 'today'
  | 'expiring'
  | 'meal-plan'
  | 'inventory'
  | 'ready-portion';

/** How the primary CTA behaves: completes data updates or navigates somewhere. */
export type DashboardActionKind = 'complete' | 'navigate';

export interface DashboardAction {
  /** Deterministic id (`type:relatedId:date`) so dismissals survive regeneration. */
  id: string;
  type: DashboardActionType;
  priority: DashboardActionPriority;
  title: string;
  message: string;
  chips: DashboardActionChip[];
  primaryLabel: string;
  primaryKind: DashboardActionKind;
  primaryRoute?: string;
  secondaryLabel?: string;
  secondaryRoute?: string;
  /** Tie-breaker inside the same priority (expiry date, meal order...). */
  sortKey?: string;
  relatedSlotItemId?: string;
  relatedRecipeId?: string;
  relatedPortionId?: string;
  relatedInventoryItemIds?: string[];
}

/** One inventory line shown (and editable) in the completion confirmation. */
export interface InventoryDeduction {
  itemId: string;
  name: string;
  /** Quantity currently in inventory. */
  available: number;
  /** Quantity that will be subtracted. Editable by the user, 0 skips the line. */
  quantityUsed: number;
  unit: string | null;
}

/**
 * Everything needed to apply a completion. Built by the facade as a draft,
 * adjusted by the user in the confirmation dialog, then applied.
 */
export interface ActionCompletionPayload {
  slotItemId?: string;
  slotStatus?: MealSlotItemStatus;
  inventoryDeductions?: InventoryDeduction[];
  portionId?: string;
  portionName?: string;
  /** Portions available before this completion (caps the editable input). */
  portionsAvailable?: number;
  portionsUsed?: number;
}
