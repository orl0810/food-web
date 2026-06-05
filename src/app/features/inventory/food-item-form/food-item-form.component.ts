import { Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FoodItem,
  FoodItemInsert,
  StorageLocation,
  STORAGE_LOCATIONS,
  STORAGE_LOCATION_LABELS,
} from '../../../core/models/food-item.model';

@Component({
  selector: 'app-food-item-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form class="space-y-4 rounded-xl border border-stone-200 bg-card p-5 shadow-sm" [formGroup]="form" (ngSubmit)="submit()">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold text-stone-900">
          {{ item() ? 'Edit food item' : 'Add food item' }}
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
          <label for="name" class="mb-1 block text-sm font-medium text-stone-700">Name *</label>
          <input
            id="name"
            type="text"
            formControlName="name"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label for="category" class="mb-1 block text-sm font-medium text-stone-700">Category</label>
          <input
            id="category"
            type="text"
            formControlName="category"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="Dairy, Produce..."
          />
        </div>

        <div>
          <label for="location" class="mb-1 block text-sm font-medium text-stone-700">Location *</label>
          <select
            id="location"
            formControlName="location"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            @for (location of locations; track location) {
              <option [value]="location">{{ locationLabels[location] }}</option>
            }
          </select>
        </div>

        <div>
          <label for="quantity" class="mb-1 block text-sm font-medium text-stone-700">Quantity *</label>
          <input
            id="quantity"
            type="number"
            min="0.01"
            step="0.01"
            formControlName="quantity"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label for="unit" class="mb-1 block text-sm font-medium text-stone-700">Unit</label>
          <input
            id="unit"
            type="text"
            formControlName="unit"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="kg, pcs, L"
          />
        </div>

        <div class="sm:col-span-2">
          <label for="expiration_date" class="mb-1 block text-sm font-medium text-stone-700">
            Expiration date
          </label>
          <input
            id="expiration_date"
            type="date"
            formControlName="expiration_date"
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      @if (error()) {
        <p class="text-sm text-red-600">{{ error() }}</p>
      }

      <div class="flex justify-end gap-3">
        <button
          type="submit"
          class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="form.invalid || submitting()"
        >
          {{ submitting() ? 'Saving...' : item() ? 'Save changes' : 'Add item' }}
        </button>
      </div>
    </form>
  `,
})
export class FoodItemFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly item = input<FoodItem | null>(null);
  readonly saved = output<FoodItemInsert>();
  readonly cancelled = output<void>();

  readonly locations = STORAGE_LOCATIONS;
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    category: [''],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit: [''],
    expiration_date: [''],
    location: ['fridge' as StorageLocation, Validators.required],
  });

  constructor() {
    effect(() => {
      const item = this.item();
      if (item) {
        this.form.patchValue({
          name: item.name,
          category: item.category ?? '',
          quantity: item.quantity,
          unit: item.unit ?? '',
          expiration_date: item.expiration_date ?? '',
          location: item.location,
        });
      } else {
        this.form.reset({
          name: '',
          category: '',
          quantity: 1,
          unit: '',
          expiration_date: '',
          location: 'fridge',
        });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      name: value.name!.trim(),
      category: value.category?.trim() || null,
      quantity: value.quantity!,
      unit: value.unit?.trim() || null,
      expiration_date: value.expiration_date || null,
      location: value.location!,
    });
  }
}
