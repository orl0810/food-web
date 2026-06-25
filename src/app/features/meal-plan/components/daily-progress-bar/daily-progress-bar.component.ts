import { Component, computed, input } from '@angular/core';
import { DayMealProgress } from '../../models/day-meal-progress.model';

@Component({
  selector: 'app-daily-progress-bar',
  standalone: true,
  template: `
    <section class="card bg-cream/60 p-4" aria-labelledby="daily-progress-title">
      <h3 id="daily-progress-title" class="text-base font-semibold text-stone-900">
        {{ title() }}
      </h3>

      <p class="mt-1 text-sm text-stone-600">
        @if (progress().plannedCount === 0) {
          No meals planned for this day
        } @else {
          {{ progress().completedCount }} of {{ progress().plannedCount }} planned meals completed
        }
      </p>

      <div class="mt-3 flex items-center gap-3">
        <div
          class="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-200"
          role="progressbar"
          [attr.aria-valuenow]="progress().percentage"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-label]="progressLabel()"
        >
          <div
            class="daily-progress-bar__fill h-full rounded-full bg-brand-600"
            [style.width.%]="progress().percentage"
          ></div>
        </div>
        <span class="shrink-0 text-sm font-semibold text-brand-700 tabular-nums">
          {{ progress().percentage }}%
        </span>
      </div>

      <p class="mt-2 text-sm font-medium text-brand-700">{{ progress().message }}</p>
    </section>
  `,
  styles: `
    .daily-progress-bar__fill {
      transition: width 300ms ease-out;
    }

    @media (prefers-reduced-motion: reduce) {
      .daily-progress-bar__fill {
        transition: none;
      }
    }
  `,
})
export class DailyProgressBarComponent {
  readonly title = input.required<string>();
  readonly progress = input.required<DayMealProgress>();

  readonly progressLabel = computed(
    () => `${this.progress().percentage} percent of planned meals completed`
  );
}
