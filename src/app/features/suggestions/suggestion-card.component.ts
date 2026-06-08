import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SmartSuggestion } from '../../core/models/smart-suggestion.model';

interface BreakdownMetric {
  label: string;
  value: number;
}

@Component({
  selector: 'app-suggestion-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="flex flex-col rounded-xl border border-brand-100 bg-card p-4 shadow-sm">
      <!-- Title + match badge -->
      <div class="flex items-start justify-between gap-3">
        <a
          [routerLink]="['/recipes', suggestion().recipe.id]"
          class="min-w-0 text-base font-semibold text-stone-900 hover:text-brand-700"
        >
          {{ suggestion().recipe.title }}
        </a>
        <span
          class="shrink-0 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-semibold text-amber-950"
        >
          {{ suggestion().matchPercentage }}% match
        </span>
      </div>

      <!-- Prep time + difficulty -->
      @if (suggestion().recipe.prep_time_minutes || suggestion().difficulty) {
        <div class="mt-2 flex items-center gap-1.5 text-sm text-stone-600">
          <svg class="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6v4l2.5 2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          @if (suggestion().recipe.prep_time_minutes) {
            <span>{{ suggestion().recipe.prep_time_minutes }} min</span>
          }
          @if (suggestion().recipe.prep_time_minutes && suggestion().difficulty) {
            <span class="text-stone-300">&middot;</span>
          }
          @if (suggestion().difficulty) {
            <span>{{ suggestion().difficulty }}</span>
          }
        </div>
      }

      <!-- Ingredient availability -->
      <div class="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand-700">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M4 10.5l3.5 3.5L16 6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ availableCount() }}/{{ totalIngredients() }} ingredients available</span>
      </div>

      <!-- Expiring callout -->
      @if (suggestion().expiringIngredientsUsed.length > 0) {
        <div class="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-amber-600">
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="10" cy="10" r="7.5" />
            <path d="M10 6v4.5" stroke-linecap="round" />
            <circle cx="10" cy="13.6" r="0.6" fill="currentColor" stroke="none" />
          </svg>
          <span>
            Uses {{ suggestion().expiringIngredientsUsed.length }} expiring
            {{ suggestion().expiringIngredientsUsed.length === 1 ? 'ingredient' : 'ingredients' }}
          </span>
        </div>

        <div class="mt-2 flex flex-wrap gap-1.5">
          @for (item of suggestion().expiringIngredientsUsed; track item.inventoryFoodId) {
            <span class="rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
              {{ item.inventoryFoodName }}
            </span>
          }
        </div>
      }

      <!-- Score breakdown -->
      <div class="mt-3 rounded-lg bg-cream p-3">
        <p class="text-sm text-stone-500">Score breakdown:</p>
        <div class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-stone-600">
          @for (metric of breakdownMetrics(); track metric.label) {
            <div>
              {{ metric.label }}: <span class="font-semibold text-stone-800">{{ metric.value }}%</span>
            </div>
          }
        </div>
      </div>

      <!-- Recipe tags -->
      @if (suggestion().recipe.tags.length > 0) {
        <div class="mt-3 flex flex-wrap gap-1.5">
          @for (tag of suggestion().recipe.tags; track tag) {
            <span class="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
              {{ tag }}
            </span>
          }
        </div>
      }

      <!-- Action -->
      <button
        type="button"
        class="mt-4 w-full rounded-lg bg-sage px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-dark"
        (click)="addToPlan.emit(suggestion())"
      >
        Add to meal plan
      </button>
    </article>
  `,
})
export class SuggestionCardComponent {
  readonly suggestion = input.required<SmartSuggestion>();
  readonly addToPlan = output<SmartSuggestion>();

  readonly availableCount = computed(
    () => this.suggestion().availableIngredients.length
  );

  readonly totalIngredients = computed(
    () =>
      this.suggestion().availableIngredients.length +
      this.suggestion().missingIngredients.length
  );

  readonly breakdownMetrics = computed<BreakdownMetric[]>(() => {
    const breakdown = this.suggestion().scoreBreakdown;
    return [
      { label: 'Inventory', value: breakdown.inventory },
      { label: 'Expiring', value: breakdown.expiring },
      { label: 'Time', value: breakdown.time },
      { label: 'Variety', value: breakdown.variety },
    ];
  });
}
