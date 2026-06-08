import { Recipe, RecipeIngredient } from './recipe.model';

export type SmartSuggestionType =
  | 'use_expiring_soon'
  | 'cook_with_available_items'
  | 'quick_meal'
  | 'meal_prep'
  | 'low_missing_ingredients'
  | 'not_planned_this_week';

export interface SuggestedIngredientMatch {
  recipeIngredientName: string;
  inventoryFoodId: string;
  inventoryFoodName: string;
  expirationDate?: string | null;
  daysUntilExpiration?: number | null;
}

export type RecipeDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface SuggestionScoreBreakdown {
  inventory: number;
  expiring: number;
  time: number;
  variety: number;
}

export interface SmartSuggestion {
  recipe: Recipe;
  score: number;
  matchPercentage: number;
  difficulty: RecipeDifficulty | null;
  scoreBreakdown: SuggestionScoreBreakdown;
  availableIngredients: SuggestedIngredientMatch[];
  missingIngredients: RecipeIngredient[];
  expiringIngredientsUsed: SuggestedIngredientMatch[];
  reasons: string[];
  suggestionType: SmartSuggestionType;
}

export interface SuggestionFilters {
  maxPrepTime?: number;
  includeAlreadyPlanned?: boolean;
  onlyUseAvailableIngredients?: boolean;
  prioritizeExpiringSoon?: boolean;
  tags?: string[];
}
