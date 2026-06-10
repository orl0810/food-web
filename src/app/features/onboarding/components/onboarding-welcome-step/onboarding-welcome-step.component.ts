import { Component, inject } from '@angular/core';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-welcome-step',
  standalone: true,
  imports: [OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout
      title="Let's build your first meal plan"
      subtitle="We'll keep it simple. Answer a few quick questions and we'll create a plan you can edit anytime."
    >
      <div class="card p-6 text-center">
        <p class="text-4xl" aria-hidden="true">🍽️</p>
        <p class="mt-3 text-sm text-stone-600">
          Tell us a little bit, and we'll do the hard work for you.
        </p>
        <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" class="btn-primary" (click)="start()">Start planning</button>
          <button type="button" class="btn-secondary" (click)="skip()">Skip for now</button>
        </div>
      </div>
    </app-onboarding-step-layout>
  `,
})
export class OnboardingWelcomeStepComponent {
  private readonly facade = inject(OnboardingFacadeService);

  start(): void {
    void this.facade.start();
  }

  skip(): void {
    void this.facade.skipOnboarding();
  }
}
