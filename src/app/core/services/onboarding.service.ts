import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  DashboardSmartAction,
  GeneratedOnboardingMealPlan,
  OnboardingDraftPatch,
  OnboardingState,
  OnboardingStatus,
  OnboardingStatusResponse,
  OnboardingStep,
  mealSlotToMealType,
} from '../../features/onboarding/models/onboarding.model';
import { AuthService } from './auth.service';
import { FoodInventoryService } from './food-inventory.service';
import { LocalApiService } from './local-api.service';
import { MealPlanService } from './meal-plan.service';
import { RecipeService } from './recipe.service';
import { ShoppingListService } from './shopping-list.service';
import { SupabaseService } from './supabase.service';
import { UserProfileService } from './user-profile.service';
import { addDays, getCurrentWeekStartDate } from '../../shared/utils/meal-plan.utils';

function defaultState(userId: string): OnboardingState {
  const now = new Date().toISOString();
  return {
    userId,
    status: 'pending',
    currentStep: 'welcome',
    goals: [],
    dietaryPreferences: ['none'],
    dislikedIngredients: [],
    allergies: [],
    cookingEffort: 'two_cooking_sessions',
    selectedMealSlots: ['lunch', 'dinner'],
    planningDays: 5,
    availableInventoryItems: [],
    createdAt: now,
    updatedAt: now,
  };
}

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly recipeService = inject(RecipeService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly foodInventoryService = inject(FoodInventoryService);

  private readonly statusSignal = signal<OnboardingStatus>('pending');
  private readonly loadingSignal = signal(false);

  readonly status = this.statusSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  async getStatus(): Promise<OnboardingStatusResponse> {
    if (environment.useLocalApi) {
      return this.getStatusLocal();
    }
    return this.getStatusSupabase();
  }

  async start(): Promise<{ error: string | null }> {
    return this.patchState({ status: 'in_progress', currentStep: 'welcome' });
  }

  async patchState(patch: OnboardingDraftPatch): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.patchStateLocal(patch);
    }
    return this.patchStateSupabase(patch);
  }

  async skip(): Promise<{ error: string | null }> {
    return this.patchState({
      status: 'skipped',
      currentStep: 'welcome',
      generatedPlan: null,
    });
  }

  async restart(): Promise<{ error: string | null }> {
    return this.patchState({
      status: 'in_progress',
      currentStep: 'welcome',
      generatedPlan: null,
    });
  }

  async confirmPlan(
    state: OnboardingState,
    plan: GeneratedOnboardingMealPlan
  ): Promise<{ error: string | null }> {
    this.loadingSignal.set(true);
    try {
      const recipeIdMap = new Map<string, string>();

      for (const pending of plan.pendingRecipes ?? []) {
        const { recipe, error } = await this.recipeService.createRecipe(
          {
            title: pending.title,
            description: pending.description,
            prep_time_minutes: pending.prepTimeMinutes,
            portions: pending.portions,
            tags: pending.tags,
          },
          pending.ingredients.map((ing) => ({
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
          }))
        );
        if (error || !recipe) {
          return { error: error ?? 'Could not save a generated recipe.' };
        }
        recipeIdMap.set(pending.tempKey, recipe.id);
      }

      for (const item of state.availableInventoryItems) {
        const { error } = await this.foodInventoryService.createItem({
          name: item.name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? null,
          location: item.location ?? 'pantry',
          category: null,
          expiration_date: null,
        });
        if (error) {
          return { error };
        }
      }

      const profile = await this.userProfileService.loadProfile();
      if (profile) {
        await this.userProfileService.updateDietaryPreferences(state.dietaryPreferences);
        for (const name of state.dislikedIngredients) {
          await this.userProfileService.addIngredientPreference('disliked', { ingredientName: name });
        }
        for (const name of state.allergies) {
          await this.userProfileService.addAllergy({ name });
        }
        await this.userProfileService.updateProfile({
          mealPlanningSettings: {
            enabledMealSlots: state.selectedMealSlots,
            defaultMealsPerDay: state.selectedMealSlots.length,
            preferredCookingDays: plan.cookingSessions.map((s) => {
              const d = new Date(`${s.date}T00:00:00`);
              return d.toLocaleDateString(undefined, { weekday: 'long' });
            }),
          },
        });
      }

      for (const day of plan.days) {
        for (const meal of day.meals) {
          for (const item of meal.items) {
            if (item.type === 'recipe') {
              const recipeId =
                item.recipeId ?? (item.tempRecipeKey ? recipeIdMap.get(item.tempRecipeKey) : null);
              if (!recipeId) continue;
              const { error } = await this.mealPlanService.addSlotItem({
                date: day.date,
                meal_type: mealSlotToMealType(meal.slot),
                item_type: 'recipe',
                recipe_id: recipeId,
                portions_used: item.portionsUsed ?? 1,
              });
              if (error) return { error };
            } else if (item.type === 'custom') {
              const { error } = await this.mealPlanService.addSlotItem({
                date: day.date,
                meal_type: mealSlotToMealType(meal.slot),
                item_type: 'custom',
                custom_name: item.name,
                notes: item.notes ?? null,
              });
              if (error) return { error };
            }
          }
        }
      }

      const weekStart = plan.weekStartDate || getCurrentWeekStartDate();
      const weekEnd = addDays(weekStart, state.planningDays - 1);
      const { error: shopError } = await this.shoppingListService.generateFromMealPlan(
        weekStart,
        weekEnd
      );
      if (shopError) return { error: shopError };

      const smartAction = plan.firstSmartAction ?? null;
      await this.patchState({
        status: 'completed',
        currentStep: 'complete',
        generatedPlan: null,
      });

      if (environment.useLocalApi) {
        await this.saveFirstSmartActionLocal(smartAction);
      } else {
        await this.saveFirstSmartActionSupabase(smartAction);
      }

      this.statusSignal.set('completed');
      return { error: null };
    } finally {
      this.loadingSignal.set(false);
    }
  }

  stateFromDraft(
    userId: string,
    status: OnboardingStatus,
    draft: OnboardingDraftPatch | null,
    currentStep: OnboardingStep | null
  ): OnboardingState {
    const base = defaultState(userId);
    if (!draft) {
      return { ...base, status, currentStep: currentStep ?? base.currentStep };
    }
    return {
      ...base,
      status,
      currentStep: draft.currentStep ?? currentStep ?? base.currentStep,
      goals: draft.goals ?? base.goals,
      dietaryPreferences: draft.dietaryPreferences ?? base.dietaryPreferences,
      dislikedIngredients: draft.dislikedIngredients ?? base.dislikedIngredients,
      allergies: draft.allergies ?? base.allergies,
      cookingEffort: draft.cookingEffort ?? base.cookingEffort,
      selectedMealSlots: draft.selectedMealSlots ?? base.selectedMealSlots,
      planningDays: draft.planningDays ?? base.planningDays,
      availableInventoryItems: draft.availableInventoryItems ?? base.availableInventoryItems,
      generatedPlan: draft.generatedPlan ?? undefined,
      updatedAt: new Date().toISOString(),
    };
  }

  draftFromState(state: OnboardingState): OnboardingDraftPatch {
    return {
      currentStep: state.currentStep,
      status: state.status,
      goals: state.goals,
      dietaryPreferences: state.dietaryPreferences,
      dislikedIngredients: state.dislikedIngredients,
      allergies: state.allergies,
      cookingEffort: state.cookingEffort,
      selectedMealSlots: state.selectedMealSlots,
      planningDays: state.planningDays,
      availableInventoryItems: state.availableInventoryItems,
      generatedPlan: state.generatedPlan ?? null,
    };
  }

  private async getStatusLocal(): Promise<OnboardingStatusResponse> {
    const data = await this.localApiService.getOnboardingStatus();
    const status = (data.status as OnboardingStatus) ?? 'pending';
    this.statusSignal.set(status);
    return {
      status,
      currentStep: data.currentStep as OnboardingStep | null,
      draft: data.draft as OnboardingDraftPatch | null,
      firstSmartAction: data.firstSmartAction as DashboardSmartAction | null,
    };
  }

  private async getStatusSupabase(): Promise<OnboardingStatusResponse> {
    const userId = this.authService.user()?.id;
    const client = this.supabaseService.getClient();
    if (!userId || !client) {
      return { status: 'pending', currentStep: null, draft: null, firstSmartAction: null };
    }

    await this.userProfileService.loadProfile();
    const { data, error } = await client
      .from('user_food_profiles')
      .select(
        'onboarding_status, onboarding_current_step, onboarding_draft_state, onboarding_first_smart_action'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return { status: 'pending', currentStep: null, draft: null, firstSmartAction: null };
    }

    const status = (data.onboarding_status as OnboardingStatus) ?? 'pending';
    this.statusSignal.set(status);
    return {
      status,
      currentStep: data.onboarding_current_step as OnboardingStep | null,
      draft: data.onboarding_draft_state as OnboardingDraftPatch | null,
      firstSmartAction: data.onboarding_first_smart_action as DashboardSmartAction | null,
    };
  }

  private async patchStateLocal(patch: OnboardingDraftPatch): Promise<{ error: string | null }> {
    try {
      await this.localApiService.patchOnboarding(patch as Record<string, unknown>);
      if (patch.status) {
        this.statusSignal.set(patch.status);
      }
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Could not save onboarding progress.',
      };
    }
  }

  private async patchStateSupabase(patch: OnboardingDraftPatch): Promise<{ error: string | null }> {
    const userId = this.authService.user()?.id;
    const client = this.supabaseService.getClient();
    if (!userId || !client) {
      return { error: 'You must be signed in.' };
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.status) updates['onboarding_status'] = patch.status;
    if (patch.currentStep) updates['onboarding_current_step'] = patch.currentStep;
    if (patch.goals) updates['onboarding_goals'] = patch.goals;
    if (patch.cookingEffort) updates['onboarding_cooking_effort'] = patch.cookingEffort;
    if (patch.planningDays) updates['onboarding_planning_days'] = patch.planningDays;

    const draftFields: OnboardingDraftPatch = { ...patch };
    if (Object.keys(draftFields).length > 0) {
      const { data: existing } = await client
        .from('user_food_profiles')
        .select('onboarding_draft_state')
        .eq('user_id', userId)
        .maybeSingle();

      const merged = {
        ...((existing?.onboarding_draft_state as OnboardingDraftPatch) ?? {}),
        ...draftFields,
      };
      updates['onboarding_draft_state'] = merged;
    }

    if (patch.status === 'completed') {
      updates['onboarding_completed_at'] = new Date().toISOString();
    }

    const { error } = await client
      .from('user_food_profiles')
      .update(updates)
      .eq('user_id', userId);

    if (error) {
      return { error: 'Could not save onboarding progress.' };
    }

    if (patch.status) {
      this.statusSignal.set(patch.status);
    }
    return { error: null };
  }

  private async saveFirstSmartActionLocal(action: DashboardSmartAction | null): Promise<void> {
    await this.localApiService.patchOnboarding({
      firstSmartAction: action,
      status: 'completed',
    });
  }

  private async saveFirstSmartActionSupabase(action: DashboardSmartAction | null): Promise<void> {
    const userId = this.authService.user()?.id;
    const client = this.supabaseService.getClient();
    if (!userId || !client) return;

    await client
      .from('user_food_profiles')
      .update({
        onboarding_first_smart_action: action,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }
}
