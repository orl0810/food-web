import { Component, input, OnDestroy, OnInit, output } from '@angular/core';
import { STARTER_RECIPE_TAG_FILTERS } from '../../core/models/recipe.model';
import { FormatTagPipe } from '../../shared/pipes/format-tag.pipe';

@Component({
  selector: 'app-recipe-filters-dialog',
  standalone: true,
  imports: [FormatTagPipe],
  template: `
    <div
      class="fixed inset-0 z-dialog-elevated flex items-end justify-center bg-stone-900/50 p-4 sm:items-center"
      (click)="closed.emit()"
    >
      <div
        class="card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-filters-title"
        (click)="$event.stopPropagation()"
      >
        <div class="shrink-0 border-b border-stone-200 px-5 py-4">
          <h2 id="recipe-filters-title" class="text-lg font-semibold text-stone-900">Filters</h2>
          <p class="mt-1 text-sm text-stone-600">Search recipes and filter by tags.</p>
        </div>

        <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <label for="recipe-search-filter" class="mb-2 block text-sm font-medium text-stone-700">
              Search
            </label>
            <input
              id="recipe-search-filter"
              type="search"
              [value]="search()"
              (input)="onSearchInput($event)"
              placeholder="Search by name or ingredient..."
              class="input"
            />
          </div>

          <div>
            <p class="mb-2 text-sm font-medium text-stone-700">Tags</p>
            <div class="flex flex-wrap gap-2">
              @for (tag of tagFilters; track tag) {
                <button
                  type="button"
                  class="filter-pill"
                  [class.filter-pill-active]="activeTags().includes(tag)"
                  [class.filter-pill-inactive]="!activeTags().includes(tag)"
                  (click)="tagToggled.emit(tag)"
                >
                  {{ tag | formatTag }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="flex shrink-0 justify-end gap-3 border-t border-stone-200 px-5 py-4">
          <button type="button" class="btn-secondary" (click)="cleared.emit()">Clear filters</button>
          <button type="button" class="btn-primary" (click)="closed.emit()">Done</button>
        </div>
      </div>
    </div>
  `,
})
export class RecipeFiltersDialogComponent implements OnInit, OnDestroy {
  readonly search = input.required<string>();
  readonly activeTags = input.required<string[]>();

  readonly searchChanged = output<string>();
  readonly tagToggled = output<string>();
  readonly cleared = output<void>();
  readonly closed = output<void>();

  readonly tagFilters = STARTER_RECIPE_TAG_FILTERS;

  ngOnInit(): void {
    document.body.classList.add('overflow-hidden');
  }

  ngOnDestroy(): void {
    document.body.classList.remove('overflow-hidden');
  }

  onSearchInput(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }
}
