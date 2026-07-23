import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { OnboardingService } from '../../../core/services/onboarding.service';
import {
  GeneratedOnboardingMealPlan,
  OnboardingState,
} from '../models/onboarding.model';
import { OnboardingFacadeService } from './onboarding-facade.service';
import { OnboardingPlanGeneratorService } from './onboarding-plan-generator.service';

function plan(recipeName = 'Original Recipe'): GeneratedOnboardingMealPlan {
  return {
    weekStartDate: '2026-01-05',
    days: [
      {
        date: '2026-01-05',
        dayName: 'Monday',
        meals: [
          {
            slot: 'dinner',
            items: [
              {
                type: 'recipe',
                name: recipeName,
                tempRecipeKey: recipeName === 'Original Recipe' ? 'original-key' : 'new-key',
              },
            ],
          },
        ],
      },
    ],
    shoppingListItems: [],
    preparedPortionSuggestions: [],
    cookingSessions: [],
    summary: {
      mealsPlanned: 1,
      cookingSessions: 0,
      generatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

function state(generatedPlan: GeneratedOnboardingMealPlan): OnboardingState {
  return {
    userId: 'user-1',
    status: 'in_progress',
    currentStep: 'review_plan',
    goals: [],
    dietaryPreferences: ['none'],
    dislikedIngredients: [],
    allergies: [],
    cookingEffort: 'two_cooking_sessions',
    selectedMealSlots: ['dinner'],
    planningDays: 1,
    availableInventoryItems: [],
    generatedPlan,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('OnboardingFacadeService recipe replacement', () => {
  let facade: OnboardingFacadeService;
  let replaceRecipe: jasmine.Spy;
  let patchState: jasmine.Spy;
  let originalPlan: GeneratedOnboardingMealPlan;

  beforeEach(async () => {
    originalPlan = plan();
    replaceRecipe = jasmine.createSpy('replaceRecipe').and.resolveTo(plan('New Recipe'));
    patchState = jasmine.createSpy('patchState').and.resolveTo({ error: null });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        OnboardingFacadeService,
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: 'user-1' }).asReadonly(),
          },
        },
        {
          provide: OnboardingService,
          useValue: {
            getStatus: jasmine.createSpy('getStatus').and.resolveTo({
              status: 'in_progress',
              currentStep: 'review_plan',
              draft: { generatedPlan: originalPlan },
              firstSmartAction: null,
            }),
            stateFromDraft: () => state(originalPlan),
            patchState,
            draftFromState: (current: OnboardingState) => ({
              generatedPlan: current.generatedPlan,
              currentStep: current.currentStep,
              status: current.status,
            }),
          },
        },
        {
          provide: OnboardingPlanGeneratorService,
          useValue: { replaceRecipe },
        },
      ],
    });

    facade = TestBed.inject(OnboardingFacadeService);
    await facade.init();
  });

  it('persists the replacement and clears the loading state', async () => {
    const target = originalPlan.days[0].meals[0].items[0];

    const replacementPromise = facade.replaceRecipe('dinner', target);
    expect(facade.isReplacingRecipe()).toBeTrue();
    await replacementPromise;

    expect(replaceRecipe).toHaveBeenCalledWith(
      jasmine.objectContaining({ userId: 'user-1' }),
      originalPlan,
      'dinner',
      target
    );
    expect(facade.generatedPlan()?.days[0].meals[0].items[0].name).toBe('New Recipe');
    expect(patchState).toHaveBeenCalled();
    expect(facade.isReplacingRecipe()).toBeFalse();
  });

  it('keeps the original plan and exposes an error when replacement fails', async () => {
    replaceRecipe.and.rejectWith(new Error('No compatible recipe found.'));

    await facade.replaceRecipe('dinner', originalPlan.days[0].meals[0].items[0]);

    expect(facade.generatedPlan()).toBe(originalPlan);
    expect(facade.error()).toBe('No compatible recipe found.');
    expect(patchState).not.toHaveBeenCalled();
    expect(facade.isReplacingRecipe()).toBeFalse();
  });
});
