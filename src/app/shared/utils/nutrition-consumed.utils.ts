import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import {
  DailyNutritionConsumed,
  DailyNutritionTargets,
  NutritionProgressItem,
  NutritionProgressStatus,
  TodayNutritionProgress,
} from '../../core/models/nutrition.model';
import { RecipeNutrition } from '../../core/models/recipe.model';
import { hasRequiredNutritionProfileData } from './nutrition-targets.utils';
import { UserFoodProfile } from '../../core/models/user-profile.model';

interface MacroTotals {
  proteinGrams: number;
  fiberGrams: number;
  carbsGrams: number;
  fatsGrams: number;
  sugarsGrams: number;
  calories: number;
  hasMissingNutritionData: boolean;
}

export function calculateDailyNutritionConsumed(
  date: string,
  items: MealSlotItem[]
): DailyNutritionConsumed & { hasMissingNutritionData: boolean } {
  const consumedItems = items.filter(
    (item) => item.date === date && item.status === 'eaten'
  );
  const totals = sumConsumedNutrition(consumedItems);

  return {
    date,
    proteinGrams: roundGrams(totals.proteinGrams),
    fiberGrams: roundGrams(totals.fiberGrams),
    carbsGrams: roundGrams(totals.carbsGrams),
    fatsGrams: roundGrams(totals.fatsGrams),
    sugarsGrams: roundGrams(totals.sugarsGrams),
    calories: totals.calories > 0 ? Math.round(totals.calories) : undefined,
    hasMissingNutritionData: totals.hasMissingNutritionData,
  };
}

export function buildTodayNutritionProgress(
  date: string,
  items: MealSlotItem[],
  profile: UserFoodProfile | null,
  targets: DailyNutritionTargets | null
): TodayNutritionProgress {
  const hasProfile = hasRequiredNutritionProfileData(profile);
  const consumed = calculateDailyNutritionConsumed(date, items);

  return {
    date,
    targets: hasProfile ? targets : null,
    consumed,
    items: hasProfile && targets ? buildNutritionProgressItems(consumed, targets) : [],
    hasRequiredProfileData: hasProfile,
    hasMissingNutritionData: consumed.hasMissingNutritionData,
  };
}

export function buildNutritionProgressItems(
  consumed: DailyNutritionConsumed,
  targets: DailyNutritionTargets
): NutritionProgressItem[] {
  return [
    buildPositiveProgressItem('protein', 'Protein', consumed.proteinGrams, targets.proteinGrams),
    buildPositiveProgressItem('fiber', 'Fiber', consumed.fiberGrams, targets.fiberGrams),
    buildPositiveProgressItem('carbs', 'Carbs', consumed.carbsGrams, targets.carbsGrams),
    buildPositiveProgressItem('fats', 'Fats', consumed.fatsGrams, targets.fatsGrams),
    buildSugarProgressItem(consumed.sugarsGrams, targets.sugarLimitGrams),
  ];
}

function sumConsumedNutrition(items: MealSlotItem[]): MacroTotals {
  return items.reduce<MacroTotals>(
    (totals, item) => {
      const contribution = getItemNutritionContribution(item);
      totals.proteinGrams += contribution.proteinGrams;
      totals.fiberGrams += contribution.fiberGrams;
      totals.carbsGrams += contribution.carbsGrams;
      totals.fatsGrams += contribution.fatsGrams;
      totals.sugarsGrams += contribution.sugarsGrams;
      totals.calories += contribution.calories;
      totals.hasMissingNutritionData =
        totals.hasMissingNutritionData || contribution.hasMissingNutritionData;
      return totals;
    },
    {
      proteinGrams: 0,
      fiberGrams: 0,
      carbsGrams: 0,
      fatsGrams: 0,
      sugarsGrams: 0,
      calories: 0,
      hasMissingNutritionData: false,
    }
  );
}

function getItemNutritionContribution(item: MealSlotItem): MacroTotals & {
  hasMissingNutritionData: boolean;
} {
  if (item.item_type === 'product') {
    return {
      proteinGrams: item.protein_snapshot ?? 0,
      fiberGrams: item.fiber_snapshot ?? 0,
      carbsGrams: item.carbohydrates_snapshot ?? 0,
      fatsGrams: item.fat_snapshot ?? 0,
      sugarsGrams: item.sugar_snapshot ?? 0,
      calories: item.calories_snapshot ?? 0,
      hasMissingNutritionData: false,
    };
  }

  if (item.item_type === 'recipe') {
    const nutrition = scaleRecipeNutrition(item.recipe?.nutrition, item.portions_used);
    return {
      ...nutrition,
      hasMissingNutritionData: !item.recipe?.nutrition,
    };
  }

  if (item.item_type === 'prepared_portion') {
    const nutrition = scaleRecipeNutrition(
      item.prepared_portion?.recipe?.nutrition,
      item.portions_used
    );
    return {
      ...nutrition,
      hasMissingNutritionData: !item.prepared_portion?.recipe?.nutrition,
    };
  }

  if (item.item_type === 'custom' || item.item_type === 'inventory_item') {
    return {
      proteinGrams: 0,
      fiberGrams: 0,
      carbsGrams: 0,
      fatsGrams: 0,
      sugarsGrams: 0,
      calories: 0,
      hasMissingNutritionData: true,
    };
  }

  return {
    proteinGrams: 0,
    fiberGrams: 0,
    carbsGrams: 0,
    fatsGrams: 0,
    sugarsGrams: 0,
    calories: 0,
    hasMissingNutritionData: false,
  };
}

function scaleRecipeNutrition(
  nutrition: RecipeNutrition | null | undefined,
  portionsUsed: number
): Omit<MacroTotals, 'hasMissingNutritionData'> {
  if (!nutrition) {
    return {
      proteinGrams: 0,
      fiberGrams: 0,
      carbsGrams: 0,
      fatsGrams: 0,
      sugarsGrams: 0,
      calories: 0,
    };
  }

  const multiplier = Math.max(portionsUsed, 1);
  return {
    proteinGrams: (nutrition.protein_g ?? 0) * multiplier,
    fiberGrams: (nutrition.fiber_g ?? 0) * multiplier,
    carbsGrams: (nutrition.carbs_g ?? 0) * multiplier,
    fatsGrams: (nutrition.fat_g ?? 0) * multiplier,
    sugarsGrams: (nutrition.sugar_g ?? 0) * multiplier,
    calories: (nutrition.calories ?? 0) * multiplier,
  };
}

function buildPositiveProgressItem(
  key: 'protein' | 'fiber' | 'carbs' | 'fats',
  label: string,
  consumed: number,
  target: number
): NutritionProgressItem {
  const percentage = target > 0 ? Math.round((consumed / target) * 100) : 0;
  const status = getPositiveNutrientStatus(percentage);

  return {
    key,
    label,
    consumed: roundGrams(consumed),
    target: roundGrams(target),
    unit: 'g',
    percentage,
    status,
    hint: getPositiveNutrientHint(key, status),
  };
}

function buildSugarProgressItem(
  consumed: number,
  limit: number
): NutritionProgressItem {
  const percentage = limit > 0 ? Math.round((consumed / limit) * 100) : 0;
  const status = getSugarStatus(percentage);

  return {
    key: 'sugars',
    label: 'Sugars',
    consumed: roundGrams(consumed),
    target: roundGrams(limit),
    unit: 'g',
    percentage,
    status,
    isUpperLimit: true,
    hint: getSugarHint(status),
  };
}

function getPositiveNutrientStatus(percentage: number): NutritionProgressStatus {
  if (percentage < 50) {
    return 'low';
  }
  if (percentage < 100) {
    return 'on_track';
  }
  if (percentage <= 120) {
    return 'reached';
  }
  return 'over';
}

function getSugarStatus(percentage: number): NutritionProgressStatus {
  if (percentage > 100) {
    return 'over';
  }
  if (percentage >= 80) {
    return 'reached';
  }
  return 'on_track';
}

function getPositiveNutrientHint(
  key: 'protein' | 'fiber' | 'carbs' | 'fats',
  status: NutritionProgressStatus
): string | undefined {
  if (status !== 'low') {
    return undefined;
  }

  switch (key) {
    case 'protein':
      return 'Add a protein-rich meal later today.';
    case 'fiber':
      return 'Add fruits, vegetables, legumes, or whole grains.';
    default:
      return undefined;
  }
}

function getSugarHint(status: NutritionProgressStatus): string | undefined {
  if (status === 'over') {
    return "You're over today's sugar target. Consider lower-sugar options.";
  }
  return undefined;
}

function roundGrams(value: number): number {
  return Math.round(value * 10) / 10;
}
