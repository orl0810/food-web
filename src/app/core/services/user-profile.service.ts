import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AllergyInput,
  DEFAULT_MEAL_PLANNING_SETTINGS,
  DietaryPreference,
  IngredientPreferenceInput,
  IngredientPreferenceType,
  MealPlanningUserSettings,
  SuggestedIngredient,
  UserAllergy,
  UserFoodProfile,
  UserIngredientPreference,
  UserMealPlanningStats,
  UserProfileUpdateInput,
} from '../models/user-profile.model';
import { MealSlotItem } from '../models/meal-slot-item.model';
import { Recipe } from '../models/recipe.model';
import {
  buildUserMealPlanningStats,
  getStatsDateRange,
} from '../../shared/utils/user-meal-plan-stats.utils';
import { normalizeNameKey } from '../../shared/utils/name-normalization.utils';
import {
  buildAllergy,
  buildIngredientPreference,
  validateAllergyAddition,
  validateIngredientAddition,
} from '../../shared/utils/user-profile-validation.utils';
import { AuthService } from './auth.service';
import { FoodItemHistoryService } from './food-item-history.service';
import { LocalApiService } from './local-api.service';
import { MealPlanService } from './meal-plan.service';
import { RecipeService } from './recipe.service';
import { SupabaseService } from './supabase.service';

interface ProfileRow {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  default_meals_per_day: number;
  enabled_meal_slots: string[] | string;
  preferred_cooking_days: string[] | string | null;
  preferred_shopping_day: string | null;
  preferred_units: string;
  household_size: number;
  default_portions_per_recipe: number;
  expiring_items_reminder_enabled: boolean;
  onboarding_status?: string;
  onboarding_first_smart_action?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);
  private readonly historyService = inject(FoodItemHistoryService);

  private readonly profileSignal = signal<UserFoodProfile | null>(null);
  private readonly statsSignal = signal<UserMealPlanningStats | null>(null);
  private readonly suggestedSignal = signal<SuggestedIngredient[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly savingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly profile = this.profileSignal.asReadonly();
  readonly stats = this.statsSignal.asReadonly();
  readonly suggestedIngredients = this.suggestedSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  async loadProfile(): Promise<UserFoodProfile | null> {
    if (environment.useLocalApi) {
      return this.loadProfileLocal();
    }
    return this.loadProfileSupabase();
  }

  async loadStats(): Promise<UserMealPlanningStats | null> {
    const userId = this.authService.user()?.id;
    if (!userId) {
      return null;
    }

    const { start, end } = getStatsDateRange();
    const items = await this.mealPlanService.fetchMealPlanForDateRange(start, end);
    await this.recipeService.loadRecipes();
    const recipes = this.recipeService.recipes();
    const stats = buildUserMealPlanningStats(items as MealSlotItem[], recipes as Recipe[], userId);
    this.statsSignal.set(stats);
    return stats;
  }

  async loadSuggestedIngredients(limit = 10): Promise<SuggestedIngredient[]> {
    if (environment.useLocalApi) {
      const data = await this.localApiService.getSuggestedIngredients(limit);
      const suggested = (data as SuggestedIngredient[]).map((entry) => ({
        name: entry.name,
        normalizedName: entry.normalizedName,
        category: entry.category ?? null,
        usageCount: entry.usageCount,
        lastUsedAt: entry.lastUsedAt ?? null,
      }));
      this.suggestedSignal.set(suggested);
      return suggested;
    }

    await this.historyService.loadHistory();
    const suggested = [...this.historyService.history()]
      .sort((a, b) => (b.times_added ?? 0) - (a.times_added ?? 0))
      .slice(0, limit)
      .map((entry) => ({
        name: entry.name,
        normalizedName: normalizeNameKey(entry.name),
        category: entry.category,
        usageCount: entry.times_added ?? 1,
        lastUsedAt: entry.last_used_at,
      }));
    this.suggestedSignal.set(suggested);
    return suggested;
  }

  async updateProfile(input: UserProfileUpdateInput): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.updateProfileLocal(input);
    }
    return this.updateProfileSupabase(input);
  }

  async updateDietaryPreferences(
    preferences: DietaryPreference[]
  ): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    const normalized = preferences.length > 0 ? preferences : (['none'] as DietaryPreference[]);

    if (environment.useLocalApi) {
      return this.wrapSave(async () => {
        const data = await this.localApiService.updateUserDietaryPreferences(normalized);
        return this.normalizeProfile(data);
      });
    }

    return this.wrapSave(async () => {
      const userId = this.requireUserId();
      await this.ensureProfileRow(userId);

      const client = this.requireClient();
      await client.from('user_dietary_preferences').delete().eq('user_id', userId);
      if (normalized.length > 0) {
        const { error } = await client.from('user_dietary_preferences').insert(
          normalized.map((preference) => ({ user_id: userId, preference }))
        );
        if (error) {
          throw new Error(error.message);
        }
      }
      await client
        .from('user_food_profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      return this.fetchFullProfile(userId);
    });
  }

  async addIngredientPreference(
    preferenceType: IngredientPreferenceType,
    input: IngredientPreferenceInput
  ): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    const profile = this.profileSignal();
    if (!profile) {
      await this.loadProfile();
    }
    const current = this.profileSignal();
    if (!current) {
      return { profile: null, error: 'Profile not loaded.' };
    }

    const validationError = validateIngredientAddition(current, preferenceType, input);
    if (validationError) {
      return { profile: current, error: validationError.message };
    }

    const built = buildIngredientPreference(input, preferenceType);

    if (environment.useLocalApi) {
      return this.wrapSave(async () => {
        const data = await this.localApiService.patchUserIngredientPreference({
          action: 'add',
          preferenceType,
          ingredient: {
            ingredientName: built.ingredientName,
            category: built.category,
            source: built.source,
            usageCount: built.usageCount,
          },
        });
        return this.normalizeProfile(data);
      });
    }

    return this.wrapSave(async () => {
      const userId = this.requireUserId();
      await this.ensureProfileRow(userId);
      const client = this.requireClient();

      const { error } = await client.from('user_ingredient_preferences').insert({
        user_id: userId,
        ingredient_name: built.ingredientName,
        normalized_name: built.normalizedName,
        category: built.category,
        preference_type: preferenceType,
        source: built.source,
        usage_count: built.usageCount,
      });
      if (error) {
        throw new Error(error.message);
      }

      return this.fetchFullProfile(userId);
    });
  }

  async removeIngredientPreference(
    preferenceType: IngredientPreferenceType,
    id: string
  ): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.wrapSave(async () => {
        const data = await this.localApiService.patchUserIngredientPreference({
          action: 'remove',
          preferenceType,
          id,
        });
        return this.normalizeProfile(data);
      });
    }

    return this.wrapSave(async () => {
      const userId = this.requireUserId();
      const client = this.requireClient();
      const { error } = await client
        .from('user_ingredient_preferences')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .eq('preference_type', preferenceType);
      if (error) {
        throw new Error(error.message);
      }
      return this.fetchFullProfile(userId);
    });
  }

  async addAllergy(input: AllergyInput): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    const current = this.profileSignal();
    if (!current) {
      await this.loadProfile();
    }
    const profile = this.profileSignal();
    if (!profile) {
      return { profile: null, error: 'Profile not loaded.' };
    }

    const validationError = validateAllergyAddition(profile, input);
    if (validationError) {
      return { profile, error: validationError.message };
    }

    const built = buildAllergy(input);

    if (environment.useLocalApi) {
      return this.wrapSave(async () => {
        const data = await this.localApiService.patchUserAllergy({
          action: 'add',
          allergy: built,
        });
        return this.normalizeProfile(data);
      });
    }

    return this.wrapSave(async () => {
      const userId = this.requireUserId();
      await this.ensureProfileRow(userId);
      const client = this.requireClient();

      await client
        .from('user_ingredient_preferences')
        .delete()
        .eq('user_id', userId)
        .eq('normalized_name', built.normalizedName);

      const { error } = await client.from('user_allergies').insert({
        user_id: userId,
        name: built.name,
        normalized_name: built.normalizedName,
        severity: built.severity,
        notes: built.notes,
        strict_exclusion: true,
      });
      if (error) {
        throw new Error(error.message);
      }

      return this.fetchFullProfile(userId);
    });
  }

  async removeAllergy(id: string): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.wrapSave(async () => {
        const data = await this.localApiService.patchUserAllergy({ action: 'remove', id });
        return this.normalizeProfile(data);
      });
    }

    return this.wrapSave(async () => {
      const userId = this.requireUserId();
      const client = this.requireClient();
      const { error } = await client.from('user_allergies').delete().eq('id', id).eq('user_id', userId);
      if (error) {
        throw new Error(error.message);
      }
      return this.fetchFullProfile(userId);
    });
  }

  async resetProfile(): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.wrapSave(async () => {
        const data = await this.localApiService.resetUserFoodProfile();
        return this.normalizeProfile(data);
      });
    }

    return this.wrapSave(async () => {
      const userId = this.requireUserId();
      const client = this.requireClient();

      await client.from('user_dietary_preferences').delete().eq('user_id', userId);
      await client.from('user_ingredient_preferences').delete().eq('user_id', userId);
      await client.from('user_allergies').delete().eq('user_id', userId);

      await client
        .from('user_food_profiles')
        .update({
          display_name: this.defaultDisplayName(),
          avatar_url: null,
          default_meals_per_day: DEFAULT_MEAL_PLANNING_SETTINGS.defaultMealsPerDay,
          enabled_meal_slots: DEFAULT_MEAL_PLANNING_SETTINGS.enabledMealSlots,
          preferred_cooking_days: null,
          preferred_shopping_day: null,
          preferred_units: DEFAULT_MEAL_PLANNING_SETTINGS.preferredUnits,
          household_size: DEFAULT_MEAL_PLANNING_SETTINGS.householdSize,
          default_portions_per_recipe: DEFAULT_MEAL_PLANNING_SETTINGS.defaultPortionsPerRecipe,
          expiring_items_reminder_enabled: DEFAULT_MEAL_PLANNING_SETTINGS.expiringItemsReminderEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      await client.from('user_dietary_preferences').insert({ user_id: userId, preference: 'none' });
      return this.fetchFullProfile(userId);
    });
  }

  private async loadProfileLocal(): Promise<UserFoodProfile | null> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const data = await this.localApiService.getUserFoodProfile();
      const profile = this.normalizeProfile(data);
      this.profileSignal.set(profile);
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile.';
      this.errorSignal.set(message);
      return null;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async loadProfileSupabase(): Promise<UserFoodProfile | null> {
    const userId = this.authService.user()?.id;
    if (!userId) {
      return null;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      await this.ensureProfileRow(userId);
      const profile = await this.fetchFullProfile(userId);
      this.profileSignal.set(profile);
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile.';
      this.errorSignal.set(message);
      return null;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async updateProfileLocal(
    input: UserProfileUpdateInput
  ): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    return this.wrapSave(async () => {
      const data = await this.localApiService.updateUserFoodProfile({
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        mealPlanningSettings: input.mealPlanningSettings,
      });
      return this.normalizeProfile(data);
    });
  }

  private async updateProfileSupabase(
    input: UserProfileUpdateInput
  ): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    return this.wrapSave(async () => {
      const userId = this.requireUserId();
      await this.ensureProfileRow(userId);
      const client = this.requireClient();

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.displayName !== undefined) {
        updates['display_name'] = input.displayName.trim() || this.defaultDisplayName();
      }
      if (input.avatarUrl !== undefined) {
        updates['avatar_url'] = input.avatarUrl;
      }

      const settings = input.mealPlanningSettings;
      if (settings) {
        if (settings.defaultMealsPerDay !== undefined) {
          updates['default_meals_per_day'] = settings.defaultMealsPerDay;
        }
        if (settings.enabledMealSlots !== undefined) {
          updates['enabled_meal_slots'] = settings.enabledMealSlots;
        }
        if (settings.preferredCookingDays !== undefined) {
          updates['preferred_cooking_days'] = settings.preferredCookingDays;
        }
        if (settings.preferredShoppingDay !== undefined) {
          updates['preferred_shopping_day'] = settings.preferredShoppingDay;
        }
        if (settings.preferredUnits !== undefined) {
          updates['preferred_units'] = settings.preferredUnits;
        }
        if (settings.householdSize !== undefined) {
          updates['household_size'] = settings.householdSize;
        }
        if (settings.defaultPortionsPerRecipe !== undefined) {
          updates['default_portions_per_recipe'] = settings.defaultPortionsPerRecipe;
        }
        if (settings.expiringItemsReminderEnabled !== undefined) {
          updates['expiring_items_reminder_enabled'] = settings.expiringItemsReminderEnabled;
        }
      }

      const { error } = await client.from('user_food_profiles').update(updates).eq('user_id', userId);
      if (error) {
        throw new Error(error.message);
      }

      return this.fetchFullProfile(userId);
    });
  }

  async ensureProfileForUser(userId: string): Promise<void> {
    if (environment.useLocalApi) {
      await this.localApiService.getUserFoodProfile();
      return;
    }
    await this.ensureProfileRow(userId);
  }

  private async ensureProfileRow(userId: string): Promise<void> {
    const client = this.requireClient();
    const { data } = await client.from('user_food_profiles').select('id').eq('user_id', userId).maybeSingle();
    if (data) {
      return;
    }

    const { error: insertError } = await client.from('user_food_profiles').insert({
      user_id: userId,
      display_name: this.defaultDisplayName(),
      default_meals_per_day: DEFAULT_MEAL_PLANNING_SETTINGS.defaultMealsPerDay,
      enabled_meal_slots: DEFAULT_MEAL_PLANNING_SETTINGS.enabledMealSlots,
      preferred_units: DEFAULT_MEAL_PLANNING_SETTINGS.preferredUnits,
      household_size: DEFAULT_MEAL_PLANNING_SETTINGS.householdSize,
      default_portions_per_recipe: DEFAULT_MEAL_PLANNING_SETTINGS.defaultPortionsPerRecipe,
      expiring_items_reminder_enabled: DEFAULT_MEAL_PLANNING_SETTINGS.expiringItemsReminderEnabled,
    });
    if (insertError) {
      throw new Error(insertError.message);
    }

    await client.from('user_dietary_preferences').insert({ user_id: userId, preference: 'none' });
  }

  private async fetchFullProfile(userId: string): Promise<UserFoodProfile> {
    const client = this.requireClient();
    const email = this.authService.user()?.email;

    const [profileResult, dietaryResult, ingredientResult, allergyResult] = await Promise.all([
      client.from('user_food_profiles').select('*').eq('user_id', userId).single(),
      client.from('user_dietary_preferences').select('preference').eq('user_id', userId),
      client
        .from('user_ingredient_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('ingredient_name'),
      client.from('user_allergies').select('*').eq('user_id', userId).order('name'),
    ]);

    if (profileResult.error) {
      throw new Error(profileResult.error.message);
    }

    const row = profileResult.data as ProfileRow;
    const dietaryPreferences = (dietaryResult.data ?? []).map(
      (entry: { preference: DietaryPreference }) => entry.preference
    );
    const ingredients = (ingredientResult.data ?? []) as {
      id: string;
      ingredient_name: string;
      normalized_name: string;
      category: string | null;
      preference_type: IngredientPreferenceType;
      source: UserIngredientPreference['source'];
      usage_count: number | null;
      last_used_at: string | null;
    }[];

    const favoriteIngredients = ingredients
      .filter((entry) => entry.preference_type === 'favorite')
      .map(this.mapIngredientRow);
    const dislikedIngredients = ingredients
      .filter((entry) => entry.preference_type === 'disliked')
      .map(this.mapIngredientRow);

    const allergies = ((allergyResult.data ?? []) as {
      id: string;
      name: string;
      normalized_name: string;
      severity: UserAllergy['severity'];
      notes: string | null;
      strict_exclusion: boolean;
    }[]).map((entry) => ({
      id: entry.id,
      name: entry.name,
      normalizedName: entry.normalized_name,
      severity: entry.severity,
      notes: entry.notes,
      strictExclusion: true as const,
    }));

    return this.buildProfileFromRow(row, {
      email,
      dietaryPreferences: dietaryPreferences.length > 0 ? dietaryPreferences : ['none'],
      favoriteIngredients,
      dislikedIngredients,
      allergies,
    });
  }

  private mapIngredientRow(entry: {
    id: string;
    ingredient_name: string;
    normalized_name: string;
    category: string | null;
    source: UserIngredientPreference['source'];
    usage_count: number | null;
    last_used_at: string | null;
  }): UserIngredientPreference {
    return {
      id: entry.id,
      ingredientName: entry.ingredient_name,
      normalizedName: entry.normalized_name,
      category: entry.category,
      source: entry.source,
      usageCount: entry.usage_count,
      lastUsedAt: entry.last_used_at,
    };
  }

  private normalizeProfile(data: unknown): UserFoodProfile {
    const raw = data as Record<string, unknown>;
    const settings = raw['mealPlanningSettings'] as Record<string, unknown>;

    return {
      id: String(raw['id']),
      userId: String(raw['userId']),
      displayName: String(raw['displayName'] ?? this.defaultDisplayName()),
      email: raw['email'] ? String(raw['email']) : this.authService.user()?.email,
      avatarUrl: (raw['avatarUrl'] as string | null) ?? null,
      dietaryPreferences: (raw['dietaryPreferences'] as DietaryPreference[]) ?? ['none'],
      favoriteIngredients: (raw['favoriteIngredients'] as UserIngredientPreference[]) ?? [],
      dislikedIngredients: (raw['dislikedIngredients'] as UserIngredientPreference[]) ?? [],
      allergies: (raw['allergies'] as UserAllergy[]) ?? [],
      mealPlanningSettings: {
        defaultMealsPerDay: Number(settings?.['defaultMealsPerDay'] ?? 3),
        enabledMealSlots: (settings?.['enabledMealSlots'] as MealPlanningUserSettings['enabledMealSlots']) ?? [
          'breakfast',
          'lunch',
          'dinner',
        ],
        preferredCookingDays: (settings?.['preferredCookingDays'] as string[]) ?? [],
        preferredShoppingDay: (settings?.['preferredShoppingDay'] as string | null) ?? null,
        preferredUnits: settings?.['preferredUnits'] === 'imperial' ? 'imperial' : 'metric',
        householdSize: Number(settings?.['householdSize'] ?? 2),
        defaultPortionsPerRecipe: Number(settings?.['defaultPortionsPerRecipe'] ?? 4),
        expiringItemsReminderEnabled: Boolean(settings?.['expiringItemsReminderEnabled'] ?? true),
      },
      onboardingStatus: raw['onboardingStatus'] as UserFoodProfile['onboardingStatus'],
      onboardingFirstSmartAction: (raw['onboardingFirstSmartAction'] as UserFoodProfile['onboardingFirstSmartAction']) ?? null,
      createdAt: String(raw['createdAt']),
      updatedAt: String(raw['updatedAt']),
    };
  }

  private buildProfileFromRow(
    row: ProfileRow,
    extras: {
      email?: string;
      dietaryPreferences: DietaryPreference[];
      favoriteIngredients: UserIngredientPreference[];
      dislikedIngredients: UserIngredientPreference[];
      allergies: UserAllergy[];
    }
  ): UserFoodProfile {
    const parseArray = <T>(value: string[] | string | null | undefined, fallback: T[]): T[] => {
      if (Array.isArray(value)) {
        return value as T[];
      }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value) as T[];
          return Array.isArray(parsed) ? parsed : fallback;
        } catch {
          return fallback;
        }
      }
      return fallback;
    };

    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name || this.defaultDisplayName(),
      email: extras.email,
      avatarUrl: row.avatar_url,
      dietaryPreferences: extras.dietaryPreferences,
      favoriteIngredients: extras.favoriteIngredients,
      dislikedIngredients: extras.dislikedIngredients,
      allergies: extras.allergies,
      mealPlanningSettings: {
        defaultMealsPerDay: row.default_meals_per_day,
        enabledMealSlots: parseArray(row.enabled_meal_slots, DEFAULT_MEAL_PLANNING_SETTINGS.enabledMealSlots),
        preferredCookingDays: parseArray(row.preferred_cooking_days, []),
        preferredShoppingDay: row.preferred_shopping_day,
        preferredUnits: row.preferred_units === 'imperial' ? 'imperial' : 'metric',
        householdSize: row.household_size,
        defaultPortionsPerRecipe: row.default_portions_per_recipe,
        expiringItemsReminderEnabled: Boolean(row.expiring_items_reminder_enabled),
      },
      onboardingStatus: (row.onboarding_status as UserFoodProfile['onboardingStatus']) ?? 'pending',
      onboardingFirstSmartAction: row.onboarding_first_smart_action
        ? (row.onboarding_first_smart_action as unknown as UserFoodProfile['onboardingFirstSmartAction'])
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async wrapSave(
    operation: () => Promise<UserFoodProfile>
  ): Promise<{ profile: UserFoodProfile | null; error: string | null }> {
    this.savingSignal.set(true);
    this.errorSignal.set(null);
    try {
      const profile = await operation();
      this.profileSignal.set(profile);
      return { profile, error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile.';
      this.errorSignal.set(message);
      return { profile: this.profileSignal(), error: message };
    } finally {
      this.savingSignal.set(false);
    }
  }

  private defaultDisplayName(): string {
    const email = this.authService.user()?.email;
    if (!email) {
      return 'Chef';
    }
    const local = email.split('@')[0]?.trim();
    return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'Chef';
  }

  private requireUserId(): string {
    const userId = this.authService.user()?.id;
    if (!userId) {
      throw new Error('You must be signed in.');
    }
    return userId;
  }

  private requireClient() {
    const client = this.supabaseService.getClient();
    if (!client) {
      throw new Error('Database is not configured.');
    }
    return client;
  }
}
