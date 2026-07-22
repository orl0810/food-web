import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MealSlotItem } from '../../../../core/models/meal-slot-item.model';
import { RecipeMealPlanSummary } from '../../../../core/models/recipe.model';
import { RecipeService } from '../../../../core/services/recipe.service';
import { FoodIconBadgeComponent } from '../../../../shared/components/food-icon-badge/food-icon-badge.component';
import { RecipeImageComponent } from '../../../../shared/components/recipe-image/recipe-image.component';
import { GroupedCookItem } from '../../utils/meal-slot-status.utils';

@Component({
  selector: 'app-to-cook-list',
  standalone: true,
  imports: [RouterLink, FoodIconBadgeComponent, RecipeImageComponent],
  template: `
  @if (loading()) {
    <section
      class="space-y-3"
      aria-busy="true"
      aria-label="Loading meals to cook"
    >
      @for (placeholder of [1, 2]; track placeholder) {
        <div class="overflow-hidden rounded-2xl border border-stone-200/80 bg-white">
          <div class="aspect-[16/10] animate-pulse bg-stone-100"></div>
          <div class="space-y-2 p-4">
            <div class="h-4 w-2/3 animate-pulse rounded bg-stone-100"></div>
            <div class="h-9 w-full animate-pulse rounded-xl bg-stone-100"></div>
          </div>
        </div>
      }
    </section>
  } @else if (error()) {
    <section aria-label="Meals to cook">
      <div class="flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
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
  } @else if (groups().length > 0) {
    <section aria-labelledby="to-cook-list-title">
      <p id="to-cook-list-title" class="mb-4 text-sm text-stone-600">
        {{ totalCount() }} batch{{ totalCount() === 1 ? '' : 'es' }} waiting to be prepared
      </p>

      <ul class="space-y-4">
        @for (group of groups(); track group.groupKey) {
          <li>
            <article
              class="group overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
            >
              <div class="relative overflow-hidden">
                @if (resolveRecipe(group.representativeItem); as recipe) {
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
                        {{ group.displayName }}
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
                } @else {
                  <div class="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-stone-50 via-cream to-brand-50/40">
                    <app-food-icon-badge [name]="group.displayName" size="lg" />
                  </div>
                  <div class="border-b border-stone-100 px-4 py-3">
                    <p class="text-lg font-semibold text-stone-900">{{ group.displayName }}</p>
                  </div>
                }

                @if (displayCount(group) > 1) {
                  <span
                    class="absolute right-3 top-3 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-brand-600 px-2 text-sm font-bold text-white shadow-sm"
                    [attr.aria-label]="displayCount(group) + ' batches to cook'"
                  >
                    {{ displayCount(group) }}
                  </span>
                }
              </div>

              <div class="p-4">
                <ul class="space-y-2" aria-label="Planned dates">
                  @for (occurrence of group.occurrences; track occurrence.itemId) {
                    <li class="flex flex-wrap items-center gap-2 text-sm">
                      <span class="rounded-full bg-stone-100 px-2.5 py-1 font-medium text-stone-800">
                        {{ occurrence.dateLabel }}
                      </span>
                      <span class="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-800">
                        {{ occurrence.mealTypeLabel }}
                      </span>
                    </li>
                  }
                </ul>

                <div class="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
                    [disabled]="markingGroupKey() === group.groupKey"
                    [attr.aria-label]="primaryActionLabel(group) + ': ' + group.displayName"
                    (click)="markNextReady.emit(group)"
                  >
                    @if (markingGroupKey() === group.groupKey) {
                      <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
                      </svg>
                      Saving…
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-4 w-4" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      {{ primaryActionLabel(group) }}
                    }
                  </button>

                  @if (showAllAction(group)) {
                    <button
                      type="button"
                      class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-700 shadow-sm transition-all hover:bg-stone-50 active:scale-[0.99] disabled:opacity-50"
                      [disabled]="markingGroupKey() === group.groupKey"
                      [attr.aria-label]="'Cook all batches: ' + group.displayName"
                      (click)="markAllReady.emit(group)"
                    >
                      {{ group.recipeId ? 'Cook all batches' : 'Mark all as ready' }}
                    </button>
                  }
                </div>
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
export class ToCookListComponent {
  private readonly recipeService = inject(RecipeService);

  readonly groups = input.required<GroupedCookItem[]>();
  readonly loading = input(false);
  readonly error = input(false);
  readonly markingGroupKey = input<string | null>(null);

  readonly markNextReady = output<GroupedCookItem>();
  readonly markAllReady = output<GroupedCookItem>();
  readonly retry = output<void>();

  readonly totalCount = computed(() =>
    this.groups().reduce((total, group) => total + this.displayCount(group), 0)
  );

  displayCount(group: GroupedCookItem): number {
    return group.recipeId ? group.batchCount : group.count;
  }

  primaryActionLabel(group: GroupedCookItem): string {
    return group.recipeId ? 'Cook next batch' : 'Mark as ready';
  }

  showAllAction(group: GroupedCookItem): boolean {
    return group.recipeId ? group.batchCount > 1 : group.count > 1;
  }

  resolveRecipe(item: MealSlotItem): RecipeMealPlanSummary | null {
    if (item.item_type !== 'recipe' || !item.recipe_id) {
      return null;
    }

    const cached =
      this.recipeService.recipes().find((recipe) => recipe.id === item.recipe_id) ??
      this.recipeService.baseRecipes().find((recipe) => recipe.id === item.recipe_id);
    if (cached) {
      return cached;
    }

    return item.recipe ?? null;
  }
}
