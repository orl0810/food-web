import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FoodCategory } from '../models/food-category.model';
import { SearchSelectOption } from '../models/search-select-option.model';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

function normalizeCategoryKey(name: string): string {
  return name.trim().toLowerCase();
}

@Injectable({ providedIn: 'root' })
export class FoodCategoryService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly localApiService = inject(LocalApiService);

  private readonly categoriesSignal = signal<FoodCategory[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly categories = this.categoriesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  getCategoryOptions(query: string, customCategories: string[] = []): SearchSelectOption[] {
    const normalizedQuery = query.trim().toLowerCase();
    const defaultNames = new Set(
      this.categoriesSignal().map((category) => normalizeCategoryKey(category.name))
    );

    const options: SearchSelectOption[] = this.categoriesSignal()
      .filter(
        (category) =>
          !normalizedQuery || category.name.toLowerCase().includes(normalizedQuery)
      )
      .map((category) => ({
        id: `category-${category.id}`,
        label: category.name,
        payload: category,
      }));

    for (const categoryName of customCategories) {
      const trimmed = categoryName.trim();
      if (!trimmed) {
        continue;
      }

      const key = normalizeCategoryKey(trimmed);
      if (defaultNames.has(key)) {
        continue;
      }

      if (normalizedQuery && !trimmed.toLowerCase().includes(normalizedQuery)) {
        continue;
      }

      if (options.some((option) => normalizeCategoryKey(option.label) === key)) {
        continue;
      }

      options.push({
        id: `custom-category-${key}`,
        label: trimmed,
        subtitle: 'Previously used',
        payload: { name: trimmed },
      });
    }

    return options;
  }

  async loadCategories(): Promise<void> {
    if (environment.useLocalApi) {
      return this.loadCategoriesLocal();
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    const { data, error } = await client
      .from('food_categories')
      .select('id, name, sort_order, icon')
      .order('sort_order', { ascending: true });

    this.loadingSignal.set(false);

    if (error) {
      this.errorSignal.set(error.message);
      return;
    }

    this.categoriesSignal.set(
      ((data as FoodCategory[]) ?? []).map((category) => ({
        ...category,
        icon: category.icon ?? '🍽️',
      }))
    );
  }

  private async loadCategoriesLocal(): Promise<void> {
    if (!this.localApiService.isEnabled()) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const data = await this.localApiService.getFoodCategories();
      this.categoriesSignal.set(
        (data as FoodCategory[]).map((category) => ({
          ...category,
          icon: category.icon ?? '🍽️',
        }))
      );
    } catch (error) {
      this.errorSignal.set(
        error instanceof Error ? error.message : 'Failed to load food categories.'
      );
    } finally {
      this.loadingSignal.set(false);
    }
  }
}
