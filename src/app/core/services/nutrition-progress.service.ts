import { Injectable, inject } from '@angular/core';
import { MealSlotItem } from '../models/meal-slot-item.model';
import { TodayNutritionProgress } from '../models/nutrition.model';
import { buildTodayNutritionProgress } from '../../shared/utils/nutrition-consumed.utils';
import { NutritionTargetsService } from './nutrition-targets.service';
import { UserProfileService } from './user-profile.service';

@Injectable({ providedIn: 'root' })
export class NutritionProgressService {
  private readonly nutritionTargetsService = inject(NutritionTargetsService);
  private readonly userProfileService = inject(UserProfileService);

  calculateDayNutritionProgress(
    date: string,
    items: MealSlotItem[]
  ): TodayNutritionProgress {
    const profile = this.userProfileService.profile();
    const targets = this.nutritionTargetsService.dailyTargets();

    return buildTodayNutritionProgress(date, items, profile, targets);
  }
}
