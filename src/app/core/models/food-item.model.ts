export type StorageLocation = 'fridge' | 'freezer' | 'pantry';

export interface FoodItem {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  expiration_date: string | null;
  location: StorageLocation;
  created_at: string;
}

export interface FoodItemInsert {
  name: string;
  category?: string | null;
  quantity: number;
  unit?: string | null;
  expiration_date?: string | null;
  location: StorageLocation;
}

export type FoodItemUpdate = Partial<FoodItemInsert>;

export const STORAGE_LOCATIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry'];

export const STORAGE_LOCATION_LABELS: Record<StorageLocation, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Pantry',
};

export type InventoryFilter =
  | 'all'
  | 'fridge'
  | 'freezer'
  | 'pantry'
  | 'expiring_soon'
  | 'ready_portions';

export const INVENTORY_FILTERS: { value: InventoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fridge', label: 'Fridge' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'ready_portions', label: 'Ready Portions' },
];
