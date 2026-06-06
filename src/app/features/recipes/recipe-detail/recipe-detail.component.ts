import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Recipe } from '../../../core/models/recipe.model';
import { RecipeService } from '../../../core/services/recipe.service';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [RouterLink, LoadingStateComponent],
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
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 class="page-title">{{ r.title }}</h1>
            @if (r.description) {
              <p class="mt-2 max-w-2xl text-sm text-stone-600">{{ r.description }}</p>
            }
          </div>
          <div class="flex gap-2">
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
              <span class="tag">{{ tag }}</span>
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
}
