import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  MealType,
} from '../../core/models/meal-plan.model';
import {
  RECIPE_CATEGORIES,
  Recipe,
  RecipeSourceTab,
} from '../../core/models/recipe.model';
import { FoodInventoryService } from '../../core/services/food-inventory.service';
import { RecipeService } from '../../core/services/recipe.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { RecipeCardSkeletonComponent } from '../../shared/components/recipe-card-skeleton/recipe-card-skeleton.component';
import { FormatTagPipe } from '../../shared/pipes/format-tag.pipe';
import { countAvailableIngredients } from '../../shared/utils/recipe-availability.utils';
import { StarRatingComponent } from '../../shared/components/star-rating/star-rating.component';
import { RecipeImageComponent } from '../../shared/components/recipe-image/recipe-image.component';
import { AiRecipeDialogComponent } from './ai-recipe-generator/ai-recipe-dialog.component';
import { RecipeFormDialogComponent } from './recipe-form/recipe-form-dialog.component';
import { RecipeFiltersDialogComponent } from './recipe-filters-dialog.component';
import { AddToMealPlanDialogComponent } from './recipe-suggestions/add-to-meal-plan-dialog.component';

const RECIPE_BATCH_SIZE = 7;
const SKELETON_CARD_COUNT = 4;

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [
    RouterLink,
    EmptyStateComponent,
    RecipeCardSkeletonComponent,
    FormatTagPipe,
    StarRatingComponent,
    RecipeImageComponent,
    RecipeFormDialogComponent,
    AiRecipeDialogComponent,
    RecipeFiltersDialogComponent,
    AddToMealPlanDialogComponent,
  ],
  template: `
    <div class="page">
      <div class="grid grid-cols-2 gap-3">
        <button type="button" class="btn-primary" (click)="showCreateDialog.set(true)">
          Create recipe
        </button>
        <button type="button" class="btn-secondary" (click)="showAiDialog.set(true)">
          Create AI recipe
        </button>
      </div>

      <div>
        <h2 class="section-title">Recipe library</h2>
        <p class="mt-1 text-sm text-stone-600">
          Browse all recipes or manage your own.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="filter-dialog-btn"
          aria-label="Open filters"
          (click)="showFiltersDialog.set(true)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
            />
          </svg>
          @if (hasSecondaryFilters()) {
            <span
              class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-600"
              aria-hidden="true"
            ></span>
          }
        </button>

        <div class="filter-bar-scroll">
          @for (tab of sourceTabs; track tab.id) {
            <button
              type="button"
              class="filter-pill shrink-0"
              [class.filter-pill-active]="sourceTab() === tab.id"
              [class.filter-pill-inactive]="sourceTab() !== tab.id"
              (click)="sourceTab.set(tab.id)"
            >
              {{ tab.label }}
            </button>
          }

          <label class="sr-only" for="meal-type-filter">Meal type</label>
          <select
            id="meal-type-filter"
            class="filter-select"
            [value]="mealTypeFilter() ?? ''"
            (change)="onMealTypeChange($event)"
          >
            <option value="">All meals</option>
            @for (mealType of mealTypes; track mealType) {
              <option [value]="mealType">{{ mealTypeLabel(mealType) }}</option>
            }
          </select>

          <label class="sr-only" for="category-filter">Category</label>
          <select
            id="category-filter"
            class="filter-select"
            [value]="categoryFilter() ?? ''"
            (change)="onCategoryChange($event)"
          >
            <option value="">All categories</option>
            @for (category of availableCategories(); track category) {
              <option [value]="category">{{ category }}</option>
            }
          </select>
        </div>

        @if (hasClearableFilters()) {
          <button
            type="button"
            class="shrink-0 text-sm font-medium text-brand-700"
            (click)="clearFilters()"
          >
            Clear all
          </button>
        }
      </div>

      @if (hasSecondaryFilters()) {
        <div class="applied-filters-card">
          <div class="flex flex-wrap gap-2">
            @if (search().trim()) {
              <span class="applied-filter-chip">
                Search: {{ search().trim() }}
                <button
                  type="button"
                  class="text-brand-700 hover:text-brand-800"
                  aria-label="Remove search filter"
                  (click)="removeSearch()"
                >
                  &times;
                </button>
              </span>
            }
            @for (tag of activeTagFilters(); track tag) {
              <span class="applied-filter-chip">
                {{ tag | formatTag }}
                <button
                  type="button"
                  class="text-brand-700 hover:text-brand-800"
                  [attr.aria-label]="'Remove ' + tag + ' filter'"
                  (click)="removeTag(tag)"
                >
                  &times;
                </button>
              </span>
            }
          </div>
        </div>
      }

      @if (showInitialLoading()) {
        <div class="flex flex-col gap-4" aria-busy="true" aria-label="Loading recipes">
          @for (_ of skeletonItems; track $index) {
            <app-recipe-card-skeleton />
          }
        </div>
      } @else if (loadError() && !hasRecipeData()) {
        <p class="alert-error">{{ loadError() }}</p>
      } @else if (showEmptyLibrary()) {
        <app-empty-state
          title="No recipes yet"
          description="Add your own recipe or browse the full library with the All tab."
          actionLabel="Create recipe"
          (actionClick)="showCreateDialog.set(true)"
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
          @for (recipe of visibleRecipes(); track recipe.id) {
            <article class="card p-4">
              <div class="flex gap-3">
                <app-recipe-image [recipe]="recipe" variant="thumbnail" />

                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="text-base font-semibold text-stone-900">{{ recipe.title }}</h2>
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
                      <span
                        >{{ recipe.portions }}
                        {{ recipe.portions === 1 ? 'portion' : 'portions' }}</span
                      >
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
                <button
                  type="button"
                  class="btn-primary flex-1"
                  [disabled]="actionInProgressId() === recipe.id"
                  (click)="planMeal(recipe)"
                >
                  {{
                    actionInProgressId() === recipe.id ? 'Preparing recipe...' : 'Plan meal'
                  }}
                </button>
                <a [routerLink]="viewLink(recipe)" class="btn-secondary flex-1 text-center">
                  View
                </a>
              </div>
            </article>
          }

          @if (hasMoreRecipes()) {
            <div #loadMoreSentinel class="h-1" aria-hidden="true"></div>
          }
        </div>
      }
    </div>

    @if (showCreateDialog()) {
      <app-recipe-form-dialog
        (saved)="onRecipeCreated()"
        (cancelled)="showCreateDialog.set(false)"
      />
    }
    @if (showAiDialog()) {
      <app-ai-recipe-dialog (closed)="showAiDialog.set(false)" />
    }
    @if (showFiltersDialog()) {
      <app-recipe-filters-dialog
        [search]="search()"
        [activeTags]="activeTagFilters()"
        (searchChanged)="search.set($event)"
        (tagToggled)="toggleTagFilter($event)"
        (cleared)="clearFilters()"
        (closed)="showFiltersDialog.set(false)"
      />
    }
    @if (mealPlanRecipe()) {
      <app-add-to-meal-plan-dialog
        [recipe]="mealPlanRecipe()!"
        (saved)="onAddedToMealPlan()"
        (cancelled)="mealPlanRecipe.set(null)"
      />
    }
  `,
})
export class RecipesComponent implements OnInit, OnDestroy {
  readonly recipeService = inject(RecipeService);
  readonly inventoryService = inject(FoodInventoryService);
  private readonly route = inject(ActivatedRoute);

  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');
  private observer: IntersectionObserver | null = null;

  readonly mealTypes = MEAL_TYPES;
  readonly skeletonItems = Array.from({ length: SKELETON_CARD_COUNT });
  readonly sourceTabs: { id: RecipeSourceTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'My recipes' },
  ];

  readonly search = signal('');
  readonly sourceTab = signal<RecipeSourceTab>('all');
  readonly mealTypeFilter = signal<MealType | null>(null);
  readonly categoryFilter = signal<string | null>(null);
  readonly activeTagFilters = signal<string[]>([]);
  readonly actionInProgressId = signal<string | null>(null);
  readonly visibleCount = signal(RECIPE_BATCH_SIZE);
  readonly showCreateDialog = signal(false);
  readonly showAiDialog = signal(false);
  readonly showFiltersDialog = signal(false);
  readonly mealPlanRecipe = signal<Recipe | null>(null);

  readonly hasSecondaryFilters = computed(
    () => !!this.search().trim() || this.activeTagFilters().length > 0
  );

  readonly hasClearableFilters = computed(
    () =>
      this.hasSecondaryFilters() ||
      this.mealTypeFilter() !== null ||
      this.categoryFilter() !== null
  );

  readonly filteredRecipes = computed(() =>
    this.recipeService.searchRecipes({
      sourceTab: this.sourceTab(),
      mealType: this.mealTypeFilter(),
      category: this.categoryFilter(),
      tags: this.activeTagFilters(),
      search: this.search(),
    })
  );

  readonly visibleRecipes = computed(() =>
    this.filteredRecipes().slice(0, this.visibleCount())
  );

  readonly hasMoreRecipes = computed(
    () => this.visibleCount() < this.filteredRecipes().length
  );

  readonly hasRecipeData = computed(
    () =>
      this.recipeService.recipes().length > 0 || this.recipeService.baseRecipes().length > 0
  );

  readonly showInitialLoading = computed(() => this.isLoading() && !this.hasRecipeData());

  readonly availableCategories = computed(() =>
    this.recipeService.getAvailableCategories(this.sourceTab())
  );

  readonly isLoading = computed(
    () => this.recipeService.loading() || this.recipeService.baseLoading()
  );

  readonly loadError = computed(
    () => this.recipeService.error() ?? this.recipeService.baseError()
  );

  readonly showEmptyLibrary = computed(() => {
    if (this.sourceTab() === 'mine') {
      return this.recipeService.recipes().length === 0;
    }
    return !this.hasRecipeData();
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const category = params.get('category');
      if (category && (RECIPE_CATEGORIES as readonly string[]).includes(category)) {
        this.categoryFilter.set(category);
      }
    });

    effect(() => {
      if (!this.hasRecipeData()) {
        return;
      }

      const available = this.availableCategories();
      const current = this.categoryFilter();
      if (current && !available.includes(current as (typeof RECIPE_CATEGORIES)[number])) {
        this.categoryFilter.set(null);
      }
    });

    effect(() => {
      this.search();
      this.sourceTab();
      this.mealTypeFilter();
      this.categoryFilter();
      this.activeTagFilters();
      this.visibleCount.set(RECIPE_BATCH_SIZE);
    });

    effect(() => {
      this.visibleRecipes();
      this.hasMoreRecipes();
      queueMicrotask(() => this.setupLoadMoreObserver());
    });

    afterNextRender(() => {
      this.setupLoadMoreObserver();
    });
  }

  ngOnInit(): void {
    void Promise.all([
      this.recipeService.loadRecipes(),
      this.recipeService.loadBaseRecipes(),
      this.inventoryService.loadItems(),
    ]);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  onMealTypeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.mealTypeFilter.set(value ? (value as MealType) : null);
  }

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.categoryFilter.set(value || null);
  }

  viewLink(recipe: Recipe): string[] {
    return recipe.is_base_recipe ? ['/recipes/starter', recipe.id] : ['/recipes', recipe.id];
  }

  removeSearch(): void {
    this.search.set('');
  }

  removeTag(tag: string): void {
    this.activeTagFilters.update((tags) => tags.filter((existing) => existing !== tag));
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

  onRecipeCreated(): void {
    this.showCreateDialog.set(false);
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

  async planMeal(recipe: Recipe): Promise<void> {
    const target = recipe.is_base_recipe ? await this.ensureUserRecipe(recipe) : recipe;
    if (!target) {
      return;
    }

    this.mealPlanRecipe.set(target);
  }

  onAddedToMealPlan(): void {
    this.mealPlanRecipe.set(null);
  }

  async ensureUserRecipe(recipe: Recipe): Promise<Recipe | null> {
    if (!recipe.is_base_recipe) {
      return recipe;
    }

    this.actionInProgressId.set(recipe.id);
    const { recipe: copy, error } = await this.recipeService.createRecipeFromTemplate(recipe.id);
    this.actionInProgressId.set(null);

    if (error || !copy) {
      return null;
    }

    return copy;
  }

  async onRatingChange(recipeId: string, rating: number | null): Promise<void> {
    await this.recipeService.updateRecipeRating(recipeId, rating);
  }

  private setupLoadMoreObserver(): void {
    this.observer?.disconnect();
    this.observer = null;

    if (!this.hasMoreRecipes()) {
      return;
    }

    const sentinel = this.loadMoreSentinel()?.nativeElement;
    if (!sentinel) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.visibleCount.update((count) => count + RECIPE_BATCH_SIZE);
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 200px 0px',
        threshold: 0,
      }
    );

    this.observer.observe(sentinel);
  }
}
