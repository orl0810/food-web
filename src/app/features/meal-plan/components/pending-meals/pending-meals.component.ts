import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MealType } from '../../../../core/models/meal-plan.model';
import { MealSlotItem } from '../../../../core/models/meal-slot-item.model';
import { Recipe } from '../../../../core/models/recipe.model';
import { RecipeService } from '../../../../core/services/recipe.service';
import { FoodIconBadgeComponent } from '../../../../shared/components/food-icon-badge/food-icon-badge.component';
import { RecipeImageComponent } from '../../../../shared/components/recipe-image/recipe-image.component';
import { getMealSlotItemDisplayName } from '../../../../shared/utils/prepared-portion.utils';
import { PendingMealSlot } from '../../utils/meal-slot-status.utils';

@Component({
  selector: 'app-pending-meals',
  standalone: true,
  imports: [RouterLink, FoodIconBadgeComponent, RecipeImageComponent],
  template: `
  @if (loading()) {
    <section
      class="overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white via-cream to-brand-50/20 p-4 shadow-sm"
      aria-busy="true"
      aria-label="Loading meals to cook"
    >
      <div class="mb-4 h-5 w-24 animate-pulse rounded-md bg-stone-200/80"></div>
      <div class="space-y-3">
        @for (placeholder of [1, 2]; track placeholder) {
          <div class="overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
            <div class="aspect-[16/10] animate-pulse bg-stone-100"></div>
            <div class="space-y-2 p-4">
              <div class="h-4 w-2/3 animate-pulse rounded bg-stone-100"></div>
              <div class="h-9 w-full animate-pulse rounded-xl bg-stone-100"></div>
            </div>
          </div>
        }
      </div>
    </section>
  } @else if (error()) {
    <section
      class="overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white via-cream to-brand-50/20 p-4 shadow-sm"
      aria-label="Meals to cook"
    >
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-stone-600">Could not load meals to cook.</p>
        <button
          type="button"
          class="text-sm font-medium text-brand-700 hover:text-brand-800"
          (click)="retry.emit()"
        >
          Retry
        </button>
      </div>
    </section>
  } @else if (slots().length > 0) {
    <section
      class="overflow-hidden rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white via-cream to-brand-50/20 p-4 shadow-sm"
      aria-labelledby="pending-meals-title"
    >
      <div class="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 id="pending-meals-title" class="text-base font-semibold text-stone-900">To cook</h3>
          <p class="mt-0.5 text-sm text-stone-600">
            {{ slots().length }} meal{{ slots().length === 1 ? '' : 's' }} waiting to be prepared
          </p>
        </div>
        <span
          class="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand-800 ring-1 ring-brand-100"
          aria-hidden="true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Up next
        </span>
      </div>

      <ul class="space-y-4">
        @for (slot of slots(); track slotKey(slot)) {
          <li>
            <article
              class="group overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
            >
              <div class="relative overflow-hidden">
                @if (recipeItems(slot).length > 0) {
                  @if (recipeItems(slot).length === 1) {
                    @let recipeItem = recipeItems(slot)[0];
                    @let recipe = resolveRecipe(recipeItem);
                    @if (recipe) {
                      <a
                        [routerLink]="['/recipes', recipe.id]"
                        class="relative block aspect-[16/10] overflow-hidden bg-stone-100"
                        [attr.aria-label]="'View recipe: ' + recipe.title"
                      >
                        <app-recipe-image [recipe]="recipe" variant="card" />
                        <div
                          class="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-900/55 via-stone-900/10 to-transparent"
                          aria-hidden="true"
                        ></div>
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                          <p class="line-clamp-2 text-lg font-semibold leading-snug text-white drop-shadow-sm">
                            {{ recipe.title }}
                          </p>
                          @if (recipe.prep_time_minutes) {
                            <p class="mt-1 flex items-center gap-1 text-sm font-medium text-white/90">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                              </svg>
                              {{ recipe.prep_time_minutes }} min prep
                            </p>
                          }
                        </div>
                      </a>
                    }
                  } @else {
                    <div class="grid grid-cols-2 gap-px bg-stone-200">
                      @for (recipeItem of recipeItems(slot); track recipeItem.id) {
                        @let recipe = resolveRecipe(recipeItem);
                        @if (recipe) {
                          <a
                            [routerLink]="['/recipes', recipe.id]"
                            class="group/recipe relative block aspect-[4/3] overflow-hidden bg-stone-100"
                            [attr.aria-label]="'View recipe: ' + recipe.title"
                          >
                            <app-recipe-image [recipe]="recipe" variant="card" />
                            <div
                              class="pointer-events-none absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent"
                              aria-hidden="true"
                            ></div>
                            <p class="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-2 p-2.5 text-sm font-semibold leading-tight text-white">
                              {{ recipe.title }}
                            </p>
                          </a>
                        }
                      }
                    </div>
                  }
                } @else {
                  <div
                    class="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-stone-50 via-cream to-brand-50/40"
                  >
                    <app-food-icon-badge
                      [name]="slotTitle(slot)"
                      size="lg"
                    />
                  </div>
                }

                <div class="absolute left-3 top-3 flex flex-wrap gap-2">
                  <span class="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-stone-800 shadow-sm backdrop-blur-sm">
                    {{ slot.dateLabel }}
                  </span>
                  <span class="rounded-full bg-brand-600/95 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-sm">
                    {{ slot.mealTypeLabel }}
                  </span>
                </div>
              </div>

              <div class="p-4">
                @if (recipeItems(slot).length !== 1) {
                  <div class="space-y-2">
                    @for (item of slot.items; track item.id) {
                      <div class="flex items-center gap-3">
                        @if (item.item_type === 'recipe' && resolveRecipe(item); as recipe) {
                          <div class="h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-stone-200/80">
                            <app-recipe-image [recipe]="recipe" variant="thumbnail" />
                          </div>
                          <div class="min-w-0 flex-1">
                            <a
                              [routerLink]="['/recipes', recipe.id]"
                              class="block truncate text-sm font-semibold text-stone-900 transition-colors group-hover:text-brand-700 hover:text-brand-700"
                            >
                              {{ displayName(item) }}
                            </a>
                            @if (recipe.prep_time_minutes) {
                              <p class="text-xs text-stone-500">{{ recipe.prep_time_minutes }} min prep</p>
                            }
                          </div>
                        } @else {
                          <app-food-icon-badge [name]="displayName(item)" size="sm" />
                          <p class="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                            {{ displayName(item) }}
                          </p>
                        }
                      </div>
                    }
                  </div>
                } @else if (otherItems(slot).length > 0) {
                  <div class="mt-1 space-y-2 border-t border-stone-100 pt-3">
                    @for (item of otherItems(slot); track item.id) {
                      <div class="flex items-center gap-2 text-sm text-stone-600">
                        <app-food-icon-badge [name]="displayName(item)" size="sm" />
                        <span class="truncate">{{ displayName(item) }}</span>
                      </div>
                    }
                  </div>
                }

                <button
                  type="button"
                  class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
                  [disabled]="markingKey() === slotKey(slot)"
                  [attr.aria-label]="'Mark ' + slotTitle(slot) + ' as ready'"
                  (click)="markReady.emit({ date: slot.date, mealType: slot.mealType })"
                >
                  @if (markingKey() === slotKey(slot)) {
                    <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
                    </svg>
                    Saving…
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    Mark as ready
                  }
                </button>
              </div>
            </article>
          </li>
        }
      </ul>
    </section>
  } @else {
    <section
      class="overflow-hidden rounded-2xl border border-dashed border-stone-300 bg-gradient-to-br from-white via-cream to-stone-50/60 p-6 text-center"
      aria-label="Meals to cook"
    >
      <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-stone-200">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-6 w-6 text-brand-600" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-medium text-stone-700">Nothing left to cook</p>
      <p class="mt-1 text-sm text-stone-500">Planned meals for the next few days will show up here.</p>
    </section>
  }
  `,
})
export class PendingMealsComponent {
  private readonly recipeService = inject(RecipeService);

  readonly slots = input.required<PendingMealSlot[]>();
  readonly loading = input(false);
  readonly error = input(false);
  readonly markingKey = input<string | null>(null);

  readonly markReady = output<{ date: string; mealType: MealType }>();
  readonly retry = output<void>();

  readonly hasSlots = computed(() => this.slots().length > 0);

  slotKey(slot: PendingMealSlot): string {
    return `${slot.date}|${slot.mealType}`;
  }

  slotTitle(slot: PendingMealSlot): string {
    return slot.displayNames.join(', ');
  }

  recipeItems(slot: PendingMealSlot): MealSlotItem[] {
    return slot.items.filter((item) => item.item_type === 'recipe' && !!item.recipe_id);
  }

  otherItems(slot: PendingMealSlot): MealSlotItem[] {
    return slot.items.filter((item) => item.item_type !== 'recipe' || !item.recipe_id);
  }

  displayName(item: MealSlotItem): string {
    return getMealSlotItemDisplayName(item);
  }

  resolveRecipe(item: MealSlotItem): Recipe | null {
    if (item.item_type !== 'recipe' || !item.recipe_id) {
      return null;
    }

    const cached = this.recipeService.recipes().find((recipe) => recipe.id === item.recipe_id);
    if (cached) {
      return cached;
    }

    const embedded = item.recipe;
    if (!embedded) {
      return null;
    }

    return {
      id: embedded.id,
      user_id: null,
      title: embedded.title,
      description: embedded.description ?? null,
      prep_time_minutes: embedded.prep_time_minutes ?? null,
      cook_time_minutes: null,
      portions: null,
      tags: embedded.tags ?? [],
      rating: null,
      image_url: embedded.image_url ?? null,
      image_status: embedded.image_status ?? 'pending',
      image_storage_key: embedded.image_storage_key ?? null,
      is_base_recipe: false,
      base_recipe_id: null,
      meal_type: embedded.meal_type ?? null,
      category: embedded.category ?? null,
      difficulty: null,
      instructions: [],
      created_at: '',
    };
  }
}
