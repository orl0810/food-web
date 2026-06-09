import { PreparedPortion } from '../../core/models/prepared-portion.model';
import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import { getExpirationLabel } from './expiration.utils';

export interface PreparedPortionPrompt {
  portionId: string;
  portionName: string;
  message: string;
  urgency: 'high' | 'medium' | 'low';
}

export function buildUseFirstPortionPrompts(portions: PreparedPortion[]): PreparedPortionPrompt[] {
  return portions
    .filter((p) => p.available_portions > 0 && p.expires_at)
    .slice(0, 5)
    .map((portion) => ({
      portionId: portion.id,
      portionName: portion.name,
      message: `${portion.name} ${getExpirationLabel(portion.expires_at!)}. Add to a meal?`,
      urgency: 'high' as const,
    }));
}

export function countBatchCookingSessions(items: MealSlotItem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.item_type === 'prepared_portion' && item.prepared_portion_id) {
      counts.set(
        item.prepared_portion_id,
        (counts.get(item.prepared_portion_id) ?? 0) + 1
      );
    }
  }
  return counts;
}

export function getBatchCookingInsight(items: MealSlotItem[], portions: PreparedPortion[]): string | null {
  const counts = countBatchCookingSessions(items);
  let best: { name: string; count: number } | null = null;

  for (const [portionId, count] of counts) {
    if (count < 2) {
      continue;
    }
    const portion = portions.find((p) => p.id === portionId);
    if (portion && (!best || count > best.count)) {
      best = { name: portion.name, count };
    }
  }

  if (!best) {
    return null;
  }

  return `You planned ${best.count} meals from 1 batch of ${best.name}.`;
}
