import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SmartSuggestion } from '../../../../core/models/smart-suggestion.model';
import { RecipeImageAutogenService } from '../../../../core/services/recipe-image-autogen.service';
import { SmartSuggestionService } from '../../../../core/services/smart-suggestion.service';
import { RecipeImageComponent } from '../../../../shared/components/recipe-image/recipe-image.component';

const MAX_SLIDER_SUGGESTIONS = 8;

@Component({
  selector: 'app-smart-suggestions-slider',
  standalone: true,
  imports: [RouterLink, RecipeImageComponent],
  template: `
    @if (visibleSuggestions().length > 0) {
      <section aria-label="Smart suggestions">
        <div class="mb-3 flex items-center justify-between gap-4">
          <h2 class="section-title">Smart Suggestions</h2>
          <a
            routerLink="/suggestions"
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
          class="smart-suggestions-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
          role="list"
        >
          @for (suggestion of visibleSuggestions(); track suggestion.recipe.id) {
            <a
              [routerLink]="['/recipes', suggestion.recipe.id]"
              class="group block w-[148px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              role="listitem"
              [attr.aria-label]="suggestion.recipe.title + ' recipe suggestion'"
            >
              <div class="relative aspect-square w-full overflow-hidden rounded-2xl bg-cream ring-1 ring-sage/30">
                <app-recipe-image [recipe]="suggestion.recipe" variant="card" />
                @if (badgeLabel(suggestion); as label) {
                  <span
                    class="absolute left-2 top-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
                  >
                    {{ label }}
                  </span>
                }
              </div>
              <p
                class="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-stone-900 group-hover:text-brand-800"
              >
                {{ suggestion.recipe.title }}
              </p>
            </a>
          }
        </div>
      </section>
    }
  `,
  styles: `
    .smart-suggestions-scroll {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .smart-suggestions-scroll::-webkit-scrollbar {
      display: none;
    }
  `,
})
export class SmartSuggestionsSliderComponent {
  private readonly suggestionService = inject(SmartSuggestionService);
  private readonly imageAutogen = inject(RecipeImageAutogenService);

  readonly suggestions = computed(() => this.mergeSuggestions());

  readonly visibleSuggestions = computed(() => {
    this.imageAutogen.overrides();

    return this.suggestions().map((suggestion) => ({
      ...suggestion,
      recipe: this.imageAutogen.mergeRecipe(suggestion.recipe),
    }));
  });

  constructor() {
    effect(() => {
      const suggestions = this.suggestions();
      this.imageAutogen.ensureImages(suggestions.map((suggestion) => suggestion.recipe));
    });
  }

  badgeLabel(suggestion: SmartSuggestion): string | null {
    if (suggestion.expiringIngredientsUsed.length > 0) {
      return 'Uses expiring';
    }

    if (suggestion.matchPercentage >= 50) {
      return `${suggestion.matchPercentage}% match`;
    }

    return null;
  }

  private mergeSuggestions(): SmartSuggestion[] {
    const overall = this.suggestionService.getSmartSuggestions();
    const expiring = this.suggestionService.getSuggestionsForExpiringFoods();
    const seen = new Set<string>();
    const merged: SmartSuggestion[] = [];

    for (const suggestion of [...overall, ...expiring]) {
      if (seen.has(suggestion.recipe.id)) {
        continue;
      }

      seen.add(suggestion.recipe.id);
      merged.push(suggestion);

      if (merged.length >= MAX_SLIDER_SUGGESTIONS) {
        break;
      }
    }

    return merged;
  }
}
