import { Injectable, computed, inject } from '@angular/core';
import { DEFAULT_FOOD_ICON, getFoodEmoji } from '../../shared/utils/food-emoji.utils';
import { normalizeNameKey } from '../../shared/utils/name-normalization.utils';
import { FoodCatalogService } from './food-catalog.service';
import { FoodCategoryService } from './food-category.service';

function isSpecificIcon(icon: string | undefined | null): icon is string {
  return !!icon && icon !== DEFAULT_FOOD_ICON;
}

@Injectable({ providedIn: 'root' })
export class FoodIconService {
  private readonly catalogService = inject(FoodCatalogService);
  private readonly categoryService = inject(FoodCategoryService);

  private preloadPromise: Promise<void> | null = null;

  /** Tracks catalog/category loads so icon badges re-render when data arrives. */
  readonly iconDataVersion = computed(
    () =>
      `${this.catalogService.catalogItems().length}:${this.categoryService.categories().length}`
  );

  private readonly catalogIconByNameKey = computed(() => {
    const map = new Map<string, string>();

    for (const item of this.catalogService.catalogItems()) {
      if (isSpecificIcon(item.icon)) {
        map.set(normalizeNameKey(item.name), item.icon);
      }
    }

    return map;
  });

  private readonly categoryIconByKey = computed(() => {
    const map = new Map<string, string>();

    for (const category of this.categoryService.categories()) {
      if (isSpecificIcon(category.icon)) {
        map.set(normalizeNameKey(category.name), category.icon);
      }
    }

    return map;
  });

  preload(): Promise<void> {
    if (!this.preloadPromise) {
      this.preloadPromise = Promise.all([
        this.catalogService.loadCatalog(),
        this.categoryService.loadCategories(),
      ]).then(() => undefined);
    }

    return this.preloadPromise;
  }

  resolveIcon(name: string, category?: string | null): string {
    const catalogIcon = this.catalogIconByNameKey().get(normalizeNameKey(name));
    if (catalogIcon) {
      return catalogIcon;
    }

    if (category) {
      const categoryIcon = this.categoryIconByKey().get(normalizeNameKey(category));
      if (categoryIcon) {
        return categoryIcon;
      }
    }

    return getFoodEmoji(name, category);
  }
}
