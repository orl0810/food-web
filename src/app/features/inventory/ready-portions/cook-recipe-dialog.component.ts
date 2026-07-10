import { Component, effect, inject, input, output, signal } from '@angular/core';
import { Recipe } from '../../../core/models/recipe.model';
import {
  STORAGE_LOCATIONS,
  STORAGE_LOCATION_LABELS,
  StorageLocation,
} from '../../../core/models/food-item.model';
import { PreparedPortionService } from '../../../core/services/prepared-portion.service';
import { toISODate } from '../../../shared/utils/meal-plan.utils';

@Component({
  selector: 'app-cook-recipe-dialog',
  standalone: true,
  template: `
    <div
      class="fixed inset-0 z-overlay flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      (click)="cancelled.emit()"
    >
      <div class="card w-full max-w-md p-5" (click)="$event.stopPropagation()">
        <h2 class="text-base font-semibold text-stone-900">Mark as cooked</h2>
        <p class="mt-1 text-sm text-stone-600">{{ recipe().title }}</p>
        <p class="mt-1 text-xs text-stone-500">
          Creates ready portions you can assign to different meals.
        </p>

        <div class="mt-4 space-y-4">
          <div>
            <label for="portions-cooked" class="mb-1 block text-sm font-medium text-stone-700">
              How many portions did you cook?
            </label>
            <input
              id="portions-cooked"
              type="number"
              min="1"
              class="input w-full"
              [value]="totalPortions()"
              (input)="onPortionsInput($event)"
            />
            @if (recipe().portions) {
              <p class="mt-1 text-xs text-stone-500">
                Recipe serves {{ recipe().portions }} — you can cook more for meal prep.
              </p>
            }
          </div>

          <div>
            <label for="cooked-date" class="mb-1 block text-sm font-medium text-stone-700">Cooked date</label>
            <input
              id="cooked-date"
              type="date"
              class="input w-full"
              [value]="cookedAt()"
              (input)="onCookedAtInput($event)"
            />
          </div>

          <div>
            <label for="expires-date" class="mb-1 block text-sm font-medium text-stone-700">Expiry date</label>
            <input
              id="expires-date"
              type="date"
              class="input w-full"
              [value]="expiresAt()"
              (input)="onExpiresAtInput($event)"
            />
          </div>

          <div>
            <label for="storage" class="mb-1 block text-sm font-medium text-stone-700">Storage</label>
            <select
              id="storage"
              class="input w-full"
              [value]="storageLocation()"
              (change)="onStorageChange($event)"
            >
              @for (loc of locations; track loc) {
                <option [value]="loc">{{ locationLabels[loc] }}</option>
              }
            </select>
          </div>
        </div>

        @if (error()) {
          <p class="alert-error mt-4">{{ error() }}</p>
        }

        <div class="mt-5 flex gap-2">
          <button
            type="button"
            class="btn-primary flex-1"
            [disabled]="saving()"
            (click)="confirm()"
          >
            {{ saving() ? 'Creating...' : 'Create ready portions' }}
          </button>
          <button
            type="button"
            class="btn-secondary flex-1"
            [disabled]="saving()"
            (click)="cancelled.emit()"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CookRecipeDialogComponent {
  private readonly preparedPortionService = inject(PreparedPortionService);

  readonly recipe = input.required<Recipe>();
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly locations = STORAGE_LOCATIONS;
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly totalPortions = signal(2);
  readonly cookedAt = signal(toISODate(new Date()));
  readonly expiresAt = signal('');
  readonly storageLocation = signal<StorageLocation>('fridge');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const r = this.recipe();
      if (r?.portions) {
        this.totalPortions.set(Math.max(1, r.portions));
      }
    });
  }

  onPortionsInput(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.totalPortions.set(Math.max(1, value || 1));
  }

  onCookedAtInput(event: Event): void {
    this.cookedAt.set((event.target as HTMLInputElement).value);
  }

  onExpiresAtInput(event: Event): void {
    this.expiresAt.set((event.target as HTMLInputElement).value);
  }

  onStorageChange(event: Event): void {
    this.storageLocation.set((event.target as HTMLSelectElement).value as StorageLocation);
  }

  async confirm(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);

    const r = this.recipe();
    const { error } = await this.preparedPortionService.createFromRecipe(
      r.id,
      r.title,
      this.totalPortions(),
      {
        cooked_at: this.cookedAt(),
        expires_at: this.expiresAt() || null,
        storage_location: this.storageLocation(),
      }
    );

    this.saving.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    this.saved.emit();
  }
}
