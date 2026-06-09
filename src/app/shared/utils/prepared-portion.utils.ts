import {
  PreparedPortion,
  PreparedPortionFilter,
  PreparedPortionStatus,
} from '../../core/models/prepared-portion.model';
import { isExpired, isExpiringSoon } from './expiration.utils';

export function getUsedPortions(portion: PreparedPortion): number {
  return portion.total_portions - portion.available_portions;
}

export function derivePreparedPortionStatus(
  portion: Pick<PreparedPortion, 'available_portions' | 'expires_at' | 'status'>
): PreparedPortionStatus {
  if (portion.available_portions <= 0) {
    return 'finished';
  }
  if (portion.expires_at && isExpired(portion.expires_at)) {
    return 'expired';
  }
  return 'available';
}

export function filterPreparedPortions(
  portions: PreparedPortion[],
  filter: PreparedPortionFilter
): PreparedPortion[] {
  switch (filter) {
    case 'available':
      return portions.filter(
        (p) => p.status === 'available' && p.available_portions > 0
      );
    case 'expiring_soon':
      return portions.filter(
        (p) =>
          p.available_portions > 0 &&
          p.expires_at &&
          isExpiringSoon(p.expires_at, 3) &&
          !isExpired(p.expires_at)
      );
    case 'finished':
      return portions.filter(
        (p) => p.status === 'finished' || p.available_portions <= 0
      );
    default:
      return portions;
  }
}

export function canAssignPortions(
  portion: PreparedPortion,
  portionsUsed: number
): { ok: boolean; error?: string } {
  if (portionsUsed <= 0) {
    return { ok: false, error: 'Portions used must be at least 1.' };
  }
  if (portionsUsed > portion.available_portions) {
    return {
      ok: false,
      error: `Only ${portion.available_portions} portion${portion.available_portions === 1 ? '' : 's'} available.`,
    };
  }
  return { ok: true };
}

export function isPortionExpired(portion: PreparedPortion): boolean {
  return !!portion.expires_at && isExpired(portion.expires_at);
}

export function getPortionAvailabilityLabel(portion: PreparedPortion): string {
  return `${portion.available_portions} of ${portion.total_portions} portions available`;
}

export function getMealSlotItemDisplayName(item: {
  item_type: string;
  custom_name?: string | null;
  recipe?: { title: string } | null;
  prepared_portion?: { name: string } | null;
  inventory_item?: { name: string } | null;
}): string {
  switch (item.item_type) {
    case 'recipe':
      return item.recipe?.title ?? 'Recipe unavailable';
    case 'prepared_portion':
      return item.prepared_portion?.name ?? 'Portion unavailable';
    case 'inventory_item':
      return item.inventory_item?.name ?? 'Item unavailable';
    case 'custom':
      return item.custom_name ?? 'Custom item';
    default:
      return 'Unknown item';
  }
}

export function formatMealSlotSummary(items: { item_type: string; custom_name?: string | null; recipe?: { title: string } | null; prepared_portion?: { name: string } | null; inventory_item?: { name: string } | null }[]): string {
  if (items.length === 0) {
    return '';
  }
  return items.map((item) => getMealSlotItemDisplayName(item)).join(' + ');
}
