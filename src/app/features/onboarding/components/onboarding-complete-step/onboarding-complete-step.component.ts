import { Component, computed, inject } from '@angular/core';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-complete-step',
  standalone: true,
  imports: [OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout
      title="You're ready for the week"
      subtitle="Your meal plan, shopping list, and first smart action are ready."
    >
      <div class="card space-y-4 p-6 text-center">
        <p class="text-4xl" aria-hidden="true">🎉</p>
        @if (summary(); as stats) {
          <ul class="space-y-2 text-sm text-stone-700">
            <li>{{ stats.mealsPlanned }} meals planned</li>
            <li>{{ stats.cookingSessions }} cooking sessions</li>
            @if (stats.estimatedTimeSavedMinutes) {
              <li>~{{ stats.estimatedTimeSavedMinutes }} min saved this week</li>
            }
            <li>Shopping list ready</li>
          </ul>
        }
        <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <button type="button" class="btn-primary" (click)="facade.goToDashboard()">
            Go to dashboard
          </button>
          <button type="button" class="btn-secondary" (click)="facade.goToShoppingList()">
            Open shopping list
          </button>
        </div>
      </div>
    </app-onboarding-step-layout>
  `,
})
export class OnboardingCompleteStepComponent {
  readonly facade = inject(OnboardingFacadeService);
  readonly summary = computed(() => this.facade.generatedPlan()?.summary ?? null);
}
