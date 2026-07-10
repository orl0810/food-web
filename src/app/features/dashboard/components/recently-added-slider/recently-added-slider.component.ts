import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Recipe } from '../../../../core/models/recipe.model';
import { RecipeImageAutogenService } from '../../../../core/services/recipe-image-autogen.service';
import { RecipeService } from '../../../../core/services/recipe.service';
import { RecipeImageComponent } from '../../../../shared/components/recipe-image/recipe-image.component';

const MAX_RECENT_RECIPES = 8;
const NEW_RECIPE_DAYS = 7;

@Component({
  selector: 'app-recently-added-slider',
  standalone: true,
  imports: [RouterLink, RecipeImageComponent],
  template: `
    @if (visibleRecipes().length > 0) {
      <section aria-label="Recently added recipes">
        <div class="mb-3 flex items-center justify-between gap-4">
          <h2 class="section-title">Recently Added</h2>
          <a
            routerLink="/recipes"
            class="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800"
          >
            All
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M7.21 14.77a.75.75 0 0 1 .02-1.06L10.94 10 7.23 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-.02Z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
        </div>

        <div
          class="recently-added-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
          role="list"
        >
          @for (recipe of visibleRecipes(); track recipe.id) {
            <a
              [routerLink]="['/recipes', recipe.id]"
              class="group block w-[148px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              role="listitem"
              [attr.aria-label]="recipe.title + ' recipe'"
            >
              <div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-cream ring-1 ring-sage/30">
                <app-recipe-image [recipe]="recipe" variant="card" />
                @if (isNewRecipe(recipe)) {
                  <span
                    class="absolute left-2 top-2 rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
                  >
                    New
                  </span>
                }
              </div>
              <p
                class="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-stone-900 group-hover:text-brand-800"
              >
                {{ recipe.title }}
              </p>
            </a>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .recently-added-scroll {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .recently-added-scroll::-webkit-scrollbar {
      display: none;
    }
  `,
})
export class RecentlyAddedSliderComponent {
  private readonly recipeService = inject(RecipeService);
  private readonly imageAutogen = inject(RecipeImageAutogenService);

  readonly recentRecipes = computed(() => this.getRecentRecipes());

  readonly visibleRecipes = computed(() => {
    this.imageAutogen.overrides();

    return this.recentRecipes().map((recipe) => this.imageAutogen.mergeRecipe(recipe));
  });

  constructor() {
    effect(() => {
      this.imageAutogen.ensureImages(this.recentRecipes());
    });
  }

  isNewRecipe(recipe: Recipe): boolean {
    const createdAt = Date.parse(recipe.created_at);
    if (Number.isNaN(createdAt)) {
      return false;
    }

    const ageMs = Date.now() - createdAt;
    const maxAgeMs = NEW_RECIPE_DAYS * 24 * 60 * 60 * 1000;
    return ageMs >= 0 && ageMs <= maxAgeMs;
  }

  private getRecentRecipes(): Recipe[] {
    return [...this.recipeService.recipes()]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, MAX_RECENT_RECIPES);
  }
}
