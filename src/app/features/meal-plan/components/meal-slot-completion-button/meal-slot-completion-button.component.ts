import { Component, computed, input, output, signal } from '@angular/core';
import { MEAL_TYPE_LABELS, MealType } from '../../../../core/models/meal-plan.model';

@Component({
  selector: 'app-meal-slot-completion-button',
  standalone: true,
  template: `
    <button
      type="button"
      role="switch"
      class="meal-completion-toggle"
      [class.meal-completion-toggle--on]="completed()"
      [class.meal-completion-toggle--animating]="animating()"
      [attr.aria-checked]="completed()"
      [attr.aria-label]="label()"
      [disabled]="loading()"
      (click)="onClick()"
    >
      <span class="meal-completion-toggle__track" aria-hidden="true">
        <span class="meal-completion-toggle__thumb"></span>
      </span>
      @if (loading()) {
        <span class="sr-only">Saving…</span>
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

  readonly label = computed(() => {
    const meal = MEAL_TYPE_LABELS[this.mealType()].toLowerCase();
    return this.completed()
      ? `Mark ${meal} as not completed`
      : `Mark ${meal} as completed`;
  });

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
