import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FoodCatalogItem } from '../models/food-catalog-item.model';
import { SearchSelectOption } from '../models/search-select-option.model';
import { STORAGE_LOCATION_LABELS } from '../models/food-item.model';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class FoodCatalogService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);

  private readonly catalogSignal = signal<FoodCatalogItem[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly catalogItems = this.catalogSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  getCatalogOptions(query: string): SearchSelectOption[] {
    const normalizedQuery = query.trim().toLowerCase();

    return this.catalogSignal()
      .filter(
        (item) => !normalizedQuery || item.name.toLowerCase().includes(normalizedQuery)
      )
      .map((item) => ({
        id: `catalog-${item.id}`,
        label: item.name,
        subtitle: this.getCatalogSubtitle(item),
        payload: item,
      }));
  }

  async loadCatalog(): Promise<void> {
    if (environment.useLocalApi) {
      return this.loadCatalogLocal();
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const { data, error } = await client
      .from('food_catalog_items')
      .select(
        `
        id,
        category_id,
        name,
        default_unit,
        default_location,
        default_quantity,
        food_categories ( name, sort_order )
      `
      )
      .order('name', { ascending: true });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    type CatalogRow = {
      id: string;
      category_id: string;
      name: string;
      default_unit: string | null;
      default_location: FoodCatalogItem['default_location'];
      default_quantity: number;
      food_categories: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null;
    };

    const rows = (data ?? []) as CatalogRow[];
    const items = rows
      .map((item) => {
        const category = Array.isArray(item.food_categories)
          ? item.food_categories[0]
          : item.food_categories;

        return {
          id: item.id,
          category_id: item.category_id,
          category_name: category?.name ?? '',
          name: item.name,
          default_unit: item.default_unit,
          default_location: item.default_location,
          default_quantity: item.default_quantity,
          sort_order: category?.sort_order ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.name.localeCompare(b.name);
      })
      .map(({ sort_order: _sortOrder, ...item }) => item);

    this.catalogSignal.set(items);
  }

  private async loadCatalogLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getFoodCatalogItems();
      this.catalogSignal.set(data as FoodCatalogItem[]);
    } catch (error) {
      this.errorSignal.set(
        error instanceof Error ? error.message : 'Failed to load food catalog.'
      );
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private getCatalogSubtitle(item: FoodCatalogItem): string {
    const parts = [
      item.category_name,
      STORAGE_LOCATION_LABELS[item.default_location],
      `${item.default_quantity}${item.default_unit ? ` ${item.default_unit}` : ''}`,
    ].filter(Boolean);

    return parts.join(' · ');
  }
}
