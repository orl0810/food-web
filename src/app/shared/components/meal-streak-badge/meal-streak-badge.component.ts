import { Component, computed, effect, inject, signal } from '@angular/core';
import { MealStreakService } from '../../../core/services/meal-streak.service';

@Component({
  selector: 'app-meal-streak-badge',
  standalone: true,
  styleUrl: './meal-streak-badge.component.scss',
  template: `
    @if (streakService.isLoadingStreak()) {
      <span
        class="inline-flex h-8 w-14 animate-pulse rounded-full border border-stone-200 bg-cream"
        aria-hidden="true"
      ></span>
    } @else {
      <span
        class="meal-streak-badge inline-flex items-center gap-1 rounded-full border border-stone-200 bg-cream px-2.5 py-1 shadow-sm"
        [class.meal-streak-badge--pulse]="pulseActive()"
        [attr.aria-label]="ariaLabel()"
        [attr.title]="tooltip()"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="h-4 w-4 shrink-0 text-amber-500"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z"
          />
        </svg>
        <span class="text-sm font-semibold tabular-nums text-stone-800">{{ streakService.currentStreak() }}</span>
      </span>
    }
  `,
})
export class MealStreakBadgeComponent {
  readonly streakService = inject(MealStreakService);

  private readonly pulseActiveSignal = signal(false);

  readonly pulseActive = this.pulseActiveSignal.asReadonly();

  readonly ariaLabel = computed(() => {
    const count = this.streakService.currentStreak();
    if (count === 0) {
      return 'Start your streak by completing a planned meal today.';
    }
    const dayLabel = count === 1 ? 'day' : 'days';
    return `${count}-${dayLabel} meal streak`;
  });

  readonly tooltip = computed(() => {
    const count = this.streakService.currentStreak();
    if (count === 0) {
      return 'Start your streak by completing a planned meal today.';
    }
    const dayLabel = count === 1 ? 'day' : 'days';
    return `${count}-${dayLabel} meal streak. Complete at least one planned meal today to keep your streak.`;
  });

  constructor() {
    effect(() => {
      if (this.streakService.streakJustIncreased()) {
        this.pulseActiveSignal.set(true);
        const timeout = setTimeout(() => this.pulseActiveSignal.set(false), 700);
        return () => clearTimeout(timeout);
      }
      return undefined;
    });
  }
}
