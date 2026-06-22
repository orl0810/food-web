import { AiOnboardingContext } from '../../core/models/ai-recipe-suggestion.model';
import { UserFoodProfile } from '../../core/models/user-profile.model';

type ProfileForAiContext = Pick<
  UserFoodProfile,
  'dietaryPreferences' | 'allergies' | 'dislikedIngredients'
>;

export function buildAiOnboardingContextFromProfile(
  profile: ProfileForAiContext | null | undefined
): AiOnboardingContext | undefined {
  if (!profile) {
    return undefined;
  }

  return {
    dietaryPreferences: profile.dietaryPreferences,
    allergies: profile.allergies.map((allergy) => allergy.name),
    dislikedIngredients: profile.dislikedIngredients.map(
      (ingredient) => ingredient.ingredientName
    ),
    goals: [],
    cookingEffort: 'two_cooking_sessions',
  };
}
