import { StorageLocation } from './food-item.model';

export interface VoiceInventoryDraftItem {
  name: string;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  expiration_date?: string | null;
  location: StorageLocation;
}

export interface VoiceInventoryParseResult {
  items: VoiceInventoryDraftItem[];
  transcript: string;
  warnings?: string[];
}
