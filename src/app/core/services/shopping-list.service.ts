import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  ShoppingItem,
  ShoppingItemInput,
  ShoppingItemUpdate,
} from '../models/shopping-item.model';
import {
  computeMissingIngredients,
  filterNewShoppingItems,
} from '../../shared/utils/shopping-list.utils';
import { AuthService } from './auth.service';
import { FoodInventoryService } from './food-inventory.service';
import { LocalApiService } from './local-api.service';
import { MealPlanService } from './meal-plan.service';
import { RecipeService } from './recipe.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ShoppingListService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);
  private readonly mealPlanService = inject(MealPlanService);
  private readonly recipeService = inject(RecipeService);
  private readonly foodInventoryService = inject(FoodInventoryService);

  private readonly itemsSignal = signal<ShoppingItem[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly items = this.itemsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly uncheckedItems = computed(() =>
    this.itemsSignal().filter((item) => !item.is_checked)
  );
  readonly checkedItems = computed(() =>
    this.itemsSignal().filter((item) => item.is_checked)
  );
  readonly uncheckedCount = computed(() => this.uncheckedItems().length);
  readonly checkedCount = computed(() => this.checkedItems().length);

  async getShoppingItems(): Promise<void> {
    if (environment.useLocalApi) {
      return this.getShoppingItemsLocal();
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const { data, error } = await client
      .from('shopping_items')
      .select('*')
      .order('is_checked', { ascending: true })
      .order('created_at', { ascending: true });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    this.itemsSignal.set(this.normalizeItems(data));
  }

  async addShoppingItem(
    item: ShoppingItemInput
  ): Promise<{ item: ShoppingItem | null; error: string | null }> {
    if (environment.useLocalApi) {
      return this.addShoppingItemLocal(item);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { item: null, error: 'You must be signed in to add shopping items.' };
    }

    const name = item.name.trim();
    if (!name) {
      return { item: null, error: 'Name is required.' };
    }

    this.errorSignal.set(null);

    const { data, error } = await client
      .from('shopping_items')
      .insert({
        user_id: userId,
        name,
        quantity: item.quantity ?? null,
        unit: item.unit?.trim() || null,
        source: item.source ?? 'manual',
      })
      .select()
      .single();

    if (error) {
      this.errorSignal.set(error.message);
      return { item: null, error: error.message };
    }

    const created = this.normalizeItem(data);
    this.itemsSignal.update((items) => [...items, created]);
    return { item: created, error: null };
  }

  async updateShoppingItem(
    id: string,
    changes: ShoppingItemUpdate
  ): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.updateShoppingItemLocal(id, changes);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Unable to update shopping items right now.' };
    }

    this.errorSignal.set(null);

    const payload: ShoppingItemUpdate = { ...changes };
    if (payload.name !== undefined) {
      const trimmed = payload.name.trim();
      if (!trimmed) {
        return { error: 'Name is required.' };
      }
      payload.name = trimmed;
    }
    if (payload.unit !== undefined) {
      payload.unit = payload.unit?.trim() || null;
    }

    const { data, error } = await client
      .from('shopping_items')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    const updated = this.normalizeItem(data);
    this.itemsSignal.update((items) =>
      items.map((item) => (item.id === id ? updated : item))
    );
    return { error: null };
  }

  async toggleShoppingItem(
    id: string,
    isChecked: boolean
  ): Promise<{ error: string | null }> {
    return this.updateShoppingItem(id, { is_checked: isChecked });
  }

  async deleteShoppingItem(id: string): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.deleteShoppingItemLocal(id);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Unable to delete shopping items right now.' };
    }

    this.errorSignal.set(null);

    const { error } = await client.from('shopping_items').delete().eq('id', id);

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    this.itemsSignal.update((items) => items.filter((item) => item.id !== id));
    return { error: null };
  }

  async clearCheckedItems(): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.clearCheckedItemsLocal();
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to clear shopping items.' };
    }

    this.errorSignal.set(null);

    const { error } = await client
      .from('shopping_items')
      .delete()
      .eq('user_id', userId)
      .eq('is_checked', true);

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    this.itemsSignal.update((items) => items.filter((item) => !item.is_checked));
    return { error: null };
  }

  async generateFromMealPlan(
    weekStartDate: string
  ): Promise<{ addedCount: number; error: string | null }> {
    this.errorSignal.set(null);

    await Promise.all([
      this.recipeService.loadRecipes(),
      this.foodInventoryService.loadItems(),
      this.mealPlanService.getMealPlanForWeek(weekStartDate),
    ]);

    const missing = computeMissingIngredients(
      this.mealPlanService.entries(),
      this.recipeService.recipes(),
      this.foodInventoryService.items()
    );

    const toAdd = filterNewShoppingItems(missing, this.itemsSignal());

    if (toAdd.length === 0) {
      return { addedCount: 0, error: null };
    }

    let addedCount = 0;
    for (const ingredient of toAdd) {
      const result = await this.addShoppingItem({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        source: 'meal_plan',
      });
      if (result.error) {
        return { addedCount, error: result.error };
      }
      addedCount += 1;
    }

    return { addedCount, error: null };
  }

  async addCheckedItemsToInventory(): Promise<{
    addedCount: number;
    error: string | null;
  }> {
    const checked = this.checkedItems();
    if (checked.length === 0) {
      return { addedCount: 0, error: null };
    }

    this.errorSignal.set(null);

    let addedCount = 0;
    for (const item of checked) {
      const result = await this.foodInventoryService.createItem({
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit,
        location: 'pantry',
        category: null,
        expiration_date: null,
      });

      if (result.error) {
        return {
          addedCount,
          error: result.error,
        };
      }
      addedCount += 1;
    }

    const clearResult = await this.clearCheckedItems();
    if (clearResult.error) {
      return { addedCount, error: clearResult.error };
    }

    return { addedCount, error: null };
  }

  private normalizeItem(row: unknown): ShoppingItem {
    const item = row as ShoppingItem;
    return {
      ...item,
      quantity: item.quantity === null || item.quantity === undefined
        ? null
        : Number(item.quantity),
      is_checked: Boolean(item.is_checked),
    };
  }

  private normalizeItems(rows: unknown): ShoppingItem[] {
    if (!Array.isArray(rows)) {
      return [];
    }
    return rows.map((row) => this.normalizeItem(row));
  }

  private async getShoppingItemsLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getShoppingItems();
      this.itemsSignal.set(this.normalizeItems(data));
    } catch (error) {
      this.errorSignal.set(
        error instanceof Error ? error.message : 'Failed to load shopping items.'
      );
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private async addShoppingItemLocal(
    item: ShoppingItemInput
  ): Promise<{ item: ShoppingItem | null; error: string | null }> {
    if (!this.authService.user()) {
      return { item: null, error: 'You must be signed in to add shopping items.' };
    }

    const name = item.name.trim();
    if (!name) {
      return { item: null, error: 'Name is required.' };
    }

    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.createShoppingItem({
        name,
        quantity: item.quantity ?? null,
        unit: item.unit?.trim() || null,
        source: item.source ?? 'manual',
      });
      const created = this.normalizeItem(data);
      this.itemsSignal.update((items) => [...items, created]);
      return { item: created, error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to add shopping item.';
      this.errorSignal.set(message);
      return { item: null, error: message };
    }
  }

  private async updateShoppingItemLocal(
    id: string,
    changes: ShoppingItemUpdate
  ): Promise<{ error: string | null }> {
    this.errorSignal.set(null);

    const payload: ShoppingItemUpdate = { ...changes };
    if (payload.name !== undefined) {
      const trimmed = payload.name.trim();
      if (!trimmed) {
        return { error: 'Name is required.' };
      }
      payload.name = trimmed;
    }
    if (payload.unit !== undefined) {
      payload.unit = payload.unit?.trim() || null;
    }

    try {
      const data = await this.localApiService.updateShoppingItem(id, payload);
      const updated = this.normalizeItem(data);
      this.itemsSignal.update((items) =>
        items.map((item) => (item.id === id ? updated : item))
      );
      return { error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update shopping item.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }

  private async deleteShoppingItemLocal(id: string): Promise<{ error: string | null }> {
    this.errorSignal.set(null);

    try {
      await this.localApiService.deleteShoppingItem(id);
      this.itemsSignal.update((items) => items.filter((item) => item.id !== id));
      return { error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete shopping item.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }

  private async clearCheckedItemsLocal(): Promise<{ error: string | null }> {
    this.errorSignal.set(null);

    try {
      await this.localApiService.deleteCheckedShoppingItems();
      this.itemsSignal.update((items) => items.filter((item) => !item.is_checked));
      return { error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to clear checked items.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }
}
