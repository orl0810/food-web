import { Component, effect, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LoadingStateComponent } from '../../../../shared/components/loading-state/loading-state.component';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';
import { OnboardingAvoidancesStepComponent } from '../onboarding-avoidances-step/onboarding-avoidances-step.component';
import { OnboardingCompleteStepComponent } from '../onboarding-complete-step/onboarding-complete-step.component';
import { OnboardingCookingEffortStepComponent } from '../onboarding-cooking-effort-step/onboarding-cooking-effort-step.component';
import { OnboardingGeneratingStepComponent } from '../onboarding-generating-step/onboarding-generating-step.component';
import { OnboardingGoalsStepComponent } from '../onboarding-goals-step/onboarding-goals-step.component';
import { OnboardingInventoryStepComponent } from '../onboarding-inventory-step/onboarding-inventory-step.component';
import { OnboardingMealSlotsStepComponent } from '../onboarding-meal-slots-step/onboarding-meal-slots-step.component';
import { OnboardingPreferencesStepComponent } from '../onboarding-preferences-step/onboarding-preferences-step.component';
import { OnboardingReviewPlanStepComponent } from '../onboarding-review-plan-step/onboarding-review-plan-step.component';
import { OnboardingWelcomeStepComponent } from '../onboarding-welcome-step/onboarding-welcome-step.component';

@Component({
  selector: 'app-onboarding-shell',
  standalone: true,
  imports: [
    LoadingStateComponent,
    OnboardingWelcomeStepComponent,
    OnboardingGoalsStepComponent,
    OnboardingPreferencesStepComponent,
    OnboardingAvoidancesStepComponent,
    OnboardingCookingEffortStepComponent,
    OnboardingMealSlotsStepComponent,
    OnboardingInventoryStepComponent,
    OnboardingGeneratingStepComponent,
    OnboardingReviewPlanStepComponent,
    OnboardingCompleteStepComponent,
  ],
  template: `
    <div class="min-h-screen bg-surface px-4 py-8">
      <div class="mx-auto max-w-2xl">
        <div class="mb-6 flex items-center justify-between gap-4">
          <span class="text-lg font-semibold text-brand-700">PantryFlow</span>
          @if (showProgress()) {
            <div class="flex-1 max-w-xs">
              <div
                class="h-2 overflow-hidden rounded-full bg-stone-200"
                role="progressbar"
                [attr.aria-valuenow]="facade.progress()"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-label]="'Onboarding progress ' + facade.progress() + ' percent'"
              >
                <div
                  class="h-full rounded-full bg-brand-600 transition-all duration-300"
                  [style.width.%]="facade.progress()"
                ></div>
              </div>
            </div>
          }
        </div>

        @if (!facade.initialized()) {
          <app-loading-state message="Loading onboarding…" />
        } @else {
          @switch (facade.currentStep()) {
            @case ('welcome') {
              <app-onboarding-welcome-step />
            }
            @case ('goals') {
              <app-onboarding-goals-step />
            }
            @case ('preferences') {
              <app-onboarding-preferences-step />
            }
            @case ('avoidances') {
              <app-onboarding-avoidances-step />
            }
            @case ('cooking_effort') {
              <app-onboarding-cooking-effort-step />
            }
            @case ('meal_slots') {
              <app-onboarding-meal-slots-step />
            }
            @case ('inventory') {
              <app-onboarding-inventory-step />
            }
            @case ('generating') {
              <app-onboarding-generating-step />
            }
            @case ('review_plan') {
              <app-onboarding-review-plan-step />
            }
            @case ('complete') {
              <app-onboarding-complete-step />
            }
          }

          @if (showNav()) {
            <footer class="mt-8 flex items-center justify-between gap-4 border-t border-stone-200 pt-6">
              <div>
                @if (facade.canGoBack()) {
                  <button type="button" class="btn-secondary" (click)="back()">Back</button>
                }
              </div>
              <div class="flex gap-3">
                @if (facade.isOptionalStep()) {
                  <button type="button" class="btn-secondary" (click)="skipStep()">Skip</button>
                }
                @if (showContinue()) {
                  <button
                    type="button"
                    class="btn-primary"
                    [disabled]="!facade.canContinue()"
                    (click)="continue()"
                  >
                    Continue
                  </button>
                }
              </div>
            </footer>
          }
        }
      </div>
    </div>
  `,
})
export class OnboardingShellComponent implements OnInit {
  readonly facade = inject(OnboardingFacadeService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    effect(() => {
      this.facade.currentStep();
      window.scrollTo(0, 0);
    });
  }

  ngOnInit(): void {
    const restart = this.route.snapshot.queryParamMap.get('restart') === 'true';
    void this.facade.init(restart);
  }

  showProgress(): boolean {
    const step = this.facade.currentStep();
    return step !== 'welcome' && step !== 'complete';
  }

  showNav(): boolean {
    const step = this.facade.currentStep();
    return (
      step !== 'welcome' &&
      step !== 'generating' &&
      step !== 'review_plan' &&
      step !== 'complete'
    );
  }

  showContinue(): boolean {
    return this.facade.currentStep() !== 'welcome';
  }

  continue(): void {
    void this.facade.nextStep();
  }

  back(): void {
    void this.facade.previousStep();
  }

  skipStep(): void {
    void this.facade.skipStep();
  }
}
