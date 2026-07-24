import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ShoppingItem, ShoppingItemInput } from '../../core/models/shopping-item.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { RecipeService } from '../../core/services/recipe.service';
import { ShoppingListService } from '../../core/services/shopping-list.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { FirstTourEventsService } from '../../core/onboarding/first-tour-events.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { FoodIconBadgeComponent } from '../../shared/components/food-icon-badge/food-icon-badge.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import {
  addDays,
  formatWeekRangeCompact,
  getMondayOfWeek,
} from '../../shared/utils/meal-plan.utils';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    EmptyStateComponent,
    FoodIconBadgeComponent,
    LoadingStateComponent,
  ],
  template: `
    <div class="page">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="page-title">Shopping List</h1>
          <p class="page-subtitle">
            Check off items as you buy them — they go straight to your inventory. Generate from your meal plan or add items manually.
          </p>
        </div>
        @if (!showForm()) {
          <button type="button" class="btn-secondary shrink-0" (click)="openAddForm()">
            Add item
          </button>
        }
      </div>

      <section class="card p-4">
        <h2 class="text-base font-semibold text-stone-900">Generate from meal plan</h2>
        <p class="mt-1 text-sm text-stone-600">
          Compares planned meals with your inventory and rebuilds the shopping list.
        </p>
        <form class="mt-4" [formGroup]="rangeForm" (ngSubmit)="generateFromMealPlan()">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div class="flex-1">
              <label class="block text-sm font-medium text-stone-700" for="startDate">From</label>
              <input
                id="startDate"
                type="date"
                formControlName="startDate"
                class="input mt-1"
              />
            </div>
            <div class="flex-1">
              <label class="block text-sm font-medium text-stone-700" for="endDate">To</label>
              <input
                id="endDate"
                type="date"
                formControlName="endDate"
                class="input mt-1"
              />
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn-secondary" (click)="setThisWeek()">
                This week
              </button>
              <button
                type="submit"
                class="btn-primary"
                [disabled]="generating() || rangeForm.invalid || !isRangeValid()"
              >
                {{ generating() ? 'Generating...' : 'Generate shopping list' }}
              </button>
            </div>
          </div>
          @if (!isRangeValid()) {
            <p class="mt-3 text-sm text-red-700">Start date must be on or before end date.</p>
          }
        </form>
      </section>

      @if (infoMessage()) {
        <p class="alert-info">
          {{ infoMessage() }}
        </p>
      }

      @if (actionError()) {
        <p class="alert-error">
          {{ actionError() }}
        </p>
      }

      @if (showForm()) {
        <form class="card p-4" [formGroup]="form" (ngSubmit)="saveItem()">
          <h2 class="text-base font-semibold text-stone-900">
            {{ editingItem() ? 'Edit item' : 'Add item' }}
          </h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <div class="sm:col-span-1">
              <label class="block text-sm font-medium text-stone-700" for="name">Name</label>
              <input
                id="name"
                type="text"
                formControlName="name"
                class="input mt-1"
                placeholder="e.g. Milk"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-700" for="quantity">Quantity</label>
              <input
                id="quantity"
                type="number"
                min="0"
                step="any"
                formControlName="quantity"
                class="input mt-1"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-700" for="unit">Unit</label>
              <input
                id="unit"
                type="text"
                formControlName="unit"
                class="input mt-1"
                placeholder="e.g. L, kg, pcs"
              />
            </div>
          </div>
          @if (formError()) {
            <p class="mt-3 text-sm text-red-700">{{ formError() }}</p>
          }
          <div class="mt-4 flex gap-2">
            <button type="submit" class="btn-primary" [disabled]="saving() || form.invalid">
              {{ saving() ? 'Saving...' : editingItem() ? 'Save changes' : 'Add to list' }}
            </button>
            <button type="button" class="btn-secondary" (click)="closeForm()">
              Cancel
            </button>
          </div>
        </form>
      }

      @if (shoppingListService.loading()) {
        <app-loading-state message="Loading shopping list..." />
      } @else if (shoppingListService.error()) {
        <p class="alert-error">
          {{ shoppingListService.error() }}
        </p>
      } @else if (shoppingListService.items().length === 0) {
        <app-empty-state
          data-tour="shopping-fallback"
          title="Your shopping list is empty."
          description="Select a date range and generate a list from your meal plan, or add items manually."
          actionLabel="Generate shopping list"
          (actionClick)="generateFromMealPlan()"
        />
      } @else {
        <section class="space-y-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">
            To buy ({{ shoppingListService.uncheckedCount() }})
          </h2>
          <div class="space-y-2">
            @for (item of shoppingListService.uncheckedItems(); track item.id; let first = $first) {
              <article
                class="card p-4"
                [attr.data-tour]="first ? 'shopping-item' : null"
              >
                <div class="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    [attr.data-tour]="first ? 'shopping-checkbox' : null"
                    class="mt-1 h-5 w-5 rounded border-stone-300 text-brand-600"
                    [checked]="false"
                    [disabled]="movingItemId() === item.id"
                    (change)="toggleItem(item, $event)"
                  />
                  <app-food-icon-badge [name]="item.name" size="sm" />
                  <div class="min-w-0 flex-1 basis-[min(100%,12rem)]">
                    <p class="text-base font-semibold text-stone-900">{{ item.name }}</p>
                    @if (item.quantity !== null || item.unit) {
                      <p class="mt-1 text-sm text-stone-600">
                        {{ item.quantity ?? '' }} {{ item.unit || '' }}
                      </p>
                    }
                    @if (item.source === 'meal_plan') {
                      <span class="mt-2 inline-block rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                        From meal plan
                      </span>
                    }
                  </div>
                  <div class="ml-auto flex shrink-0 gap-2">
                    <button type="button" class="btn-secondary-sm touch-target-inline" (click)="openEditForm(item)">
                      Edit
                    </button>
                    <button type="button" class="btn-danger touch-target-inline" (click)="deleteItem(item)">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class ShoppingListComponent implements OnInit {
  readonly shoppingListService = inject(ShoppingListService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);
  private readonly inventoryService = inject(FoodInventoryService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly firstTourEvents = inject(FirstTourEventsService);

  readonly showForm = signal(false);
  readonly editingItem = signal<ShoppingItem | null>(null);
  readonly saving = signal(false);
  readonly generating = signal(false);
  readonly movingItemId = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    quantity: [null as number | null],
    unit: [''],
  });

  readonly rangeForm = this.fb.nonNullable.group({
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
  });

  ngOnInit(): void {
    this.setThisWeek();
    void Promise.all([
      this.shoppingListService.getShoppingItems(),
      this.recipeService.loadRecipes(),
      this.inventoryService.loadItems(),
      this.mealPlanService.loadWeekAndToday(),
    ]);
  }

  openAddForm(): void {
    this.editingItem.set(null);
    this.formError.set(null);
    this.form.reset({ name: '', quantity: null, unit: '' });
    this.showForm.set(true);
  }

  openEditForm(item: ShoppingItem): void {
    this.editingItem.set(item);
    this.formError.set(null);
    this.form.reset({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit ?? '',
    });
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingItem.set(null);
    this.formError.set(null);
  }

  async saveItem(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    this.formError.set(null);
    this.actionError.set(null);

    const value = this.form.getRawValue();
    const input: ShoppingItemInput = {
      name: value.name,
      quantity: value.quantity,
      unit: value.unit || null,
    };

    const editing = this.editingItem();
    const result = editing
      ? await this.shoppingListService.updateShoppingItem(editing.id, input)
      : await this.shoppingListService.addShoppingItem(input);

    this.saving.set(false);

    if (result.error) {
      this.formError.set(result.error);
      return;
    }

    this.closeForm();
  }

  async toggleItem(item: ShoppingItem, event: Event): Promise<void> {
    const checkbox = event.target as HTMLInputElement;
    const checked = checkbox.checked;

    if (!checked) {
      return;
    }

    this.actionError.set(null);
    this.movingItemId.set(item.id);

    const result = await this.shoppingListService.moveShoppingItemToInventory(item);

    this.movingItemId.set(null);

    if (result.error) {
      checkbox.checked = false;
      this.actionError.set(result.error);
      return;
    }

    this.infoMessage.set(`Added "${item.name}" to your inventory.`);
    this.firstTourEvents.publish({ type: 'shopping-item-moved', itemId: item.id });
  }

  async deleteItem(item: ShoppingItem): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove item',
      message: `Remove "${item.name}" from your shopping list?`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    this.actionError.set(null);
    const result = await this.shoppingListService.deleteShoppingItem(item.id);
    if (result.error) {
      this.actionError.set(result.error);
    }
  }

  isRangeValid(): boolean {
    const { startDate, endDate } = this.rangeForm.getRawValue();
    return Boolean(startDate && endDate && startDate <= endDate);
  }

  setThisWeek(): void {
    const weekStart = getMondayOfWeek(new Date());
    const weekEnd = addDays(weekStart, 6);
    this.rangeForm.reset({ startDate: weekStart, endDate: weekEnd });
  }

  formatRangeLabel(): string {
    const { startDate, endDate } = this.rangeForm.getRawValue();
    if (!startDate || !endDate) {
      return '';
    }
    return formatWeekRangeCompact([startDate, endDate]);
  }

  async generateFromMealPlan(): Promise<void> {
    if (!this.isRangeValid()) {
      return;
    }

    if (this.shoppingListService.items().length > 0) {
      const confirmed = await this.confirmDialog.confirm({
        title: 'Replace shopping list',
        message:
          'Generating will replace your entire shopping list with items from the selected date range. Continue?',
        confirmLabel: 'Replace list',
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }

    this.generating.set(true);
    this.actionError.set(null);
    this.infoMessage.set(null);

    const { startDate, endDate } = this.rangeForm.getRawValue();
    const result = await this.shoppingListService.generateFromMealPlan(
      startDate,
      endDate
    );

    this.generating.set(false);

    if (result.error) {
      this.actionError.set(result.error);
      return;
    }

    const rangeLabel = this.formatRangeLabel();

    if (result.addedCount === 0) {
      this.infoMessage.set(
        rangeLabel
          ? `No missing ingredients for ${rangeLabel}.`
          : 'No missing ingredients found for the selected date range.'
      );
      return;
    }

    this.infoMessage.set(
      result.addedCount === 1
        ? `Added 1 item for ${rangeLabel}.`
        : `Added ${result.addedCount} items for ${rangeLabel}.`
    );
  }

}
