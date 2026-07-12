export type AccessLevel = 'premium' | 'free' | 'blocked';

export type PlanCode =
  | 'beta_trial'
  | 'early_access_monthly'
  | 'early_access_annual'
  | 'free';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'
  | 'free';

export interface EntitlementLimits {
  activeMealPlanWeeks: number | null;
  personalRecipes: number | null;
  smartSuggestionsPerMonth: number | null;
  manualPlanningEnabled: boolean;
  basicInventoryEnabled: boolean;
}

export interface EntitlementUsage {
  activeMealPlanWeeks: number;
  personalRecipes: number;
  smartSuggestionsUsedThisMonth: number;
  smartSuggestionsRemainingThisMonth: number | null;
}

export interface UserEntitlements {
  accessLevel: AccessLevel;
  planCode: PlanCode;
  subscriptionStatus: SubscriptionStatus;
  isPremium: boolean;
  isTrial: boolean;
  isPaidSubscriber: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  trialDaysRemaining: number | null;
  currentPeriodStartedAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  gracePeriodEndsAt: string | null;
  canManageBilling: boolean;
  limits: EntitlementLimits;
  usage: EntitlementUsage;
}

export type EntitlementLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type FeatureKey =
  | 'additional_active_meal_plan_weeks'
  | 'additional_personal_recipes'
  | 'automatic_meal_planning'
  | 'advanced_smart_suggestions'
  | 'photo_recipe_creation'
  | 'voice_recipe_creation'
  | 'recipe_import'
  | 'advanced_inventory'
  | 'nutrition_mode';

export const PREMIUM_FEATURES: ReadonlySet<FeatureKey> = new Set([
  'additional_active_meal_plan_weeks',
  'additional_personal_recipes',
  'automatic_meal_planning',
  'advanced_smart_suggestions',
  'photo_recipe_creation',
  'voice_recipe_creation',
  'recipe_import',
  'advanced_inventory',
  'nutrition_mode',
]);
