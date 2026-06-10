import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import { INPUT_STEPS, ONBOARDING_STEPS } from '../models/onboarding.constants';
import { DietaryPreference } from '../../../core/models/user-profile.model';
import {
  CookingEffortPreference,
  GeneratedOnboardingMealPlan,
  MealSlotType,
  OnboardingInventoryInput,
  OnboardingState,
  OnboardingStep,
  UserMealPlanningGoal,
} from '../models/onboarding.model';
import { OnboardingPlanGeneratorService } from './onboarding-plan-generator.service';

@Injectable({ providedIn: 'root' })
export class OnboardingFacadeService {
  private readonly authService = inject(AuthService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly generator = inject(OnboardingPlanGeneratorService);
  private readonly router = inject(Router);

  private readonly stateSignal = signal<OnboardingState | null>(null);
  private readonly isGeneratingSignal = signal(false);
  private readonly isConfirmingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly initializedSignal = signal(false);

  readonly state = this.stateSignal.asReadonly();
  readonly currentStep = computed(() => this.stateSignal()?.currentStep ?? 'welcome');
  readonly generatedPlan = computed(() => this.stateSignal()?.generatedPlan ?? null);
  readonly isGenerating = this.isGeneratingSignal.asReadonly();
  readonly isConfirming = this.isConfirmingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly initialized = this.initializedSignal.asReadonly();

  readonly progress = computed(() => {
    const step = this.currentStep();
    const index = ONBOARDING_STEPS.indexOf(step);
    if (index < 0) return 0;
    if (step === 'generating') return 85;
    if (step === 'review_plan') return 92;
    if (step === 'complete') return 100;
    if (step === 'welcome') return 5;
    const inputIndex = INPUT_STEPS.indexOf(step as OnboardingStep);
    if (inputIndex >= 0) {
      return 10 + Math.round(((inputIndex + 1) / INPUT_STEPS.length) * 60);
    }
    return Math.round((index / (ONBOARDING_STEPS.length - 1)) * 100);
  });

  readonly canContinue = computed(() => {
    const state = this.stateSignal();
    if (!state) return false;
    switch (state.currentStep) {
      case 'welcome':
        return true;
      case 'goals':
        return state.goals.length > 0;
      case 'preferences':
        return true;
      case 'avoidances':
        return true;
      case 'cooking_effort':
        return !!state.cookingEffort;
      case 'meal_slots':
        return state.selectedMealSlots.length > 0 && state.planningDays > 0;
      case 'inventory':
        return true;
      case 'review_plan':
        return !!state.generatedPlan;
      default:
        return false;
    }
  });

  readonly canGoBack = computed(() => {
    const step = this.currentStep();
    return step !== 'welcome' && step !== 'generating' && step !== 'complete';
  });

  readonly isOptionalStep = computed(() => {
    const step = this.currentStep();
    return step === 'preferences' || step === 'avoidances' || step === 'inventory';
  });

  async init(restart = false): Promise<void> {
    const userId = this.authService.user()?.id;
    if (!userId) return;

    const statusResponse = await this.onboardingService.getStatus();
    let state = this.onboardingService.stateFromDraft(
      userId,
      restart ? 'in_progress' : statusResponse.status,
      statusResponse.draft,
      restart ? 'welcome' : statusResponse.currentStep
    );

    if (restart) {
      await this.onboardingService.restart();
      state = { ...state, status: 'in_progress', currentStep: 'welcome', generatedPlan: undefined };
    } else if (state.status === 'pending') {
      await this.onboardingService.start();
      state = { ...state, status: 'in_progress' };
    }

    this.stateSignal.set(state);
    this.initializedSignal.set(true);
  }

  async start(): Promise<void> {
    await this.onboardingService.start();
    this.updateState({ currentStep: 'goals', status: 'in_progress' });
    await this.persist();
  }

  async nextStep(): Promise<void> {
    const state = this.stateSignal();
    if (!state) return;

    const index = ONBOARDING_STEPS.indexOf(state.currentStep);
    if (index < 0 || index >= ONBOARDING_STEPS.length - 1) return;

    let next = ONBOARDING_STEPS[index + 1];

    if (state.currentStep === 'inventory') {
      await this.generatePlan();
      return;
    }

    this.updateState({ currentStep: next });
    await this.persist();
  }

  async previousStep(): Promise<void> {
    const state = this.stateSignal();
    if (!state) return;
    const index = ONBOARDING_STEPS.indexOf(state.currentStep);
    if (index <= 0) return;
    let prev = ONBOARDING_STEPS[index - 1];
    if (state.currentStep === 'review_plan') {
      prev = 'inventory';
    }
    this.updateState({ currentStep: prev });
    await this.persist();
  }

  async skipStep(): Promise<void> {
    const state = this.stateSignal();
    if (!state) return;

    if (state.currentStep === 'preferences') {
      this.updateState({ dietaryPreferences: ['none'] });
    }

    await this.nextStep();
  }

  updateGoals(goals: UserMealPlanningGoal[]): void {
    this.updateState({ goals });
  }

  updatePreferences(preferences: DietaryPreference[]): void {
    const normalized =
      preferences.length === 0
        ? ['none' as DietaryPreference]
        : preferences.includes('none' as DietaryPreference) && preferences.length > 1
          ? preferences.filter((p) => p !== 'none')
          : preferences;
    this.updateState({ dietaryPreferences: normalized });
  }

  updateAvoidances(disliked: string[], allergies: string[]): void {
    this.updateState({ dislikedIngredients: disliked, allergies });
  }

  updateCookingEffort(effort: CookingEffortPreference): void {
    this.updateState({ cookingEffort: effort });
  }

  updateMealSlots(slots: MealSlotType[], planningDays: number): void {
    this.updateState({ selectedMealSlots: slots, planningDays });
  }

  updateInventory(items: OnboardingInventoryInput[]): void {
    this.updateState({ availableInventoryItems: items });
  }

  async generatePlan(): Promise<void> {
    const state = this.stateSignal();
    if (!state) return;

    this.isGeneratingSignal.set(true);
    this.errorSignal.set(null);
    this.updateState({ currentStep: 'generating' });

    try {
      const plan = await this.generator.generate(state);
      this.updateState({ generatedPlan: plan, currentStep: 'review_plan' });
      await this.persist();
    } catch (error) {
      this.errorSignal.set(
        error instanceof Error ? error.message : 'Could not generate your plan. Please try again.'
      );
      this.updateState({ currentStep: 'inventory' });
    } finally {
      this.isGeneratingSignal.set(false);
    }
  }

  async regeneratePlan(): Promise<void> {
    await this.generatePlan();
  }

  updateGeneratedPlan(plan: GeneratedOnboardingMealPlan): void {
    this.updateState({ generatedPlan: plan });
    void this.persist();
  }

  async confirmPlan(): Promise<{ error: string | null }> {
    const state = this.stateSignal();
    if (!state?.generatedPlan) {
      return { error: 'No plan to confirm.' };
    }

    this.isConfirmingSignal.set(true);
    this.errorSignal.set(null);

    const result = await this.onboardingService.confirmPlan(state, state.generatedPlan);
    this.isConfirmingSignal.set(false);

    if (result.error) {
      this.errorSignal.set(result.error);
      return result;
    }

    this.updateState({ status: 'completed', currentStep: 'complete' });
    return { error: null };
  }

  async skipOnboarding(): Promise<void> {
    await this.onboardingService.skip();
    this.updateState({ status: 'skipped', currentStep: 'welcome' });
    await this.router.navigateByUrl('/dashboard');
  }

  goToDashboard(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  goToShoppingList(): void {
    void this.router.navigateByUrl('/shopping-list');
  }

  private updateState(partial: Partial<OnboardingState>): void {
    const current = this.stateSignal();
    if (!current) return;
    this.stateSignal.set({
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  }

  private async persist(): Promise<void> {
    const state = this.stateSignal();
    if (!state) return;
    const { error } = await this.onboardingService.patchState(
      this.onboardingService.draftFromState(state)
    );
    if (error) {
      this.errorSignal.set(error);
    }
  }
}
