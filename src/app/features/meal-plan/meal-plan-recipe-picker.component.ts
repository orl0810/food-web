import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MEAL_TYPE_LABELS, MealType } from '../../core/models/meal-plan.model';
import { RecipeService } from '../../core/services/recipe.service';
import { FormatTagPipe } from '../../shared/pipes/format-tag.pipe';
import { formatTagLabel } from '../../shared/utils/tag.utils';
import { formatDayLabel } from '../../shared/utils/meal-plan.utils';

@Component({
  selector: 'app-meal-plan-recipe-picker',
  standalone: true,
  imports: [RouterLink, FormatTagPipe],
  template: `
    <div class="card-featured p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Choose a recipe</h3>
          <p class="mt-0.5 text-sm text-stone-600">
            {{ formatDayLabel(date()) }} · {{ mealTypeLabel() }}
          </p>
        </div>
        <button
          type="button"
          class="self-start rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-white"
          (click)="cancelled.emit()"
        >
          Cancel
        </button>
      </div>

      <div class="mt-4 space-y-3">
        <input
          type="search"
          [value]="search()"
          (input)="onSearch($event)"
          placeholder="Search by title..."
          class="input"
        />

        @if (recipeService.allTags().length > 0) {
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="filter-pill"
              [class.filter-pill-active]="activeTag() === null"
              [class.filter-pill-inactive]="activeTag() !== null"
              (click)="activeTag.set(null)"
            >
              All tags
            </button>
            @for (tag of recipeService.allTags(); track tag) {
              <button
                type="button"
                class="filter-pill"
                [class.filter-pill-active]="activeTag() === tag"
                [class.filter-pill-inactive]="activeTag() !== tag"
                (click)="activeTag.set(tag)"
              >
                {{ tag | formatTag }}
              </button>
            }
          </div>
        }
      </div>

      @if (recipeService.loading()) {
        <p class="mt-4 text-sm text-stone-600">Loading recipes...</p>
      } @else if (recipeService.recipes().length === 0) {
        <div class="mt-4 rounded-lg border border-dashed border-stone-300 bg-white px-4 py-6 text-center">
          <p class="text-sm font-medium text-stone-900">No recipes found. Create a recipe first.</p>
          <a
            routerLink="/recipes/new"
            class="mt-3 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            New recipe
          </a>
        </div>
      } @else if (filteredRecipes().length === 0) {
        <p class="mt-4 rounded-lg bg-white px-4 py-3 text-sm text-stone-600">
          No recipes found. Create a recipe first.
        </p>
      } @else {
        <ul class="mt-4 max-h-64 space-y-2 overflow-auto">
          @for (recipe of filteredRecipes(); track recipe.id) {
            <li>
              <button
                type="button"
                class="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50/50"
                (click)="selected.emit(recipe.id)"
              >
                <span class="block text-sm font-medium text-stone-900">{{ recipe.title }}</span>
                @if (recipe.tags.length > 0) {
                  <span class="mt-1 block text-xs text-stone-500">
                    {{ formatTagsList(recipe.tags) }}
                  </span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class MealPlanRecipePickerComponent implements OnInit {
  readonly date = input.required<string>();
  readonly mealType = input.required<MealType>();

  readonly selected = output<string>();
  readonly cancelled = output<void>();

  readonly recipeService = inject(RecipeService);

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

  mealTypeLabel(): string {
    return MEAL_TYPE_LABELS[this.mealType()];
  }

  formatDayLabel(date: string): string {
    return formatDayLabel(date);
  }

  formatTagsList(tags: string[]): string {
    return tags.map((tag) => formatTagLabel(tag)).join(', ');
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }
}
