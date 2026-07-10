import { Injectable, computed, inject } from '@angular/core';
import {
  calculateDailyNutritionTargets,
  hasRequiredNutritionProfileData,
} from '../../shared/utils/nutrition-targets.utils';
import { DailyNutritionTargets } from '../models/nutrition.model';
import { UserProfileService } from './user-profile.service';

@Injectable({ providedIn: 'root' })
export class NutritionTargetsService {
  private readonly userProfileService = inject(UserProfileService);

  readonly hasRequiredProfileData = computed(() =>
    hasRequiredNutritionProfileData(this.userProfileService.profile())
  );

  readonly dailyTargets = computed((): DailyNutritionTargets | null => {
    const profile = this.userProfileService.profile();
    if (!profile || !this.hasRequiredProfileData()) {
      return null;
    }

    return calculateDailyNutritionTargets(profile);
  });

  async ensureProfileLoaded(): Promise<void> {
    if (!this.userProfileService.profile()) {
      await this.userProfileService.loadProfile();
    }
  }
}
