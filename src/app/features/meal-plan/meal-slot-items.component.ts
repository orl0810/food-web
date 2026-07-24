import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MealSlotItem, FoodLogSource } from '../../core/models/meal-slot-item.model';
import { FoodIconBadgeComponent } from '../../shared/components/food-icon-badge/food-icon-badge.component';
import { RecipeImageComponent } from '../../shared/components/recipe-image/recipe-image.component';
import {
  getMealSlotItemDisplayName,
} from '../../shared/utils/prepared-portion.utils';
import {
  getMealStatusUiConfig,
  MealSlotDisplayStatus,
} from './utils/meal-slot-status.utils';

@Component({
  selector: 'app-meal-slot-items',
  standalone: true,
  imports: [RouterLink, FoodIconBadgeComponent, RecipeImageComponent],
  template: `
    <article
      class="card overflow-hidden p-3 transition-colors"
      [class]="cardClasses()"
    >
      <ul class="divide-y divide-stone-100">
        @for (item of items(); track item.id) {
          <li
            class="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-2 first:pt-0 last:pb-0"
            [attr.data-tour]="tourItemId() === item.id ? 'meal-plan-first-recipe' : null"
          >
            <div class="row-span-2 shrink-0 self-start [&_figure]:!h-16 [&_figure]:!w-16">
              @if (item.item_type === 'recipe' && item.recipe) {
                <app-recipe-image [recipe]="item.recipe" variant="thumbnail" />
              } @else if (item.image_url) {
                <img
                  [src]="item.image_url"
                  [alt]="displayName(item) + ' photo'"
                  class="h-16 w-16 rounded-xl object-cover ring-1 ring-stone-200"
                />
              } @else {
                <div class="flex h-16 w-16 items-center justify-center rounded-xl bg-stone-50 ring-1 ring-stone-200">
                  <app-food-icon-badge
                    [name]="displayName(item)"
                    [category]="itemTypeCategory(item)"
                    size="lg"
                  />
                </div>
              }
            </div>

            <div class="flex min-w-0 items-start justify-between gap-2">
              <p class="min-w-0 flex-1 font-medium leading-snug text-stone-900">{{ displayName(item) }}</p>
              <div class="flex shrink-0 items-center gap-2">
                @if (item.item_type === 'recipe' && item.recipe_id) {
                  <a
                    [routerLink]="['/recipes', item.recipe_id]"
                    class="text-xs font-medium text-brand-700 hover:text-brand-800"
                  >
                    View
                  </a>
                }
                <button
                  type="button"
                  class="touch-target-inline rounded-md px-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                  [disabled]="removingId() === item.id"
                  (click)="removeItem.emit(item)"
                >
                  {{ removingId() === item.id ? '...' : 'Remove' }}
                </button>
              </div>
            </div>

            <div class="flex min-w-0 items-center justify-between gap-2">
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <p class="text-xs text-stone-500">{{ itemTypeLabel(item) }}</p>
                @if (sourceLabel(item); as label) {
                  <span class="inline-flex items-center rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                    {{ label }}
                  </span>
                }
                @if (item.status === 'prepared') {
                  <span class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.38a48.474 48.474 0 0 0-6-.37c-2.032 0-3.963.175-5.771.48M3 16.5V18.75A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
                    </svg>
                    Ready
                  </span>
                }
                @if (item.status === 'eaten') {
                  <span class="inline-flex items-center gap-0.5 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-2.5 w-2.5" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Consumed
                  </span>
                }
                @if (item.item_type === 'prepared_portion' && item.portions_used > 1) {
                  <span class="text-xs text-stone-500">{{ item.portions_used }} portions</span>
                }
                @if (item.item_type === 'inventory_item' && item.quantity) {
                  <span class="text-xs text-stone-500">{{ item.quantity }} {{ item.unit || 'units' }}</span>
                }
              </div>

              @if (canChangeRecipe(item)) {
                <button
                  type="button"
                  class="touch-target-inline inline-flex shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                  [attr.aria-label]="'Change recipe: ' + displayName(item)"
                  (click)="changeItem.emit(item)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3 w-3" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                  Change recipe
                </button>
              }
            </div>
          </li>
        }
      </ul>

      @if (canAdd()) {
        <button
          type="button"
          class="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
          (click)="addItem.emit()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add another item
        </button>
      }
    </article>
  `,
})
export class MealSlotItemsComponent {
  readonly items = input.required<MealSlotItem[]>();
  readonly removingId = input<string | null>(null);
  readonly canAdd = input(true);
  readonly canChange = input(true);
  readonly status = input<MealSlotDisplayStatus>('planned');
  readonly tourItemId = input<string | null>(null);

  readonly addItem = output<void>();
  readonly removeItem = output<MealSlotItem>();
  readonly changeItem = output<MealSlotItem>();

  readonly cardClasses = computed(() => {
    const config = getMealStatusUiConfig(this.status());
    return config?.cardClass ?? '';
  });

  displayName(item: MealSlotItem): string {
    return getMealSlotItemDisplayName(item);
  }

  itemTypeLabel(item: MealSlotItem): string {
    if (item.source) {
      return 'Logged food';
    }
    switch (item.item_type) {
      case 'recipe':
        return 'Recipe';
      case 'prepared_portion':
        return 'Ready portion';
      case 'inventory_item':
        return 'From inventory';
      case 'custom':
        return 'Custom item';
      default:
        return '';
    }
  }

  sourceLabel(item: MealSlotItem): string | null {
    const labels: Record<FoodLogSource, string> = {
      manual: 'Manual log',
      voice: 'Voice log',
      photo: 'Photo log',
    };
    return item.source ? labels[item.source] : null;
  }

  itemTypeCategory(item: MealSlotItem): string | null {
    if (item.item_type === 'prepared_portion') {
      return 'Prepared / Leftovers';
    }
    return item.inventory_item ? null : null;
  }

  canChangeRecipe(item: MealSlotItem): boolean {
    return (
      this.canChange() &&
      item.item_type === 'recipe' &&
      item.status === 'planned'
    );
  }
}
