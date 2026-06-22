import { MealType } from './meal-plan.model';
import { DietaryPreference } from './user-profile.model';
import {
  CookingEffortPreference,
  UserMealPlanningGoal,
} from '../../features/onboarding/models/onboarding.model';

export type AiRecipeDifficulty = 'easy';

export interface AiOnboardingContext {
  dietaryPreferences: DietaryPreference[];
  allergies: string[];
  dislikedIngredients: string[];
  goals: UserMealPlanningGoal[];
  cookingEffort: CookingEffortPreference;
  extraInventory?: string[];
}

export interface AiRecipeSuggestionRequest {
  mealType: MealType;
  maxPrepTimeMinutes: number;
  prioritizeExpiringIngredients: boolean;
  includeMissingIngredients: boolean;
  numberOfSuggestions: number;
  onboardingContext?: AiOnboardingContext;
  excludeTitles?: string[];
}

export interface AiRecipeIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface AiRecipeSuggestion {
  title: string;
  description: string;
  prepTimeMinutes: number;
  portions: number;
  difficulty: AiRecipeDifficulty;
  tags: string[];
  ingredients: AiRecipeIngredient[];
  steps: string[];
  usedInventoryIngredients: string[];
  missingIngredients: AiRecipeIngredient[];
  reason: string;
}

export interface AiRecipeSuggestionResponse {
  suggestions: AiRecipeSuggestion[];
}
