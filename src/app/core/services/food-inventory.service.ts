import { Injectable, computed, inject, signal } from '@angular/core';
import {
  FoodItem,
  FoodItemInsert,
  FoodItemUpdate,
  InventoryFilter,
} from '../models/food-item.model';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { isExpired, isExpiringSoon } from '../../shared/utils/expiration.utils';

@Injectable({ providedIn: 'root' })
export class FoodInventoryService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

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
    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return { error: 'You must be signed in to add food items.' };
    }

    this.errorSignal.set(null);

    const { data, error } = await client
      .from('food_items')
      .insert({
        ...input,
        user_id: userId,
        category: input.category?.trim() || null,
        unit: input.unit?.trim() || null,
        expiration_date: input.expiration_date || null,
      })
      .select()
      .single();

    if (error) {
      this.errorSignal.set(error.message);
      return { error: error.message };
    }

    this.itemsSignal.update((items) => [...items, data as FoodItem]);
    return { error: null };
  }

  async updateItem(id: string, input: FoodItemUpdate): Promise<{ error: string | null }> {
    const client = this.supabaseService.getClient();
    if (!client) {
      return { error: 'Unable to update food items right now.' };
    }

    this.errorSignal.set(null);

    const payload: FoodItemUpdate = { ...input };
    if (payload.category !== undefined) {
      payload.category = payload.category?.trim() || null;
    }
    if (payload.unit !== undefined) {
      payload.unit = payload.unit?.trim() || null;
    }
    if (payload.expiration_date === '') {
      payload.expiration_date = null;
    }

    const { data, error } = await client
      .from('food_items')
      .update(payload)
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
    return { error: null };
  }

  async deleteItem(id: string): Promise<{ error: string | null }> {
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
}
