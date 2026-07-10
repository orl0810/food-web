import { Component, computed, input, output, signal } from '@angular/core';
import { DayMealProgress } from '../../../features/meal-plan/models/day-meal-progress.model';
import { DailyProgressBarComponent } from '../../../features/meal-plan/components/daily-progress-bar/daily-progress-bar.component';
import {
  NutritionProgressItem,
  NutritionProgressStatus,
  TodayNutritionProgress,
  TodayProgressMode,
} from '../../../core/models/nutrition.model';
import { isToday } from '../../utils/meal-plan.utils';

@Component({
  selector: 'app-today-progress-switcher',
  standalone: true,
  imports: [DailyProgressBarComponent],
  template: `
    <section
      class="today-progress-switcher card bg-cream/60"
      [class.p-3]="compact()"
      [class.p-4]="!compact()"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
    >
      <div
        class="mb-3 flex items-center justify-between gap-3"
        role="radiogroup"
        aria-label="Progress view mode"
      >
        <div class="inline-flex rounded-lg bg-stone-100 p-1">
          <button
            type="button"
            class="today-progress-switcher__mode-btn"
            role="radio"
            [attr.aria-checked]="mode() === 'meals'"
            [class.today-progress-switcher__mode-btn--active]="mode() === 'meals'"
            (click)="setMode('meals')"
          >
            Meals
          </button>
          <button
            type="button"
            class="today-progress-switcher__mode-btn"
            role="radio"
            [attr.aria-checked]="mode() === 'nutrition'"
            [class.today-progress-switcher__mode-btn--active]="mode() === 'nutrition'"
            (click)="setMode('nutrition')"
          >
            Nutrition
          </button>
        </div>
      </div>

      @if (mode() === 'meals') {
        <app-daily-progress-bar
          [title]="title()"
          [progress]="mealProgress()"
          [compact]="compact()"
          [hideTitle]="hideTitle()"
          [readyCount]="readyCount()"
        />
      } @else if (isLoading()) {
        <p class="text-sm text-stone-600">Loading nutrition progress...</p>
      } @else if (!isNutritionProfileComplete()) {
        <div class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-stone-900">Nutrition progress</h3>
            <p class="mt-1 text-sm text-stone-600">
              Set up your nutrition profile to see personalized daily targets.
            </p>
          </div>
          <div class="rounded-xl border border-dashed border-stone-200 bg-white/60 p-4">
            <p class="text-sm font-medium text-stone-900">Set up your nutrition profile</p>
            <p class="mt-1 text-sm text-stone-600">
              Add your weight, height, activity level, and goal to calculate your daily nutrition targets.
            </p>
            <button
              type="button"
              class="btn-primary-sm mt-4"
              (click)="onCompleteProfileClick()"
            >
              Complete profile
            </button>
          </div>
        </div>
      } @else {
        <div class="space-y-4">
          <div>
            <h3 class="text-base font-semibold text-stone-900">Nutrition progress</h3>
            <p class="mt-1 text-sm text-stone-600">{{ nutritionSubtitle() }}</p>
          </div>

          @for (item of nutritionItems(); track item.key) {
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm font-medium text-stone-900">{{ item.label }}</span>
                <span class="text-sm text-stone-600 tabular-nums">
                  {{ formatAmount(item.consumed) }}g
                  @if (item.isUpperLimit) {
                    of {{ formatAmount(item.target) }}g limit
                  } @else {
                    of {{ formatAmount(item.target) }}g
                  }
                </span>
              </div>

              <div class="flex items-center gap-3">
                <div
                  class="flex-1 overflow-hidden rounded-full bg-stone-200"
                  [style.height.px]="compact() ? 8 : 10"
                  role="progressbar"
                  [attr.aria-valuenow]="item.percentage"
                  aria-valuemin="0"
                  [attr.aria-valuemax]="item.isUpperLimit ? 100 : item.percentage > 100 ? item.percentage : 100"
                  [attr.aria-label]="nutritionProgressLabel(item)"
                >
                  <div
                    class="today-progress-switcher__fill h-full rounded-full"
                    [class]="barClass(item)"
                    [style.width.%]="barWidth(item)"
                  ></div>
                </div>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  [class]="statusClass(item.status)"
                >
                  {{ statusLabel(item.status) }}
                </span>
              </div>

              @if (item.hint) {
                <p class="text-xs text-stone-600">{{ item.hint }}</p>
              }
            </div>
          }

          @if (nutritionProgress()?.hasMissingNutritionData) {
            <p class="text-xs text-amber-700">Some meals are missing nutrition data.</p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .today-progress-switcher__mode-btn {
      border-radius: 0.5rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: rgb(87 83 78);
      transition: background-color 150ms ease, color 150ms ease;
    }

    .today-progress-switcher__mode-btn--active {
      background: white;
      color: rgb(28 25 23);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
    }

    .today-progress-switcher__fill {
      transition: width 300ms ease-out;
    }

    @media (prefers-reduced-motion: reduce) {
      .today-progress-switcher__fill {
        transition: none;
      }
    }
  `,
})
export class TodayProgressSwitcherComponent {
  readonly title = input.required<string>();
  readonly selectedDate = input.required<string>();
  readonly mealProgress = input.required<DayMealProgress>();
  readonly nutritionProgress = input<TodayNutritionProgress | null>(null);
  readonly isNutritionProfileComplete = input(false);
  readonly isLoading = input(false);
  readonly compact = input(false);
  readonly hideTitle = input(false);
  readonly readyCount = input(0);

  readonly modeChanged = output<TodayProgressMode>();
  readonly completeProfileClicked = output<void>();

  readonly mode = signal<TodayProgressMode>('meals');

  private pointerStartX = 0;
  private pointerStartY = 0;
  private pointerTracking = false;
  private swipeLocked = false;

  readonly nutritionItems = computed(() => this.nutritionProgress()?.items ?? []);

  readonly nutritionSubtitle = computed(() => {
    if (isToday(this.selectedDate())) {
      return "Based on what you've consumed today";
    }
    return 'Based on what you consumed on this day';
  });

  setMode(next: TodayProgressMode): void {
    if (this.mode() === next) {
      return;
    }
    this.mode.set(next);
    this.modeChanged.emit(next);
  }

  onCompleteProfileClick(): void {
    this.completeProfileClicked.emit();
  }

  formatAmount(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  nutritionProgressLabel(item: NutritionProgressItem): string {
    if (item.isUpperLimit) {
      return `${item.label}: ${item.consumed} grams of ${item.target} gram limit`;
    }
    return `${item.label}: ${item.consumed} grams of ${item.target} gram target`;
  }

  barWidth(item: NutritionProgressItem): number {
    if (item.isUpperLimit) {
      return Math.min(item.percentage, 100);
    }
    return Math.min(item.percentage, 100);
  }

  barClass(item: NutritionProgressItem): string {
    if (item.isUpperLimit) {
      if (item.status === 'over') {
        return 'bg-pantry-coral';
      }
      if (item.status === 'reached') {
        return 'bg-pantry-amber';
      }
      return 'bg-brand-600';
    }

    switch (item.status) {
      case 'low':
        return 'bg-pantry-amber';
      case 'over':
        return 'bg-pantry-coral';
      case 'reached':
        return 'bg-brand-600';
      default:
        return 'bg-brand-600';
    }
  }

  statusClass(status: NutritionProgressStatus): string {
    switch (status) {
      case 'low':
        return 'bg-amber-50 text-amber-800';
      case 'over':
        return 'bg-pantry-beige text-pantry-coral';
      case 'reached':
        return 'bg-brand-50 text-brand-800';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  }

  statusLabel(status: NutritionProgressStatus): string {
    switch (status) {
      case 'low':
        return 'Low';
      case 'on_track':
        return 'On track';
      case 'reached':
        return 'Reached';
      case 'over':
        return 'Over target';
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
    this.pointerTracking = true;
    this.swipeLocked = false;
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.pointerTracking || this.swipeLocked) {
      return;
    }

    const deltaX = event.clientX - this.pointerStartX;
    const deltaY = event.clientY - this.pointerStartY;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      this.swipeLocked = true;
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.pointerTracking || this.swipeLocked) {
      this.pointerTracking = false;
      return;
    }

    const deltaX = event.clientX - this.pointerStartX;
    const threshold = 48;

    if (deltaX <= -threshold) {
      this.setMode('nutrition');
    } else if (deltaX >= threshold) {
      this.setMode('meals');
    }

    this.pointerTracking = false;
  }
}
