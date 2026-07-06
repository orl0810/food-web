import { MealSlotItem, MealSlotItemStatus } from '../../../core/models/meal-slot-item.model';
import { MEAL_TYPES, MEAL_TYPE_LABELS, MealType } from '../../../core/models/meal-plan.model';
import { addDays, isToday, toISODate } from '../../../shared/utils/meal-plan.utils';
import { getItemsForSlot, isSlotCompleted } from './meal-slot-completion.utils';
import { getMealSlotItemDisplayName } from '../../../shared/utils/prepared-portion.utils';

/** UI-facing lifecycle states for a meal slot. */
export type MealSlotDisplayStatus = 'empty' | 'planned' | 'ready' | 'consumed';

/** Alias for persisted status values used in the preparation flow. */
export type MealPreparationStatus = Extract<MealSlotItemStatus, 'planned' | 'prepared' | 'eaten'>;

export interface MealStatusUiConfig {
  label: string;
  pillClass: string;
  cardClass: string;
  primaryActionLabel: string | null;
  secondaryActionLabel: string | null;
  description: string;
}

export interface PendingMealSlot {
  date: string;
  mealType: MealType;
  items: MealSlotItem[];
  displayNames: string[];
  dateLabel: string;
  mealTypeLabel: string;
}

const DISPLAY_STATUS_CONFIG: Record<
  Exclude<MealSlotDisplayStatus, 'empty'>,
  MealStatusUiConfig
> = {
  planned: {
    label: 'Planned',
    pillClass: 'bg-stone-100 text-stone-700',
    cardClass: '',
    primaryActionLabel: 'Mark as ready',
    secondaryActionLabel: null,
    description: 'Scheduled but not cooked yet',
  },
  ready: {
    label: 'Ready',
    pillClass: 'bg-amber-100 text-amber-800',
    cardClass: 'ring-1 ring-amber-200 bg-amber-50/40',
    primaryActionLabel: 'Mark as consumed',
    secondaryActionLabel: 'Back to planned',
    description: 'Cooked and ready to eat',
  },
  consumed: {
    label: 'Consumed',
    pillClass: 'bg-brand-100 text-brand-700',
    cardClass: 'ring-1 ring-brand-200 bg-brand-50/30',
    primaryActionLabel: null,
    secondaryActionLabel: 'Undo',
    description: 'Already eaten',
  },
};

export function getSlotDisplayStatus(items: MealSlotItem[]): MealSlotDisplayStatus {
  if (items.length === 0) {
    return 'empty';
  }

  if (items.every((item) => item.status === 'eaten')) {
    return 'consumed';
  }

  const allPreparedOrEaten = items.every(
    (item) => item.status === 'prepared' || item.status === 'eaten'
  );
  const hasPrepared = items.some((item) => item.status === 'prepared');

  if (allPreparedOrEaten && hasPrepared) {
    return 'ready';
  }

  if (items.every((item) => item.status === 'prepared')) {
    return 'ready';
  }

  return 'planned';
}

export function getMealStatusUiConfig(status: MealSlotDisplayStatus): MealStatusUiConfig | null {
  if (status === 'empty') {
    return null;
  }
  return DISPLAY_STATUS_CONFIG[status];
}

export function getTargetStatusForPrimaryAction(
  displayStatus: MealSlotDisplayStatus
): MealSlotItemStatus | null {
  switch (displayStatus) {
    case 'planned':
      return 'prepared';
    case 'ready':
      return 'eaten';
    default:
      return null;
  }
}

export function getTargetStatusForSecondaryAction(
  displayStatus: MealSlotDisplayStatus
): MealSlotItemStatus | null {
  switch (displayStatus) {
    case 'ready':
      return 'planned';
    case 'consumed':
      return 'prepared';
    default:
      return null;
  }
}

export function formatSlotDateLabel(date: string, today: string = toISODate()): string {
  if (date === today) {
    return 'Today';
  }

  const tomorrow = addDays(today, 1);
  if (date === tomorrow) {
    return 'Tomorrow';
  }

  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getPendingMealsToPrepare(
  items: MealSlotItem[],
  startDate: string = toISODate(),
  endDate?: string
): PendingMealSlot[] {
  const rangeEnd = endDate ?? addDays(startDate, 6);
  const slots = new Map<string, PendingMealSlot>();

  for (const item of items) {
    if (item.date < startDate || item.date > rangeEnd) {
      continue;
    }

    const key = `${item.date}|${item.meal_type}`;
    const slotItems = getItemsForSlot(items, item.date, item.meal_type);
    const displayStatus = getSlotDisplayStatus(slotItems);

    if (displayStatus !== 'planned') {
      continue;
    }

    if (!slots.has(key)) {
      slots.set(key, {
        date: item.date,
        mealType: item.meal_type,
        items: slotItems,
        displayNames: slotItems.map((slotItem) => getMealSlotItemDisplayName(slotItem)),
        dateLabel: formatSlotDateLabel(item.date, startDate),
        mealTypeLabel: MEAL_TYPE_LABELS[item.meal_type],
      });
    }
  }

  return [...slots.values()].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType);
  });
}

export function countReadySlotsForDay(
  date: string,
  items: MealSlotItem[],
  activeMealTypes: MealType[] = MEAL_TYPES
): number {
  return activeMealTypes.filter((mealType) => {
    const slotItems = getItemsForSlot(items, date, mealType);
    return slotItems.length > 0 && getSlotDisplayStatus(slotItems) === 'ready';
  }).length;
}

/** Maps legacy completion checks to display status for compatibility. */
export function isSlotConsumed(items: MealSlotItem[]): boolean {
  return isSlotCompleted(items);
}

export function isTodayDate(date: string): boolean {
  return isToday(date);
}
