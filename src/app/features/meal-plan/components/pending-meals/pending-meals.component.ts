import { Component, computed, input, output } from '@angular/core';
import { MealType } from '../../../../core/models/meal-plan.model';
import { PendingMealSlot } from '../../utils/meal-slot-status.utils';

@Component({
  selector: 'app-pending-meals',
  standalone: true,
  template: `
  @if (loading()) {
    <section class="card p-4" aria-busy="true" aria-label="Loading meals to cook">
      <p class="text-sm text-stone-500">Loading meals to cook…</p>
    </section>
  } @else if (error()) {
    <section class="card p-4" aria-label="Meals to cook">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-stone-600">Could not load meals to cook.</p>
        <button
          type="button"
          class="text-sm font-medium text-brand-700 hover:text-brand-800"
          (click)="retry.emit()"
        >
          Retry
        </button>
      </div>
    </section>
  } @else if (slots().length > 0) {
    <section class="card p-4" aria-labelledby="pending-meals-title">
      <div class="mb-3">
        <h3 id="pending-meals-title" class="text-base font-semibold text-stone-900">To cook</h3>
        <p class="mt-0.5 text-sm text-stone-600">
          {{ slots().length }} meal{{ slots().length === 1 ? '' : 's' }} waiting to be prepared
        </p>
      </div>

      <ul class="space-y-3">
        @for (slot of slots(); track slotKey(slot)) {
          <li
            class="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0">
              <p class="font-medium text-stone-900">{{ slotTitle(slot) }}</p>
              <p class="mt-0.5 text-sm text-stone-600">
                {{ slot.dateLabel }} · {{ slot.mealTypeLabel }}
              </p>
              <span class="mt-1.5 inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3 w-3" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                Planned
              </span>
            </div>

            <button
              type="button"
              class="shrink-0 rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              [disabled]="markingKey() === slotKey(slot)"
              [attr.aria-label]="'Mark ' + slotTitle(slot) + ' as ready'"
              (click)="markReady.emit({ date: slot.date, mealType: slot.mealType })"
            >
              {{ markingKey() === slotKey(slot) ? 'Saving…' : 'Mark as ready' }}
            </button>
          </li>
        }
      </ul>
    </section>
  } @else {
    <section class="card border-dashed p-4 text-center" aria-label="Meals to cook">
      <p class="text-sm font-medium text-stone-600">Nothing left to cook</p>
      <p class="mt-0.5 text-sm text-stone-500">Planned meals for the next few days will show up here.</p>
    </section>
  }
  `,
})
export class PendingMealsComponent {
  readonly slots = input.required<PendingMealSlot[]>();
  readonly loading = input(false);
  readonly error = input(false);
  readonly markingKey = input<string | null>(null);

  readonly markReady = output<{ date: string; mealType: MealType }>();
  readonly retry = output<void>();

  readonly hasSlots = computed(() => this.slots().length > 0);

  slotKey(slot: PendingMealSlot): string {
    return `${slot.date}|${slot.mealType}`;
  }

  slotTitle(slot: PendingMealSlot): string {
    return slot.displayNames.join(', ');
  }
}
