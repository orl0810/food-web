import { buildAiOnboardingContextFromProfile } from './ai-recipe-context.utils';
import { UserFoodProfile } from '../../core/models/user-profile.model';

function emptyProfile(overrides: Partial<UserFoodProfile> = {}): UserFoodProfile {
  return {
    id: '1',
    userId: 'u1',
    displayName: 'Test',
    dietaryPreferences: ['none'],
    favoriteIngredients: [],
    dislikedIngredients: [],
    allergies: [],
    mealPlanningSettings: {
      defaultMealsPerDay: 3,
      enabledMealSlots: ['breakfast', 'lunch', 'dinner'],
      preferredUnits: 'metric',
      householdSize: 2,
      defaultPortionsPerRecipe: 4,
      expiringItemsReminderEnabled: true,
    },
    createdAt: '',
    updatedAt: '',
    role: 'user',
    ...overrides,
  };
}

describe('buildAiOnboardingContextFromProfile', () => {
  it('returns undefined when profile is null', () => {
    expect(buildAiOnboardingContextFromProfile(null)).toBeUndefined();
  });

  it('returns undefined when profile is undefined', () => {
    expect(buildAiOnboardingContextFromProfile(undefined)).toBeUndefined();
  });

  it('maps dietary preferences, allergies, and disliked ingredients', () => {
    const profile = emptyProfile({
      dietaryPreferences: ['vegan', 'gluten_free'],
      allergies: [
        {
          id: 'a1',
          name: 'Peanuts',
          normalizedName: 'peanuts',
          strictExclusion: true,
        },
      ],
      dislikedIngredients: [
        {
          id: 'd1',
          ingredientName: 'Mushrooms',
          normalizedName: 'mushrooms',
          source: 'manual',
        },
      ],
    });

    expect(buildAiOnboardingContextFromProfile(profile)).toEqual({
      dietaryPreferences: ['vegan', 'gluten_free'],
      allergies: ['Peanuts'],
      dislikedIngredients: ['Mushrooms'],
      goals: [],
      cookingEffort: 'two_cooking_sessions',
    });
  });
});
