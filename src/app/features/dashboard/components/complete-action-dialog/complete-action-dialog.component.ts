import { Component, computed, effect, input, output, signal } from '@angular/core';
import { MealSlotItemStatus } from '../../../../core/models/meal-slot-item.model';
import {
  ActionCompletionPayload,
  DashboardAction,
  InventoryDeduction,
} from '../../models/dashboard-action.model';

@Component({
  selector: 'app-complete-action-dialog',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      (click)="cancelled.emit()"
    >
      <div
        class="card max-h-[85vh] w-full max-w-md overflow-y-auto p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-action-title"
        (click)="$event.stopPropagation()"
      >
        <h2 id="complete-action-title" class="text-base font-semibold text-stone-900">
          {{ action().primaryLabel }}
        </h2>
        <p class="mt-1 text-sm text-stone-600">{{ action().title }}</p>

        @if (showStatusChoice()) {
          <fieldset class="mt-4">
            <legend class="mb-1.5 block text-sm font-medium text-stone-700">
              How should we mark it?
            </legend>
            <div class="flex gap-2">
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="slotStatus() === 'prepared'"
                [class.filter-pill-inactive]="slotStatus() !== 'prepared'"
                (click)="slotStatus.set('prepared')"
              >
                Cooked
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="slotStatus() === 'eaten'"
                [class.filter-pill-inactive]="slotStatus() !== 'eaten'"
                (click)="slotStatus.set('eaten')"
              >
                Cooked &amp; eaten
              </button>
            </div>
          </fieldset>
        } @else if (slotStatus() === 'eaten') {
          <p class="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
            This will mark the item as eaten in today's meal plan.
          </p>
        }

        @if (portionId()) {
          <div class="mt-4">
            <label for="portions-used" class="mb-1 block text-sm font-medium text-stone-700">
              Portions to use
            </label>
            <input
              id="portions-used"
              type="number"
              min="1"
              [max]="portionsAvailable()"
              class="input w-full"
              [value]="portionsUsed()"
              (input)="onPortionsInput($event)"
            />
            <p class="mt-1 text-xs text-stone-500">
              {{ portionsAvailable() }} of {{ portionName() }} available.
            </p>
          </div>
        }

        @if (deductions().length > 0) {
          <div class="mt-4">
            <p class="text-sm font-medium text-stone-700">
              This will reduce the following inventory items
            </p>
            <p class="mt-0.5 text-xs text-stone-500">
              Adjust quantities or set to 0 to keep an item untouched.
            </p>
            <ul class="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
              @for (deduction of deductions(); track deduction.itemId; let index = $index) {
                <li class="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-stone-900">
                      {{ deduction.name }}
                    </p>
                    <p class="text-xs text-stone-500">
                      {{ deduction.available }} {{ deduction.unit || 'units' }} in stock
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <span class="text-sm font-medium text-stone-500" aria-hidden="true">−</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      [max]="deduction.available"
                      class="input w-20 text-right"
                      [attr.aria-label]="'Quantity of ' + deduction.name + ' to use'"
                      [value]="deduction.quantityUsed"
                      (input)="onDeductionInput(index, $event)"
                    />
                    <span class="w-10 text-xs text-stone-500">{{ deduction.unit || 'units' }}</span>
                  </div>
                </li>
              }
            </ul>
          </div>
        }

        @if (!portionId() && deductions().length === 0 && !showStatusChoice() && slotStatus() !== 'eaten') {
          <p class="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
            Confirm to mark this action as done.
          </p>
        }

        @if (error()) {
          <p class="alert-error mt-4">{{ error() }}</p>
        }

        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="btn-primary flex-1"
            [disabled]="busy()"
            (click)="confirm()"
          >
            {{ busy() ? 'Updating...' : 'Confirm' }}
          </button>
          <button
            type="button"
            class="btn-secondary flex-1"
            [disabled]="busy()"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CompleteActionDialogComponent {
  readonly action = input.required<DashboardAction>();
  readonly draft = input.required<ActionCompletionPayload>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<ActionCompletionPayload>();
  readonly cancelled = output<void>();

  readonly slotStatus = signal<MealSlotItemStatus | null>(null);
  readonly deductions = signal<InventoryDeduction[]>([]);
  readonly portionsUsed = signal(1);

  readonly portionId = computed(() => this.draft().portionId ?? null);
  readonly portionName = computed(() => this.draft().portionName ?? 'this portion');
  readonly portionsAvailable = computed(() => this.draft().portionsAvailable ?? 1);

  /** Recipes can be batch cooked (prepared) or eaten right away. */
  readonly showStatusChoice = computed(
    () => this.action().type === 'cook_recipe_today' && !!this.draft().slotItemId
  );

  constructor() {
    effect(() => {
      const draft = this.draft();
      this.slotStatus.set(draft.slotStatus ?? null);
      this.deductions.set((draft.inventoryDeductions ?? []).map((d) => ({ ...d })));
      this.portionsUsed.set(draft.portionsUsed ?? 1);
    });
  }

  onPortionsInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    const clamped = Math.min(this.portionsAvailable(), Math.max(1, value || 1));
    this.portionsUsed.set(clamped);
  }

  onDeductionInput(index: number, event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    this.deductions.update((items) =>
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              quantityUsed: Math.min(
                item.available,
                Math.max(0, Number.isFinite(raw) ? raw : 0)
              ),
            }
          : item
      )
    );
  }

  confirm(): void {
    const draft = this.draft();
    this.confirmed.emit({
      slotItemId: draft.slotItemId,
      slotStatus: this.slotStatus() ?? undefined,
      inventoryDeductions: this.deductions(),
      portionId: draft.portionId,
      portionName: draft.portionName,
      portionsAvailable: draft.portionsAvailable,
      portionsUsed: this.portionsUsed(),
    });
  }
}
