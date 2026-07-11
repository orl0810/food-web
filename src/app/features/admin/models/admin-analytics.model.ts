export interface AdminAnalyticsPeriod {
  startDate: string | null;
  endDate: string | null;
}

export interface AdminAnalyticsUsers {
  totalUsers: number;
  newUsers: number;
  onboardingStarted: number;
  onboardingCompleted: number;
  onboardingCompletionRate: number;
  activatedUsers: number;
  activationRate: number;
  usersWithNoMeaningfulAction: number;
}

export interface AdminAnalyticsEngagement {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  returningUsers: number;
  consecutiveWeekUsers: number;
  daySevenRetentionRate: number | null;
  weekFourRetentionRate: number | null;
}

export interface AdminAnalyticsMealPlans {
  totalMealPlans: number;
  uniquePlanningUsers: number;
  plannedMeals: number;
  cookedMeals: number;
  completedMeals: number;
  mealCompletionRate: number;
  averageCompletedMealsPerActiveUser: number;
}

export interface AdminAnalyticsProductUsage {
  recipesCreated: number;
  recipeCreators: number;
  inventoryItemsAdded: number;
  shoppingListsGenerated: number;
  preparedPortionsCreated: number;
  preparedPortionsConsumed: number | null;
}

export interface AdminAnalyticsFriction {
  onboardingAbandoned: number;
  usersWithoutMealPlanAfterOnboarding: number;
  mealPlanGenerationFailures: number;
  recipeImportStarted: number;
  recipeImportCompleted: number;
  recipeImportFailures: number;
  recipeImportCompletionRate: number | null;
  criticalWorkflowFailures: number;
  mealPhotoAnalysisFailures: number;
}

export interface AdminAnalyticsFunnel {
  registered: number;
  onboardingCompleted: number;
  firstMealPlan: number;
  firstMealEaten: number;
}

export interface AdminAnalytics {
  period: AdminAnalyticsPeriod;
  users: AdminAnalyticsUsers;
  engagement: AdminAnalyticsEngagement;
  mealPlans: AdminAnalyticsMealPlans;
  productUsage: AdminAnalyticsProductUsage;
  friction: AdminAnalyticsFriction;
  funnel: AdminAnalyticsFunnel;
}

export type AdminDateRangePreset = '7d' | '30d' | '90d' | 'all';

export interface AdminDateRange {
  preset: AdminDateRangePreset;
  startDate: string | null;
  endDate: string;
}

export function buildDateRange(preset: AdminDateRangePreset): AdminDateRange {
  const endDate = new Date();
  const endIso = endDate.toISOString();

  if (preset === 'all') {
    return { preset, startDate: null, endDate: endIso };
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - days);

  return {
    preset,
    startDate: startDate.toISOString(),
    endDate: endIso,
  };
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapAdminAnalyticsResponse(raw: unknown): AdminAnalytics {
  const data = (raw ?? {}) as Record<string, unknown>;
  const period = (data['period'] ?? {}) as Record<string, unknown>;
  const users = (data['users'] ?? {}) as Record<string, unknown>;
  const engagement = (data['engagement'] ?? {}) as Record<string, unknown>;
  const mealPlans = (data['meal_plans'] ?? {}) as Record<string, unknown>;
  const productUsage = (data['product_usage'] ?? {}) as Record<string, unknown>;
  const friction = (data['friction'] ?? {}) as Record<string, unknown>;
  const funnel = (data['funnel'] ?? {}) as Record<string, unknown>;

  return {
    period: {
      startDate: period['start_date'] ? String(period['start_date']) : null,
      endDate: period['end_date'] ? String(period['end_date']) : null,
    },
    users: {
      totalUsers: toNumber(users['total_users']),
      newUsers: toNumber(users['new_users']),
      onboardingStarted: toNumber(users['onboarding_started']),
      onboardingCompleted: toNumber(users['onboarding_completed']),
      onboardingCompletionRate: toNumber(users['onboarding_completion_rate']),
      activatedUsers: toNumber(users['activated_users']),
      activationRate: toNumber(users['activation_rate']),
      usersWithNoMeaningfulAction: toNumber(users['users_with_no_meaningful_action']),
    },
    engagement: {
      dailyActiveUsers: toNumber(engagement['daily_active_users']),
      weeklyActiveUsers: toNumber(engagement['weekly_active_users']),
      monthlyActiveUsers: toNumber(engagement['monthly_active_users']),
      returningUsers: toNumber(engagement['returning_users']),
      consecutiveWeekUsers: toNumber(engagement['consecutive_week_users']),
      daySevenRetentionRate: toNullableNumber(engagement['day_seven_retention_rate']),
      weekFourRetentionRate: toNullableNumber(engagement['week_four_retention_rate']),
    },
    mealPlans: {
      totalMealPlans: toNumber(mealPlans['total_meal_plans']),
      uniquePlanningUsers: toNumber(mealPlans['unique_planning_users']),
      plannedMeals: toNumber(mealPlans['planned_meals']),
      cookedMeals: toNumber(mealPlans['cooked_meals']),
      completedMeals: toNumber(mealPlans['completed_meals']),
      mealCompletionRate: toNumber(mealPlans['meal_completion_rate']),
      averageCompletedMealsPerActiveUser: toNumber(
        mealPlans['average_completed_meals_per_active_user']
      ),
    },
    productUsage: {
      recipesCreated: toNumber(productUsage['recipes_created']),
      recipeCreators: toNumber(productUsage['recipe_creators']),
      inventoryItemsAdded: toNumber(productUsage['inventory_items_added']),
      shoppingListsGenerated: toNumber(productUsage['shopping_lists_generated']),
      preparedPortionsCreated: toNumber(productUsage['prepared_portions_created']),
      preparedPortionsConsumed: toNullableNumber(productUsage['prepared_portions_consumed']),
    },
    friction: {
      onboardingAbandoned: toNumber(friction['onboarding_abandoned']),
      usersWithoutMealPlanAfterOnboarding: toNumber(
        friction['users_without_meal_plan_after_onboarding']
      ),
      mealPlanGenerationFailures: toNumber(friction['meal_plan_generation_failures']),
      recipeImportStarted: toNumber(friction['recipe_import_started']),
      recipeImportCompleted: toNumber(friction['recipe_import_completed']),
      recipeImportFailures: toNumber(friction['recipe_import_failures']),
      recipeImportCompletionRate: toNullableNumber(friction['recipe_import_completion_rate']),
      criticalWorkflowFailures: toNumber(friction['critical_workflow_failures']),
      mealPhotoAnalysisFailures: toNumber(friction['meal_photo_analysis_failures']),
    },
    funnel: {
      registered: toNumber(funnel['registered']),
      onboardingCompleted: toNumber(funnel['onboarding_completed']),
      firstMealPlan: toNumber(funnel['first_meal_plan']),
      firstMealEaten: toNumber(funnel['first_meal_eaten']),
    },
  };
}
