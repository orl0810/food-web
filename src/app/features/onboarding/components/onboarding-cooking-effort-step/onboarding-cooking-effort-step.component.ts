import { Component, computed, inject } from '@angular/core';
import { COOKING_EFFORT_OPTIONS } from '../../models/onboarding.constants';
import { CookingEffortPreference } from '../../models/onboarding.model';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-cooking-effort-step',
  standalone: true,
  imports: [OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout title="How much do you want to cook this week?">
      <div class="space-y-3">
        @for (option of options; track option.value) {
          <button
            type="button"
            class="card w-full p-4 text-left transition-colors"
            [class.border-brand-500]="selected() === option.value"
            [class.bg-brand-50]="selected() === option.value"
            [attr.aria-pressed]="selected() === option.value"
            (click)="select(option.value)"
          >
            <p class="font-medium text-stone-900">{{ option.label }}</p>
            <p class="mt-1 text-sm text-stone-600">{{ option.description }}</p>
          </button>
        }
      </div>
    </app-onboarding-step-layout>
  `,
})
export class OnboardingCookingEffortStepComponent {
  private readonly facade = inject(OnboardingFacadeService);
  readonly options = COOKING_EFFORT_OPTIONS;
  readonly selected = computed(() => this.facade.state()?.cookingEffort ?? 'two_cooking_sessions');

  select(value: CookingEffortPreference): void {
    this.facade.updateCookingEffort(value);
  }
}
