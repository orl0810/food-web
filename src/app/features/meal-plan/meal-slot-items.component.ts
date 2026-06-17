import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import { FoodIconBadgeComponent } from '../../shared/components/food-icon-badge/food-icon-badge.component';
import {
  getMealSlotItemDisplayName,
} from '../../shared/utils/prepared-portion.utils';

@Component({
  selector: 'app-meal-slot-items',
  standalone: true,
  imports: [RouterLink, FoodIconBadgeComponent],
  template: `
    <article class="card overflow-hidden p-4">
      <ul class="divide-y divide-stone-100">
        @for (item of items(); track item.id) {
          <li class="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <app-food-icon-badge
              [name]="displayName(item)"
              [category]="itemTypeCategory(item)"
            />

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p class="font-medium text-stone-900">{{ displayName(item) }}</p>
                  <p class="mt-0.5 text-xs text-stone-500">{{ itemTypeLabel(item) }}</p>
                  @if (item.item_type === 'prepared_portion' && item.portions_used > 1) {
                    <p class="mt-0.5 text-xs text-stone-500">{{ item.portions_used }} portions</p>
                  }
                  @if (item.item_type === 'inventory_item' && item.quantity) {
                    <p class="mt-0.5 text-xs text-stone-500">{{ item.quantity }} {{ item.unit || 'units' }}</p>
                  }
                </div>
                @if (item.item_type === 'recipe' && item.recipe_id) {
                  <a
                    [routerLink]="['/recipes', item.recipe_id]"
                    class="text-xs font-medium text-brand-700 hover:text-brand-800"
                  >
                    View
                  </a>
                }
              </div>
            </div>

            <button
              type="button"
              class="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              [disabled]="removingId() === item.id"
              (click)="removeItem.emit(item)"
            >
              {{ removingId() === item.id ? '...' : 'Remove' }}
            </button>
          </li>
        }
      </ul>

      @if (canAdd()) {
        <button
          type="button"
          class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-sm font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
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

  readonly addItem = output<void>();
  readonly removeItem = output<MealSlotItem>();

  displayName(item: MealSlotItem): string {
    return getMealSlotItemDisplayName(item);
  }

  itemTypeLabel(item: MealSlotItem): string {
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

  itemTypeCategory(item: MealSlotItem): string | null {
    if (item.item_type === 'prepared_portion') {
      return 'Prepared / Leftovers';
    }
    return item.inventory_item ? null : null;
  }
}
