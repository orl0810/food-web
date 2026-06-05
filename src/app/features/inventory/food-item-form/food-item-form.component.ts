import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodCatalogItem } from '../../../core/models/food-catalog-item.model';
import { FoodItemHistory } from '../../../core/models/food-item-history.model';
import {
  FoodItem,
  FoodItemInsert,
  StorageLocation,
  STORAGE_LOCATIONS,
  STORAGE_LOCATION_LABELS,
} from '../../../core/models/food-item.model';
import { SearchSelectOption } from '../../../core/models/search-select-option.model';
import { FoodCatalogService } from '../../../core/services/food-catalog.service';
import { FoodCategoryService } from '../../../core/services/food-category.service';
import { FoodItemHistoryService } from '../../../core/services/food-item-history.service';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select.component';

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

@Component({
  selector: 'app-food-item-form',
  standalone: true,
  imports: [ReactiveFormsModule, SearchSelectComponent],
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
          @if (item()) {
            <input
              id="name"
              type="text"
              formControlName="name"
              class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          } @else {
            <app-search-select
              inputId="name"
              [control]="nameControl"
              [options]="nameOptions()"
              placeholder="Search previously added items..."
              (selected)="applyNameSelection($event)"
            />
            @if (suggestionsError()) {
              <p class="mt-1 text-xs text-red-600">
                Suggestions unavailable — make sure the local API is running (npm run start:api) or check your connection.
              </p>
            } @else if (suggestionsLoading()) {
              <p class="mt-1 text-xs text-stone-500">Loading suggestions...</p>
            } @else {
              <p class="mt-1 text-xs text-stone-500">
                Start typing to reuse a previously added item or pick from the catalog.
              </p>
            }
          }
        </div>

        <div>
          <label for="category" class="mb-1 block text-sm font-medium text-stone-700">Category</label>
          @if (item()) {
            <input
              id="category"
              type="text"
              formControlName="category"
              class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="Dairy, Produce..."
            />
          } @else {
            <app-search-select
              inputId="category"
              [control]="categoryControl"
              [options]="categoryOptions()"
              placeholder="Search categories..."
              (selected)="applyCategorySelection($event)"
            />
            <p class="mt-1 text-xs text-stone-500">
              Pick a default category or type your own.
            </p>
          }
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
  readonly foodItemHistoryService = inject(FoodItemHistoryService);
  readonly foodCategoryService = inject(FoodCategoryService);
  readonly foodCatalogService = inject(FoodCatalogService);

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

  readonly nameOptions = computed(() => {
    this.foodItemHistoryService.history();
    this.foodCatalogService.catalogItems();

    const historyOptions = this.foodItemHistoryService.getHistoryOptions('');
    const historyKeys = new Set(historyOptions.map((option) => normalizeNameKey(option.label)));
    const catalogOptions = this.foodCatalogService
      .getCatalogOptions('')
      .filter((option) => !historyKeys.has(normalizeNameKey(option.label)));

    return [...historyOptions, ...catalogOptions];
  });

  readonly categoryOptions = computed(() => {
    this.foodItemHistoryService.history();
    this.foodCategoryService.categories();

    return this.foodCategoryService.getCategoryOptions(
      '',
      this.foodItemHistoryService.getCustomCategories()
    );
  });

  readonly suggestionsLoading = computed(
    () =>
      this.foodItemHistoryService.loading() ||
      this.foodCategoryService.loading() ||
      this.foodCatalogService.loading()
  );

  readonly suggestionsError = computed(
    () =>
      this.foodCatalogService.error() ||
      this.foodCategoryService.error() ||
      this.foodItemHistoryService.error()
  );

  get nameControl() {
    return this.form.controls.name;
  }

  get categoryControl() {
    return this.form.controls.category;
  }

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

  applyCategorySelection(option: SearchSelectOption): void {
    this.form.patchValue({ category: option.label });
  }

  applyNameSelection(option: SearchSelectOption): void {
    if (this.isHistoryEntry(option.payload)) {
      this.applyHistoryEntry(option.payload);
      return;
    }

    if (this.isCatalogItem(option.payload)) {
      this.applyCatalogEntry(option.payload);
    }
  }

  applyHistoryEntry(entry: FoodItemHistory): void {
    this.form.patchValue({
      name: entry.name,
      category: entry.category ?? '',
      unit: entry.unit ?? '',
      location: entry.location,
      quantity: entry.default_quantity,
    });
  }

  applyCatalogEntry(entry: FoodCatalogItem): void {
    this.form.patchValue({
      name: entry.name,
      category: entry.category_name,
      unit: entry.default_unit ?? '',
      location: entry.default_location,
      quantity: entry.default_quantity,
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

  private isHistoryEntry(payload: unknown): payload is FoodItemHistory {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'user_id' in payload &&
      'last_used_at' in payload &&
      !('category_id' in payload)
    );
  }

  private isCatalogItem(payload: unknown): payload is FoodCatalogItem {
    return (
      typeof payload === 'object' &&
      payload !== null &&
      'category_id' in payload &&
      'category_name' in payload
    );
  }
}
