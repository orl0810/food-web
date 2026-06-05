import { StorageLocation } from './food-item.model';

export interface FoodCatalogItem {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  default_unit: string | null;
  default_location: StorageLocation;
  default_quantity: number;
}
