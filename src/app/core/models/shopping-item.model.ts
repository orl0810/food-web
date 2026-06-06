export type ShoppingItemSource = 'manual' | 'meal_plan';

export interface ShoppingItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  is_checked: boolean;
  source: ShoppingItemSource;
  created_at: string;
}

export interface ShoppingItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  source?: ShoppingItemSource;
}

export type ShoppingItemUpdate = Partial<
  Pick<ShoppingItemInput, 'name' | 'quantity' | 'unit'>
> & {
  is_checked?: boolean;
};
