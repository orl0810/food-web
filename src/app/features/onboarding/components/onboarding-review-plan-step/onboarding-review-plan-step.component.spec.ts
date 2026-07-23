import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GeneratedOnboardingMealPlan } from '../../models/onboarding.model';
import { OnboardingFacadeService } from '../../services/onboarding-facade.service';
import { OnboardingReviewPlanStepComponent } from './onboarding-review-plan-step.component';

function makePlan(): GeneratedOnboardingMealPlan {
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
                name: 'Pasta',
                tempRecipeKey: 'pasta-key',
                portionsUsed: 1,
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

describe('OnboardingReviewPlanStepComponent', () => {
  let fixture: ComponentFixture<OnboardingReviewPlanStepComponent>;
  let replaceRecipe: jasmine.Spy;
  let replacing: ReturnType<typeof signal<boolean>>;
  let replacingKey: ReturnType<typeof signal<string | null>>;

  beforeEach(async () => {
    replacing = signal(false);
    replacingKey = signal<string | null>(null);
    replaceRecipe = jasmine.createSpy('replaceRecipe').and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [OnboardingReviewPlanStepComponent],
      providers: [
        {
          provide: OnboardingFacadeService,
          useValue: {
            generatedPlan: signal(makePlan()).asReadonly(),
            isGenerating: signal(false).asReadonly(),
            isConfirming: signal(false).asReadonly(),
            isReplacingRecipe: replacing.asReadonly(),
            replacingRecipeKey: replacingKey.asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            isReplacing: (item: { tempRecipeKey?: string }) =>
              replacingKey() === item.tempRecipeKey,
            replaceRecipe,
            updateGeneratedPlan: jasmine.createSpy('updateGeneratedPlan'),
            regeneratePlan: jasmine.createSpy('regeneratePlan').and.resolveTo(),
            confirmPlan: jasmine.createSpy('confirmPlan').and.resolveTo({ error: null }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingReviewPlanStepComponent);
    fixture.detectChanges();
  });

  it('requests a replacement for the clicked recipe and slot', () => {
    const changeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Change Pasta"]'
    ) as HTMLButtonElement;

    changeButton.click();

    expect(replaceRecipe).toHaveBeenCalledWith(
      'dinner',
      jasmine.objectContaining({
        name: 'Pasta',
        tempRecipeKey: 'pasta-key',
      })
    );
  });

  it('shows the localized loading state and disables plan actions', () => {
    replacing.set(true);
    replacingKey.set('pasta-key');
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    expect(buttons.find((button) => button.textContent?.trim() === 'Changing…')?.disabled).toBeTrue();
    expect(buttons.find((button) => button.textContent?.trim() === 'Regenerate plan')?.disabled).toBeTrue();
    expect(buttons.find((button) => button.textContent?.trim() === 'Confirm plan')?.disabled).toBeTrue();
  });
});
