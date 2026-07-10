import {
  calculateDailyNutritionTargets,
  hasRequiredNutritionProfileData,
} from './nutrition-targets.utils';

describe('nutrition-targets.utils', () => {
  const completeProfile = {
    userId: 'user-1',
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male' as const,
    activityLevel: 'moderately_active' as const,
    nutritionGoal: 'maintain' as const,
  };

  it('requires weight, height, activity level, and goal', () => {
    expect(hasRequiredNutritionProfileData(completeProfile)).toBeTrue();
    expect(hasRequiredNutritionProfileData({ ...completeProfile, weightKg: null })).toBeFalse();
    expect(hasRequiredNutritionProfileData({ ...completeProfile, activityLevel: null })).toBeFalse();
  });

  it('calculates calorie-based targets when age is available', () => {
    const targets = calculateDailyNutritionTargets(completeProfile);

    expect(targets).not.toBeNull();
    expect(targets!.proteinGrams).toBe(98);
    expect(targets!.calories).toBeGreaterThan(1200);
    expect(targets!.fiberGrams).toBeGreaterThanOrEqual(25);
    expect(targets!.sugarLimitGrams).toBeGreaterThan(0);
    expect(targets!.source).toBe('estimated');
  });

  it('uses weight-based fallback when age is missing', () => {
    const targets = calculateDailyNutritionTargets({
      ...completeProfile,
      age: null,
      sex: null,
    });

    expect(targets).not.toBeNull();
    expect(targets!.calories).toBeUndefined();
    expect(targets!.proteinGrams).toBe(98);
    expect(targets!.fiberGrams).toBe(30);
    expect(targets!.sugarLimitGrams).toBe(50);
  });

  it('returns null when required profile data is missing', () => {
    expect(calculateDailyNutritionTargets({ ...completeProfile, nutritionGoal: null })).toBeNull();
  });
});
