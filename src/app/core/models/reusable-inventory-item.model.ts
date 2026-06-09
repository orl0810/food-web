import { StorageLocation } from './food-item.model';

export interface ReusableInventoryItem {
  id: string;
  name: string;
  normalizedName: string;
  category?: string;
  defaultUnit?: string;
  defaultQuantity?: number;
  defaultLocation?: StorageLocation;
  icon?: string;
  lastAddedAt?: string;
  timesAdded?: number;
  currentlyInInventory?: boolean;
  activeInventoryItemId?: string;
}
