import { Location } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SmartSuggestion } from '../../../core/models/smart-suggestion.model';
import { RecipeImageAutogenService } from '../../../core/services/recipe-image-autogen.service';
import { SmartSuggestionService } from '../../../core/services/smart-suggestion.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../shared/components/loading-state/loading-state.component';
import { OverlayPageComponent } from '../../../shared/components/overlay-page/overlay-page.component';
import { RecipeImageComponent } from '../../../shared/components/recipe-image/recipe-image.component';

@Component({
  selector: 'app-smart-suggestions-page',
  standalone: true,
  imports: [
    RouterLink,
    RecipeImageComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    OverlayPageComponent,
  ],
  template: `
    <app-overlay-page title="Smart Suggestions" (backClick)="goBack()">
      @if (loading()) {
        <app-loading-state message="Loading suggestions..." />
      } @else if (visibleSuggestions().length === 0) {
        <app-empty-state
          title="No suggestions yet"
          description="Add recipes and inventory items to get personalized meal ideas."
          actionLabel="Browse recipes"
          (actionClick)="goToRecipes()"
        />
      } @else {
        <div class="space-y-6">
          @for (suggestion of visibleSuggestions(); track suggestion.recipe.id) {
            <a
              [routerLink]="['/recipes', suggestion.recipe.id]"
              class="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div class="relative aspect-[16/10] w-full overflow-hidden bg-cream">
                <app-recipe-image [recipe]="suggestion.recipe" variant="card" />

                @if (suggestion.recipe.rating !== null) {
                  <div
                    class="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-stone-900 shadow-sm backdrop-blur-sm"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      class="h-3.5 w-3.5 text-amber-500"
                      aria-hidden="true"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span>{{ suggestion.recipe.rating.toFixed(1) }}</span>
                  </div>
                }
              </div>

              <div class="px-4 py-4 sm:px-5">
                <div class="flex items-start justify-between gap-3">
                  <h2 class="text-lg font-bold text-stone-900 group-hover:text-brand-800">
                    {{ suggestion.recipe.title }}
                  </h2>
                  <span class="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {{ suggestion.matchPercentage }}% match
                  </span>
                </div>

                <p class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-500">
                  @if (suggestion.recipe.prep_time_minutes) {
                    <span>{{ suggestion.recipe.prep_time_minutes }} min prep</span>
                  }
                  @if (suggestion.recipe.prep_time_minutes && suggestion.recipe.portions) {
                    <span class="text-stone-300" aria-hidden="true">·</span>
                  }
                  @if (suggestion.recipe.portions) {
                    <span>{{ suggestion.recipe.portions }} portions</span>
                  }
                  @if ((suggestion.recipe.prep_time_minutes || suggestion.recipe.portions) && suggestion.reasons[0]) {
                    <span class="text-stone-300" aria-hidden="true">·</span>
                  }
                  @if (suggestion.reasons[0]) {
                    <span>{{ suggestion.reasons[0] }}</span>
                  }
                </p>
              </div>
            </a>
          }
        </div>
      }
    </app-overlay-page>
  `,
})
export class SmartSuggestionsPageComponent implements OnInit {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly suggestionService = inject(SmartSuggestionService);
  private readonly imageAutogen = inject(RecipeImageAutogenService);

  readonly loading = signal(true);

  readonly suggestions = computed(() => this.suggestionService.getSmartSuggestions());

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

  ngOnInit(): void {
    void this.loadSuggestions();
  }

  goBack(): void {
    this.location.back();
  }

  goToRecipes(): void {
    void this.router.navigateByUrl('/recipes');
  }

  private async loadSuggestions(): Promise<void> {
    this.loading.set(true);
    await this.suggestionService.refresh();
    this.loading.set(false);
  }
}
