import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FoodItemHistory } from '../models/food-item-history.model';
import { FoodItem, FoodItemInsert, STORAGE_LOCATION_LABELS } from '../models/food-item.model';
import { ReusableInventoryItem } from '../models/reusable-inventory-item.model';
import { SearchSelectOption } from '../models/search-select-option.model';
import { AuthService } from './auth.service';
import { FoodIconService } from './food-icon.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';
import {
  formatInventoryName,
  normalizeNameKey,
} from '../../shared/utils/name-normalization.utils';
import {
  buildReusableInventoryItems,
  filterReusableItems,
} from '../../shared/utils/reusable-inventory.utils';

@Injectable({ providedIn: 'root' })
export class FoodItemHistoryService {
  private static readonly PAGE_SIZE = 5;

  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);
  private readonly foodIconService = inject(FoodIconService);

  private readonly historySignal = signal<FoodItemHistory[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly loadingMoreSignal = signal(false);
  private readonly hasMoreSignal = signal(true);
  private readonly errorSignal = signal<string | null>(null);

  readonly history = this.historySignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadingMore = this.loadingMoreSignal.asReadonly();
  readonly hasMore = this.hasMoreSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  filterHistory(query: string): FoodItemHistory[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return this.historySignal();
    }

    return this.historySignal().filter((entry) =>
      entry.name.toLowerCase().includes(normalizedQuery)
    );
  }

  getReusableItems(inventoryItems: FoodItem[]): ReusableInventoryItem[] {
    return buildReusableInventoryItems(
      this.historySignal(),
      inventoryItems,
      (name, category) => this.foodIconService.resolveIcon(name, category)
    );
  }

  filterReusableItems(items: ReusableInventoryItem[], query: string): ReusableInventoryItem[] {
    return filterReusableItems(items, query);
  }

  getHistoryOptions(query: string): SearchSelectOption[] {
    return this.filterHistory(query).map((entry) => ({
      id: `history-${entry.id}`,
      label: entry.name,
      subtitle: this.getHistorySubtitle(entry),
      payload: entry,
    }));
  }

  getCustomCategories(): string[] {
    const categories: string[] = [];

    for (const entry of this.historySignal()) {
      const category = entry.category?.trim();
      if (category && !categories.includes(category)) {
        categories.push(category);
      }
    }

    return categories;
  }

  async loadHistory(): Promise<void> {
    await this.fetchHistoryPage(0, false, 'initial');
  }

  async loadMoreHistory(): Promise<void> {
    if (
      !this.hasMoreSignal() ||
      this.loadingSignal() ||
      this.loadingMoreSignal()
    ) {
      return;
    }

    await this.fetchHistoryPage(
      this.historySignal().length,
      true,
      'more'
    );
  }

  async loadAllHistory(): Promise<void> {
    if (environment.useLocalApi) {
      return this.loadAllHistoryLocal();
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const { data, error } = await client
      .from('food_item_history')
      .select('*')
      .order('last_used_at', { ascending: false });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    const items = (data as FoodItemHistory[]) ?? [];
    this.historySignal.set(items);
    this.hasMoreSignal.set(false);
  }

  async upsertFromFoodItem(input: FoodItemInsert): Promise<void> {
    const formattedName = formatInventoryName(input.name);
    const payload = {
      name: formattedName,
      name_key: normalizeNameKey(formattedName),
      category: input.category?.trim() || null,
      unit: input.unit?.trim() || null,
      location: input.location,
      default_quantity: input.quantity,
      last_used_at: new Date().toISOString(),
    };

    if (environment.useLocalApi) {
      await this.upsertFromFoodItemLocal(payload);
      return;
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      return;
    }

    const { data: existing, error: fetchError } = await client
      .from('food_item_history')
      .select('id, times_added')
      .eq('user_id', userId)
      .eq('name_key', payload.name_key)
      .maybeSingle();

    if (fetchError) {
      this.errorSignal.set(fetchError.message);
      return;
    }

    if (existing) {
      const { data, error } = await client
        .from('food_item_history')
        .update({
          name: payload.name,
          category: payload.category,
          unit: payload.unit,
          location: payload.location,
          default_quantity: payload.default_quantity,
          last_used_at: payload.last_used_at,
          times_added: (existing.times_added ?? 0) + 1,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        this.errorSignal.set(error.message);
        return;
      }

      this.mergeHistoryEntry(data as FoodItemHistory);
      return;
    }

    const { data, error } = await client
      .from('food_item_history')
      .insert({
        ...payload,
        user_id: userId,
        times_added: 1,
      })
      .select()
      .single();

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    this.mergeHistoryEntry(data as FoodItemHistory);
  }

  private async fetchHistoryPage(
    offset: number,
    append: boolean,
    mode: 'initial' | 'more'
  ): Promise<void> {
    if (environment.useLocalApi) {
      return this.fetchHistoryPageLocal(offset, append, mode);
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return;
    }

    const loadingSignal =
      mode === 'initial' ? this.loadingSignal : this.loadingMoreSignal;
    loadingSignal.set(true);
    if (mode === 'initial') {
      this.errorSignal.set(null);
    }

    const pageSize = FoodItemHistoryService.PAGE_SIZE;
    const { data, error, count } = await client
      .from('food_item_history')
      .select('*', { count: 'exact' })
      .order('last_used_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    loadingSignal.set(false);

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    const items = (data as FoodItemHistory[]) ?? [];
    const hasMore = offset + items.length < (count ?? 0);
    this.applyHistoryPage(items, append, hasMore);
  }

  private async fetchHistoryPageLocal(
    offset: number,
    append: boolean,
    mode: 'initial' | 'more'
  ): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    const loadingSignal =
      mode === 'initial' ? this.loadingSignal : this.loadingMoreSignal;
    loadingSignal.set(true);
    if (mode === 'initial') {
      this.errorSignal.set(null);
    }

    try {
      const data = await this.localApiService.getFoodItemHistory(
        FoodItemHistoryService.PAGE_SIZE,
        offset
      );
      const items = data as FoodItemHistory[];
      const hasMore = items.length === FoodItemHistoryService.PAGE_SIZE;
      this.applyHistoryPage(items, append, hasMore);
    } catch (error) {
      this.errorSignal.set(
        error instanceof Error ? error.message : 'Failed to load food item history.'
      );
    } finally {
      loadingSignal.set(false);
    }
  }

  private async loadAllHistoryLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getFoodItemHistory();
      this.historySignal.set(data as FoodItemHistory[]);
      this.hasMoreSignal.set(false);
    } catch (error) {
      this.errorSignal.set(
        error instanceof Error ? error.message : 'Failed to load food item history.'
      );
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private applyHistoryPage(
    items: FoodItemHistory[],
    append: boolean,
    hasMore: boolean
  ): void {
    if (append) {
      this.historySignal.update((existing) => [...existing, ...items]);
    } else {
      this.historySignal.set(items);
    }

    this.hasMoreSignal.set(hasMore);
  }

  private async upsertFromFoodItemLocal(payload: {
    name: string;
    name_key: string;
    category: string | null;
    unit: string | null;
    location: string;
    default_quantity: number;
    last_used_at: string;
  }): Promise<void> {
    const existing = this.historySignal().find(
      (entry) => normalizeNameKey(entry.name) === payload.name_key
    );

    if (existing) {
      this.mergeHistoryEntry({
        ...existing,
        name: payload.name,
        category: payload.category,
        unit: payload.unit,
        location: payload.location as FoodItemHistory['location'],
        default_quantity: payload.default_quantity,
        last_used_at: payload.last_used_at,
        times_added: (existing.times_added ?? 1) + 1,
      });
      return;
    }

    const userId = this.authService.user()?.id;
    if (!userId) {
      return;
    }

    this.mergeHistoryEntry({
      id: crypto.randomUUID(),
      user_id: userId,
      name: payload.name,
      category: payload.category,
      unit: payload.unit,
      location: payload.location as FoodItemHistory['location'],
      default_quantity: payload.default_quantity,
      last_used_at: payload.last_used_at,
      created_at: payload.last_used_at,
      times_added: 1,
    });
  }

  private mergeHistoryEntry(entry: FoodItemHistory): void {
    this.historySignal.update((items) => {
      const nameKey = normalizeNameKey(entry.name);
      const filtered = items.filter((item) => normalizeNameKey(item.name) !== nameKey);
      return [entry, ...filtered].sort((a, b) =>
        b.last_used_at.localeCompare(a.last_used_at)
      );
    });
  }

  private getHistorySubtitle(entry: FoodItemHistory): string {
    const parts = [
      entry.category,
      STORAGE_LOCATION_LABELS[entry.location],
      `${entry.default_quantity}${entry.unit ? ` ${entry.unit}` : ''}`,
    ].filter(Boolean);

    return parts.join(' · ');
  }
}
