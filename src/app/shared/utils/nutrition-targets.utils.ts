import {
  ActivityLevel,
  DailyNutritionTargets,
  NutritionGoal,
  NutritionSex,
} from '../../core/models/nutrition.model';
import { UserFoodProfile } from '../../core/models/user-profile.model';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  athlete: 1.9,
};

const PROTEIN_G_PER_KG: Record<NutritionGoal, number> = {
  maintain: 1.4,
  general_health: 1.4,
  fat_loss: 1.9,
  muscle_gain: 1.9,
};

const FALLBACK_CARBS_G: Record<NutritionGoal, number> = {
  maintain: 250,
  general_health: 220,
  fat_loss: 150,
  muscle_gain: 300,
};

export function hasRequiredNutritionProfileData(
  profile: Pick<
    UserFoodProfile,
    'weightKg' | 'heightCm' | 'activityLevel' | 'nutritionGoal'
  > | null | undefined
): boolean {
  if (!profile) {
    return false;
  }

  return (
    isPositiveNumber(profile.weightKg) &&
    isPositiveNumber(profile.heightCm) &&
    Boolean(profile.activityLevel) &&
    Boolean(profile.nutritionGoal)
  );
}

export function calculateDailyNutritionTargets(
  profile: Pick<
    UserFoodProfile,
    'userId' | 'weightKg' | 'heightCm' | 'age' | 'sex' | 'activityLevel' | 'nutritionGoal'
  >
): DailyNutritionTargets | null {
  if (!hasRequiredNutritionProfileData(profile)) {
    return null;
  }

  const weightKg = profile.weightKg!;
  const heightCm = profile.heightCm!;
  const activityLevel = profile.activityLevel!;
  const goal = profile.nutritionGoal!;
  const proteinGrams = Math.round(weightKg * PROTEIN_G_PER_KG[goal]);

  let calories: number | undefined;
  if (isPositiveNumber(profile.age)) {
    calories = estimateCalorieTarget({
      weightKg,
      heightCm,
      age: profile.age!,
      sex: profile.sex ?? null,
      activityLevel,
      goal,
    });
  }

  if (calories) {
    const fatsGrams = Math.round((calories * 0.3) / 9);
    const proteinCalories = proteinGrams * 4;
    const fatCalories = fatsGrams * 9;
    const carbsGrams = Math.max(0, Math.round((calories - proteinCalories - fatCalories) / 4));
    const fiberGrams = clamp(Math.round((calories / 1000) * 14), 25, 35);
    const sugarLimitGrams = Math.max(25, Math.round((calories * 0.1) / 4));

    return {
      userId: profile.userId,
      calories,
      proteinGrams,
      fiberGrams,
      carbsGrams,
      fatsGrams,
      sugarLimitGrams,
      source: 'estimated',
      calculatedAt: new Date().toISOString(),
    };
  }

  const fatsGrams = Math.round(weightKg * 0.9);
  const carbsGrams = FALLBACK_CARBS_G[goal];

  return {
    userId: profile.userId,
    proteinGrams,
    fiberGrams: 30,
    carbsGrams,
    fatsGrams,
    sugarLimitGrams: 50,
    source: 'estimated',
    calculatedAt: new Date().toISOString(),
  };
}

function estimateCalorieTarget(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: NutritionSex | null;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
}): number {
  const bmrMale =
    10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + 5;
  const bmrFemale =
    10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age - 161;

  let bmr: number;
  if (input.sex === 'male') {
    bmr = bmrMale;
  } else if (input.sex === 'female') {
    bmr = bmrFemale;
  } else {
    bmr = (bmrMale + bmrFemale) / 2;
  }

  let calories = Math.round(bmr * ACTIVITY_MULTIPLIERS[input.activityLevel]);

  if (input.goal === 'fat_loss') {
    calories = Math.round(calories * 0.85);
  } else if (input.goal === 'muscle_gain') {
    calories = Math.round(calories * 1.1);
  }

  return Math.max(1200, calories);
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
