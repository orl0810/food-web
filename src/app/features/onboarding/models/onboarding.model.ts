import { MealType } from '../../../core/models/meal-plan.model';
import { DietaryPreference } from '../../../core/models/user-profile.model';

export type OnboardingStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type OnboardingStep =
  | 'welcome'
  | 'goals'
  | 'preferences'
  | 'avoidances'
  | 'cooking_effort'
  | 'meal_slots'
  | 'inventory'
  | 'generating'
  | 'review_plan'
  | 'complete';

export type UserMealPlanningGoal =
  | 'save_time'
  | 'reduce_food_waste'
  | 'eat_healthier'
  | 'save_money'
  | 'work_lunches'
  | 'cook_less_often'
  | 'use_existing_ingredients';

export type CookingEffortPreference =
  | 'minimal_cooking'
  | 'two_cooking_sessions'
  | 'three_cooking_sessions'
  | 'daily_cooking'
  | 'batch_cooking';

export type MealSlotType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface OnboardingInventoryInput {
  name: string;
  quantity?: number;
  unit?: string;
  location?: 'fridge' | 'freezer' | 'pantry';
}

export interface OnboardingState {
  userId: string;
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  goals: UserMealPlanningGoal[];
  dietaryPreferences: DietaryPreference[];
  dislikedIngredients: string[];
  allergies: string[];
  cookingEffort: CookingEffortPreference;
  selectedMealSlots: MealSlotType[];
  planningDays: number;
  availableInventoryItems: OnboardingInventoryInput[];
  generatedPlan?: GeneratedOnboardingMealPlan;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedOnboardingMealPlan {
  weekStartDate: string;
  days: GeneratedMealPlanDay[];
  shoppingListItems: GeneratedShoppingListItem[];
  preparedPortionSuggestions: GeneratedPreparedPortionSuggestion[];
  cookingSessions: GeneratedCookingSession[];
  summary: GeneratedMealPlanSummary;
  firstSmartAction?: DashboardSmartAction;
  /** Recipes to create on confirm (AI/mock, not yet in DB). */
  pendingRecipes?: PendingOnboardingRecipe[];
}

export interface PendingOnboardingRecipe {
  tempKey: string;
  /** Meal type this generated recipe was created for. Optional for persisted legacy drafts. */
  mealType?: MealType;
  title: string;
  description: string;
  prepTimeMinutes: number;
  portions: number;
  tags: string[];
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  steps: string[];
  source: 'ai' | 'mock';
}

export interface GeneratedMealPlanDay {
  date: string;
  dayName: string;
  meals: GeneratedMealSlot[];
}

export interface GeneratedMealSlot {
  slot: MealSlotType;
  items: GeneratedMealSlotItem[];
}

export interface GeneratedMealSlotItem {
  type: 'recipe' | 'preparedPortion' | 'inventoryItem' | 'custom';
  name: string;
  recipeId?: string;
  tempRecipeKey?: string;
  inventoryItemIds?: string[];
  portionsUsed?: number;
  notes?: string;
}

export interface GeneratedCookingSession {
  date: string;
  title: string;
  tasks: GeneratedCookingTask[];
  estimatedMinutes?: number;
}

export interface GeneratedCookingTask {
  title: string;
  relatedMealNames?: string[];
  createsPreparedPortions?: boolean;
  portionsCreated?: number;
}

export interface GeneratedPreparedPortionSuggestion {
  name: string;
  portions: number;
  usedOnDays: string[];
  storageLocation?: 'fridge' | 'freezer';
}

export interface GeneratedShoppingListItem {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  category?: string;
}

export interface GeneratedMealPlanSummary {
  mealsPlanned: number;
  cookingSessions: number;
  estimatedTimeSavedMinutes?: number;
  inventoryItemsUsed?: number;
  generatedAt: string;
}

export interface DashboardSmartAction {
  title: string;
  description: string;
  ctaLabel?: string;
  route?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface OnboardingDraftPatch {
  currentStep?: OnboardingStep;
  status?: OnboardingStatus;
  goals?: UserMealPlanningGoal[];
  dietaryPreferences?: DietaryPreference[];
  dislikedIngredients?: string[];
  allergies?: string[];
  cookingEffort?: CookingEffortPreference;
  selectedMealSlots?: MealSlotType[];
  planningDays?: number;
  availableInventoryItems?: OnboardingInventoryInput[];
  generatedPlan?: GeneratedOnboardingMealPlan | null;
}

export interface OnboardingStatusResponse {
  status: OnboardingStatus;
  currentStep: OnboardingStep | null;
  draft: OnboardingDraftPatch | null;
  firstSmartAction: DashboardSmartAction | null;
}

/** Map profile meal slot to meal plan meal type. */
export function mealSlotToMealType(slot: MealSlotType): MealType {
  return slot === 'snacks' ? 'snack' : slot;
}

export function mealTypeToMealSlot(type: MealType): MealSlotType {
  return type === 'snack' ? 'snacks' : type;
}
