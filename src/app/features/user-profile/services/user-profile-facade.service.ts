import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AllergyInput,
  DietaryPreference,
  IngredientPreferenceInput,
  IngredientPreferenceType,
  MealPlanningUserSettings,
  SuggestedIngredient,
  UserFoodProfile,
  UserMealPlanningStats,
  UserProfileSaveState,
} from '../../../core/models/user-profile.model';
import { AuthService } from '../../../core/services/auth.service';
import { UserProfileService } from '../../../core/services/user-profile.service';

const SUCCESS_MESSAGE_MS = 3000;

@Injectable({ providedIn: 'root' })
export class UserProfileFacadeService {
  private readonly profileService = inject(UserProfileService);
  private readonly authService = inject(AuthService);

  private readonly saveStateSignal = signal<UserProfileSaveState>('idle');
  private readonly saveMessageSignal = signal<string | null>(null);
  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly profile = this.profileService.profile;
  readonly stats = this.profileService.stats;
  readonly suggestedIngredients = this.profileService.suggestedIngredients;
  readonly loading = this.profileService.loading;
  readonly saving = this.profileService.saving;
  readonly error = this.profileService.error;
  readonly saveState = this.saveStateSignal.asReadonly();
  readonly saveMessage = this.saveMessageSignal.asReadonly();

  readonly email = computed(() => this.profile()?.email ?? this.authService.user()?.email ?? '');

  readonly displayName = computed(() => {
    const profileName = this.profile()?.displayName?.trim();
    if (profileName) {
      return profileName;
    }
    const email = this.email();
    if (!email) {
      return 'Chef';
    }
    const local = email.split('@')[0]?.trim();
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Chef';
  });

  readonly initials = computed(() => {
    const name = this.displayName();
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  });

  readonly quickStats = computed(() => {
    const stats = this.stats();
    return {
      mealsPlannedThisWeek: stats?.mealsPlannedThisWeek ?? 0,
      completedWeeksStreak: stats?.completedWeeksStreak ?? 0,
    };
  });

  async loadAll(): Promise<void> {
    await Promise.all([
      this.profileService.loadProfile(),
      this.profileService.loadStats(),
      this.profileService.loadSuggestedIngredients(),
    ]);
  }

  async refreshStats(): Promise<void> {
    await this.profileService.loadStats();
  }

  async saveDisplayName(displayName: string): Promise<boolean> {
    const result = await this.profileService.updateProfile({ displayName: displayName.trim() });
    return this.handleSaveResult(result.error);
  }

  async saveDietaryPreferences(preferences: DietaryPreference[]): Promise<boolean> {
    const normalized =
      preferences.includes('none') && preferences.length > 1
        ? preferences.filter((preference) => preference !== 'none')
        : preferences.length > 0
          ? preferences
          : (['none'] as DietaryPreference[]);

    const result = await this.profileService.updateDietaryPreferences(normalized);
    return this.handleSaveResult(result.error);
  }

  async addIngredient(
    preferenceType: IngredientPreferenceType,
    input: IngredientPreferenceInput
  ): Promise<boolean> {
    const result = await this.profileService.addIngredientPreference(preferenceType, input);
    return this.handleSaveResult(result.error);
  }

  async removeIngredient(preferenceType: IngredientPreferenceType, id: string): Promise<boolean> {
    const result = await this.profileService.removeIngredientPreference(preferenceType, id);
    return this.handleSaveResult(result.error);
  }

  async addAllergy(input: AllergyInput): Promise<boolean> {
    const result = await this.profileService.addAllergy(input);
    return this.handleSaveResult(result.error);
  }

  async removeAllergy(id: string): Promise<boolean> {
    const result = await this.profileService.removeAllergy(id);
    return this.handleSaveResult(result.error);
  }

  async saveSettings(settings: Partial<MealPlanningUserSettings>): Promise<boolean> {
    const result = await this.profileService.updateProfile({ mealPlanningSettings: settings });
    return this.handleSaveResult(result.error);
  }

  async saveNutritionProfile(
    input: Parameters<UserProfileService['saveNutritionProfile']>[0]
  ): Promise<boolean> {
    const result = await this.profileService.saveNutritionProfile(input);
    return this.handleSaveResult(result.error);
  }

  async resetPreferences(): Promise<boolean> {
    const result = await this.profileService.resetProfile();
    return this.handleSaveResult(result.error);
  }

  exportProfile(): void {
    const profile = this.profile();
    if (!profile) {
      return;
    }
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pantryflow-profile.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  getProfileForSuggestions(): Pick<
    UserFoodProfile,
    'dietaryPreferences' | 'favoriteIngredients' | 'dislikedIngredients' | 'allergies'
  > | null {
    const profile = this.profile();
    if (!profile) {
      return null;
    }
    return {
      dietaryPreferences: profile.dietaryPreferences,
      favoriteIngredients: profile.favoriteIngredients,
      dislikedIngredients: profile.dislikedIngredients,
      allergies: profile.allergies,
    };
  }

  private handleSaveResult(error: string | null): boolean {
    if (error) {
      this.saveStateSignal.set('error');
      this.saveMessageSignal.set(error);
      return false;
    }

    this.saveStateSignal.set('saved');
    this.saveMessageSignal.set('Preferences saved.');
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }
    this.successTimeout = setTimeout(() => {
      this.saveStateSignal.set('idle');
      this.saveMessageSignal.set(null);
    }, SUCCESS_MESSAGE_MS);
    return true;
  }
}
