import { Component, computed, input, output, signal } from '@angular/core';
import { MEAL_TYPE_LABELS, MealType } from '../../../../core/models/meal-plan.model';

@Component({
  selector: 'app-meal-slot-completion-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="meal-completion-btn flex w-full min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      [class.meal-completion-btn--incomplete]="!completed()"
      [class.meal-completion-btn--complete]="completed()"
      [class.meal-completion-btn--animating]="animating()"
      [attr.aria-pressed]="completed()"
      [attr.aria-label]="label()"
      [disabled]="loading()"
      (click)="onClick()"
    >
      @if (loading()) {
        <span>Saving…</span>
      } @else if (completed()) {
        <svg
          class="meal-completion-btn__check h-5 w-5 shrink-0"
          [class.meal-completion-btn__check--bounce]="animating()"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        <span>{{ completedLabel() }}</span>
      } @else {
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <span>{{ incompleteLabel() }}</span>
      }
    </button>
  `,
  styleUrl: './meal-slot-completion-button.component.scss',
})
export class MealSlotCompletionButtonComponent {
  readonly mealType = input.required<MealType>();
  readonly completed = input(false);
  readonly loading = input(false);

  readonly toggled = output<void>();

  readonly animating = signal(false);

  readonly incompleteLabel = computed(
    () => `Complete ${MEAL_TYPE_LABELS[this.mealType()].toLowerCase()}`
  );

  readonly completedLabel = computed(
    () => `${MEAL_TYPE_LABELS[this.mealType()]} completed`
  );

  readonly label = computed(() =>
    this.completed() ? this.completedLabel() : this.incompleteLabel()
  );

  onClick(): void {
    if (this.loading()) {
      return;
    }

    this.triggerAnimation();
    this.toggled.emit();
  }

  private triggerAnimation(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.animating.set(true);
    window.setTimeout(() => this.animating.set(false), 320);
  }
}
