import { Component, computed, input, output } from '@angular/core';
import {
  DashboardAction,
  DashboardActionType,
} from '../../models/dashboard-action.model';

const TYPE_ICONS: Record<DashboardActionType, string> = {
  cook_recipe_today: '🍳',
  prepare_component_for_tomorrow: '🥘',
  use_prepared_portion: '🍱',
  use_expiring_inventory: '🥬',
  inventory_low: '🧺',
  shopping_list_pending: '🛒',
  no_meal_planned_today: '📅',
  meal_plan_incomplete: '📋',
  prepared_food_expiring: '⏰',
  weekly_plan_progress: '📈',
  onboarding_starter_action: '✨',
  create_first_meal_plan: '📋',
};

@Component({
  selector: 'app-dashboard-smart-action-card',
  standalone: true,
  template: `
    @if (successMessage(); as message) {
      <section
        class="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 shadow-sm"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-center gap-2.5">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base"
            aria-hidden="true"
          >
            ✓
          </span>
          <div>
            <p class="text-sm font-semibold text-brand-800">{{ message }}</p>
            <p class="mt-0.5 text-xs text-brand-700">
              Finding your next best action...
            </p>
          </div>
        </div>
      </section>
    } @else if (action(); as currentAction) {
      <section
        class="rounded-xl border px-4 py-3 shadow-sm"
        [class]="containerClasses()"
        aria-labelledby="smart-action-label"
      >
        <div class="flex items-start gap-2.5">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
            [class]="iconBadgeClasses()"
            aria-hidden="true"
          >
            {{ icon() }}
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p
                id="smart-action-label"
                class="text-[11px] font-semibold uppercase tracking-wide"
                [class]="labelClasses()"
              >
                {{ label() }}
              </p>
              <button
                type="button"
                class="-mr-1 -mt-1 rounded-lg p-1 text-stone-400 transition-colors hover:bg-stone-900/5 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Dismiss this suggestion for today"
                [disabled]="busy()"
                (click)="dismissClick.emit()"
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <p class="mt-1 text-sm text-stone-600">{{ currentAction.message }}</p>
          </div>
        </div>
      </section>
    } @else {
      <section
        class="rounded-xl border border-stone-200 bg-cream px-4 py-3 shadow-sm"
        aria-labelledby="smart-action-label"
      >
        <div class="flex items-start gap-2.5">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg"
            aria-hidden="true"
          >
            🌿
          </span>
          <div class="min-w-0 flex-1">
            <p
              id="smart-action-label"
              class="text-[11px] font-semibold uppercase tracking-wide text-stone-500"
            >
              Today's focus
            </p>
            <p class="mt-1 text-sm text-stone-600">
              Nothing needs your attention right now. Keep your week on track.
            </p>
          </div>
        </div>
      </section>
    }
  `,
})
export class DashboardSmartActionCardComponent {
  readonly action = input<DashboardAction | null>(null);
  readonly busy = input(false);
  readonly successMessage = input<string | null>(null);

  readonly dismissClick = output<void>();

  readonly icon = computed(() => {
    const action = this.action();
    return action ? TYPE_ICONS[action.type] : '🌿';
  });

  readonly label = computed(() => {
    const action = this.action();
    if (!action) {
      return "Today's focus";
    }
    return action.priority === 'urgent' ? "Urgent — today's focus" : "Today's focus";
  });

  readonly containerClasses = computed(() => {
    switch (this.action()?.priority) {
      case 'urgent':
        return 'border-red-200 bg-red-50/60';
      case 'high':
        return 'border-amber-200 bg-amber-50/60';
      default:
        return 'border-stone-200 bg-cream';
    }
  });

  readonly iconBadgeClasses = computed(() => {
    switch (this.action()?.priority) {
      case 'urgent':
        return 'bg-red-100';
      case 'high':
        return 'bg-amber-100';
      default:
        return 'bg-brand-50';
    }
  });

  readonly labelClasses = computed(() => {
    switch (this.action()?.priority) {
      case 'urgent':
        return 'text-red-700';
      case 'high':
        return 'text-amber-700';
      default:
        return 'text-stone-500';
    }
  });
}
