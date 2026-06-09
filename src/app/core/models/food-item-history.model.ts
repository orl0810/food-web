import { StorageLocation } from './food-item.model';

export interface FoodItemHistory {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  unit: string | null;
  location: StorageLocation;
  default_quantity: number;
  last_used_at: string;
  created_at: string;
  times_added: number;
}
