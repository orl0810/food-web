import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Recipe } from '../../core/models/recipe.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { RecipeService } from '../../core/services/recipe.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { FormatTagPipe } from '../../shared/pipes/format-tag.pipe';
import { countAvailableIngredients } from '../../shared/utils/recipe-availability.utils';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { RecipeSuggestionsComponent } from './recipe-suggestions/recipe-suggestions.component';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [
    RouterLink,
    EmptyStateComponent,
    LoadingStateComponent,
    FormatTagPipe,
    StarRatingComponent,
    RecipeSuggestionsComponent,
  ],
  template: `
    <div class="page">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="page-title">Recipes</h1>
          <p class="page-subtitle">
            Smart suggestions based on your inventory, plus your saved recipes.
          </p>
        </div>
        <a routerLink="/recipes/new" class="btn-primary self-start sm:self-auto">
          New recipe
        </a>
      </div>

      <app-recipe-suggestions />

      <div>
        <h2 class="section-title">My Recipes</h2>
        <p class="mt-1 text-sm text-stone-600">
          Your saved recipes, ready to plan into your week.
        </p>
      </div>

      @if (recipeService.recipes().length > 0) {
        <div class="space-y-3">
          <input
            type="search"
            [value]="search()"
            (input)="onSearch($event)"
            placeholder="Search by title..."
            class="input"
          />

          @if (recipeService.allTags().length > 0) {
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="activeTag() === null"
                [class.filter-pill-inactive]="activeTag() !== null"
                (click)="activeTag.set(null)"
              >
                All tags
              </button>
              @for (tag of recipeService.allTags(); track tag) {
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="activeTag() === tag"
                  [class.filter-pill-inactive]="activeTag() !== tag"
                  (click)="activeTag.set(tag)"
                >
                  {{ tag | formatTag }}
                </button>
              }
            </div>
          }
        </div>
      }

      @if (recipeService.loading()) {
        <app-loading-state message="Loading recipes..." />
      } @else if (recipeService.error()) {
        <p class="alert-error">
          {{ recipeService.error() }}
        </p>
      } @else if (recipeService.recipes().length === 0) {
        <app-empty-state
          title="No recipes yet"
          description="Start by adding a recipe you cook often. You can include ingredients, prep time, portions, and tags."
          actionLabel="New recipe"
          (actionClick)="goToNew()"
        />
      } @else if (filteredRecipes().length === 0) {
        <app-empty-state
          title="No matching recipes"
          description="Try a different search term or tag filter."
        />
      } @else {
        <div class="flex flex-col gap-4">
          @for (recipe of filteredRecipes(); track recipe.id) {
            <article class="card p-4">
              <div class="flex gap-3">
                <div
                  class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-100"
                  aria-hidden="true"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="h-7 w-7 text-brand-600"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"
                    />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 17h12" />
                  </svg>
                </div>

                <div class="min-w-0 flex-1">
                  <h2 class="text-base font-semibold text-stone-900">{{ recipe.title }}</h2>

                  <app-star-rating
                    class="mt-1"
                    [rating]="recipe.rating"
                    size="sm"
                    (ratingChange)="onRatingChange(recipe.id, $event)"
                  />

                  <div class="mt-1.5 flex flex-wrap items-center gap-2">
                    @if (recipe.prep_time_minutes) {
                      <span class="inline-flex items-center gap-1 text-xs text-stone-600">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                          class="h-3.5 w-3.5"
                          aria-hidden="true"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                          />
                        </svg>
                        {{ recipe.prep_time_minutes }} min
                      </span>
                    }
                    @for (tag of recipe.tags; track tag) {
                      <span class="tag">{{ tag | formatTag }}</span>
                    }
                  </div>
                </div>
              </div>

              <p class="mt-3 text-sm text-brand-700">
                {{ availabilityLabel(recipe) }}
              </p>

              <div class="mt-3 flex gap-2">
                <button type="button" class="btn-primary flex-1" (click)="planMeal(recipe)">
                  Plan meal
                </button>
                <a
                  [routerLink]="['/recipes', recipe.id]"
                  class="btn-secondary flex-1 text-center"
                >
                  View
                </a>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
})
export class RecipesComponent implements OnInit {
  readonly recipeService = inject(RecipeService);
  readonly inventoryService = inject(FoodInventoryService);
  private readonly router = inject(Router);

  readonly search = signal('');
  readonly activeTag = signal<string | null>(null);

  readonly filteredRecipes = computed(() => {
    const query = this.search().trim().toLowerCase();
    const tag = this.activeTag();

    return this.recipeService.recipes().filter((recipe) => {
      const matchesTitle = !query || recipe.title.toLowerCase().includes(query);
      const matchesTag = !tag || recipe.tags.includes(tag);
      return matchesTitle && matchesTag;
    });
  });

  ngOnInit(): void {
    void this.recipeService.loadRecipes();
    void this.inventoryService.loadItems();
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  availabilityLabel(recipe: Recipe): string {
    const ingredients = recipe.ingredients ?? [];
    const { available, total } = countAvailableIngredients(
      ingredients,
      this.inventoryService.items()
    );

    if (total === 0) {
      return 'No ingredients listed';
    }

    return `${available}/${total} ingredients available`;
  }

  planMeal(recipe: Recipe): void {
    void this.router.navigate(['/meal-plan'], { queryParams: { recipe: recipe.id } });
  }

  async onRatingChange(recipeId: string, rating: number | null): Promise<void> {
    await this.recipeService.updateRecipeRating(recipeId, rating);
  }

  goToNew(): void {
    void this.router.navigateByUrl('/recipes/new');
  }
}
