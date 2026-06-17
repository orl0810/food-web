import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FoodItemHistory } from '../../core/models/food-item-history.model';
import {
  FoodItem,
  FoodItemInsert,
  INVENTORY_FILTERS,
  InventoryFilter,
  STORAGE_LOCATION_LABELS,
} from '../../core/models/food-item.model';
import { ReusableInventoryItem } from '../../core/models/reusable-inventory-item.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { FoodItemHistoryService } from '../../core/services/food-item-history.service';
import { FoodCategoryService } from '../../core/services/food-category.service';
import { FoodCatalogService } from '../../core/services/food-catalog.service';
import { VoiceInventoryDraftItem } from '../../core/models/voice-inventory.model';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FoodIconBadgeComponent } from '../../shared/components/food-icon-badge/food-icon-badge.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import {
  getExpirationLabel,
  getExpirationShortLabel,
  getExpirationStatus,
} from '../../shared/utils/expiration.utils';
import {
  formatInventoryName,
  normalizeNameKey,
} from '../../shared/utils/name-normalization.utils';
import { findHistoryEntryForReusableItem } from '../../shared/utils/reusable-inventory.utils';
import { AddInventoryByVoiceComponent } from './add-inventory-by-voice/add-inventory-by-voice.component';
import { FoodItemFormDialogComponent } from './food-item-form/food-item-form-dialog.component';
import { ReusableInventoryItemsComponent } from './reusable-inventory-items/reusable-inventory-items.component';
import { PreparedPortionsListComponent } from './ready-portions/prepared-portions-list.component';
import { AddPortionToMealPlanDialogComponent } from './ready-portions/add-portion-to-meal-plan-dialog.component';
import { PreparedPortion } from '../../core/models/prepared-portion.model';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    FoodItemFormDialogComponent,
    AddInventoryByVoiceComponent,
    ReusableInventoryItemsComponent,
    PreparedPortionsListComponent,
    AddPortionToMealPlanDialogComponent,
    EmptyStateComponent,
    FoodIconBadgeComponent,
    LoadingStateComponent,
  ],
  template: `
    <div class="page">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="page-title">Inventory</h1>
          <p class="page-subtitle">Track what you have at home.</p>
        </div>

@if (!showVoiceForm() && activeFilter() !== 'ready_portions') {
        <app-reusable-inventory-items
          [reusableItems]="reusableItems()"
          [selectedItem]="selectedReusableItem()"
          [isLoading]="foodItemHistoryService.loading()"
          [hasMore]="foodItemHistoryService.hasMore()"
          [loadingMore]="foodItemHistoryService.loadingMore()"
          (itemSelected)="onReusableItemSelected($event)"
          (duplicateItemSelected)="onDuplicateItemSelected($event)"
          (updateExistingClicked)="onUpdateExistingClicked($event)"
          (addNewBatchClicked)="onAddNewBatchClicked($event)"
          (loadMoreRequested)="onLoadMoreReusableItems()"
        />
      }









        @if (!showVoiceForm() && activeFilter() !== 'ready_portions') {
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="openVoiceForm()"
            >
              Add by voice
            </button>
            <button type="button" class="btn-primary" (click)="openAddForm()">
              Add food
            </button>
          </div>
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

      @if (voiceSaveInfo()) {
        <p class="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {{ voiceSaveInfo() }}
        </p>
      }

      @if (showVoiceForm()) {
        <app-add-inventory-by-voice
          [submitting]="voiceSaving()"
          [saveError]="voiceError()"
          (saved)="saveVoiceItems($event)"
          (cancelled)="closeVoiceForm()"
        />
      }

      @if (portionForMealPlan()) {
        <app-add-portion-to-meal-plan-dialog
          [portion]="portionForMealPlan()!"
          (saved)="onPortionAddedToMealPlan()"
          (cancelled)="portionForMealPlan.set(null)"
        />
      }

      @if (activeFilter() === 'ready_portions') {
        <app-prepared-portions-list (addToMealPlan)="portionForMealPlan.set($event)" />
      } @else if (inventoryService.loading()) {
        <app-loading-state message="Loading inventory..." />
      } @else if (inventoryService.error()) {
        <p class="alert-error">
          {{ inventoryService.error() }}
        </p>
      } @else if (filteredItems().length === 0) {
        <app-empty-state
          title="No food items here"
          description="No food added yet. Start by adding what you already have in your fridge, freezer, or pantry."
          actionLabel="Add food"
          (actionClick)="openAddForm()"
        />
      } @else {
        <section class="card overflow-hidden">
          <div class="divide-y divide-stone-200/60">
            @for (item of filteredItems(); track item.id) {
              <article class="flex flex-wrap items-start gap-x-2.5 gap-y-2 px-4 py-3 transition-colors hover:bg-stone-50/60 sm:flex-nowrap sm:items-center sm:gap-3 sm:px-5">
                <app-food-icon-badge [name]="item.name" [category]="item.category" />

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

      @if (showForm()) {
        <app-food-item-form-dialog
          [item]="editingItem()"
          [prefillFromHistory]="historyPrefill()"
          [submitting]="saving()"
          [error]="formError()"
          (saved)="saveItem($event)"
          (cancelled)="closeForm()"
        />
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
  readonly showVoiceForm = signal(false);
  readonly editingItem = signal<FoodItem | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly voiceSaving = signal(false);
  readonly voiceError = signal<string | null>(null);
  readonly voiceSaveInfo = signal<string | null>(null);
  readonly selectedReusableItem = signal<ReusableInventoryItem | null>(null);
  readonly historyPrefill = signal<FoodItemHistory | null>(null);

  readonly portionForMealPlan = signal<PreparedPortion | null>(null);

  readonly filteredItems = computed(() => {
    if (this.activeFilter() === 'ready_portions') {
      return [];
    }
    return this.inventoryService.filterItems(this.inventoryService.items(), this.activeFilter());
  });

  readonly reusableItems = computed(() => {
    this.foodItemHistoryService.history();
    return this.foodItemHistoryService.getReusableItems(this.inventoryService.items());
  });

  onPortionAddedToMealPlan(): void {
    this.portionForMealPlan.set(null);
  }

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
    this.closeVoiceForm();
    this.editingItem.set(null);
    this.formError.set(null);
    this.historyPrefill.set(null);
    this.selectedReusableItem.set(null);
    this.showForm.set(true);

    void this.foodItemHistoryService.loadAllHistory();
    void this.foodCategoryService.loadCategories();
    void this.foodCatalogService.loadCatalog();
  }

  openEditForm(item: FoodItem): void {
    this.closeVoiceForm();
    this.editingItem.set(item);
    this.formError.set(null);
    this.historyPrefill.set(null);
    this.selectedReusableItem.set(null);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingItem.set(null);
    this.formError.set(null);
    this.historyPrefill.set(null);
    this.selectedReusableItem.set(null);
  }

  onReusableItemSelected(item: ReusableInventoryItem): void {
    this.openAddFormWithPrefill(item);
  }

  onDuplicateItemSelected(item: ReusableInventoryItem): void {
    this.selectedReusableItem.set(item);
  }

  onUpdateExistingClicked(item: ReusableInventoryItem): void {
    const inventoryItem = this.inventoryService
      .items()
      .find((entry) => entry.id === item.activeInventoryItemId);

    if (!inventoryItem) {
      return;
    }

    this.selectedReusableItem.set(null);
    this.openEditForm(inventoryItem);
  }

  onAddNewBatchClicked(item: ReusableInventoryItem): void {
    this.selectedReusableItem.set(null);
    this.openAddFormWithPrefill(item);
  }

  private openAddFormWithPrefill(item: ReusableInventoryItem): void {
    const historyEntry = findHistoryEntryForReusableItem(
      this.foodItemHistoryService.history(),
      item
    );

    this.closeVoiceForm();
    this.editingItem.set(null);
    this.formError.set(null);
    this.historyPrefill.set(historyEntry);
    this.selectedReusableItem.set(null);
    this.showForm.set(true);

    void this.foodItemHistoryService.loadAllHistory();
    void this.foodCategoryService.loadCategories();
    void this.foodCatalogService.loadCatalog();
  }

  onLoadMoreReusableItems(): void {
    void this.foodItemHistoryService.loadMoreHistory();
  }

  openVoiceForm(): void {
    this.closeForm();
    this.voiceError.set(null);
    this.voiceSaveInfo.set(null);
    this.showVoiceForm.set(true);
  }

  closeVoiceForm(): void {
    this.showVoiceForm.set(false);
    this.voiceError.set(null);
    this.voiceSaving.set(false);
  }

  async saveItem(input: FoodItemInsert): Promise<void> {
    this.saving.set(true);
    this.formError.set(null);

    const normalizedInput: FoodItemInsert = {
      ...input,
      name: formatInventoryName(input.name),
    };

    const editing = this.editingItem();
    if (!editing) {
      const existing = this.findExistingItemByName(normalizedInput.name);
      if (existing) {
        this.saving.set(false);
        this.historyPrefill.set(null);
        this.editingItem.set({
          ...existing,
          quantity: normalizedInput.quantity,
        });
        this.formError.set(
          `"${normalizedInput.name}" is already in your inventory. Update the quantity below.`
        );
        return;
      }
    }

    const result = editing
      ? await this.inventoryService.updateItem(editing.id, normalizedInput)
      : await this.inventoryService.createItem(normalizedInput);

    this.saving.set(false);

    if (result.error) {
      this.formError.set(result.error);
      return;
    }

    this.closeForm();
  }

  async saveVoiceItems(items: VoiceInventoryDraftItem[]): Promise<void> {
    this.voiceSaving.set(true);
    this.voiceError.set(null);

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const payload: FoodItemInsert = {
        name: formatInventoryName(item.name),
        category: item.category?.trim() || null,
        quantity: item.quantity ?? 1,
        unit: item.unit?.trim() || null,
        expiration_date: item.expiration_date || null,
        location: item.location,
      };

      const existing = this.findExistingItemByName(payload.name);
      if (existing) {
        const result = await this.inventoryService.updateItem(existing.id, {
          quantity: payload.quantity,
        });

        if (result.error) {
          this.voiceSaving.set(false);
          this.voiceError.set(result.error);
          return;
        }

        updatedCount += 1;
        continue;
      }

      const result = await this.inventoryService.createItem(payload);

      if (result.error) {
        this.voiceSaving.set(false);
        this.voiceError.set(result.error);
        return;
      }

      createdCount += 1;
    }

    this.voiceSaving.set(false);

    if (updatedCount > 0) {
      const parts: string[] = [];
      if (createdCount > 0) {
        parts.push(
          `Added ${createdCount} item${createdCount === 1 ? '' : 's'}`
        );
      }
      parts.push(
        `updated ${updatedCount} existing item${updatedCount === 1 ? '' : 's'}`
      );
      this.voiceSaveInfo.set(`${parts.join(' and ')}.`);
    }

    await this.foodItemHistoryService.loadHistory();
    this.closeVoiceForm();
  }

  private findExistingItemByName(name: string): FoodItem | undefined {
    const nameKey = normalizeNameKey(name);
    return this.inventoryService.items().find(
      (item) => normalizeNameKey(item.name) === nameKey
    );
  }

  async deleteItem(item: FoodItem): Promise<void> {
    const confirmed = window.confirm(`Delete "${item.name}" from your inventory?`);
    if (!confirmed) {
      return;
    }

    await this.inventoryService.deleteItem(item.id);
  }
}
