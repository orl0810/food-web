import { MealType } from '../../core/models/meal-plan.model';
import { MealSlotItem } from '../../core/models/meal-slot-item.model';
import { RecipeMealPlanSummary } from '../../core/models/recipe.model';

export interface RecentMealPlanRecipe {
  recipe: RecipeMealPlanSummary;
  addedAt: string;
  plannedDate: string;
  mealType: MealType;
}

export function buildRecentMealPlanRecipes(items: MealSlotItem[]): RecentMealPlanRecipe[] {
  const recipeItems = items
    .filter((item) => item.item_type === 'recipe' && item.recipe_id && item.recipe)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const seen = new Set<string>();
  const result: RecentMealPlanRecipe[] = [];

  for (const item of recipeItems) {
    if (!item.recipe_id || seen.has(item.recipe_id)) {
      continue;
    }

    seen.add(item.recipe_id);
    result.push({
      recipe: item.recipe!,
      addedAt: item.created_at,
      plannedDate: item.date,
      mealType: item.meal_type,
    });
  }

  return result;
}
