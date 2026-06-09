import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PreparedPortion } from '../../core/models/prepared-portion.model';
import { MEAL_TYPE_LABELS, MealType } from '../../core/models/meal-plan.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { MealPlanService } from '../../core/services/meal-plan.service';
import { PreparedPortionService } from '../../core/services/prepared-portion.service';
import { RecipeService } from '../../core/services/recipe.service';
import { FormatTagPipe } from '../../shared/pipes/format-tag.pipe';
import { formatDayLabel } from '../../shared/utils/meal-plan.utils';
import { isPortionExpired } from '../../shared/utils/prepared-portion.utils';
import { formatTagLabel } from '../../shared/utils/tag.utils';

type PickerTab = 'recipes' | 'portions' | 'inventory' | 'custom';

@Component({
  selector: 'app-meal-slot-item-picker',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center"
      (click)="cancelled.emit()"
    >
      <div
        class="card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden"
        (click)="$event.stopPropagation()"
      >
        <div class="border-b border-stone-100 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold text-stone-900">Add to meal</h2>
              <p class="mt-0.5 text-sm text-stone-600">
                {{ formatDayLabel(date()) }} · {{ mealTypeLabel() }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
              (click)="cancelled.emit()"
            >
              Cancel
            </button>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="activeTab() === tab.id"
                [class.filter-pill-inactive]="activeTab() !== tab.id"
                (click)="activeTab.set(tab.id)"
              >
                {{ tab.label }}
              </button>
            }
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          @if (activeTab() === 'recipes') {
            <div class="space-y-3">
              <input
                type="search"
                class="input w-full"
                placeholder="Search recipes..."
                [value]="recipeSearch()"
                (input)="onRecipeSearch($event)"
              />
              @if (recipeService.loading()) {
                <p class="text-sm text-stone-600">Loading recipes...</p>
              } @else if (filteredRecipes().length === 0) {
                <div class="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center">
                  <p class="text-sm text-stone-600">No recipes found.</p>
                  <a routerLink="/recipes/new" class="mt-2 inline-block text-sm font-medium text-brand-700">
                    Create a recipe
                  </a>
                </div>
              } @else {
                <ul class="space-y-2">
                  @for (recipe of filteredRecipes(); track recipe.id) {
                    <li>
                      <button
                        type="button"
                        class="w-full rounded-lg border border-stone-200 px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50"
                        [disabled]="saving()"
                        (click)="addRecipe(recipe.id)"
                      >
                        <span class="block text-sm font-medium text-stone-900">{{ recipe.title }}</span>
                        @if (recipe.tags.length > 0) {
                          <span class="mt-0.5 block text-xs text-stone-500">
                            {{ formatTagsList(recipe.tags) }}
                          </span>
                        }
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          @if (activeTab() === 'portions') {
            <div class="space-y-3">
              @if (preparedPortionService.loading()) {
                <p class="text-sm text-stone-600">Loading ready portions...</p>
              } @else if (availablePortions().length === 0) {
                <div class="rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center">
                  <p class="text-sm text-stone-600">No ready portions available.</p>
                  <p class="mt-1 text-xs text-stone-500">
                    Mark a recipe as cooked or add prepared food from Inventory.
                  </p>
                </div>
              } @else {
                @if (expiredConfirmPortion()) {
                  <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    "{{ expiredConfirmPortion()!.name }}" has expired. Tap again to use anyway.
                  </p>
                }
                <ul class="space-y-2">
                  @for (portion of availablePortions(); track portion.id) {
                    <li>
                      <button
                        type="button"
                        class="w-full rounded-lg border border-stone-200 px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50"
                        [disabled]="saving()"
                        (click)="addPortion(portion)"
                      >
                        <span class="block text-sm font-medium text-stone-900">{{ portion.name }}</span>
                        <span class="mt-0.5 block text-xs text-stone-500">
                          {{ portion.available_portions }} of {{ portion.total_portions }} available
                        </span>
                      </button>
                    </li>
                  }
                </ul>
                <div class="rounded-lg bg-stone-50 p-3">
                  <label class="mb-1 block text-xs font-medium text-stone-700">Portions to use</label>
                  <input
                    type="number"
                    min="1"
                    class="input w-full"
                    [value]="portionsUsed()"
                    (input)="onPortionsUsedInput($event)"
                  />
                </div>
              }
            </div>
          }

          @if (activeTab() === 'inventory') {
            <div class="space-y-3">
              <input
                type="search"
                class="input w-full"
                placeholder="Search inventory..."
                [value]="inventorySearch()"
                (input)="onInventorySearch($event)"
              />
              @if (filteredInventory().length === 0) {
                <p class="text-sm text-stone-600">No inventory items found.</p>
              } @else {
                <ul class="space-y-2">
                  @for (item of filteredInventory(); track item.id) {
                    <li>
                      <button
                        type="button"
                        class="w-full rounded-lg border border-stone-200 px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50"
                        [disabled]="saving()"
                        (click)="addInventoryItem(item.id, item.name, item.quantity, item.unit)"
                      >
                        <span class="block text-sm font-medium text-stone-900">{{ item.name }}</span>
                        <span class="mt-0.5 block text-xs text-stone-500">
                          {{ item.quantity }} {{ item.unit || 'units' }}
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          @if (activeTab() === 'custom') {
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-stone-700">Item name *</label>
                <input
                  type="text"
                  class="input w-full"
                  placeholder="e.g. Side salad"
                  [value]="customName()"
                  (input)="onCustomNameInput($event)"
                />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="mb-1 block text-sm font-medium text-stone-700">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    class="input w-full"
                    [value]="customQuantity()"
                    (input)="onCustomQuantityInput($event)"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium text-stone-700">Unit</label>
                  <input
                    type="text"
                    class="input w-full"
                    placeholder="piece, cup..."
                    [value]="customUnit()"
                    (input)="onCustomUnitInput($event)"
                  />
                </div>
              </div>
              <button
                type="button"
                class="btn-primary w-full"
                [disabled]="saving() || !customName().trim()"
                (click)="addCustomItem()"
              >
                {{ saving() ? 'Adding...' : 'Add custom item' }}
              </button>
            </div>
          }

          @if (error()) {
            <p class="alert-error mt-3">{{ error() }}</p>
          }
        </div>
      </div>
    </div>
  `,
})
export class MealSlotItemPickerComponent implements OnInit {
  readonly date = input.required<string>();
  readonly mealType = input.required<MealType>();

  readonly added = output<void>();
  readonly cancelled = output<void>();

  readonly recipeService = inject(RecipeService);
  readonly preparedPortionService = inject(PreparedPortionService);
  readonly inventoryService = inject(FoodInventoryService);
  private readonly mealPlanService = inject(MealPlanService);

  readonly tabs: { id: PickerTab; label: string }[] = [
    { id: 'recipes', label: 'Recipes' },
    { id: 'portions', label: 'Ready portions' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'custom', label: 'Custom' },
  ];

  readonly activeTab = signal<PickerTab>('recipes');
  readonly recipeSearch = signal('');
  readonly inventorySearch = signal('');
  readonly customName = signal('');
  readonly customQuantity = signal<number | null>(null);
  readonly customUnit = signal('');
  readonly portionsUsed = signal(1);
  readonly expiredConfirmPortion = signal<{ id: string; name: string } | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly filteredRecipes = computed(() => {
    const query = this.recipeSearch().trim().toLowerCase();
    return this.recipeService.recipes().filter(
      (recipe) => !query || recipe.title.toLowerCase().includes(query)
    );
  });

  readonly availablePortions = computed(() =>
    this.preparedPortionService.availablePortions()
  );

  readonly filteredInventory = computed(() => {
    const query = this.inventorySearch().trim().toLowerCase();
    return this.inventoryService.items().filter(
      (item) => !query || item.name.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    void Promise.all([
      this.recipeService.loadRecipes(),
      this.preparedPortionService.loadPortions(),
      this.inventoryService.loadItems(),
    ]);
  }

  formatDayLabel = formatDayLabel;

  mealTypeLabel(): string {
    return MEAL_TYPE_LABELS[this.mealType()];
  }

  formatTagsList(tags: string[]): string {
    return tags.map((tag) => formatTagLabel(tag)).join(', ');
  }

  onRecipeSearch(event: Event): void {
    this.recipeSearch.set((event.target as HTMLInputElement).value);
  }

  onInventorySearch(event: Event): void {
    this.inventorySearch.set((event.target as HTMLInputElement).value);
  }

  onCustomNameInput(event: Event): void {
    this.customName.set((event.target as HTMLInputElement).value);
  }

  onCustomQuantityInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.customQuantity.set(value ? Number(value) : null);
  }

  onCustomUnitInput(event: Event): void {
    this.customUnit.set((event.target as HTMLInputElement).value);
  }

  onPortionsUsedInput(event: Event): void {
    this.portionsUsed.set(Math.max(1, parseInt((event.target as HTMLInputElement).value, 10) || 1));
  }

  async addRecipe(recipeId: string): Promise<void> {
    await this.submit({
      item_type: 'recipe',
      recipe_id: recipeId,
    });
  }

  async addPortion(portion: PreparedPortion): Promise<void> {
    const expired = isPortionExpired(portion);
    const confirm = this.expiredConfirmPortion();

    if (expired && confirm?.id !== portion.id) {
      this.expiredConfirmPortion.set({ id: portion.id, name: portion.name });
      return;
    }

    const used = Math.min(this.portionsUsed(), portion.available_portions);
    await this.submit({
      item_type: 'prepared_portion',
      prepared_portion_id: portion.id,
      portions_used: used,
      allow_expired: !!expired,
    });
  }

  async addInventoryItem(
    id: string,
    _name: string,
    quantity: number,
    unit: string | null
  ): Promise<void> {
    await this.submit({
      item_type: 'inventory_item',
      inventory_item_id: id,
      quantity,
      unit,
    });
  }

  async addCustomItem(): Promise<void> {
    const name = this.customName().trim();
    if (!name) {
      return;
    }

    await this.submit({
      item_type: 'custom',
      custom_name: name,
      quantity: this.customQuantity(),
      unit: this.customUnit() || null,
    });
  }

  private async submit(payload: {
    item_type: 'recipe' | 'prepared_portion' | 'inventory_item' | 'custom';
    recipe_id?: string;
    prepared_portion_id?: string;
    inventory_item_id?: string;
    custom_name?: string;
    quantity?: number | null;
    unit?: string | null;
    portions_used?: number;
    allow_expired?: boolean;
  }): Promise<void> {
    this.saving.set(true);
    this.error.set(null);

    const { error } = await this.mealPlanService.addSlotItem({
      date: this.date(),
      meal_type: this.mealType(),
      ...payload,
    });

    this.saving.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    this.expiredConfirmPortion.set(null);
    this.added.emit();
  }
}
