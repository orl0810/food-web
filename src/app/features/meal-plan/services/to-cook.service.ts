import { Injectable, computed, inject, signal } from '@angular/core';
import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { addDays, toISODate } from '../../../shared/utils/meal-plan.utils';
import {
  getGroupedPendingCookItems,
  GroupedCookItem,
} from '../utils/meal-slot-status.utils';
import { MealPlanProgressService } from './meal-plan-progress.service';

@Injectable({ providedIn: 'root' })
export class ToCookService {
  private readonly mealPlanService = inject(MealPlanService);
  private readonly progressService = inject(MealPlanProgressService);

  private readonly itemsSignal = signal<MealSlotItem[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal(false);
  private readonly panelOpenSignal = signal(false);
  private readonly markingGroupKeySignal = signal<string | null>(null);

  readonly items = this.itemsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly panelOpen = this.panelOpenSignal.asReadonly();
  readonly markingGroupKey = this.markingGroupKeySignal.asReadonly();

  readonly groupedItems = computed(() =>
    getGroupedPendingCookItems(
      this.itemsSignal(),
      toISODate(),
      addDays(toISODate(), 6)
    )
  );

  readonly totalPendingCount = computed(() =>
    this.groupedItems().reduce((total, group) => total + group.count, 0)
  );

  async load(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const startDate = toISODate();
    const endDate = addDays(startDate, 6);
    this.loadingSignal.set(true);
    this.errorSignal.set(false);

    try {
      const items = await this.mealPlanService.fetchMealPlanForDateRange(startDate, endDate);
      this.itemsSignal.set(items);
    } catch {
      this.errorSignal.set(true);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  openPanel(): void {
    this.panelOpenSignal.set(true);
    void this.refresh();
  }

  closePanel(): void {
    this.panelOpenSignal.set(false);
  }

  async markNextReady(group: GroupedCookItem): Promise<{ error: string | null }> {
    const nextItemId = group.occurrences[0]?.itemId;
    if (!nextItemId) {
      return { error: null };
    }

    this.markingGroupKeySignal.set(group.groupKey);
    const result = await this.progressService.markSlotItemAsReady(nextItemId);
    this.markingGroupKeySignal.set(null);

    if (!result.error) {
      await Promise.all([
        this.refresh(),
        this.mealPlanService.getTodayMeals(),
      ]);
    }

    return result;
  }

  async markAllReady(group: GroupedCookItem): Promise<{ error: string | null }> {
    const itemIds = group.occurrences.map((occurrence) => occurrence.itemId);
    if (itemIds.length === 0) {
      return { error: null };
    }

    this.markingGroupKeySignal.set(group.groupKey);
    const result = await this.progressService.markSlotItemsAsReady(itemIds);
    this.markingGroupKeySignal.set(null);

    if (!result.error) {
      await Promise.all([
        this.refresh(),
        this.mealPlanService.getTodayMeals(),
      ]);
    }

    return result;
  }
}
