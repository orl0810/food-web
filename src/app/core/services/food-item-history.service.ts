import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FoodItemHistory } from '../models/food-item-history.model';
import { FoodItemInsert, STORAGE_LOCATION_LABELS } from '../models/food-item.model';
import { SearchSelectOption } from '../models/search-select-option.model';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class FoodItemHistoryService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);
  private readonly authService = inject(AuthService);

  private readonly historySignal = signal<FoodItemHistory[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly history = this.historySignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
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
    if (environment.useLocalApi) {
      return this.loadHistoryLocal();
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

    this.historySignal.set((data as FoodItemHistory[]) ?? []);
  }

  async upsertFromFoodItem(input: FoodItemInsert): Promise<void> {
    const payload = {
      name: input.name.trim(),
      name_key: normalizeNameKey(input.name),
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

    const { data, error } = await client
      .from('food_item_history')
      .upsert(
        {
          ...payload,
          user_id: userId,
        },
        { onConflict: 'user_id,name_key' }
      )
      .select()
      .single();

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    this.mergeHistoryEntry(data as FoodItemHistory);
  }

  private async loadHistoryLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getFoodItemHistory();
      this.historySignal.set(data as FoodItemHistory[]);
    } catch (error) {
      this.errorSignal.set(
        error instanceof Error ? error.message : 'Failed to load food item history.'
      );
    } finally {
      this.loadingSignal.set(false);
    }
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
