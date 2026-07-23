import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Recipe } from '../../../core/models/recipe.model';
import { AiRecipeService } from '../../../core/services/ai-recipe.service';
import { RecipeService } from '../../../core/services/recipe.service';
import {
  GeneratedOnboardingMealPlan,
  OnboardingState,
  PendingOnboardingRecipe,
} from '../models/onboarding.model';
import { OnboardingPlanGeneratorService } from './onboarding-plan-generator.service';

function pending(
  tempKey: string,
  title: string,
  ingredient: string
): PendingOnboardingRecipe {
  return {
    tempKey,
    mealType: 'dinner',
    title,
    description: `${title} description`,
    prepTimeMinutes: 20,
    portions: 2,
    tags: ['quick'],
    ingredients: [{ name: ingredient, quantity: 1, unit: 'piece' }],
    steps: ['Cook'],
    source: 'mock',
  };
}

function recipe(id: string, title: string, mealType: Recipe['meal_type']): Recipe {
  return {
    id,
    user_id: 'user-1',
    title,
    description: null,
    prep_time_minutes: 20,
    cook_time_minutes: null,
    portions: 2,
    tags: ['quick'],
    rating: null,
    image_url: null,
    image_status: 'pending',
    is_base_recipe: false,
    base_recipe_id: null,
    meal_type: mealType,
    category: null,
    difficulty: 'easy',
    instructions: ['Cook'],
    created_at: '2026-01-01T00:00:00Z',
    ingredients: [
      {
        id: `${id}-ingredient`,
        recipe_id: id,
        name: `${title} ingredient`,
        quantity: 1,
        unit: 'piece',
      },
    ],
  };
}

function state(): OnboardingState {
  return {
    userId: 'user-1',
    status: 'in_progress',
    currentStep: 'review_plan',
    goals: ['save_time'],
    dietaryPreferences: ['none'],
    dislikedIngredients: [],
    allergies: [],
    cookingEffort: 'batch_cooking',
    selectedMealSlots: ['dinner'],
    planningDays: 3,
    availableInventoryItems: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function plan(): GeneratedOnboardingMealPlan {
  const rejected = pending('pending-rejected', 'Rejected Pasta', 'Pasta');
  const alternative = pending('pending-alternative', 'Better Curry', 'Chickpeas');
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
                name: rejected.title,
                tempRecipeKey: rejected.tempKey,
                portionsUsed: 1,
              },
            ],
          },
        ],
      },
      {
        date: '2026-01-06',
        dayName: 'Tuesday',
        meals: [
          {
            slot: 'dinner',
            items: [
              {
                type: 'recipe',
                name: 'Keep This Soup',
                recipeId: 'keep-recipe',
                portionsUsed: 1,
              },
            ],
          },
        ],
      },
      {
        date: '2026-01-07',
        dayName: 'Wednesday',
        meals: [
          {
            slot: 'dinner',
            items: [
              {
                type: 'recipe',
                name: rejected.title,
                tempRecipeKey: rejected.tempKey,
                portionsUsed: 2,
              },
            ],
          },
        ],
      },
    ],
    shoppingListItems: [{ name: 'Pasta' }],
    cookingSessions: [
      {
        date: '2026-01-05',
        title: 'Cooking session 1',
        estimatedMinutes: 60,
        tasks: [
          {
            title: 'Batch cook main meals',
            relatedMealNames: ['Rejected Pasta'],
            createsPreparedPortions: true,
            portionsCreated: 2,
          },
        ],
      },
    ],
    preparedPortionSuggestions: [
      {
        name: 'Rejected Pasta',
        portions: 2,
        usedOnDays: ['Tue'],
        storageLocation: 'fridge',
      },
    ],
    pendingRecipes: [rejected, alternative],
    summary: {
      mealsPlanned: 3,
      cookingSessions: 1,
      generatedAt: '2026-01-01T00:00:00Z',
    },
    firstSmartAction: {
      title: 'Old action',
      description: 'Cook Rejected Pasta.',
      priority: 'high',
    },
  };
}

describe('OnboardingPlanGeneratorService recipe replacement', () => {
  let service: OnboardingPlanGeneratorService;
  let recipesSignal: ReturnType<typeof signal<Recipe[]>>;

  beforeEach(() => {
    recipesSignal = signal([recipe('keep-recipe', 'Keep This Soup', 'dinner')]);
    TestBed.configureTestingModule({
      providers: [
        OnboardingPlanGeneratorService,
        {
          provide: RecipeService,
          useValue: {
            loadRecipes: jasmine.createSpy('loadRecipes').and.resolveTo(),
            recipes: recipesSignal.asReadonly(),
          },
        },
        {
          provide: AiRecipeService,
          useValue: {
            generateRecipesFromInventory: jasmine
              .createSpy('generateRecipesFromInventory')
              .and.resolveTo({ suggestions: [] }),
            error: signal<string | null>(null).asReadonly(),
          },
        },
      ],
    });
    service = TestBed.inject(OnboardingPlanGeneratorService);
  });

  it('replaces every occurrence and refreshes derived plan data', async () => {
    const original = plan();
    const target = original.days[0].meals[0].items[0];

    const updated = await service.replaceRecipe(state(), original, 'dinner', target);

    expect(updated.days[0].meals[0].items[0].name).toBe('Better Curry');
    expect(updated.days[2].meals[0].items[0].name).toBe('Better Curry');
    expect(updated.days[2].meals[0].items[0].portionsUsed).toBe(2);
    expect(updated.days[1].meals[0].items[0].name).toBe('Keep This Soup');
    expect(original.days[0].meals[0].items[0].name).toBe('Rejected Pasta');

    expect(updated.pendingRecipes?.map((item) => item.tempKey)).toEqual([
      'pending-alternative',
    ]);
    expect(updated.shoppingListItems.map((item) => item.name)).toContain('Chickpeas');
    expect(updated.shoppingListItems.map((item) => item.name)).not.toContain('Pasta');
    expect(updated.cookingSessions[0].tasks[0].relatedMealNames).toEqual(['Better Curry']);
    expect(updated.preparedPortionSuggestions[0].name).toBe('Better Curry');
    expect(updated.firstSmartAction?.description).toContain('Better Curry');
  });

  it('uses a compatible unused saved recipe when no pending alternative exists', async () => {
    recipesSignal.set([
      recipe('keep-recipe', 'Keep This Soup', 'dinner'),
      recipe('breakfast-recipe', 'Morning Oats', 'breakfast'),
      recipe('dinner-recipe', 'New Dinner', 'dinner'),
    ]);
    const original = plan();
    original.pendingRecipes = original.pendingRecipes?.slice(0, 1);

    const updated = await service.replaceRecipe(
      state(),
      original,
      'dinner',
      original.days[0].meals[0].items[0]
    );

    expect(updated.days[0].meals[0].items[0]).toEqual(
      jasmine.objectContaining({
        name: 'New Dinner',
        recipeId: 'dinner-recipe',
      })
    );
  });
});
