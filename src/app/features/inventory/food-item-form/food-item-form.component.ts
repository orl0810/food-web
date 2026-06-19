import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FoodCatalogItem } from '../../../core/models/food-catalog-item.model';
import { FoodItemHistory } from '../../../core/models/food-item-history.model';
import {
  FoodItem,
  FoodItemInsert,
  FOOD_UNIT_LABELS,
  FOOD_UNIT_OTHER,
  FOOD_UNITS,
  StorageLocation,
  STORAGE_LOCATIONS,
  STORAGE_LOCATION_LABELS,
} from '../../../core/models/food-item.model';
import { SearchSelectOption } from '../../../core/models/search-select-option.model';
import { FoodCatalogService } from '../../../core/services/food-catalog.service';
import { FoodCategoryService } from '../../../core/services/food-category.service';
import { FoodIconService } from '../../../core/services/food-icon.service';
import { FoodItemHistoryService } from '../../../core/services/food-item-history.service';
import { SearchSelectComponent } from '../../../shared/components/search-select/search-select.component';
import {
  formatInventoryName,
  normalizeNameKey,
} from '../../../shared/utils/name-normalization.utils';

@Component({
  selector: 'app-food-item-form',
  standalone: true,
  imports: [ReactiveFormsModule, SearchSelectComponent],
  template: `
    <form class="space-y-4" [formGroup]="form" (ngSubmit)="submit()">
      <div class="flex items-center justify-between gap-4">
        <h2 [id]="titleId()" class="text-lg font-semibold text-stone-900">
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
              class="input"
              (blur)="formatNameField()"
            />
          } @else {
            <app-search-select
              inputId="name"
              [control]="nameControl"
              [options]="nameOptions()"
              placeholder="Search previously added items..."
              (selected)="applyNameSelection($event)"
              (blurred)="formatNameField()"
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
              class="input"
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
            class="input"
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
            class="input"
          />
        </div>

        <div>
          <label for="unit" class="mb-1 block text-sm font-medium text-stone-700">Unit</label>
          <select
            id="unit"
            formControlName="unit"
            class="input"
          >
            <option value="">—</option>
            @for (foodUnit of foodUnits; track foodUnit) {
              <option [value]="foodUnit">{{ unitLabels[foodUnit] }}</option>
            }
            <option [value]="unitOther">Other...</option>
          </select>
          @if (form.controls.unit.value === unitOther) {
            <input
              id="unit_custom"
              type="text"
              formControlName="unit_custom"
              class="input mt-2"
              placeholder="can, bottle, cup"
            />
          }
        </div>

        <div class="sm:col-span-2">
          <label for="expiration_date" class="mb-1 block text-sm font-medium text-stone-700">
            Expiration date
          </label>
          <input
            id="expiration_date"
            type="date"
            formControlName="expiration_date"
            class="input"
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
  private readonly foodIconService = inject(FoodIconService);

  readonly item = input<FoodItem | null>(null);
  readonly prefillFromHistory = input<FoodItemHistory | null>(null);
  readonly titleId = input('food-item-form-title');
  readonly saved = output<FoodItemInsert>();
  readonly cancelled = output<void>();

  readonly locations = STORAGE_LOCATIONS;
  readonly locationLabels = STORAGE_LOCATION_LABELS;
  readonly foodUnits = FOOD_UNITS;
  readonly unitLabels = FOOD_UNIT_LABELS;
  readonly unitOther = FOOD_UNIT_OTHER;

  readonly submitting = input(false);
  readonly error = input<string | null>(null);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    category: [''],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit: [''],
    unit_custom: [''],
    expiration_date: [''],
    location: ['fridge' as StorageLocation, Validators.required],
  });

  readonly nameOptions = computed(() => {
    this.foodItemHistoryService.history();
    this.foodCatalogService.catalogItems();

    const historyOptions = this.foodItemHistoryService.getHistoryOptions('').map((option) => ({
      ...option,
      icon: this.foodIconService.resolveIcon(
        option.label,
        this.isHistoryEntry(option.payload) ? option.payload.category : null
      ),
    }));
    const historyKeys = new Set(historyOptions.map((option) => normalizeNameKey(option.label)));
    const catalogOptions = this.foodCatalogService
      .getCatalogOptions('')
      .filter((option) => !historyKeys.has(normalizeNameKey(option.label)))
      .map((option) => ({
        ...option,
        icon: this.isCatalogItem(option.payload)
          ? option.payload.icon
          : this.foodIconService.resolveIcon(option.label),
      }));

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
    this.form.controls.unit.valueChanges.subscribe((unit) => {
      const customControl = this.form.controls.unit_custom;
      if (unit === FOOD_UNIT_OTHER) {
        customControl.setValidators(Validators.required);
      } else {
        customControl.clearValidators();
      }
      customControl.updateValueAndValidity({ emitEvent: false });
    });

    effect(() => {
      const item = this.item();
      const prefill = this.prefillFromHistory();

      if (item) {
        this.form.patchValue({
          name: item.name,
          category: item.category ?? '',
          quantity: item.quantity,
          ...this.resolveUnitFields(item.unit),
          expiration_date: item.expiration_date ?? '',
          location: item.location,
        });
        return;
      }

      if (prefill) {
        this.applyHistoryEntry(prefill);
        this.form.patchValue({ expiration_date: '' });
        return;
      }

      this.form.reset({
        name: '',
        category: '',
        quantity: 1,
        unit: '',
        unit_custom: '',
        expiration_date: '',
        location: 'fridge',
      });
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
      ...this.resolveUnitFields(entry.unit),
      location: entry.location,
      quantity: entry.default_quantity,
    });
  }

  applyCatalogEntry(entry: FoodCatalogItem): void {
    this.form.patchValue({
      name: formatInventoryName(entry.name),
      category: entry.category_name,
      ...this.resolveUnitFields(entry.default_unit),
      location: entry.default_location,
      quantity: entry.default_quantity,
    });
  }

  formatNameField(): void {
    const current = this.nameControl.value?.trim();
    if (!current) {
      return;
    }
    this.nameControl.setValue(formatInventoryName(current));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const unit =
      value.unit === FOOD_UNIT_OTHER
        ? value.unit_custom?.trim() || null
        : value.unit?.trim() || null;

    this.saved.emit({
      name: formatInventoryName(value.name!),
      category: value.category?.trim() || null,
      quantity: value.quantity!,
      unit,
      expiration_date: value.expiration_date || null,
      location: value.location!,
    });
  }

  private resolveUnitFields(unit: string | null | undefined): { unit: string; unit_custom: string } {
    const trimmed = unit?.trim() ?? '';

    if (!trimmed) {
      return { unit: '', unit_custom: '' };
    }

    if ((FOOD_UNITS as readonly string[]).includes(trimmed)) {
      return { unit: trimmed, unit_custom: '' };
    }

    return { unit: FOOD_UNIT_OTHER, unit_custom: trimmed };
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
