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
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { getMondayOfWeek } from '../../shared/utils/meal-plan.utils';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent],
  template: `
    <div class="page">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="page-title">Shopping List</h1>
          <p class="page-subtitle">
            Generate missing ingredients from your meal plan or add items manually.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-primary"
            [disabled]="generating()"
            (click)="generateFromMealPlan()"
          >
            {{ generating() ? 'Generating...' : 'Generate from this week' }}
          </button>
          @if (!showForm()) {
            <button type="button" class="btn-secondary" (click)="openAddForm()">
              Add item
            </button>
          }
        </div>
      </div>

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
          title="Your shopping list is empty."
          description="Generate a list from your weekly meal plan or add items manually."
          actionLabel="Generate from this week"
          (actionClick)="generateFromMealPlan()"
        />
      } @else {
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn-secondary-sm"
            [disabled]="shoppingListService.checkedCount() === 0 || clearing()"
            (click)="clearChecked()"
          >
            {{ clearing() ? 'Clearing...' : 'Clear checked' }}
          </button>
          <button
            type="button"
            class="btn-primary-sm"
            [disabled]="shoppingListService.checkedCount() === 0 || addingToInventory()"
            (click)="addCheckedToInventory()"
          >
            {{ addingToInventory() ? 'Adding...' : 'Add checked to inventory' }}
          </button>
        </div>

        @if (shoppingListService.uncheckedCount() > 0) {
          <section class="space-y-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">
              To buy ({{ shoppingListService.uncheckedCount() }})
            </h2>
            <div class="space-y-2">
              @for (item of shoppingListService.uncheckedItems(); track item.id) {
                <article class="card p-4">
                  <div class="flex items-start gap-3">
                    <input
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600"
                      [checked]="item.is_checked"
                      (change)="toggleItem(item, $event)"
                    />
                    <div class="min-w-0 flex-1">
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
                    <div class="flex gap-2">
                      <button type="button" class="btn-secondary-sm" (click)="openEditForm(item)">
                        Edit
                      </button>
                      <button type="button" class="btn-danger" (click)="deleteItem(item)">
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        }

        @if (shoppingListService.checkedCount() > 0) {
          <section class="space-y-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Bought ({{ shoppingListService.checkedCount() }})
            </h2>
            <div class="space-y-2">
              @for (item of shoppingListService.checkedItems(); track item.id) {
                <article class="rounded-xl border border-stone-200 bg-stone-50 p-4 shadow-sm">
                  <div class="flex items-start gap-3">
                    <input
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border-stone-300 text-brand-600"
                      [checked]="item.is_checked"
                      (change)="toggleItem(item, $event)"
                    />
                    <div class="min-w-0 flex-1">
                      <p class="text-base font-semibold text-stone-500 line-through">{{ item.name }}</p>
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
                    <div class="flex gap-2">
                      <button type="button" class="btn-secondary-sm" (click)="openEditForm(item)">
                        Edit
                      </button>
                      <button type="button" class="btn-danger" (click)="deleteItem(item)">
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        }
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

  readonly showForm = signal(false);
  readonly editingItem = signal<ShoppingItem | null>(null);
  readonly saving = signal(false);
  readonly generating = signal(false);
  readonly clearing = signal(false);
  readonly addingToInventory = signal(false);
  readonly formError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly infoMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    quantity: [null as number | null],
    unit: [''],
  });

  ngOnInit(): void {
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
    const checked = (event.target as HTMLInputElement).checked;
    this.actionError.set(null);

    const result = await this.shoppingListService.toggleShoppingItem(item.id, checked);
    if (result.error) {
      this.actionError.set(result.error);
    }
  }

  async deleteItem(item: ShoppingItem): Promise<void> {
    const confirmed = window.confirm(`Remove "${item.name}" from your shopping list?`);
    if (!confirmed) {
      return;
    }

    this.actionError.set(null);
    const result = await this.shoppingListService.deleteShoppingItem(item.id);
    if (result.error) {
      this.actionError.set(result.error);
    }
  }

  async generateFromMealPlan(): Promise<void> {
    this.generating.set(true);
    this.actionError.set(null);
    this.infoMessage.set(null);

    const weekStart = getMondayOfWeek(new Date());
    const result = await this.shoppingListService.generateFromMealPlan(weekStart);

    this.generating.set(false);

    if (result.error) {
      this.actionError.set(result.error);
      return;
    }

    if (result.addedCount === 0) {
      this.infoMessage.set(
        'No missing ingredients found. You already have everything for this week.'
      );
      return;
    }

    this.infoMessage.set(
      result.addedCount === 1
        ? 'Added 1 item to your shopping list.'
        : `Added ${result.addedCount} items to your shopping list.`
    );
  }

  async clearChecked(): Promise<void> {
    this.clearing.set(true);
    this.actionError.set(null);
    this.infoMessage.set(null);

    const result = await this.shoppingListService.clearCheckedItems();

    this.clearing.set(false);

    if (result.error) {
      this.actionError.set(result.error);
    }
  }

  async addCheckedToInventory(): Promise<void> {
    this.addingToInventory.set(true);
    this.actionError.set(null);
    this.infoMessage.set(null);

    const result = await this.shoppingListService.addCheckedItemsToInventory();

    this.addingToInventory.set(false);

    if (result.error) {
      this.actionError.set(result.error);
      return;
    }

    if (result.addedCount > 0) {
      this.infoMessage.set(
        result.addedCount === 1
          ? 'Added 1 item to your inventory.'
          : `Added ${result.addedCount} items to your inventory.`
      );
    }
  }
}
