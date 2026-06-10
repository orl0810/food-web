import { DietaryPreference } from './user-profile.model';

export interface DietaryPreferenceOption {
  value: DietaryPreference;
  label: string;
  icon: string;
}

export const DIETARY_PREFERENCE_OPTIONS: DietaryPreferenceOption[] = [
  { value: 'none', label: 'No specific diet', icon: '🍽️' },
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥬' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'pescatarian', label: 'Pescatarian', icon: '🐟' },
  { value: 'flexitarian', label: 'Flexitarian', icon: '🥗' },
  { value: 'high_protein', label: 'High-protein', icon: '💪' },
  { value: 'low_carb', label: 'Low-carb', icon: '🥩' },
  { value: 'gluten_free', label: 'Gluten-free', icon: '🌾' },
  { value: 'dairy_free', label: 'Dairy-free', icon: '🥛' },
  { value: 'mediterranean', label: 'Mediterranean', icon: '🫒' },
  { value: 'budget_friendly', label: 'Budget-friendly', icon: '💰' },
  { value: 'quick_meals', label: 'Quick meals', icon: '⚡' },
  { value: 'meal_prep_focused', label: 'Meal prep focused', icon: '🍱' },
];

export const COMMON_ALLERGY_SUGGESTIONS = [
  'Peanuts',
  'Tree nuts',
  'Dairy',
  'Gluten',
  'Eggs',
  'Shellfish',
  'Soy',
  'Sesame',
];

export const WEEKDAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const MEAL_SLOT_OPTIONS: { value: 'breakfast' | 'lunch' | 'dinner' | 'snacks'; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

export function getDietaryPreferenceLabel(value: DietaryPreference): string {
  return DIETARY_PREFERENCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
