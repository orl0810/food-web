import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  MealPlanEntry,
  MealType,
} from '../models/meal-plan.model';
import { Recipe } from '../models/recipe.model';
import {
  addDays,
  getMondayOfWeek,
  getWeekDates,
  toISODate,
} from '../../shared/utils/meal-plan.utils';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

const MEAL_PLAN_SELECT = '*, recipe:recipes(id, title, description, tags, prep_time_minutes)';

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);

  private readonly entriesSignal = signal<MealPlanEntry[]>([]);
  private readonly todayEntriesSignal = signal<MealPlanEntry[]>([]);
  private readonly weekStartSignal = signal(getMondayOfWeek(new Date()));
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly entries = this.entriesSignal.asReadonly();
  readonly todayEntries = this.todayEntriesSignal.asReadonly();
  readonly weekStart = this.weekStartSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly weekDates = computed(() => getWeekDates(this.weekStartSignal()));

  readonly weekEntries = computed(() => {
    const map = new Map<string, MealPlanEntry>();
    for (const entry of this.entriesSignal()) {
      map.set(`${entry.date}|${entry.meal_type}`, entry);
    }
    return map;
  });

  readonly todaysMeals = computed(() => {
    const today = toISODate(new Date());
    const map = new Map<MealType, MealPlanEntry>();
    for (const entry of this.todayEntriesSignal()) {
      if (entry.date === today && entry.recipe_id) {
        map.set(entry.meal_type, entry);
      }
    }
    return map;
  });

  getWeekDates(startDate: string): string[] {
    return getWeekDates(startDate);
  }

  setWeekStart(startDate: string): void {
    this.weekStartSignal.set(getMondayOfWeek(startDate));
  }

  goToPreviousWeek(): void {
    this.weekStartSignal.update((start) => addDays(start, -7));
  }

  goToNextWeek(): void {
    this.weekStartSignal.update((start) => addDays(start, 7));
  }

  goToTodayWeek(): void {
    this.weekStartSignal.set(getMondayOfWeek(new Date()));
  }

  async getMealPlanForWeek(startDate: string): Promise<void> {
    if (environment.useLocalApi) {
      return this.getMealPlanForWeekLocal(startDate);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const weekDates = getWeekDates(getMondayOfWeek(startDate));
    const start = weekDates[0];
    const end = weekDates[6];

    const { data, error } = await client
      .from('meal_plan')
      .select(MEAL_PLAN_SELECT)
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set('Could not load your meal plan. Please try again.');
      return;
    }

    this.entriesSignal.set(this.normalizeEntries(data));
  }

  async getTodayMeals(): Promise<void> {
    if (environment.useLocalApi) {
      return this.getTodayMealsLocal();
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return;
    }

    const today = toISODate(new Date());

    const { data, error } = await client
      .from('meal_plan')
      .select(MEAL_PLAN_SELECT)
      .eq('user_id', userId)
      .eq('date', today)
      .order('meal_type', { ascending: true });

    if (error) {
      this.errorSignal.set('Could not load today\'s meals. Please try again.');
      return;
    }

    this.todayEntriesSignal.set(this.normalizeEntries(data));
  }

  async loadWeekAndToday(startDate?: string): Promise<void> {
    const weekStart = getMondayOfWeek(startDate ?? this.weekStartSignal());
    this.weekStartSignal.set(weekStart);
    await Promise.all([
      this.getMealPlanForWeek(weekStart),
      this.getTodayMeals(),
    ]);
  }

  async assignRecipeToMeal(
    date: string,
    mealType: MealType,
    recipeId: string
  ): Promise<{ entry: MealPlanEntry | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.assignRecipeToMealLocal(date, mealType, recipeId);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { entry: null, error: 'You must be signed in to plan meals.' };
    }

    this.errorSignal.set(null);

    const { data, error } = await client
      .from('meal_plan')
      .upsert(
        {
          user_id: userId,
          date,
          meal_type: mealType,
          recipe_id: recipeId,
        },
        { onConflict: 'user_id,date,meal_type' }
      )
      .select(MEAL_PLAN_SELECT)
      .single();

    if (error) {
      const message = 'Could not assign this recipe. Please try again.';
      this.errorSignal.set(message);
      return { entry: null, error: message };
    }

    const entry = this.normalizeEntry(data);
    this.updateEntryInSignals(entry);
    return { entry, error: null };
  }

  async removeMealPlanEntry(id: string): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.removeMealPlanEntryLocal(id);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to update your meal plan.' };
    }

    this.errorSignal.set(null);

    const { error } = await client
      .from('meal_plan')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      const message = 'Could not remove this meal. Please try again.';
      this.errorSignal.set(message);
      return { error: message };
    }

    this.removeEntryFromSignals(id);
    return { error: null };
  }

  async duplicatePreviousWeek(
    targetWeekStartDate: string
  ): Promise<{ copiedCount: number; error: string | null }> {
    if (environment.useLocalApi) {
      return this.duplicatePreviousWeekLocal(targetWeekStartDate);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { copiedCount: 0, error: 'You must be signed in to duplicate your meal plan.' };
    }

    this.errorSignal.set(null);

    const targetStart = getMondayOfWeek(targetWeekStartDate);
    const previousStart = addDays(targetStart, -7);
    const previousEnd = addDays(targetStart, -1);

    const { data: sourceEntries, error: sourceError } = await client
      .from('meal_plan')
      .select('date, meal_type, recipe_id')
      .eq('user_id', userId)
      .gte('date', previousStart)
      .lte('date', previousEnd)
      .not('recipe_id', 'is', null);

    if (sourceError) {
      const message = 'Could not copy last week\'s meals. Please try again.';
      this.errorSignal.set(message);
      return { copiedCount: 0, error: message };
    }

    const targetWeekDates = getWeekDates(targetStart);
    const targetStartDate = targetWeekDates[0];
    const targetEndDate = targetWeekDates[6];

    const { data: existingEntries, error: existingError } = await client
      .from('meal_plan')
      .select('date, meal_type')
      .eq('user_id', userId)
      .gte('date', targetStartDate)
      .lte('date', targetEndDate);

    if (existingError) {
      const message = 'Could not copy last week\'s meals. Please try again.';
      this.errorSignal.set(message);
      return { copiedCount: 0, error: message };
    }

    const occupied = new Set(
      (existingEntries ?? []).map((entry) => `${entry.date}|${entry.meal_type}`)
    );

    const rowsToInsert = (sourceEntries ?? [])
      .filter((entry) => entry.recipe_id)
      .map((entry) => {
        const targetDate = addDays(entry.date as string, 7);
        return {
          user_id: userId,
          date: targetDate,
          meal_type: entry.meal_type as MealType,
          recipe_id: entry.recipe_id as string,
        };
      })
      .filter((row) => !occupied.has(`${row.date}|${row.meal_type}`));

    if (rowsToInsert.length === 0) {
      return { copiedCount: 0, error: null };
    }

    const { error: insertError } = await client.from('meal_plan').insert(rowsToInsert);

    if (insertError) {
      const message = 'Could not copy last week\'s meals. Please try again.';
      this.errorSignal.set(message);
      return { copiedCount: 0, error: message };
    }

    await this.loadWeekAndToday(targetStart);
    return { copiedCount: rowsToInsert.length, error: null };
  }

  getEntryForSlot(date: string, mealType: MealType): MealPlanEntry | undefined {
    return this.weekEntries().get(`${date}|${mealType}`);
  }

  private async getMealPlanForWeekLocal(startDate: string): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const weekDates = getWeekDates(getMondayOfWeek(startDate));
      const data = await this.localApiService.getMealPlan(weekDates[0], weekDates[6]);
      this.entriesSignal.set(this.normalizeEntries(data));
    } catch {
      this.errorSignal.set('Could not load your meal plan. Please try again.');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async getTodayMealsLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    try {
      const data = await this.localApiService.getTodayMeals();
      this.todayEntriesSignal.set(this.normalizeEntries(data));
    } catch {
      this.errorSignal.set('Could not load today\'s meals. Please try again.');
    }
  }

  private async assignRecipeToMealLocal(
    date: string,
    mealType: MealType,
    recipeId: string
  ): Promise<{ entry: MealPlanEntry | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { entry: null, error: 'You must be signed in to plan meals.' };
    }

    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.upsertMealPlanEntry({
        date,
        meal_type: mealType,
        recipe_id: recipeId,
      });
      const entry = this.normalizeEntry(data);
      this.updateEntryInSignals(entry);
      return { entry, error: null };
    } catch {
      const message = 'Could not assign this recipe. Please try again.';
      this.errorSignal.set(message);
      return { entry: null, error: message };
    }
  }

  private async removeMealPlanEntryLocal(
    id: string
  ): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'You must be signed in to update your meal plan.' };
    }

    this.errorSignal.set(null);

    try {
      await this.localApiService.deleteMealPlanEntry(id);
      this.removeEntryFromSignals(id);
      return { error: null };
    } catch {
      const message = 'Could not remove this meal. Please try again.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }

  private async duplicatePreviousWeekLocal(
    targetWeekStartDate: string
  ): Promise<{ copiedCount: number; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { copiedCount: 0, error: 'You must be signed in to duplicate your meal plan.' };
    }

    this.errorSignal.set(null);

    try {
      const result = await this.localApiService.duplicateMealPlanWeek(
        getMondayOfWeek(targetWeekStartDate)
      );
      await this.loadWeekAndToday(targetWeekStartDate);
      return { copiedCount: result.copiedCount, error: null };
    } catch {
      const message = 'Could not copy last week\'s meals. Please try again.';
      this.errorSignal.set(message);
      return { copiedCount: 0, error: message };
    }
  }

  private updateEntryInSignals(entry: MealPlanEntry): void {
    this.entriesSignal.update((entries) => {
      const filtered = entries.filter(
        (existing) =>
          !(existing.date === entry.date && existing.meal_type === entry.meal_type)
      );
      return [...filtered, entry];
    });

    if (entry.date === toISODate(new Date())) {
      this.todayEntriesSignal.update((entries) => {
        const filtered = entries.filter(
          (existing) => existing.meal_type !== entry.meal_type
        );
        return [...filtered, entry];
      });
    }
  }

  private removeEntryFromSignals(id: string): void {
    const removed = this.entriesSignal().find((entry) => entry.id === id);

    this.entriesSignal.update((entries) => entries.filter((entry) => entry.id !== id));

    if (removed && removed.date === toISODate(new Date())) {
      this.todayEntriesSignal.update((entries) =>
        entries.filter((entry) => entry.id !== id)
      );
    }
  }

  private normalizeEntries(data: unknown): MealPlanEntry[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((row) => this.normalizeEntry(row));
  }

  private normalizeEntry(row: unknown): MealPlanEntry {
    const entry = row as MealPlanEntry & { recipe?: Recipe | Recipe[] | null };
    const recipeData = Array.isArray(entry.recipe) ? entry.recipe[0] : entry.recipe;

    return {
      ...entry,
      recipe: recipeData
        ? {
            id: recipeData.id,
            title: recipeData.title,
            description: recipeData.description ?? null,
            tags: recipeData.tags ?? [],
            prep_time_minutes: recipeData.prep_time_minutes ?? null,
          }
        : undefined,
    };
  }
}
