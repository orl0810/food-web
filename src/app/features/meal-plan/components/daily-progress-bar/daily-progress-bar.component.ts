import { Component, computed, input } from '@angular/core';
import { DayMealProgress } from '../../models/day-meal-progress.model';

@Component({
  selector: 'app-daily-progress-bar',
  standalone: true,
  template: `
    <section
      class="card bg-cream/60"
      [class.p-3]="compact()"
      [class.p-4]="!compact()"
      [attr.aria-labelledby]="hideTitle() ? null : 'daily-progress-title'"
      [attr.aria-label]="hideTitle() ? title() : null"
    >
      @if (!hideTitle()) {
        <h3 id="daily-progress-title" class="text-base font-semibold text-stone-900">
          {{ title() }}
        </h3>
      }

      <p [class.mt-1]="!hideTitle()" class="text-sm text-stone-600">
        @if (progress().plannedCount === 0) {
          No meals planned for this day
        } @else {
          {{ progress().completedCount }} of {{ progress().plannedCount }} meals consumed
        }
      </p>

      @if (!compact() && readyCount() > 0) {
        <p class="mt-0.5 text-xs text-amber-700">
          {{ readyCount() }} meal{{ readyCount() === 1 ? '' : 's' }} ready to eat
        </p>
      }

      <div class="mt-3 flex items-center gap-3">
        <div
          class="flex-1 overflow-hidden rounded-full bg-stone-200"
          [style.height.px]="compact() ? 8 : 10"
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

      @if (!compact()) {
        <p class="mt-2 text-sm font-medium text-brand-700">{{ progress().message }}</p>
      }
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
  readonly compact = input(false);
  readonly hideTitle = input(false);
  readonly readyCount = input(0);

  readonly progressLabel = computed(
    () => `${this.progress().percentage} percent of meals consumed`
  );
}
