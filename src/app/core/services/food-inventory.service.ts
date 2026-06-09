import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  FoodItem,
  FoodItemInsert,
  FoodItemUpdate,
  InventoryFilter,
} from '../models/food-item.model';
import { AuthService } from './auth.service';
import { FoodItemHistoryService } from './food-item-history.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';
import { isExpired, isExpiringSoon } from '../../shared/utils/expiration.utils';
import { formatInventoryName } from '../../shared/utils/name-normalization.utils';

@Injectable({ providedIn: 'root' })
export class FoodInventoryService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);
  private readonly foodItemHistoryService = inject(FoodItemHistoryService);

  private readonly itemsSignal = signal<FoodItem[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly items = this.itemsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly totalCount = computed(() => this.itemsSignal().length);
  readonly expiredCount = computed(
    () => this.itemsSignal().filter((item) => isExpired(item.expiration_date)).length
  );
  readonly expiringSoonCount = computed(
    () =>
      this.itemsSignal().filter(
        (item) =>
          isExpiringSoon(item.expiration_date, 3) && !isExpired(item.expiration_date)
      ).length
  );
  readonly locationCounts = computed(() => {
    const counts = { fridge: 0, freezer: 0, pantry: 0 };
    for (const item of this.itemsSignal()) {
      counts[item.location]++;
    }
    return counts;
  });
  readonly useFirstItems = computed(() =>
    [...this.itemsSignal()]
      .filter(
        (item) =>
          item.expiration_date &&
          !isExpired(item.expiration_date)
      )
      .sort((a, b) => (a.expiration_date ?? '').localeCompare(b.expiration_date ?? ''))
      .slice(0, 5)
  );

  filterItems(items: FoodItem[], filter: InventoryFilter): FoodItem[] {
    switch (filter) {
      case 'fridge':
      case 'freezer':
      case 'pantry':
        return items.filter((item) => item.location === filter);
      case 'expiring_soon':
        return items.filter(
          (item) =>
            isExpiringSoon(item.expiration_date, 3) && !isExpired(item.expiration_date)
        );
      default:
        return items;
    }
  }

  async loadItems(): Promise<void> {
    if (environment.useLocalApi) {
      return this.loadItemsLocal();
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const { data, error } = await client
      .from('food_items')
      .select('*')
      .order('expiration_date', { ascending: true, nullsFirst: false });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    this.itemsSignal.set((data as FoodItem[]) ?? []);
  }

  async createItem(input: FoodItemInsert): Promise<{ error: string | null }> {
    const sanitized = this.sanitizeInput(input);

    if (environment.useLocalApi) {
      return this.createItemLocal(sanitized);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to add food items.' };
    }

    this.errorSignal.set(null);

    const { data, error } = await client
      .from('food_items')
      .insert({
        ...sanitized,
        user_id: userId,
        category: sanitized.category?.trim() || null,
        unit: sanitized.unit?.trim() || null,
        expiration_date: sanitized.expiration_date || null,
      })
      .select()
      .single();

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    this.itemsSignal.update((items) => [...items, data as FoodItem]);
    await this.foodItemHistoryService.upsertFromFoodItem(sanitized);
    return { error: null };
  }

  async updateItem(id: string, input: FoodItemUpdate): Promise<{ error: string | null }> {
    const sanitized = this.sanitizeInput(input);

    if (environment.useLocalApi) {
      return this.updateItemLocal(id, sanitized);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Unable to update food items right now.' };
    }

    this.errorSignal.set(null);

    const { data, error } = await client
      .from('food_items')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    this.itemsSignal.update((items) =>
      items.map((item) => (item.id === id ? (data as FoodItem) : item))
    );
    await this.foodItemHistoryService.upsertFromFoodItem({
      name: (data as FoodItem).name,
      category: (data as FoodItem).category,
      quantity: (data as FoodItem).quantity,
      unit: (data as FoodItem).unit,
      expiration_date: (data as FoodItem).expiration_date,
      location: (data as FoodItem).location,
    });
    return { error: null };
  }

  async deleteItem(id: string): Promise<{ error: string | null }> {
    if (environment.useLocalApi) {
      return this.deleteItemLocal(id);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Unable to delete food items right now.' };
    }

    this.errorSignal.set(null);

    const { error } = await client.from('food_items').delete().eq('id', id);

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    this.itemsSignal.update((items) => items.filter((item) => item.id !== id));
    return { error: null };
  }

  private async loadItemsLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getFoodItems();
      this.itemsSignal.set(data as FoodItem[]);
    } catch (error) {
      this.errorSignal.set(error instanceof Error ? error.message : 'Failed to load items.');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private sanitizeInput<T extends FoodItemInsert | FoodItemUpdate>(input: T): T {
    const sanitized = { ...input };
    if (sanitized.name !== undefined) {
      sanitized.name = formatInventoryName(sanitized.name);
    }
    if (sanitized.category !== undefined) {
      sanitized.category = sanitized.category?.trim() || null;
    }
    if (sanitized.unit !== undefined) {
      sanitized.unit = sanitized.unit?.trim() || null;
    }
    if (sanitized.expiration_date === '') {
      sanitized.expiration_date = null;
    }
    return sanitized;
  }

  private async createItemLocal(input: FoodItemInsert): Promise<{ error: string | null }> {
    if (!this.authService.user()) {
      return { error: 'You must be signed in to add food items.' };
    }

    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.createFoodItem({
        ...input,
        category: input.category?.trim() || null,
        unit: input.unit?.trim() || null,
        expiration_date: input.expiration_date || null,
      });
      this.itemsSignal.update((items) => [...items, data as FoodItem]);
      await this.foodItemHistoryService.upsertFromFoodItem(input);
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create item.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }

  private async updateItemLocal(
    id: string,
    input: FoodItemUpdate
  ): Promise<{ error: string | null }> {
    this.errorSignal.set(null);

    const payload: FoodItemUpdate = { ...input };

    try {
      const data = await this.localApiService.updateFoodItem(id, payload);
      this.itemsSignal.update((items) =>
        items.map((item) => (item.id === id ? (data as FoodItem) : item))
      );
      await this.foodItemHistoryService.upsertFromFoodItem({
        name: (data as FoodItem).name,
        category: (data as FoodItem).category,
        quantity: (data as FoodItem).quantity,
        unit: (data as FoodItem).unit,
        expiration_date: (data as FoodItem).expiration_date,
        location: (data as FoodItem).location,
      });
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update item.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }

  private async deleteItemLocal(id: string): Promise<{ error: string | null }> {
    this.errorSignal.set(null);

    try {
      await this.localApiService.deleteFoodItem(id);
      this.itemsSignal.update((items) => items.filter((item) => item.id !== id));
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete item.';
      this.errorSignal.set(message);
      return { error: message };
    }
  }
}
