import { Component, computed, effect, input, output, signal } from '@angular/core';
import {
  IngredientReconciliationLine,
  RecipeCookingDraft,
} from '../../../core/models/recipe-cooking.model';
import {
  STORAGE_LOCATIONS,
  STORAGE_LOCATION_LABELS,
  StorageLocation,
} from '../../../core/models/food-item.model';

@Component({
  selector: 'app-recipe-cooking-dialog',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-overlay flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      (click)="cancelled.emit()"
    >
      <div
        class="card max-h-[85vh] w-full max-w-md overflow-y-auto p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-cooking-title"
        (click)="$event.stopPropagation()"
      >
        <h2 id="recipe-cooking-title" class="text-base font-semibold text-stone-900">
          Mark as cooked
        </h2>
        <p class="mt-1 text-sm text-stone-600">{{ draft().recipeTitle }}</p>
        <p class="mt-1 text-xs text-stone-500">
          Covers {{ draft().portionsCovered }} planned portion{{ draft().portionsCovered === 1 ? '' : 's' }}
          from {{ draft().batches }} batch{{ draft().batches === 1 ? '' : 'es' }}.
        </p>

        @if (draft().coveredOccurrences.length > 0) {
          <ul class="mt-3 flex flex-wrap gap-2" aria-label="Meals covered">
            @for (occurrence of draft().coveredOccurrences; track occurrence.dateLabel + occurrence.mealTypeLabel) {
              <li class="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                {{ occurrence.dateLabel }} · {{ occurrence.mealTypeLabel }}
              </li>
            }
          </ul>
        }

        @if (sufficientLines().length > 0) {
          <div class="mt-4">
            <p class="text-sm font-medium text-stone-700">Inventory to update</p>
            <ul class="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200">
              @for (line of sufficientLines(); track line.key) {
                <li class="px-3 py-2.5">
                  <p class="text-sm font-medium text-stone-900">{{ line.name }}</p>
                  <p class="text-xs text-stone-500">
                    Using {{ line.requiredQuantity }} {{ line.unit || 'units' }}
                  </p>
                </li>
              }
            </ul>
          </div>
        }

        @if (reconcileLines().length > 0) {
          <div class="mt-4">
            <p class="text-sm font-medium text-stone-700">Confirm what you still have</p>
            <p class="mt-0.5 text-xs text-stone-500">
              Some ingredients were missing or not fully tracked. Enter what remains so inventory stays accurate.
            </p>
            <ul class="mt-2 space-y-3">
              @for (line of reconcileLines(); track line.key; let index = $index) {
                <li class="rounded-lg border border-stone-200 p-3">
                  <p class="text-sm font-medium text-stone-900">{{ line.name }}</p>
                  @if (line.requiredQuantity != null) {
                    <p class="mt-0.5 text-xs text-stone-500">
                      Needed {{ line.requiredQuantity }} {{ line.unit || 'units' }}.
                      @if (line.availableQuantity > 0) {
                        Only {{ line.availableQuantity }} {{ line.unit || 'units' }} tracked.
                      } @else {
                        Not tracked in inventory.
                      }
                    </p>
                  }
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      class="input w-24"
                      [attr.aria-label]="'Remaining ' + line.name"
                      [value]="line.actualRemaining"
                      (input)="onRemainingInput(index, $event)"
                    />
                    <input
                      type="text"
                      class="input w-20"
                      [attr.aria-label]="'Unit for ' + line.name"
                      [value]="line.remainingUnit ?? ''"
                      (input)="onUnitInput(index, $event)"
                    />
                    <select
                      class="input flex-1 min-w-[7rem]"
                      [attr.aria-label]="'Storage for ' + line.name"
                      [value]="line.location"
                      (change)="onLocationChange(index, $event)"
                    >
                      @for (loc of locations; track loc) {
                        <option [value]="loc">{{ locationLabels[loc] }}</option>
                      }
                    </select>
                  </div>
                </li>
              }
            </ul>
          </div>
        }

        @if (draft().extraPortions > 0) {
          <div class="mt-4 rounded-lg bg-brand-50 px-3 py-3">
            <p class="text-sm font-medium text-brand-900">
              {{ draft().extraPortions }} extra portion{{ draft().extraPortions === 1 ? '' : 's' }} will be saved as ready portions
            </p>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label for="ready-storage" class="mb-1 block text-xs font-medium text-stone-700">
                  Storage
                </label>
                <select
                  id="ready-storage"
                  class="input w-full"
                  [value]="readyPortionStorage()"
                  (change)="onReadyStorageChange($event)"
                >
                  @for (loc of locations; track loc) {
                    <option [value]="loc">{{ locationLabels[loc] }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="ready-expires" class="mb-1 block text-xs font-medium text-stone-700">
                  Expiry (optional)
                </label>
                <input
                  id="ready-expires"
                  type="date"
                  class="input w-full"
                  [value]="readyPortionExpiresAt() ?? ''"
                  (input)="onReadyExpiresInput($event)"
                />
              </div>
            </div>
          </div>
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
            {{ busy() ? 'Updating...' : 'Confirm cooked' }}
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
export class RecipeCookingDialogComponent {
  readonly draft = input.required<RecipeCookingDraft>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly confirmed = output<RecipeCookingDraft>();
  readonly cancelled = output<void>();

  readonly locations = STORAGE_LOCATIONS;
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly lines = signal<IngredientReconciliationLine[]>([]);
  readonly readyPortionStorage = signal<StorageLocation>('fridge');
  readonly readyPortionExpiresAt = signal<string | null>(null);

  readonly sufficientLines = computed(() =>
    this.lines().filter((line) => line.status === 'sufficient')
  );
  readonly reconcileLines = computed(() =>
    this.lines().filter((line) => line.status !== 'sufficient')
  );

  constructor() {
    effect(() => {
      const draft = this.draft();
      this.lines.set(draft.reconciliationLines.map((line) => ({ ...line })));
      this.readyPortionStorage.set(draft.readyPortionStorage);
      this.readyPortionExpiresAt.set(draft.readyPortionExpiresAt);
    });
  }

  onRemainingInput(index: number, event: Event): void {
    const raw = parseFloat((event.target as HTMLInputElement).value);
    this.lines.update((items) =>
      items.map((item, i) =>
        i === index
          ? { ...item, actualRemaining: Math.max(0, Number.isFinite(raw) ? raw : 0) }
          : item
      )
    );
  }

  onUnitInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.lines.update((items) =>
      items.map((item, i) =>
        i === index ? { ...item, remainingUnit: value || null } : item
      )
    );
  }

  onLocationChange(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value as StorageLocation;
    this.lines.update((items) =>
      items.map((item, i) => (i === index ? { ...item, location: value } : item))
    );
  }

  onReadyStorageChange(event: Event): void {
    this.readyPortionStorage.set((event.target as HTMLSelectElement).value as StorageLocation);
  }

  onReadyExpiresInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.readyPortionExpiresAt.set(value || null);
  }

  confirm(): void {
    const draft = this.draft();
    this.confirmed.emit({
      ...draft,
      reconciliationLines: this.lines(),
      readyPortionStorage: this.readyPortionStorage(),
      readyPortionExpiresAt: this.readyPortionExpiresAt(),
    });
  }
}
