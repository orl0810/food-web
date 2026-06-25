import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Recipe } from '../../../core/models/recipe.model';
import { RecipeService } from '../../../core/services/recipe.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating.component';
import { FormatTagPipe } from '../../../shared/pipes/format-tag.pipe';
import { CookRecipeDialogComponent } from '../../inventory/ready-portions/cook-recipe-dialog.component';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent, StarRatingComponent, FormatTagPipe, CookRecipeDialogComponent],
  template: `
    <div class="page">
      <a routerLink="/recipes" class="inline-flex text-sm text-stone-500 hover:text-stone-700">
        &larr; Back to recipes
      </a>

      @if (loading()) {
        <app-loading-state message="Loading recipe..." />
      } @else if (error()) {
        <p class="alert-error">{{ error() }}</p>
      } @else if (recipe(); as r) {
        <figure
          class="w-full overflow-hidden rounded-2xl aspect-[16/10] bg-stone-100 ring-1 ring-stone-200"
        >
          @if (r.image_url && !imageError()) {
            <img
              [src]="r.image_url"
              [alt]="r.title"
              class="h-full w-full object-cover"
              (error)="onImageError()"
            />
          } @else {
            <div
              class="flex h-full w-full items-center justify-center"
              role="img"
              [attr.aria-label]="'No photo for ' + r.title"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="h-16 w-16 text-brand-600"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z"
                />
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 17h12" />
              </svg>
            </div>
          }
        </figure>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="page-title">{{ r.title }}</h1>
            @if (r.description) {
              <p class="mt-2 max-w-2xl text-sm text-stone-600">{{ r.description }}</p>
            }

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
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="btn-primary-sm"
              (click)="showCookDialog.set(true)"
            >
              Mark as cooked
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
          </div>
        </div>

        <div class="flex flex-wrap gap-2 text-xs text-stone-600">
          @if (r.prep_time_minutes) {
            <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
              {{ r.prep_time_minutes }} min prep
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
                <li class="flex items-center justify-between py-2 text-sm">
                  <span class="text-stone-800">{{ ingredient.name }}</span>
                  @if (ingredient.quantity !== null || ingredient.unit) {
                    <span class="text-stone-500">
                      {{ ingredient.quantity }} {{ ingredient.unit }}
                    </span>
                  }
                </li>
              }
            </ul>
          }
        </section>

        @if (showCookDialog()) {
          <app-cook-recipe-dialog
            [recipe]="r"
            (saved)="onCooked()"
            (cancelled)="showCookDialog.set(false)"
          />
        }
      }
    </div>
  `,
})
export class RecipeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);

  readonly recipe = signal<Recipe | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly showCookDialog = signal(false);
  readonly ratingError = signal<string | null>(null);
  readonly imageError = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Recipe not found.');
      return;
    }

    this.loading.set(true);
    const { recipe, error } = await this.recipeService.getRecipeById(id);
    this.loading.set(false);

    if (error || !recipe) {
      this.error.set(error ?? 'Recipe not found.');
      return;
    }

    this.recipe.set(recipe);
    this.imageError.set(false);
  }

  onImageError(): void {
    this.imageError.set(true);
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

  onCooked(): void {
    this.showCookDialog.set(false);
  }
}
