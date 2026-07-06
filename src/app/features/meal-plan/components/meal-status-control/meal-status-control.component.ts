import { Component, computed, input, output, signal } from '@angular/core';
import { MealSlotItemStatus } from '../../../../core/models/meal-slot-item.model';
import { MEAL_TYPE_LABELS, MealType } from '../../../../core/models/meal-plan.model';
import {
  getMealStatusUiConfig,
  getTargetStatusForPrimaryAction,
  getTargetStatusForSecondaryAction,
  MealSlotDisplayStatus,
} from '../../utils/meal-slot-status.utils';

@Component({
  selector: 'app-meal-status-control',
  standalone: true,
  template: `
    @if (uiConfig(); as config) {
      <div class="meal-status-control">
        <span
          class="meal-status-control__pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          [class]="config.pillClass"
        >
          @switch (displayStatus()) {
            @case ('planned') {
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
            }
            @case ('ready') {
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.38a48.474 48.474 0 0 0-6-.37c-2.032 0-3.963.175-5.771.48M3 16.5V18.75A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
              </svg>
            }
            @case ('consumed') {
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-3.5 w-3.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            }
          }
          {{ config.label }}
        </span>

        <div class="meal-status-control__actions">
          @if (config.primaryActionLabel) {
            <button
              type="button"
              class="meal-status-control__primary"
              [class.meal-status-control__primary--animating]="animating()"
              [attr.aria-label]="primaryAriaLabel()"
              [disabled]="loading()"
              (click)="onPrimaryAction()"
            >
              {{ config.primaryActionLabel }}
            </button>
          }

          @if (config.secondaryActionLabel) {
            <button
              type="button"
              class="meal-status-control__secondary"
              [attr.aria-label]="secondaryAriaLabel()"
              [disabled]="loading()"
              (click)="onSecondaryAction()"
            >
              {{ config.secondaryActionLabel }}
            </button>
          }
        </div>

        @if (loading()) {
          <span class="sr-only">Saving…</span>
        }
      </div>
    }
  `,
  styleUrl: './meal-status-control.component.scss',
})
export class MealStatusControlComponent {
  readonly mealType = input.required<MealType>();
  readonly displayStatus = input.required<MealSlotDisplayStatus>();
  readonly loading = input(false);

  readonly statusChange = output<MealSlotItemStatus>();

  readonly animating = signal(false);

  readonly uiConfig = computed(() => getMealStatusUiConfig(this.displayStatus()));

  readonly primaryAriaLabel = computed(() => {
    const meal = MEAL_TYPE_LABELS[this.mealType()].toLowerCase();
    const action = this.uiConfig()?.primaryActionLabel;
    return action ? `${action} for ${meal}` : '';
  });

  readonly secondaryAriaLabel = computed(() => {
    const meal = MEAL_TYPE_LABELS[this.mealType()].toLowerCase();
    const action = this.uiConfig()?.secondaryActionLabel;
    return action ? `${action} for ${meal}` : '';
  });

  onPrimaryAction(): void {
    if (this.loading()) {
      return;
    }

    const next = getTargetStatusForPrimaryAction(this.displayStatus());
    if (!next) {
      return;
    }

    this.triggerAnimation();
    this.statusChange.emit(next);
  }

  onSecondaryAction(): void {
    if (this.loading()) {
      return;
    }

    const next = getTargetStatusForSecondaryAction(this.displayStatus());
    if (!next) {
      return;
    }

    this.statusChange.emit(next);
  }

  private triggerAnimation(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.animating.set(true);
    window.setTimeout(() => this.animating.set(false), 320);
  }
}
