import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MealPlanService } from '../../../../core/services/meal-plan.service';
import { RecipeImageAutogenService } from '../../../../core/services/recipe-image-autogen.service';
import { RecipeImageComponent } from '../../../../shared/components/recipe-image/recipe-image.component';
import { RecentMealPlanRecipe } from '../../../../shared/utils/meal-plan-recipe-history.utils';

const MAX_RECENT_ENTRIES = 8;
const NEW_ENTRY_DAYS = 7;

@Component({
  selector: 'app-recently-added-slider',
  standalone: true,
  imports: [RouterLink, RecipeImageComponent],
  template: `
    @if (visibleEntries().length > 0) {
      <section aria-label="Recently added to meal plan">
        <div class="mb-3 flex items-center justify-between gap-4">
          <h2 class="section-title">Recently Added</h2>
          <a
            routerLink="/meal-plan/recent"
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
          @for (entry of visibleEntries(); track entry.recipe.id) {
            <a
              [routerLink]="['/recipes', entry.recipe.id]"
              class="group block w-[148px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              role="listitem"
              [attr.aria-label]="entry.recipe.title + ' recipe'"
            >
              <div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-cream ring-1 ring-sage/30">
                <app-recipe-image [recipe]="entry.recipe" variant="card" />
                @if (isNewEntry(entry)) {
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
                {{ entry.recipe.title }}
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
  private readonly mealPlanService = inject(MealPlanService);
  private readonly imageAutogen = inject(RecipeImageAutogenService);

  readonly recentEntries = computed(() =>
    this.mealPlanService.recentRecipeHistory().slice(0, MAX_RECENT_ENTRIES)
  );

  readonly visibleEntries = computed(() => {
    this.imageAutogen.overrides();

    return this.recentEntries().map((entry) => ({
      ...entry,
      recipe: this.imageAutogen.mergeRecipe(this.toAutogenRecipe(entry)),
    }));
  });

  constructor() {
    effect(() => {
      this.imageAutogen.ensureImages(
        this.recentEntries().map((entry) => this.toAutogenRecipe(entry))
      );
    });
  }

  isNewEntry(entry: RecentMealPlanRecipe): boolean {
    const addedAt = Date.parse(entry.addedAt);
    if (Number.isNaN(addedAt)) {
      return false;
    }

    const ageMs = Date.now() - addedAt;
    const maxAgeMs = NEW_ENTRY_DAYS * 24 * 60 * 60 * 1000;
    return ageMs >= 0 && ageMs <= maxAgeMs;
  }

  private toAutogenRecipe(entry: RecentMealPlanRecipe) {
    return {
      ...entry.recipe,
      image_status: entry.recipe.image_status ?? 'pending',
    };
  }
}
