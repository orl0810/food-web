import { Component, computed, inject } from '@angular/core';
import { GOAL_OPTIONS } from '../../models/onboarding.constants';
import { UserMealPlanningGoal } from '../../models/onboarding.model';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-goals-step',
  standalone: true,
  imports: [OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout
      title="What should your meal plan help you with?"
      helper="Choose what matters most this week."
    >
      <div class="grid gap-3 sm:grid-cols-2">
        @for (option of options; track option.value) {
          <button
            type="button"
            class="card flex items-start gap-3 p-4 text-left transition-colors hover:border-brand-300"
            [class.border-brand-500]="isSelected(option.value)"
            [class.bg-brand-50]="isSelected(option.value)"
            [attr.aria-pressed]="isSelected(option.value)"
            (click)="toggle(option.value)"
          >
            <span class="text-xl" aria-hidden="true">{{ option.icon }}</span>
            <span class="text-sm font-medium text-stone-800">{{ option.label }}</span>
          </button>
        }
      </div>
    </app-onboarding-step-layout>
  `,
})
export class OnboardingGoalsStepComponent {
  private readonly facade = inject(OnboardingFacadeService);
  readonly options = GOAL_OPTIONS;

  readonly selected = computed(() => this.facade.state()?.goals ?? []);

  isSelected(value: UserMealPlanningGoal): boolean {
    return this.selected().includes(value);
  }

  toggle(value: UserMealPlanningGoal): void {
    const current = [...this.selected()];
    const index = current.indexOf(value);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }
    this.facade.updateGoals(current);
  }
}
