import { Injectable, Signal, computed, inject } from '@angular/core';
import { FoodItem } from '../../../core/models/food-item.model';
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../../../core/models/meal-plan.model';
import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import { PreparedPortion } from '../../../core/models/prepared-portion.model';
import { FoodInventoryService } from '../../../core/services/food-inventory.service';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { PreparedPortionService } from '../../../core/services/prepared-portion.service';
import { ShoppingListService } from '../../../core/services/shopping-list.service';
import {
  getDaysUntilExpiration,
  isExpired,
} from '../../../shared/utils/expiration.utils';
import { toISODate } from '../../../shared/utils/meal-plan.utils';
import {
  DashboardAction,
  DashboardActionPriority,
} from '../models/dashboard-action.model';

/** Inventory size at or below which the "inventory low" action fires. */
const INVENTORY_LOW_THRESHOLD = 3;

/** Days ahead (inclusive) that count as "expiring" for inventory items. */
const INVENTORY_EXPIRING_WINDOW_DAYS = 2;

const PRIORITY_RANK: Record<DashboardActionPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface ActionEngineInput {
  todaySlotItems: MealSlotItem[];
  inventoryItems: FoodItem[];
  portions: PreparedPortion[];
  uncheckedShoppingCount: number;
}

type ActionGenerator = (
  input: ActionEngineInput,
  today: Date,
  todayISO: string
) => DashboardAction[];

function plural(count: number, singular: string, pluralWord?: string): string {
  return count === 1 ? singular : pluralWord ?? `${singular}s`;
}

function mealOrder(item: MealSlotItem): string {
  return String(MEAL_TYPES.indexOf(item.meal_type));
}

const expiredInventoryGenerator: ActionGenerator = (input, today, todayISO) => {
  const expired = input.inventoryItems.filter((item) =>
    isExpired(item.expiration_date, today)
  );

  if (expired.length === 0) {
    return [];
  }

  const first = expired[0];
  return [
    {
      id: `use_expiring_inventory:expired:${todayISO}`,
      type: 'use_expiring_inventory',
      priority: 'urgent',
      title:
        expired.length === 1
          ? `${first.name} has expired`
          : `You have ${expired.length} expired items`,
      message:
        expired.length === 1
          ? `${first.name} in your ${first.location} has expired. Check it and remove it from your inventory.`
          : 'Some food in your inventory has expired. Review it and clear it out before planning more meals.',
      chips: ['inventory', 'expiring'],
      primaryLabel: 'Review inventory',
      primaryKind: 'navigate',
      primaryRoute: '/inventory',
      sortKey: '0',
      relatedInventoryItemIds: expired.map((item) => item.id),
    },
  ];
};

const preparedFoodExpiringGenerator: ActionGenerator = (input, today, todayISO) => {
  return input.portions
    .filter((portion) => {
      if (portion.available_portions <= 0 || !portion.expires_at) {
        return false;
      }
      const days = getDaysUntilExpiration(portion.expires_at, today);
      return days !== null && days >= 0 && days <= 1;
    })
    .map((portion): DashboardAction => {
      const days = getDaysUntilExpiration(portion.expires_at, today) ?? 0;
      const when = days === 0 ? 'today' : 'tomorrow';
      return {
        id: `prepared_food_expiring:${portion.id}:${todayISO}`,
        type: 'prepared_food_expiring',
        priority: 'urgent',
        title: `Use ${portion.name} ${when}`,
        message: `${portion.name} expires ${when} and still has ${portion.available_portions} ${plural(portion.available_portions, 'portion')} left. Add it to a meal before it goes to waste.`,
        chips: days === 0 ? ['today', 'expiring', 'ready-portion'] : ['expiring', 'ready-portion'],
        primaryLabel: 'Use a portion',
        primaryKind: 'complete',
        secondaryLabel: 'View meal plan',
        secondaryRoute: '/meal-plan',
        sortKey: portion.expires_at ?? '',
        relatedPortionId: portion.id,
      };
    });
};

const useExpiringInventoryGenerator: ActionGenerator = (input, today, todayISO) => {
  const expiring = input.inventoryItems
    .filter((item) => {
      if (!item.expiration_date || isExpired(item.expiration_date, today)) {
        return false;
      }
      const days = getDaysUntilExpiration(item.expiration_date, today);
      return days !== null && days <= INVENTORY_EXPIRING_WINDOW_DAYS;
    })
    .sort((a, b) => (a.expiration_date ?? '').localeCompare(b.expiration_date ?? ''));

  if (expiring.length === 0) {
    return [];
  }

  const item = expiring[0];
  const days = getDaysUntilExpiration(item.expiration_date, today) ?? 0;
  const when = days === 0 ? 'today' : days === 1 ? 'by tomorrow' : `in ${days} days`;
  const others = expiring.length - 1;

  return [
    {
      id: `use_expiring_inventory:${item.id}:${todayISO}`,
      type: 'use_expiring_inventory',
      priority: 'high',
      title: `Use ${item.name} ${when}`,
      message:
        `${item.name} expires ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}. Use it ${days === 0 ? 'today' : 'soon'} or add it to dinner.` +
        (others > 0
          ? ` ${others} more ${plural(others, 'item is', 'items are')} expiring soon.`
          : ''),
      chips: days === 0 ? ['today', 'expiring', 'inventory'] : ['expiring', 'inventory'],
      primaryLabel: `Mark ${item.name} used`,
      primaryKind: 'complete',
      secondaryLabel: 'View inventory',
      secondaryRoute: '/inventory',
      sortKey: item.expiration_date ?? '',
      relatedInventoryItemIds: [item.id],
    },
  ];
};

const usePlannedPortionGenerator: ActionGenerator = (input, _today, todayISO) => {
  return input.todaySlotItems
    .filter(
      (item) =>
        item.date === todayISO &&
        item.item_type === 'prepared_portion' &&
        item.status === 'planned' &&
        !!item.prepared_portion
    )
    .sort((a, b) => mealOrder(a).localeCompare(mealOrder(b)))
    .slice(0, 1)
    .map((item): DashboardAction => {
      const name = item.prepared_portion?.name ?? 'your ready portion';
      const meal = MEAL_TYPE_LABELS[item.meal_type].toLowerCase();
      return {
        id: `use_prepared_portion:${item.id}:${todayISO}`,
        type: 'use_prepared_portion',
        priority: 'high',
        title: `${name} is ready for ${meal}`,
        message: `You already cooked ${name}. ${item.portions_used} ${plural(item.portions_used, 'portion is', 'portions are')} reserved for today's ${meal} — no cooking needed.`,
        chips: ['today', 'ready-portion', 'meal-plan'],
        primaryLabel: 'Mark as eaten',
        primaryKind: 'complete',
        secondaryLabel: 'View meal plan',
        secondaryRoute: '/meal-plan',
        sortKey: mealOrder(item),
        relatedSlotItemId: item.id,
        relatedPortionId: item.prepared_portion_id ?? undefined,
      };
    });
};

const cookRecipeTodayGenerator: ActionGenerator = (input, _today, todayISO) => {
  return input.todaySlotItems
    .filter(
      (item) =>
        item.date === todayISO &&
        item.item_type === 'recipe' &&
        item.status === 'planned' &&
        !!item.recipe
    )
    .sort((a, b) => mealOrder(a).localeCompare(mealOrder(b)))
    .slice(0, 1)
    .map((item): DashboardAction => {
      const title = item.recipe?.title ?? 'your planned recipe';
      const meal = MEAL_TYPE_LABELS[item.meal_type].toLowerCase();
      return {
        id: `cook_recipe_today:${item.id}:${todayISO}`,
        type: 'cook_recipe_today',
        priority: 'medium',
        title: "Today's cooking step",
        message: `Today you're making ${title} for ${meal} according to your plan.`,
        chips: ['today', 'meal-plan'],
        primaryLabel: 'Mark as cooked',
        primaryKind: 'complete',
        secondaryLabel: 'View recipe',
        secondaryRoute: item.recipe_id ? `/recipes/${item.recipe_id}` : '/recipes',
        sortKey: mealOrder(item),
        relatedSlotItemId: item.id,
        relatedRecipeId: item.recipe_id ?? undefined,
      };
    });
};

const noMealPlannedTodayGenerator: ActionGenerator = (input, _today, todayISO) => {
  const hasMealsToday = input.todaySlotItems.some((item) => item.date === todayISO);

  if (hasMealsToday) {
    return [];
  }

  return [
    {
      id: `no_meal_planned_today:${todayISO}`,
      type: 'no_meal_planned_today',
      priority: 'low',
      title: 'No meals planned for today',
      message: "Plan today's meals in less than 2 minutes and stay on track for the week.",
      chips: ['today', 'meal-plan'],
      primaryLabel: "Plan today's meals",
      primaryKind: 'navigate',
      primaryRoute: '/meal-plan',
      sortKey: '0',
    },
  ];
};

const usePreparedPortionSuggestionGenerator: ActionGenerator = (input, today, todayISO) => {
  const plannedPortionIds = new Set(
    input.todaySlotItems
      .filter((item) => item.item_type === 'prepared_portion')
      .map((item) => item.prepared_portion_id)
  );

  const candidates = input.portions
    .filter((portion) => {
      if (portion.available_portions <= 0 || portion.status === 'finished') {
        return false;
      }
      if (portion.expires_at && isExpired(portion.expires_at, today)) {
        return false;
      }
      // Expiring within a day is already covered by the urgent generator.
      const days = getDaysUntilExpiration(portion.expires_at, today);
      if (days !== null && days <= 1) {
        return false;
      }
      return !plannedPortionIds.has(portion.id);
    })
    .sort((a, b) => (a.expires_at ?? '9999').localeCompare(b.expires_at ?? '9999'));

  if (candidates.length === 0) {
    return [];
  }

  const portion = candidates[0];
  return [
    {
      id: `use_prepared_portion:suggest:${portion.id}:${todayISO}`,
      type: 'use_prepared_portion',
      priority: 'low',
      title: 'You have ready portions waiting',
      message: `${portion.name} has ${portion.available_portions} ${plural(portion.available_portions, 'portion')} available. Use one today or add it to your meal plan.`,
      chips: ['ready-portion'],
      primaryLabel: 'Mark a portion eaten',
      primaryKind: 'complete',
      secondaryLabel: 'View meal plan',
      secondaryRoute: '/meal-plan',
      sortKey: portion.expires_at ?? '9999',
      relatedPortionId: portion.id,
    },
  ];
};

const inventoryLowGenerator: ActionGenerator = (input, _today, todayISO) => {
  if (input.inventoryItems.length > INVENTORY_LOW_THRESHOLD) {
    return [];
  }

  const pending = input.uncheckedShoppingCount;
  return [
    {
      id: `inventory_low:${todayISO}`,
      type: 'inventory_low',
      priority: 'low',
      title: 'Inventory is running low',
      message:
        'Your inventory is almost empty. Review your shopping list before planning more meals.' +
        (pending > 0 ? ` You have ${pending} ${plural(pending, 'item')} waiting on your list.` : ''),
      chips: ['inventory'],
      primaryLabel: 'Open shopping list',
      primaryKind: 'navigate',
      primaryRoute: '/shopping-list',
      secondaryLabel: 'Add inventory items',
      secondaryRoute: '/inventory',
      sortKey: '1',
    },
  ];
};

/**
 * Ordered registry of action generators. Add new smart action types here —
 * each generator stays independent and priority sorting handles relevance.
 */
const ACTION_GENERATORS: ActionGenerator[] = [
  expiredInventoryGenerator,
  preparedFoodExpiringGenerator,
  useExpiringInventoryGenerator,
  usePlannedPortionGenerator,
  cookRecipeTodayGenerator,
  noMealPlannedTodayGenerator,
  usePreparedPortionSuggestionGenerator,
  inventoryLowGenerator,
];

/**
 * Pure ranking function: evaluates every generator against the current data
 * and returns actions sorted by priority, then by each action's sort key.
 */
export function buildDashboardActions(
  input: ActionEngineInput,
  today: Date = new Date()
): DashboardAction[] {
  const todayISO = toISODate(today);
  const actions = ACTION_GENERATORS.flatMap((generate) =>
    generate(input, today, todayISO)
  );

  return actions.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.sortKey ?? '').localeCompare(b.sortKey ?? '') ||
      a.id.localeCompare(b.id)
  );
}

@Injectable({ providedIn: 'root' })
export class DashboardActionEngineService {
  private readonly inventoryService = inject(FoodInventoryService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly preparedPortionService = inject(PreparedPortionService);
  private readonly shoppingListService = inject(ShoppingListService);

  /** All candidate actions, best first, recomputed whenever source data changes. */
  readonly actions: Signal<DashboardAction[]> = computed(() =>
    buildDashboardActions({
      todaySlotItems: this.mealPlanService.todayEntries(),
      inventoryItems: this.inventoryService.items(),
      portions: this.preparedPortionService.portions(),
      uncheckedShoppingCount: this.shoppingListService.uncheckedCount(),
    })
  );
}
