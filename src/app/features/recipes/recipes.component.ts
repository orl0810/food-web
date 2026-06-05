import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Recipe } from '../../core/models/recipe.model';
import { RecipeService } from '../../core/services/recipe.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, LoadingStateComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-stone-900">Recipes</h1>
          <p class="mt-1 text-sm text-stone-600">Save and reuse your favourite meals.</p>
        </div>
        <a
          routerLink="/recipes/new"
          class="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 sm:self-auto"
        >
          New recipe
        </a>
      </div>

      @if (recipeService.recipes().length > 0) {
        <div class="space-y-3">
          <input
            type="search"
            [value]="search()"
            (input)="onSearch($event)"
            placeholder="Search by title..."
            class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          @if (recipeService.allTags().length > 0) {
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                [class.bg-brand-600]="activeTag() === null"
                [class.text-white]="activeTag() === null"
                [class.bg-stone-100]="activeTag() !== null"
                [class.text-stone-700]="activeTag() !== null"
                (click)="activeTag.set(null)"
              >
                All tags
              </button>
              @for (tag of recipeService.allTags(); track tag) {
                <button
                  type="button"
                  class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  [class.bg-brand-600]="activeTag() === tag"
                  [class.text-white]="activeTag() === tag"
                  [class.bg-stone-100]="activeTag() !== tag"
                  [class.text-stone-700]="activeTag() !== tag"
                  (click)="activeTag.set(tag)"
                >
                  {{ tag }}
                </button>
              }
            </div>
          }
        </div>
      }

      @if (recipeService.loading()) {
        <app-loading-state message="Loading recipes..." />
      } @else if (recipeService.error()) {
        <p class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
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
        <div class="grid gap-3 sm:grid-cols-2">
          @for (recipe of filteredRecipes(); track recipe.id) {
            <a
              [routerLink]="['/recipes', recipe.id]"
              class="block rounded-xl border border-stone-200 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 class="text-base font-semibold text-stone-900">{{ recipe.title }}</h2>
              @if (recipe.description) {
                <p class="mt-1 line-clamp-2 text-sm text-stone-600">{{ recipe.description }}</p>
              }

              <div class="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                @if (recipe.prep_time_minutes) {
                  <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
                    {{ recipe.prep_time_minutes }} min
                  </span>
                }
                @if (recipe.portions) {
                  <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
                    {{ recipe.portions }} {{ recipe.portions === 1 ? 'portion' : 'portions' }}
                  </span>
                }
                <span class="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium">
                  {{ ingredientCount(recipe) }}
                  {{ ingredientCount(recipe) === 1 ? 'ingredient' : 'ingredients' }}
                </span>
              </div>

              @if (recipe.tags.length > 0) {
                <div class="mt-2 flex flex-wrap gap-1.5">
                  @for (tag of recipe.tags; track tag) {
                    <span class="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                      {{ tag }}
                    </span>
                  }
                </div>
              }
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class RecipesComponent implements OnInit {
  readonly recipeService = inject(RecipeService);
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
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  ingredientCount(recipe: Recipe): number {
    return recipe.ingredients?.length ?? 0;
  }

  goToNew(): void {
    void this.router.navigateByUrl('/recipes/new');
  }
}
