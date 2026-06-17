import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { GENERATING_MESSAGES } from '../../models/onboarding.constants';
import { OnboardingStepLayoutComponent } from '../onboarding-step-layout/onboarding-step-layout.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';

@Component({
  selector: 'app-onboarding-generating-step',
  standalone: true,
  imports: [LoadingStateComponent, OnboardingStepLayoutComponent],
  template: `
    <app-onboarding-step-layout
      title="Creating your first plan…"
      [subtitle]="subtitle()"
    >
      <div class="card flex flex-col items-center p-8 text-center">
        <span class="ai-sparkle text-4xl" aria-hidden="true">✨</span>
        <app-loading-state class="mt-4 block" [message]="message()" />
        @if (facade.error(); as err) {
          <p class="mt-4 text-sm text-red-600" role="alert">{{ err }}</p>
          <button type="button" class="btn-primary mt-4" (click)="retry()">Try again</button>
        }
      </div>
    </app-onboarding-step-layout>
  `,
})
export class OnboardingGeneratingStepComponent implements OnInit, OnDestroy {
  readonly facade = inject(OnboardingFacadeService);
  private readonly messageIndex = signal(0);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  readonly message = computed(
    () => GENERATING_MESSAGES[this.messageIndex() % GENERATING_MESSAGES.length]
  );

  readonly subtitle = computed(() =>
    environment.useLocalApi
      ? 'Generating recipes from your preferences (dev mock).'
      : 'Optimizing meals, leftovers, and shopping list with AI.'
  );

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.messageIndex.update((i) => i + 1);
    }, 2200);

    if (!this.facade.generatedPlan() && !this.facade.isGenerating()) {
      void this.facade.generatePlan();
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  retry(): void {
    void this.facade.generatePlan();
  }
}
