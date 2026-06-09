import { StorageLocation } from './food-item.model';
import { Recipe } from './recipe.model';

export type PreparedPortionSourceType = 'recipe' | 'custom' | 'leftover';
export type PreparedPortionStatus = 'available' | 'finished' | 'expired';

export interface PreparedPortion {
  id: string;
  user_id: string;
  name: string;
  source_type: PreparedPortionSourceType;
  recipe_id: string | null;
  total_portions: number;
  available_portions: number;
  cooked_at: string;
  expires_at: string | null;
  storage_location: StorageLocation | null;
  notes: string | null;
  status: PreparedPortionStatus;
  created_at: string;
  updated_at: string;
  recipe?: Pick<Recipe, 'id' | 'title'>;
}

export interface PreparedPortionInput {
  name: string;
  source_type: PreparedPortionSourceType;
  recipe_id?: string | null;
  total_portions: number;
  cooked_at?: string;
  expires_at?: string | null;
  storage_location?: StorageLocation | null;
  notes?: string | null;
}

export type PreparedPortionFilter = 'all' | 'available' | 'expiring_soon' | 'finished';

export const PREPARED_PORTION_FILTERS: { value: PreparedPortionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'expiring_soon', label: 'Expiring soon' },
  { value: 'finished', label: 'Finished' },
];

export const PREPARED_PORTION_SOURCE_LABELS: Record<PreparedPortionSourceType, string> = {
  recipe: 'From recipe',
  custom: 'Custom',
  leftover: 'Leftover',
};
