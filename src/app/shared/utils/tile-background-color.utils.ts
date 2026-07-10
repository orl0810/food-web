import { normalizeNameKey } from './name-normalization.utils';

const TILE_COLOR_PALETTE = [
  '#7a3b2e',
  '#2d6a4f',
  '#8b4513',
  '#c45c26',
  '#6b2d3d',
  '#d4a017',
  '#b83232',
  '#9b59b6',
  '#1e6b52',
  '#5c4033',
  '#2d5a4a',
  '#1e3a5f',
  '#6b3a2a',
  '#4a3728',
  '#5b2c6f',
  '#1a5c5c',
  '#8b3a3a',
  '#2e4a6e',
  '#6b4c2a',
  '#4a3d6b',
  '#5c2d4a',
  '#3d5c6b',
  '#4a2d3d',
  '#5a4a2e',
] as const;

const CATEGORY_COLOR_MAP: Record<string, string> = {
  dairy: '#2d5a4a',
  meat: '#6b2d3d',
  poultry: '#c45c26',
  chicken: '#c45c26',
  seafood: '#1a5c5c',
  fish: '#2e4a6e',
  vegetables: '#2d6a4f',
  veggies: '#2d6a4f',
  fruit: '#d4a017',
  fruits: '#d4a017',
  grains: '#5c4033',
  bakery: '#6b3a2a',
  bread: '#6b3a2a',
  snacks: '#5a4a2e',
  beverages: '#3d5c6b',
  drinks: '#3d5c6b',
  frozen: '#2e4a6e',
  pantry: '#4a3728',
  condiments: '#8b4513',
  spices: '#7a3b2e',
  eggs: '#1e3a5f',
  breakfast: '#d4a017',
  dessert: '#9b59b6',
  sweets: '#9b59b6',
  healthy: '#2d6a4f',
  salad: '#2d6a4f',
  pasta: '#8b3a3a',
  soup: '#2e4a6e',
  italian: '#1e6b52',
  asian: '#b83232',
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function colorFromPalette(seed: string): string {
  const index = hashString(seed) % TILE_COLOR_PALETTE.length;
  return TILE_COLOR_PALETTE[index];
}

export function tileBackgroundColor(category?: string | null, name?: string): string {
  if (category) {
    const key = normalizeNameKey(category);
    const mapped = CATEGORY_COLOR_MAP[key];
    if (mapped) {
      return mapped;
    }
    return colorFromPalette(key);
  }

  if (name) {
    return colorFromPalette(normalizeNameKey(name));
  }

  return TILE_COLOR_PALETTE[0];
}
