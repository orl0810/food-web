import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PreparedPortion,
  PreparedPortionInput,
} from '../../../core/models/prepared-portion.model';
import {
  STORAGE_LOCATIONS,
  STORAGE_LOCATION_LABELS,
  StorageLocation,
} from '../../../core/models/food-item.model';
import { toISODate } from '../../../shared/utils/meal-plan.utils';

@Component({
  selector: 'app-prepared-portion-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="card space-y-4 p-5" [formGroup]="form" (ngSubmit)="submit()">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold text-stone-900">
          {{ portion() ? 'Edit ready portion' : 'Add prepared food' }}
        </h2>
        <button
          type="button"
          class="text-sm text-stone-500 hover:text-stone-700"
          (click)="cancelled.emit()"
        >
          Cancel
        </button>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label for="pp-name" class="mb-1 block text-sm font-medium text-stone-700">Name *</label>
          <input
            id="pp-name"
            type="text"
            formControlName="name"
            class="input w-full"
            placeholder="Roasted vegetables"
          />
        </div>

        <div>
          <label for="pp-portions" class="mb-1 block text-sm font-medium text-stone-700">Total portions *</label>
          <input
            id="pp-portions"
            type="number"
            min="1"
            formControlName="total_portions"
            class="input w-full"
          />
        </div>

        <div>
          <label for="pp-cooked" class="mb-1 block text-sm font-medium text-stone-700">Cooked date</label>
          <input id="pp-cooked" type="date" formControlName="cooked_at" class="input w-full" />
        </div>

        <div>
          <label for="pp-expires" class="mb-1 block text-sm font-medium text-stone-700">Expiry date</label>
          <input id="pp-expires" type="date" formControlName="expires_at" class="input w-full" />
        </div>

        <div>
          <label for="pp-location" class="mb-1 block text-sm font-medium text-stone-700">Storage</label>
          <select id="pp-location" formControlName="storage_location" class="input w-full">
            @for (loc of locations; track loc) {
              <option [value]="loc">{{ locationLabels[loc] }}</option>
            }
          </select>
        </div>

        <div class="sm:col-span-2">
          <label for="pp-notes" class="mb-1 block text-sm font-medium text-stone-700">Notes</label>
          <textarea
            id="pp-notes"
            formControlName="notes"
            rows="2"
            class="input w-full resize-none"
            placeholder="Optional notes..."
          ></textarea>
        </div>
      </div>

      @if (error()) {
        <p class="alert-error">{{ error() }}</p>
      }

      <div class="flex gap-2">
        <button type="submit" class="btn-primary flex-1" [disabled]="submitting() || form.invalid">
          {{ submitting() ? 'Saving...' : (portion() ? 'Save changes' : 'Add prepared food') }}
        </button>
        <button type="button" class="btn-secondary flex-1" (click)="cancelled.emit()">
          Cancel
        </button>
      </div>
    </form>
  `,
})
export class PreparedPortionFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly portion = input<PreparedPortion | null>(null);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly saved = output<PreparedPortionInput>();
  readonly cancelled = output<void>();

  readonly locations = STORAGE_LOCATIONS;
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    total_portions: [1, [Validators.required, Validators.min(1)]],
    cooked_at: [toISODate(new Date()), Validators.required],
    expires_at: [''],
    storage_location: ['fridge' as StorageLocation, Validators.required],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const p = this.portion();
      if (p) {
        this.form.patchValue({
          name: p.name,
          total_portions: p.total_portions,
          cooked_at: p.cooked_at,
          expires_at: p.expires_at ?? '',
          storage_location: p.storage_location ?? 'fridge',
          notes: p.notes ?? '',
        });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      name: value.name,
      source_type: this.portion()?.source_type ?? 'custom',
      recipe_id: this.portion()?.recipe_id ?? null,
      total_portions: value.total_portions,
      cooked_at: value.cooked_at,
      expires_at: value.expires_at || null,
      storage_location: value.storage_location,
      notes: value.notes || null,
    });
  }
}
