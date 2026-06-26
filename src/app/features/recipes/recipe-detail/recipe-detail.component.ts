import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MEAL_TYPE_LABELS, MealType } from '../../../core/models/meal-plan.model';
import { Recipe, RecipeNutrition } from '../../../core/models/recipe.model';
import { FoodItemHistoryService } from '../../../core/services/food-item-history.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { FoodIconBadgeComponent } from '../../../shared/components/food-icon-badge/food-icon-badge.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { RecipeImageComponent } from '../../../shared/components/recipe-image/recipe-image.component';
import { normalizeNameKey } from '../../../shared/utils/name-normalization.utils';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';
import { FormatTagPipe } from '../../../shared/pipes/format-tag.pipe';
import { AddToMealPlanDialogComponent } from '../recipe-suggestions/add-to-meal-plan-dialog.component';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [
    RouterLink,
    DecimalPipe,
    LoadingStateComponent,
    StarRatingComponent,
    FormatTagPipe,
    AddToMealPlanDialogComponent,
    FoodIconBadgeComponent,
    RecipeImageComponent,
  ],
  template: `
    <div class="page">
      <a routerLink="/recipes" class="inline-flex text-sm text-stone-500 hover:text-stone-700">
        &larr; Back to recipes
      </a>

      @if (isStarterMode()) {
        <p class="text-sm font-medium text-amber-800">
          Recipe template — customize to save your own version
        </p>
      }

      @if (loading()) {
        <app-loading-state message="Loading recipe..." />
      } @else if (error()) {
        <p class="alert-error">{{ error() }}</p>
      } @else if (recipe(); as r) {
        <app-recipe-image [recipe]="r" variant="hero" />

        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="page-title">{{ r.title }}</h1>
            @if (r.description) {
              <p class="mt-2 max-w-2xl text-sm text-stone-600">{{ r.description }}</p>
            }

            @if (r.base_recipe_id && !isStarterMode()) {
              <p class="mt-2 text-sm text-stone-500">
                Based on a
                <a
                  [routerLink]="['/recipes/starter', r.base_recipe_id]"
                  class="font-medium text-brand-700 hover:text-brand-800"
                >
                  starter recipe
                </a>
              </p>
            }

            @if (!isStarterMode()) {
              <div class="mt-3">
                <p class="text-sm font-medium text-stone-700">Your rating</p>
                <app-star-rating
                  class="mt-1"
                  [rating]="r.rating"
                  size="md"
                  (ratingChange)="onRatingChange($event)"
                />
                @if (ratingError()) {
                  <p class="mt-1 text-sm text-red-600">{{ ratingError() }}</p>
                }
              </div>
            }
          </div>
          <div class="flex flex-wrap gap-2">
            @if (isStarterMode()) {
              <button
                type="button"
                class="btn-primary-sm"
                [disabled]="customizing()"
                (click)="customizeRecipe()"
              >
                {{ customizing() ? 'Creating your copy...' : 'Customize' }}
              </button>
            } @else {
              <button
                type="button"
                class="btn-primary-sm"
                (click)="showMealPlanDialog.set(true)"
              >
                Add to meal plan
              </button>
              <a [routerLink]="['/recipes', r.id, 'edit']" class="btn-secondary-sm">
                Edit
              </a>
              <button
                type="button"
                class="btn-danger disabled:cursor-not-allowed disabled:opacity-60"
                [disabled]="deleting()"
                (click)="deleteRecipe(r)"
              >
                {{ deleting() ? 'Deleting...' : 'Delete' }}
              </button>
            }
          </div>
        </div>

        <div class="flex flex-wrap gap-2 text-xs text-stone-600">
          @if (r.meal_type) {
            <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
              {{ mealTypeLabel(r.meal_type) }}
            </span>
          }
          @if (r.category) {
            <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
              {{ r.category }}
            </span>
          }
          @if (r.difficulty) {
            <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium capitalize">
              {{ r.difficulty }}
            </span>
          }
          @if (r.prep_time_minutes) {
            <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
              {{ r.prep_time_minutes }} min prep
            </span>
          }
          @if (r.cook_time_minutes) {
            <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
              {{ r.cook_time_minutes }} min cook
            </span>
          }
          @if (r.portions) {
            <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
              {{ r.portions }} {{ r.portions === 1 ? 'portion' : 'portions' }}
            </span>
          }
        </div>

        @if (r.tags.length > 0) {
          <div class="flex flex-wrap gap-1.5">
            @for (tag of r.tags; track tag) {
              <span class="tag">{{ tag | formatTag }}</span>
            }
          </div>
        }

        <section class="card p-5">
          <h2 class="text-lg font-semibold text-stone-900">Ingredients</h2>
          @if ((r.ingredients?.length ?? 0) === 0) {
            <p class="mt-2 text-sm text-stone-500">No ingredients added for this recipe.</p>
          } @else {
            <ul class="mt-3 divide-y divide-stone-100">
              @for (ingredient of r.ingredients; track ingredient.id) {
                <li class="flex items-center justify-between gap-3 py-2 text-sm">
                  <div class="flex min-w-0 flex-1 items-center gap-3">
                    <app-food-icon-badge
                      [name]="ingredient.name"
                      [category]="ingredientCategory(ingredient.name)"
                      size="sm"
                    />
                    <span class="truncate text-stone-800">{{ ingredient.name }}</span>
                  </div>
                  @if (ingredient.quantity !== null || ingredient.unit) {
                    <span class="shrink-0 text-stone-500">
                      {{ ingredient.quantity }} {{ ingredient.unit }}
                    </span>
                  }
                </li>
              }
            </ul>
          }
        </section>

        @if ((r.instructions?.length ?? 0) > 0) {
          <section class="card p-5">
            <h2 class="text-lg font-semibold text-stone-900">Instructions</h2>
            <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-stone-700">
              @for (step of r.instructions; track $index) {
                <li>{{ step }}</li>
              }
            </ol>
          </section>
        }

        @if (!isStarterMode()) {
        <section class="card overflow-hidden">
          <button
            type="button"
            class="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-brand-50/40 sm:px-5"
            [attr.aria-expanded]="nutritionExpanded()"
            aria-controls="recipe-nutrition-content"
            (click)="toggleNutritionExpanded()"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-lg font-semibold text-stone-900">Nutrition</span>
              @if (r.portions) {
                <span class="mt-0.5 block text-sm text-stone-600">Per portion</span>
              }
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="mt-1 h-5 w-5 shrink-0 text-stone-400 transition-transform duration-200"
              [class.rotate-180]="nutritionExpanded()"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          @if (nutritionExpanded()) {
            <div
              id="recipe-nutrition-content"
              class="border-t border-stone-200/60 px-4 pb-4 pt-4 sm:px-5"
            >
              @if (hasNutrition(r.nutrition); as nutrition) {
                <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  @for (item of nutritionItems(nutrition); track item.label) {
                    <div>
                      <dt class="text-stone-500">{{ item.label }}</dt>
                      <dd class="font-medium text-stone-900">
                        @if (item.value !== null) {
                          {{ item.value | number: '1.0-1' }} {{ item.unit }}
                        } @else {
                          —
                        }
                      </dd>
                    </div>
                  }
                </dl>
              } @else {
                <p class="text-sm text-stone-500">
                  Nutrition estimate is not available for this recipe.
                </p>
              }
            </div>
          }
        </section>
        }

        @if (showMealPlanDialog() && !isStarterMode()) {
          <app-add-to-meal-plan-dialog
            [recipe]="r"
            (saved)="onAddedToMealPlan()"
            (cancelled)="showMealPlanDialog.set(false)"
          />
        }
      }
    </div>
  `,
})
export class RecipeDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly foodItemHistoryService = inject(FoodItemHistoryService);

  private imagePollTimer: ReturnType<typeof setInterval> | null = null;
  private imagePollAttempts = 0;
  private readonly maxImagePollAttempts = 40;

  readonly recipe = signal<Recipe | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly showMealPlanDialog = signal(false);
  readonly nutritionExpanded = signal(false);
  readonly ratingError = signal<string | null>(null);
  readonly customizing = signal(false);

  isStarterMode(): boolean {
    return this.route.snapshot.data['starterMode'] === true;
  }

  mealTypeLabel(mealType: MealType): string {
    return MEAL_TYPE_LABELS[mealType];
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Recipe not found.');
      return;
    }

    this.loading.set(true);
    const { recipe, error } = this.isStarterMode()
      ? await this.recipeService.getBaseRecipeById(id)
      : await this.recipeService.getRecipeById(id);
    this.loading.set(false);

    if (error || !recipe) {
      this.error.set(error ?? 'Recipe not found.');
      return;
    }

    this.recipe.set(recipe);
    void this.foodItemHistoryService.loadHistory();
    this.startImagePollingIfNeeded(recipe);
  }

  ngOnDestroy(): void {
    this.stopImagePolling();
  }

  private startImagePollingIfNeeded(recipe: Recipe): void {
    if (this.isStarterMode() || recipe.image_status !== 'generating') {
      return;
    }

    this.stopImagePolling();
    this.imagePollAttempts = 0;

    this.imagePollTimer = setInterval(() => {
      void this.pollRecipeImage(recipe.id);
    }, 3000);
  }

  private async pollRecipeImage(recipeId: string): Promise<void> {
    this.imagePollAttempts += 1;

    if (this.imagePollAttempts > this.maxImagePollAttempts) {
      this.stopImagePolling();
      return;
    }

    const { recipe, error } = await this.recipeService.getRecipeById(recipeId);
    if (error || !recipe) {
      this.stopImagePolling();
      return;
    }

    this.recipe.set(recipe);

    if (recipe.image_status === 'completed' || recipe.image_status === 'failed') {
      this.stopImagePolling();
    }
  }

  private stopImagePolling(): void {
    if (this.imagePollTimer !== null) {
      clearInterval(this.imagePollTimer);
      this.imagePollTimer = null;
    }
  }

  ingredientCategory(name: string): string | null {
    const entry = this.foodItemHistoryService.history().find(
      (h) => normalizeNameKey(h.name) === normalizeNameKey(name)
    );
    return entry?.category?.trim() || null;
  }

  toggleNutritionExpanded(): void {
    this.nutritionExpanded.update((expanded) => !expanded);
  }

  hasNutrition(nutrition: RecipeNutrition | null | undefined): RecipeNutrition | null {
    if (!nutrition) {
      return null;
    }

    const hasValue =
      nutrition.calories !== null ||
      nutrition.fat_g !== null ||
      nutrition.cholesterol_mg !== null ||
      nutrition.protein_g !== null ||
      nutrition.sugar_g !== null ||
      nutrition.sodium_mg !== null ||
      nutrition.carbs_g !== null ||
      nutrition.fiber_g !== null;

    return hasValue ? nutrition : null;
  }

  nutritionItems(nutrition: RecipeNutrition): { label: string; value: number | null; unit: string }[] {
    return [
      { label: 'Calories', value: nutrition.calories, unit: 'kcal' },
      { label: 'Fat', value: nutrition.fat_g, unit: 'g' },
      { label: 'Cholesterol', value: nutrition.cholesterol_mg, unit: 'mg' },
      { label: 'Protein', value: nutrition.protein_g, unit: 'g' },
      { label: 'Sugars', value: nutrition.sugar_g, unit: 'g' },
      { label: 'Sodium', value: nutrition.sodium_mg, unit: 'mg' },
      { label: 'Carbs', value: nutrition.carbs_g, unit: 'g' },
      { label: 'Fiber', value: nutrition.fiber_g, unit: 'g' },
    ];
  }

  async onRatingChange(rating: number | null): Promise<void> {
    const current = this.recipe();
    if (!current) {
      return;
    }

    this.ratingError.set(null);
    this.recipe.set({ ...current, rating });

    const { error } = await this.recipeService.updateRecipeRating(current.id, rating);
    if (error) {
      this.recipe.set(current);
      this.ratingError.set(error);
    }
  }

  async deleteRecipe(recipe: Recipe): Promise<void> {
    const confirmed = window.confirm(`Delete "${recipe.title}"?`);
    if (!confirmed) {
      return;
    }

    this.deleting.set(true);
    const { error } = await this.recipeService.deleteRecipe(recipe.id);
    this.deleting.set(false);

    if (error) {
      this.error.set(error);
      return;
    }

    await this.router.navigateByUrl('/recipes');
  }

  onAddedToMealPlan(): void {
    this.showMealPlanDialog.set(false);
  }

  async customizeRecipe(): Promise<void> {
    const current = this.recipe();
    if (!current) {
      return;
    }

    this.customizing.set(true);
    const { recipe, error } = await this.recipeService.createRecipeFromTemplate(current.id);
    this.customizing.set(false);

    if (error || !recipe) {
      this.error.set(error ?? 'Could not create your recipe from this template.');
      return;
    }

    await this.router.navigate(['/recipes', recipe.id, 'edit']);
  }
}
