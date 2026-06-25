import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { MealType } from '../models/meal-plan.model';
import { MealSlotItem, MealSlotItemInput, MealSlotItemStatus } from '../models/meal-slot-item.model';
import { Recipe } from '../models/recipe.model';
import { FoodItem } from '../models/food-item.model';
import { PreparedPortion } from '../models/prepared-portion.model';
import {
  addDays,
  getMondayOfWeek,
  getWeekDates,
  isPastDate,
  toISODate,
} from '../../shared/utils/meal-plan.utils';
import { isPortionExpired } from '../../shared/utils/prepared-portion.utils';
import { normalizeTags } from '../../shared/utils/tag.utils';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { PreparedPortionService } from './prepared-portion.service';
import { SupabaseService } from './supabase.service';

const MEAL_PLAN_ITEM_SELECT = `
  *,
  recipe:recipes(id, title, description, tags, prep_time_minutes),
  prepared_portion:prepared_portions(id, name, available_portions, expires_at, storage_location),
  inventory_item:food_items(id, name, quantity, unit, location, expiration_date)
`;

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);
  private readonly preparedPortionService = inject(PreparedPortionService);
  private readonly injector = inject(Injector);

  private readonly itemsSignal = signal<MealSlotItem[]>([]);
  private readonly todayItemsSignal = signal<MealSlotItem[]>([]);
  private readonly weekStartSignal = signal(getMondayOfWeek(new Date()));
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly entries = this.itemsSignal.asReadonly();
  readonly todayEntries = this.todayItemsSignal.asReadonly();
  readonly weekStart = this.weekStartSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly weekDates = computed(() => getWeekDates(this.weekStartSignal()));

  readonly weekSlotItems = computed(() => {
    const map = new Map<string, MealSlotItem[]>();
    for (const item of this.itemsSignal()) {
      const key = `${item.date}|${item.meal_type}`;
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    }
    for (const [key, items] of map) {
      map.set(key, [...items].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)));
    }
    return map;
  });

  /** @deprecated Use weekSlotItems */
  readonly weekEntries = this.weekSlotItems;

  readonly todaysMeals = computed(() => {
    const today = toISODate(new Date());
    const map = new Map<MealType, MealSlotItem[]>();
    for (const item of this.todayItemsSignal()) {
      if (item.date === today) {
        const existing = map.get(item.meal_type) ?? [];
        existing.push(item);
        map.set(item.meal_type, existing);
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
      .from('meal_plan_items')
      .select(MEAL_PLAN_ITEM_SELECT)
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('sort_order', { ascending: true });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set('Could not load your meal plan. Please try again.');
      return;
    }

    this.itemsSignal.set(this.normalizeItems(data));
  }

  async fetchMealPlanForDateRange(
    startDate: string,
    endDate: string
  ): Promise<MealSlotItem[]> {
    if (startDate > endDate) {
      return [];
    }

    if (environment.useLocalApi) {
      return this.fetchMealPlanForDateRangeLocal(startDate, endDate);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return [];
    }

    const { data, error } = await client
      .from('meal_plan_items')
      .select(MEAL_PLAN_ITEM_SELECT)
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      return [];
    }

    return this.normalizeItems(data);
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
      .from('meal_plan_items')
      .select(MEAL_PLAN_ITEM_SELECT)
      .eq('user_id', userId)
      .eq('date', today)
      .order('meal_type', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      this.errorSignal.set('Could not load today\'s meals. Please try again.');
      return;
    }

    this.todayItemsSignal.set(this.normalizeItems(data));
  }

  async loadWeekAndToday(startDate?: string): Promise<void> {
    const weekStart = getMondayOfWeek(startDate ?? this.weekStartSignal());
    this.weekStartSignal.set(weekStart);
    await Promise.all([
      this.getMealPlanForWeek(weekStart),
      this.getTodayMeals(),
    ]);
  }

  async addSlotItem(
    input: MealSlotItemInput
  ): Promise<{ item: MealSlotItem | null; error: string | null }> {
    if (isPastDate(input.date)) {
      return {
        item: null,
        error: 'You can only plan meals for today and upcoming days.',
      };
    }

    if (input.item_type === 'prepared_portion' && input.prepared_portion_id) {
      const portion = this.preparedPortionService.getPortionById(input.prepared_portion_id);
      if (portion && isPortionExpired(portion) && !input.allow_expired) {
        return { item: null, error: 'This portion has expired. Confirm to use anyway.' };
      }
    }

    if (environment.useLocalApi) {
      return this.addSlotItemLocal(input);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { item: null, error: 'You must be signed in to plan meals.' };
    }

    this.errorSignal.set(null);

    const slotItems = this.getItemsForSlot(input.date, input.meal_type);
    const row = this.buildInsertRow(userId, input, slotItems.length);

    if (input.item_type === 'prepared_portion' && input.prepared_portion_id) {
      const assignResult = await this.preparedPortionService.assignPortions(
        input.prepared_portion_id,
        input.portions_used ?? 1,
        input.allow_expired ?? false
      );
      if (assignResult.error) {
        return { item: null, error: assignResult.error };
      }
    }

    const { data, error } = await client
      .from('meal_plan_items')
      .insert(row)
      .select(MEAL_PLAN_ITEM_SELECT)
      .single();

    if (error) {
      if (input.item_type === 'prepared_portion' && input.prepared_portion_id) {
        await this.preparedPortionService.releasePortions(
          input.prepared_portion_id,
          input.portions_used ?? 1
        );
      }
      const message = 'Could not add this item. Please try again.';
      this.errorSignal.set(message);
      return { item: null, error: message };
    }

    const item = this.normalizeItem(data);
    this.addItemToSignals(item);
    return { item, error: null };
  }

  async assignRecipeToMeal(
    date: string,
    mealType: MealType,
    recipeId: string
  ): Promise<{ entry: MealSlotItem | null; error: string | null }> {
    const result = await this.addSlotItem({
      date,
      meal_type: mealType,
      item_type: 'recipe',
      recipe_id: recipeId,
    });
    return { entry: result.item, error: result.error };
  }

  async removeSlotItem(id: string): Promise<{ error: string | null }> {
    const item = this.findItemById(id);
    if (!item) {
      return { error: 'Item not found.' };
    }

    if (environment.useLocalApi) {
      return this.removeSlotItemLocal(item);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to update your meal plan.' };
    }

    this.errorSignal.set(null);

    const { error } = await client
      .from('meal_plan_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      const message = 'Could not remove this item. Please try again.';
      this.errorSignal.set(message);
      return { error: message };
    }

    if (item.item_type === 'prepared_portion' && item.prepared_portion_id) {
      await this.preparedPortionService.releasePortions(
        item.prepared_portion_id,
        item.portions_used
      );
    }

    this.removeItemFromSignals(id);
    return { error: null };
  }

  /** @deprecated Use removeSlotItem */
  async removeMealPlanEntry(id: string): Promise<{ error: string | null }> {
    return this.removeSlotItem(id);
  }

  async updateSlotItemStatus(
    id: string,
    status: MealSlotItemStatus
  ): Promise<{ error: string | null }> {
    const itemBeforeUpdate = this.findItemById(id);
    const completedAt = status === 'planned' ? null : new Date().toISOString();

    if (environment.useLocalApi) {
      const result = await this.updateSlotItemStatusLocal(id, status, completedAt);
      this.notifyStreakIfNeeded(itemBeforeUpdate, status, result.error);
      return result;
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to update your meal plan.' };
    }

    this.errorSignal.set(null);

    const { error } = await client
      .from('meal_plan_items')
      .update({ status, completed_at: completedAt })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      const message = 'Could not update this item. Please try again.';
      this.errorSignal.set(message);
      return { error: message };
    }

    this.patchItemInSignals(id, { status, completed_at: completedAt });
    this.notifyStreakIfNeeded(itemBeforeUpdate, status, null);
    return { error: null };
  }

  getItemById(id: string): MealSlotItem | undefined {
    return this.findItemById(id);
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

    const { data: sourceItems, error: sourceError } = await client
      .from('meal_plan_items')
      .select('*')
      .eq('user_id', userId)
      .gte('date', previousStart)
      .lte('date', previousEnd);

    if (sourceError) {
      const message = 'Could not copy last week\'s meals. Please try again.';
      this.errorSignal.set(message);
      return { copiedCount: 0, error: message };
    }

    const targetWeekDates = getWeekDates(targetStart);
    const targetStartDate = targetWeekDates[0];
    const targetEndDate = targetWeekDates[6];

    const { data: existingItems, error: existingError } = await client
      .from('meal_plan_items')
      .select('date, meal_type')
      .eq('user_id', userId)
      .gte('date', targetStartDate)
      .lte('date', targetEndDate);

    if (existingError) {
      const message = 'Could not copy last week\'s meals. Please try again.';
      this.errorSignal.set(message);
      return { copiedCount: 0, error: message };
    }

    const occupiedSlots = new Set(
      (existingItems ?? []).map((entry) => `${entry.date}|${entry.meal_type}`)
    );

    let copiedCount = 0;

    for (const source of sourceItems ?? []) {
      const targetDate = addDays(source.date as string, 7);
      const slotKey = `${targetDate}|${source.meal_type}`;

      if (isPastDate(targetDate)) {
        continue;
      }

      if (occupiedSlots.has(slotKey)) {
        continue;
      }

      if (source.item_type === 'prepared_portion' && source.prepared_portion_id) {
        continue;
      }

      const { error: insertError } = await client.from('meal_plan_items').insert({
        user_id: userId,
        date: targetDate,
        meal_type: source.meal_type,
        item_type: source.item_type,
        recipe_id: source.recipe_id,
        inventory_item_id: source.inventory_item_id,
        custom_name: source.custom_name,
        quantity: source.quantity,
        unit: source.unit,
        portions_used: source.portions_used,
        notes: source.notes,
        sort_order: source.sort_order,
      });

      if (!insertError) {
        copiedCount++;
      }
    }

    await this.loadWeekAndToday(targetStart);
    return { copiedCount, error: null };
  }

  getItemsForSlot(date: string, mealType: MealType): MealSlotItem[] {
    return this.weekSlotItems().get(`${date}|${mealType}`) ?? [];
  }

  /** @deprecated Use getItemsForSlot */
  getEntryForSlot(date: string, mealType: MealType): MealSlotItem | undefined {
    return this.getItemsForSlot(date, mealType)[0];
  }

  private buildInsertRow(
    userId: string,
    input: MealSlotItemInput,
    sortOrder: number
  ): Record<string, unknown> {
    return {
      user_id: userId,
      date: input.date,
      meal_type: input.meal_type,
      item_type: input.item_type,
      recipe_id: input.item_type === 'recipe' ? input.recipe_id ?? null : null,
      prepared_portion_id:
        input.item_type === 'prepared_portion' ? input.prepared_portion_id ?? null : null,
      inventory_item_id:
        input.item_type === 'inventory_item' ? input.inventory_item_id ?? null : null,
      custom_name: input.item_type === 'custom' ? input.custom_name?.trim() ?? null : null,
      quantity: input.quantity ?? null,
      unit: input.unit?.trim() ?? null,
      portions_used: input.portions_used ?? 1,
      notes: input.notes?.trim() ?? null,
      sort_order: input.sort_order ?? sortOrder,
    };
  }

  private findItemById(id: string): MealSlotItem | undefined {
    return (
      this.itemsSignal().find((item) => item.id === id) ??
      this.todayItemsSignal().find((item) => item.id === id)
    );
  }

  private notifyStreakIfNeeded(
    item: MealSlotItem | undefined,
    status: MealSlotItemStatus,
    error: string | null
  ): void {
    if (error || !item || !this.authService.user()?.id) {
      return;
    }

    if (status === 'eaten' || item.status === 'eaten') {
      void import('./meal-streak.service').then(({ MealStreakService }) => {
        void this.injector.get(MealStreakService).handleCompletionChanged(item.date);
      });
    }
  }

  private async fetchMealPlanForDateRangeLocal(
    startDate: string,
    endDate: string
  ): Promise<MealSlotItem[]> {
    if (!this.localApiService.isEnabled()) {
      return [];
    }

    try {
      const data = await this.localApiService.getMealPlanItems(startDate, endDate);
      return this.normalizeItems(data);
    } catch {
      return [];
    }
  }

  private async getMealPlanForWeekLocal(startDate: string): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const weekDates = getWeekDates(getMondayOfWeek(startDate));
      const data = await this.localApiService.getMealPlanItems(weekDates[0], weekDates[6]);
      this.itemsSignal.set(this.normalizeItems(data));
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
      const data = await this.localApiService.getTodayMealPlanItems();
      this.todayItemsSignal.set(this.normalizeItems(data));
    } catch {
      this.errorSignal.set('Could not load today\'s meals. Please try again.');
    }
  }

  private async addSlotItemLocal(
    input: MealSlotItemInput
  ): Promise<{ item: MealSlotItem | null; error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { item: null, error: 'You must be signed in to plan meals.' };
    }

    if (input.item_type === 'prepared_portion' && input.prepared_portion_id) {
      const assignResult = await this.preparedPortionService.assignPortions(
        input.prepared_portion_id,
        input.portions_used ?? 1,
        input.allow_expired ?? false
      );
      if (assignResult.error) {
        return { item: null, error: assignResult.error };
      }
    }

    try {
      const slotItems = this.getItemsForSlot(input.date, input.meal_type);
      const data = await this.localApiService.createMealPlanItem({
        ...input,
        sort_order: input.sort_order ?? slotItems.length,
      });
      const item = this.normalizeItem(data);
      this.addItemToSignals(item);
      return { item, error: null };
    } catch (err) {
      if (input.item_type === 'prepared_portion' && input.prepared_portion_id) {
        await this.preparedPortionService.releasePortions(
          input.prepared_portion_id,
          input.portions_used ?? 1
        );
      }
      const message = err instanceof Error ? err.message : 'Could not add this item. Please try again.';
      this.errorSignal.set(message);
      return { item: null, error: message };
    }
  }

  private async removeSlotItemLocal(item: MealSlotItem): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'You must be signed in to update your meal plan.' };
    }

    try {
      await this.localApiService.deleteMealPlanItem(item.id);

      if (item.item_type === 'prepared_portion' && item.prepared_portion_id) {
        await this.preparedPortionService.releasePortions(
          item.prepared_portion_id,
          item.portions_used
        );
      }

      this.removeItemFromSignals(item.id);
      return { error: null };
    } catch {
      const message = 'Could not remove this item. Please try again.';
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

  private async updateSlotItemStatusLocal(
    id: string,
    status: MealSlotItemStatus,
    completedAt: string | null
  ): Promise<{ error: string | null }> {
    if (!this.localApiService.isEnabled()) {
      return { error: 'You must be signed in to update your meal plan.' };
    }

    try {
      await this.localApiService.updateMealPlanItem(id, {
        status,
        completed_at: completedAt,
      });
      this.patchItemInSignals(id, { status, completed_at: completedAt });
      return { error: null };
    } catch {
      const message = 'Could not update this item. Please try again.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }

  private patchItemInSignals(id: string, patch: Partial<MealSlotItem>): void {
    const apply = (items: MealSlotItem[]): MealSlotItem[] =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item));

    this.itemsSignal.update(apply);
    this.todayItemsSignal.update(apply);
  }

  private addItemToSignals(item: MealSlotItem): void {
    this.itemsSignal.update((items) => [...items, item]);

    if (item.date === toISODate(new Date())) {
      this.todayItemsSignal.update((items) => [...items, item]);
    }
  }

  private removeItemFromSignals(id: string): void {
    const removed = this.findItemById(id);

    this.itemsSignal.update((items) => items.filter((item) => item.id !== id));

    if (removed && removed.date === toISODate(new Date())) {
      this.todayItemsSignal.update((items) => items.filter((item) => item.id !== id));
    }
  }

  private normalizeItems(data: unknown): MealSlotItem[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((row) => this.normalizeItem(row));
  }

  private normalizeItem(row: unknown): MealSlotItem {
    const item = row as MealSlotItem & {
      recipe?: Recipe | Recipe[] | null;
      prepared_portion?: PreparedPortion | PreparedPortion[] | null;
      inventory_item?: FoodItem | FoodItem[] | null;
    };

    const recipeData = Array.isArray(item.recipe) ? item.recipe[0] : item.recipe;
    const portionData = Array.isArray(item.prepared_portion)
      ? item.prepared_portion[0]
      : item.prepared_portion;
    const inventoryData = Array.isArray(item.inventory_item)
      ? item.inventory_item[0]
      : item.inventory_item;

    return {
      ...item,
      portions_used: Number(item.portions_used ?? 1),
      quantity: item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : null,
      sort_order: Number(item.sort_order ?? 0),
      status: item.status ?? 'planned',
      completed_at: item.completed_at ?? null,
      recipe: recipeData
        ? {
            id: recipeData.id,
            title: recipeData.title,
            description: recipeData.description ?? null,
            tags: normalizeTags(recipeData.tags ?? []),
            prep_time_minutes: recipeData.prep_time_minutes ?? null,
          }
        : undefined,
      prepared_portion: portionData
        ? {
            id: portionData.id,
            name: portionData.name,
            available_portions: Number(portionData.available_portions),
            expires_at: portionData.expires_at ?? null,
            storage_location: portionData.storage_location ?? null,
          }
        : undefined,
      inventory_item: inventoryData
        ? {
            id: inventoryData.id,
            name: inventoryData.name,
            quantity: Number(inventoryData.quantity),
            unit: inventoryData.unit ?? null,
            location: inventoryData.location,
            expiration_date: inventoryData.expiration_date ?? null,
          }
        : undefined,
    };
  }
}
