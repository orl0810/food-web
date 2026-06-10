import {
  CookingEffortPreference,
  OnboardingStep,
  UserMealPlanningGoal,
} from './onboarding.model';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'goals',
  'preferences',
  'avoidances',
  'cooking_effort',
  'meal_slots',
  'inventory',
  'generating',
  'review_plan',
  'complete',
];

export const INPUT_STEPS: OnboardingStep[] = [
  'goals',
  'preferences',
  'avoidances',
  'cooking_effort',
  'meal_slots',
  'inventory',
];

export const GOAL_OPTIONS: { value: UserMealPlanningGoal; label: string; icon: string }[] = [
  { value: 'save_time', label: 'Save time cooking', icon: '⏱️' },
  { value: 'reduce_food_waste', label: 'Reduce food waste', icon: '♻️' },
  { value: 'eat_healthier', label: 'Eat healthier', icon: '🥗' },
  { value: 'save_money', label: 'Spend less on groceries', icon: '💰' },
  { value: 'work_lunches', label: 'Plan meals for work', icon: '💼' },
  { value: 'cook_less_often', label: 'Cook fewer times per week', icon: '🍳' },
  { value: 'use_existing_ingredients', label: 'Use what I already have', icon: '🧺' },
];

export const COOKING_EFFORT_OPTIONS: {
  value: CookingEffortPreference;
  label: string;
  description: string;
}[] = [
  {
    value: 'minimal_cooking',
    label: 'As little as possible',
    description: '1–2 quick cooking sessions for the week',
  },
  {
    value: 'two_cooking_sessions',
    label: '2 cooking sessions',
    description: 'Cook twice, eat well all week',
  },
  {
    value: 'three_cooking_sessions',
    label: '3 cooking sessions',
    description: 'A balanced rhythm of fresh meals',
  },
  {
    value: 'daily_cooking',
    label: 'I do not mind cooking daily',
    description: 'Simple fresh meals most days',
  },
  {
    value: 'batch_cooking',
    label: 'I want leftovers / batch cooking',
    description: 'Cook bigger batches and reuse portions',
  },
];

export const PLANNING_DAY_OPTIONS = [3, 5, 7] as const;

export const COMMON_INVENTORY_CHIPS = [
  'Eggs',
  'Rice',
  'Pasta',
  'Chicken',
  'Tuna',
  'Couscous',
  'Vegetables',
  'Cheese',
  'Yogurt',
  'Bread',
];

export const GENERATING_MESSAGES = [
  'Generating recipes with AI…',
  'Building your week…',
  'Optimizing leftovers and portions…',
  'Preparing your shopping list…',
];
