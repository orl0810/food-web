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
        <div class="grid grid-cols-3 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (item of filteredItems(); track item.id) {
            <article class="card h-full p-4">
              <div class="flex h-full flex-col gap-3">
                <div class="min-w-0 flex-1">
                  <h2 class="truncate text-base font-semibold text-stone-900">{{ item.name }}</h2>
                  <p class="mt-1 text-sm text-stone-600">
                    {{ item.quantity }} {{ item.unit || 'units' }}
                    @if (item.category) {
                      · {{ item.category }}
                    }
                  </p>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span class="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
                      {{ locationLabels[item.location] }}
                    </span>
                    <span
                      class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      [class.bg-red-100]="expirationStatus(item) === 'expired'"
                      [class.text-red-700]="expirationStatus(item) === 'expired'"
                      [class.bg-amber-100]="expirationStatus(item) === 'soon'"
                      [class.text-amber-800]="expirationStatus(item) === 'soon'"
                      [class.bg-stone-100]="expirationStatus(item) === 'none' || expirationStatus(item) === 'ok'"
                      [class.text-stone-700]="expirationStatus(item) === 'none' || expirationStatus(item) === 'ok'"
                    >
                      {{ expirationLabel(item) }}
                    </span>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button type="button" class="btn-secondary-sm flex-1" (click)="openEditForm(item)">
                    Edit
                  </button>
                  <button type="button" class="btn-danger flex-1" (click)="deleteItem(item)">
                    Delete
                  </button>
                </div>
              </div>
            </article>
          }
        </div>
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
