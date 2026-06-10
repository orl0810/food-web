import {
  buildAllergy,
  buildIngredientPreference,
  validateAllergyAddition,
  validateIngredientAddition,
} from './user-profile-validation.utils';
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
    ...overrides,
  };
}

describe('user-profile-validation.utils', () => {
  it('blocks duplicate favorites', () => {
    const profile = emptyProfile({
      favoriteIngredients: [
        {
          id: 'f1',
          ingredientName: 'Chicken',
          normalizedName: 'chicken',
          source: 'manual',
        },
      ],
    });

    const error = validateIngredientAddition(profile, 'favorite', {
      ingredientName: 'chicken',
    });

    expect(error?.code).toBe('duplicate');
  });

  it('blocks favorite when ingredient is disliked', () => {
    const profile = emptyProfile({
      dislikedIngredients: [
        {
          id: 'd1',
          ingredientName: 'Olives',
          normalizedName: 'olives',
          source: 'manual',
        },
      ],
    });

    const error = validateIngredientAddition(profile, 'favorite', {
      ingredientName: 'Olives',
    });

    expect(error?.code).toBe('favorite_disliked_conflict');
  });

  it('blocks duplicate allergies', () => {
    const profile = emptyProfile({
      allergies: [
        {
          id: 'a1',
          name: 'Peanuts',
          normalizedName: 'peanuts',
          strictExclusion: true,
        },
      ],
    });

    const error = validateAllergyAddition(profile, { name: 'peanuts' });
    expect(error?.code).toBe('duplicate');
  });

  it('normalizes ingredient names when building preference', () => {
    const built = buildIngredientPreference({ ingredientName: '  AVOCADO  ' }, 'favorite');
    expect(built.ingredientName).toBe('Avocado');
    expect(built.normalizedName).toBe('avocado');
  });

  it('builds allergy with strict exclusion', () => {
    const allergy = buildAllergy({ name: 'dairy', severity: 'high' });
    expect(allergy.strictExclusion).toBe(true);
    expect(allergy.name).toBe('Dairy');
  });
});
