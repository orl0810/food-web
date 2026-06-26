import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  MealType,
} from '../../core/models/meal-plan.model';
import {
  RECIPE_CATEGORIES,
  Recipe,
  RecipeSourceTab,
  STARTER_RECIPE_TAG_FILTERS,
} from '../../core/models/recipe.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { RecipeService } from '../../core/services/recipe.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { FormatTagPipe } from '../../shared/pipes/format-tag.pipe';
import { countAvailableIngredients } from '../../shared/utils/recipe-availability.utils';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { RecipeImageComponent } from '../../shared/components/recipe-image/recipe-image.component';
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
    RecipeImageComponent,
  ],
  template: `
    <div class="page">
      <app-recipe-suggestions />

      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="section-title">Recipe library</h2>
          <p class="mt-1 text-sm text-stone-600">
            Browse starter recipes or manage your saved versions.
          </p>
        </div>
        <a routerLink="/recipes/new" class="btn-primary-sm shrink-0 text-center">
          New recipe
        </a>
      </div>

      <div class="flex flex-wrap gap-2">
        @for (tab of sourceTabs; track tab.id) {
          <button
            type="button"
            class="filter-pill"
            [class.filter-pill-active]="sourceTab() === tab.id"
            [class.filter-pill-inactive]="sourceTab() !== tab.id"
            (click)="sourceTab.set(tab.id)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      <div class="space-y-3">
        <input
          type="search"
          [value]="search()"
          (input)="onSearch($event)"
          placeholder="Search by name or ingredient..."
          class="input"
        />

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="filter-pill"
            [class.filter-pill-active]="mealTypeFilter() === null"
            [class.filter-pill-inactive]="mealTypeFilter() !== null"
            (click)="mealTypeFilter.set(null)"
          >
            All meals
          </button>
          @for (mealType of mealTypes; track mealType) {
            <button
              type="button"
              class="filter-pill"
              [class.filter-pill-active]="mealTypeFilter() === mealType"
              [class.filter-pill-inactive]="mealTypeFilter() !== mealType"
              (click)="mealTypeFilter.set(mealType)"
            >
              {{ mealTypeLabel(mealType) }}
            </button>
          }
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="filter-pill"
            [class.filter-pill-active]="categoryFilter() === null"
            [class.filter-pill-inactive]="categoryFilter() !== null"
            (click)="categoryFilter.set(null)"
          >
            All categories
          </button>
          @for (category of categories; track category) {
            <button
              type="button"
              class="filter-pill"
              [class.filter-pill-active]="categoryFilter() === category"
              [class.filter-pill-inactive]="categoryFilter() !== category"
              (click)="categoryFilter.set(category)"
            >
              {{ category }}
            </button>
          }
        </div>

        <div class="flex flex-wrap gap-2">
          @for (tag of starterTagFilters; track tag) {
            <button
              type="button"
              class="filter-pill"
              [class.filter-pill-active]="activeTagFilters().includes(tag)"
              [class.filter-pill-inactive]="!activeTagFilters().includes(tag)"
              (click)="toggleTagFilter(tag)"
            >
              {{ tag | formatTag }}
            </button>
          }
        </div>
      </div>

      @if (isLoading()) {
        <app-loading-state message="Loading recipes..." />
      } @else if (loadError()) {
        <p class="alert-error">{{ loadError() }}</p>
      } @else if (showEmptyLibrary()) {
        <app-empty-state
          title="No recipes yet"
          description="Start from a starter recipe template, or add your own recipe from scratch."
          actionLabel="Browse starter recipes"
          (actionClick)="sourceTab.set('starter')"
        />
      } @else if (filteredRecipes().length === 0) {
        <app-empty-state
          title="No matching recipes"
          description="Try clearing your filters or using a different search term."
          actionLabel="Clear filters"
          (actionClick)="clearFilters()"
        />
      } @else {
        <div class="flex flex-col gap-4">
          @for (recipe of filteredRecipes(); track recipe.id) {
            <article class="card p-4">
              <div class="flex gap-3">
                <app-recipe-image [recipe]="recipe" variant="thumbnail" />

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="text-base font-semibold text-stone-900">{{ recipe.title }}</h2>
                    @if (recipe.is_base_recipe) {
                      <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                        Starter recipe
                      </span>
                    }
                  </div>

                  @if (recipe.description) {
                    <p class="mt-1 line-clamp-2 text-sm text-stone-600">{{ recipe.description }}</p>
                  }

                  @if (!recipe.is_base_recipe) {
                    <app-star-rating
                      class="mt-1"
                      [rating]="recipe.rating"
                      size="sm"
                      (ratingChange)="onRatingChange(recipe.id, $event)"
                    />
                  }

                  <div class="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                    @if (recipe.meal_type) {
                      <span class="rounded-full bg-stone-100 px-2 py-0.5 font-medium">
                        {{ mealTypeLabel(recipe.meal_type) }}
                      </span>
                    }
                    @if (recipe.category) {
                      <span class="rounded-full bg-stone-100 px-2 py-0.5 font-medium">
                        {{ recipe.category }}
                      </span>
                    }
                    @if (recipe.prep_time_minutes) {
                      <span>{{ recipe.prep_time_minutes }} min prep</span>
                    }
                    @if (recipe.cook_time_minutes) {
                      <span>{{ recipe.cook_time_minutes }} min cook</span>
                    }
                    @if (recipe.portions) {
                      <span>{{ recipe.portions }} {{ recipe.portions === 1 ? 'portion' : 'portions' }}</span>
                    }
                  </div>

                  <div class="mt-1.5 flex flex-wrap gap-1.5">
                    @for (tag of recipe.tags; track tag) {
                      <span class="tag">{{ tag | formatTag }}</span>
                    }
                  </div>
                </div>
              </div>

              @if (!recipe.is_base_recipe) {
                <p class="mt-3 text-sm text-brand-700">
                  {{ availabilityLabel(recipe) }}
                </p>
              }

              <div class="mt-3 flex gap-2">
                @if (recipe.is_base_recipe) {
                  <button
                    type="button"
                    class="btn-primary flex-1"
                    [disabled]="customizingId() === recipe.id"
                    (click)="customizeRecipe(recipe)"
                  >
                    {{ customizingId() === recipe.id ? 'Creating your copy...' : 'Customize' }}
                  </button>
                  <a
                    [routerLink]="['/recipes/starter', recipe.id]"
                    class="btn-secondary flex-1 text-center"
                  >
                    View template
                  </a>
                } @else {
                  <button type="button" class="btn-primary flex-1" (click)="planMeal(recipe)">
                    Plan meal
                  </button>
                  <a
                    [routerLink]="['/recipes', recipe.id, 'edit']"
                    class="btn-secondary flex-1 text-center"
                  >
                    Edit
                  </a>
                  <a
                    [routerLink]="['/recipes', recipe.id]"
                    class="btn-secondary flex-1 text-center"
                  >
                    View
                  </a>
                }
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

  readonly mealTypes = MEAL_TYPES;
  readonly categories = RECIPE_CATEGORIES;
  readonly starterTagFilters = STARTER_RECIPE_TAG_FILTERS;
  readonly sourceTabs: { id: RecipeSourceTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'My recipes' },
    { id: 'starter', label: 'Starter recipes' },
  ];

  readonly search = signal('');
  readonly sourceTab = signal<RecipeSourceTab>('all');
  readonly mealTypeFilter = signal<MealType | null>(null);
  readonly categoryFilter = signal<string | null>(null);
  readonly activeTagFilters = signal<string[]>([]);
  readonly customizingId = signal<string | null>(null);

  readonly filteredRecipes = computed(() =>
    this.recipeService.searchRecipes({
      sourceTab: this.sourceTab(),
      mealType: this.mealTypeFilter(),
      category: this.categoryFilter(),
      tags: this.activeTagFilters(),
      search: this.search(),
    })
  );

  readonly isLoading = computed(
    () => this.recipeService.loading() || this.recipeService.baseLoading()
  );

  readonly loadError = computed(
    () => this.recipeService.error() ?? this.recipeService.baseError()
  );

  readonly showEmptyLibrary = computed(() => {
    if (this.sourceTab() === 'starter') {
      return this.recipeService.baseRecipes().length === 0;
    }
    if (this.sourceTab() === 'mine') {
      return this.recipeService.recipes().length === 0;
    }
    return (
      this.recipeService.recipes().length === 0 &&
      this.recipeService.baseRecipes().length === 0
    );
  });

  ngOnInit(): void {
    void Promise.all([
      this.recipeService.loadRecipes(),
      this.recipeService.loadBaseRecipes(),
      this.inventoryService.loadItems(),
    ]);
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  toggleTagFilter(tag: string): void {
    this.activeTagFilters.update((tags) =>
      tags.includes(tag) ? tags.filter((existing) => existing !== tag) : [...tags, tag]
    );
  }

  clearFilters(): void {
    this.search.set('');
    this.mealTypeFilter.set(null);
    this.categoryFilter.set(null);
    this.activeTagFilters.set([]);
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

  async customizeRecipe(recipe: Recipe): Promise<void> {
    this.customizingId.set(recipe.id);
    const { recipe: copy, error } = await this.recipeService.createRecipeFromTemplate(recipe.id);
    this.customizingId.set(null);

    if (error || !copy) {
      return;
    }

    await this.router.navigate(['/recipes', copy.id, 'edit']);
  }

  async onRatingChange(recipeId: string, rating: number | null): Promise<void> {
    await this.recipeService.updateRecipeRating(recipeId, rating);
  }
}
