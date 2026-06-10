export type DietaryPreference =
  | 'none'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'flexitarian'
  | 'high_protein'
  | 'low_carb'
  | 'gluten_free'
  | 'dairy_free'
  | 'mediterranean'
  | 'budget_friendly'
  | 'quick_meals'
  | 'meal_prep_focused';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type IngredientPreferenceType = 'favorite' | 'disliked';

export type IngredientPreferenceSource = 'manual' | 'auto_detected';

export type AllergySeverity = 'low' | 'medium' | 'high';

export type PreferredUnits = 'metric' | 'imperial';

export interface UserIngredientPreference {
  id: string;
  ingredientName: string;
  normalizedName: string;
  category?: string | null;
  source: IngredientPreferenceSource;
  usageCount?: number | null;
  lastUsedAt?: string | null;
}

export interface UserAllergy {
  id: string;
  name: string;
  normalizedName: string;
  severity?: AllergySeverity | null;
  notes?: string | null;
  strictExclusion: true;
}

export interface MealPlanningUserSettings {
  defaultMealsPerDay: number;
  enabledMealSlots: MealSlot[];
  preferredCookingDays?: string[];
  preferredShoppingDay?: string | null;
  preferredUnits: PreferredUnits;
  householdSize: number;
  defaultPortionsPerRecipe: number;
  expiringItemsReminderEnabled: boolean;
}

export interface UserFoodProfile {
  id: string;
  userId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string | null;
  dietaryPreferences: DietaryPreference[];
  favoriteIngredients: UserIngredientPreference[];
  dislikedIngredients: UserIngredientPreference[];
  allergies: UserAllergy[];
  mealPlanningSettings: MealPlanningUserSettings;
  createdAt: string;
  updatedAt: string;
}

export interface UserMealPlanningStats {
  userId: string;
  mealsPlannedThisWeek: number;
  mealsCompletedThisWeek: number;
  preparedPortionsUsedThisWeek: number;
  inventoryItemsSavedFromWasteThisWeek: number;
  weeklyCompletionPercentage: number;
  completedWeeksStreak: number;
  totalRecipesCooked?: number;
  estimatedTimeSavedMinutes?: number;
}

export interface SuggestedIngredient {
  name: string;
  normalizedName: string;
  category?: string | null;
  usageCount: number;
  lastUsedAt?: string | null;
}

export type UserProfileSaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface IngredientPreferenceInput {
  ingredientName: string;
  category?: string | null;
  source?: IngredientPreferenceSource;
  usageCount?: number | null;
}

export interface AllergyInput {
  name: string;
  severity?: AllergySeverity | null;
  notes?: string | null;
}

export interface UserProfileUpdateInput {
  displayName?: string;
  avatarUrl?: string | null;
  mealPlanningSettings?: Partial<MealPlanningUserSettings>;
}

export const DEFAULT_MEAL_PLANNING_SETTINGS: MealPlanningUserSettings = {
  defaultMealsPerDay: 3,
  enabledMealSlots: ['breakfast', 'lunch', 'dinner'],
  preferredUnits: 'metric',
  householdSize: 2,
  defaultPortionsPerRecipe: 4,
  expiringItemsReminderEnabled: true,
};

export const PLANNING_STREAK_MIN_SLOTS = 5;
export const PLANNING_STREAK_LOOKBACK_WEEKS = 12;
