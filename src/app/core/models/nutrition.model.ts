export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'athlete';

export type NutritionGoal =
  | 'maintain'
  | 'fat_loss'
  | 'muscle_gain'
  | 'general_health';

export type NutritionSex = 'male' | 'female';

export interface DailyNutritionTargets {
  userId: string;
  calories?: number;
  proteinGrams: number;
  fiberGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  sugarLimitGrams: number;
  source: 'estimated' | 'manual' | 'default';
  calculatedAt: string;
}

export interface DailyNutritionConsumed {
  date: string;
  proteinGrams: number;
  fiberGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  sugarsGrams: number;
  calories?: number;
}

export type NutritionProgressStatus = 'low' | 'on_track' | 'reached' | 'over';

export interface NutritionProgressItem {
  key: 'protein' | 'fiber' | 'carbs' | 'fats' | 'sugars';
  label: string;
  consumed: number;
  target: number;
  unit: 'g';
  percentage: number;
  status: NutritionProgressStatus;
  isUpperLimit?: boolean;
  hint?: string;
}

export interface TodayNutritionProgress {
  date: string;
  targets: DailyNutritionTargets | null;
  consumed: DailyNutritionConsumed;
  items: NutritionProgressItem[];
  hasRequiredProfileData: boolean;
  hasMissingNutritionData: boolean;
}

export type TodayProgressMode = 'meals' | 'nutrition';

export interface NutritionProfileInput {
  weightKg?: number | null;
  heightCm?: number | null;
  age?: number | null;
  sex?: NutritionSex | null;
  activityLevel?: ActivityLevel | null;
  nutritionGoal?: NutritionGoal | null;
}
