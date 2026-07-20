import { Injectable, inject } from '@angular/core';
import { FoodInventoryService } from '../../../core/services/food-inventory.service';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import {
  MealPlanAutogenerateRequest,
  MealPlanAutogenerateResult,
} from '../../../core/models/meal-plan-autogenerate.model';
import {
  rankRecipesForAutogeneration,
  validateAutogenerateSelection,
} from '../../../shared/utils/meal-plan-autogenerate.utils';
import { addDays, toISODate } from '../../../shared/utils/meal-plan.utils';

@Injectable({ providedIn: 'root' })
export class MealPlanAutogenerateService {
  private readonly mealPlan = inject(MealPlanService);
  private readonly recipes = inject(RecipeService);
  private readonly inventory = inject(FoodInventoryService);
  private readonly profiles = inject(UserProfileService);

  async generate(request: MealPlanAutogenerateRequest): Promise<MealPlanAutogenerateResult> {
    const today = toISODate();
    const validationError = validateAutogenerateSelection(request.dates, request.mealTypes, today);
    if (validationError) throw new Error(validationError);

    const dates = [...new Set(request.dates)].sort();
    const mealTypes = [...new Set(request.mealTypes)];
    await Promise.all([
      this.recipes.loadRecipes(),
      this.recipes.loadBaseRecipes(),
      this.inventory.loadItems(),
      this.profiles.profile() ? Promise.resolve() : this.profiles.loadProfile(),
    ]);

    const [selectedItems, history] = await Promise.all([
      this.mealPlan.fetchMealPlanForDateRange(dates[0], dates[dates.length - 1]),
      this.mealPlan.fetchMealPlanForDateRange(addDays(today, -90), today),
    ]);
    const occupied = new Set(selectedItems.map((item) => `${item.date}|${item.meal_type}`));
    const usedRecipes = new Set<string>();
    const inserts: Array<{ date: string; mealType: typeof mealTypes[number]; recipeId: string }> = [];
    const result: MealPlanAutogenerateResult = {
      generatedCount: 0,
      occupiedSlotsSkipped: 0,
      unfilledSlots: [],
    };

    for (const date of dates) {
      for (const mealType of mealTypes) {
        if (occupied.has(`${date}|${mealType}`)) {
          result.occupiedSlotsSkipped++;
          continue;
        }
        const candidate = rankRecipesForAutogeneration(
          this.recipes.getAllVisibleRecipes(), mealType, this.inventory.items(), history,
          this.profiles.profile(), today
        ).find((entry) => !usedRecipes.has(entry.recipe.id));
        if (!candidate) {
          result.unfilledSlots.push({ date, mealType, reason: 'No eligible unused recipe was available.' });
          continue;
        }
        usedRecipes.add(candidate.recipe.id);
        inserts.push({ date, mealType, recipeId: candidate.recipe.id });
      }
    }

    const saved = await this.mealPlan.addRecipeSlotsBatch(inserts);
    if (saved.error) throw new Error(saved.error);
    result.generatedCount = saved.items.length;
    await Promise.all([
      this.mealPlan.loadWeekAndToday(this.mealPlan.weekStart()),
      this.mealPlan.loadRecentRecipeHistory(),
    ]);
    return result;
  }
}
