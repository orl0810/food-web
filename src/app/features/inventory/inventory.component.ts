import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FoodItem,
  FoodItemInsert,
  INVENTORY_FILTERS,
  InventoryFilter,
  STORAGE_LOCATION_LABELS,
} from '../../core/models/food-item.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { FoodItemHistoryService } from '../../core/services/food-item-history.service';
import { FoodCategoryService } from '../../core/services/food-category.service';
import { FoodCatalogService } from '../../core/services/food-catalog.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import {
  getExpirationLabel,
  getExpirationShortLabel,
  getExpirationStatus,
} from '../../shared/utils/expiration.utils';
import { FoodItemFormComponent } from './food-item-form/food-item-form.component';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FoodItemFormComponent, EmptyStateComponent, LoadingStateComponent],
  template: `
    <div class="page">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="page-title">Inventory</h1>
          <p class="page-subtitle">Track what you have at home.</p>
        </div>
        @if (!showForm()) {
          <button type="button" class="btn-primary" (click)="openAddForm()">
            Add food
          </button>
        }
      </div>

      <div class="flex flex-wrap gap-2">
        @for (filter of filters; track filter.value) {
          <button
            type="button"
            class="filter-pill"
            [class.filter-pill-active]="activeFilter() === filter.value"
            [class.filter-pill-inactive]="activeFilter() !== filter.value"
            (click)="activeFilter.set(filter.value)"
          >
            {{ filter.label }}
          </button>
        }
      </div>

      @if (showForm()) {
        <app-food-item-form
          [item]="editingItem()"
          [submitting]="saving()"
          [error]="formError()"
          (saved)="saveItem($event)"
          (cancelled)="closeForm()"
        />
      }

      @if (inventoryService.loading()) {
        <app-loading-state message="Loading inventory..." />
      } @else if (inventoryService.error()) {
        <p class="alert-error">
          {{ inventoryService.error() }}
        </p>
      } @else if (filteredItems().length === 0) {
        <app-empty-state
          title="No food items here"
          description="No food added yet. Start by adding what you already have in your fridge, freezer, or pantry."
          [actionLabel]="showForm() ? '' : 'Add food'"
          (actionClick)="openAddForm()"
        />
      } @else {
        <section class="card overflow-hidden">
          <div class="divide-y divide-stone-200/60">
            @for (item of filteredItems(); track item.id) {
              <article class="flex flex-wrap items-start gap-x-2.5 gap-y-2 px-4 py-3 transition-colors hover:bg-stone-50/60 sm:flex-nowrap sm:items-center sm:gap-3 sm:px-5">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200/80"
                  aria-hidden="true"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-4 w-4 text-stone-400">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H5.25A2.25 2.25 0 0 0 3 5.25v13.5A2.25 2.25 0 0 0 5.25 21Z" />
                  </svg>
                </div>

                <div class="min-w-0 flex-1 sm:flex sm:items-center sm:gap-5">
                  <div class="flex items-start justify-between gap-2 sm:contents">
                    <p class="truncate text-sm font-semibold text-stone-900 sm:w-32 sm:shrink-0 lg:w-40">
                      {{ item.name }}
                    </p>

                    <span
                      class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:hidden"
                      [class.bg-red-50]="expirationStatus(item) === 'expired'"
                      [class.text-red-700]="expirationStatus(item) === 'expired'"
                      [class.bg-amber-50]="expirationStatus(item) === 'soon'"
                      [class.text-amber-700]="expirationStatus(item) === 'soon'"
                      [class.bg-stone-100]="expirationStatus(item) === 'none' || expirationStatus(item) === 'ok'"
                      [class.text-stone-600]="expirationStatus(item) === 'none' || expirationStatus(item) === 'ok'"
                    >
                      {{ expirationLabel(item) }}
                    </span>
                  </div>

                  <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 sm:mt-0 sm:flex-1">
                    <span
                      class="font-medium"
                      [class.text-red-600]="expirationStatus(item) === 'expired'"
                      [class.text-amber-600]="expirationStatus(item) === 'soon'"
                      [class.text-stone-600]="expirationStatus(item) === 'none' || expirationStatus(item) === 'ok'"
                    >
                      {{ item.expiration_date ? expirationShortLabel(item.expiration_date) : 'No date' }}
                    </span>
                    <span class="text-stone-300" aria-hidden="true">·</span>
                    <span>{{ locationLabels[item.location] }}</span>
                    <span class="text-stone-300" aria-hidden="true">·</span>
                    <span>{{ item.quantity }} {{ item.unit || 'units' }}</span>
                    @if (item.category) {
                      <span class="text-stone-300" aria-hidden="true">·</span>
                      <span>{{ item.category }}</span>
                    }
                  </p>
                </div>

                <span
                  class="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight sm:inline-flex sm:self-center"
                  [class.bg-red-50]="expirationStatus(item) === 'expired'"
                  [class.text-red-700]="expirationStatus(item) === 'expired'"
                  [class.bg-amber-50]="expirationStatus(item) === 'soon'"
                  [class.text-amber-700]="expirationStatus(item) === 'soon'"
                  [class.bg-stone-100]="expirationStatus(item) === 'none' || expirationStatus(item) === 'ok'"
                  [class.text-stone-600]="expirationStatus(item) === 'none' || expirationStatus(item) === 'ok'"
                >
                  {{ expirationLabel(item) }}
                </span>

                <div class="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto sm:self-center">
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100"
                    (click)="openEditForm(item)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                    (click)="deleteItem(item)"
                  >
                    Delete
                  </button>
                </div>
              </article>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class InventoryComponent implements OnInit {
  readonly inventoryService = inject(FoodInventoryService);
  readonly foodItemHistoryService = inject(FoodItemHistoryService);
  readonly foodCategoryService = inject(FoodCategoryService);
  readonly foodCatalogService = inject(FoodCatalogService);

  readonly filters = INVENTORY_FILTERS;
  readonly locationLabels = STORAGE_LOCATION_LABELS;

  readonly activeFilter = signal<InventoryFilter>('all');
  readonly showForm = signal(false);
  readonly editingItem = signal<FoodItem | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly filteredItems = computed(() =>
    this.inventoryService.filterItems(this.inventoryService.items(), this.activeFilter())
  );

  ngOnInit(): void {
    void this.inventoryService.loadItems();
    void this.foodItemHistoryService.loadHistory();
    void this.foodCategoryService.loadCategories();
    void this.foodCatalogService.loadCatalog();
  }

  expirationLabel(item: FoodItem): string {
    return getExpirationLabel(item.expiration_date);
  }

  expirationShortLabel(date: string | null): string {
    return getExpirationShortLabel(date);
  }

  expirationStatus(item: FoodItem) {
    return getExpirationStatus(item.expiration_date);
  }

  openAddForm(): void {
    this.editingItem.set(null);
    this.formError.set(null);
    this.showForm.set(true);

    void this.foodItemHistoryService.loadHistory();
    void this.foodCategoryService.loadCategories();
    void this.foodCatalogService.loadCatalog();
  }

  openEditForm(item: FoodItem): void {
    this.editingItem.set(item);
    this.formError.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingItem.set(null);
    this.formError.set(null);
  }

  async saveItem(input: FoodItemInsert): Promise<void> {
    this.saving.set(true);
    this.formError.set(null);

    const editing = this.editingItem();
    const result = editing
      ? await this.inventoryService.updateItem(editing.id, input)
      : await this.inventoryService.createItem(input);

    this.saving.set(false);

    if (result.error) {
      this.formError.set(result.error);
      return;
    }

    this.closeForm();
  }

  async deleteItem(item: FoodItem): Promise<void> {
    const confirmed = window.confirm(`Delete "${item.name}" from your inventory?`);
    if (!confirmed) {
      return;
    }

    await this.inventoryService.deleteItem(item.id);
  }
}
