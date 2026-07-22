import { Injectable, computed, inject, signal } from '@angular/core';
import { MealSlotItem } from '../../../core/models/meal-slot-item.model';
import { RecipeCookingDraft } from '../../../core/models/recipe-cooking.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { RecipeCookingService } from '../../../core/services/recipe-cooking.service';
import { addDays, toISODate } from '../../../shared/utils/meal-plan.utils';
import {
  getCookBatchSelection,
  getGroupedPendingCookItems,
  GroupedCookItem,
} from '../utils/meal-slot-status.utils';

@Injectable({ providedIn: 'root' })
export class ToCookService {
  private readonly mealPlanService = inject(MealPlanService);
  private readonly recipeCookingService = inject(RecipeCookingService);

  private readonly itemsSignal = signal<MealSlotItem[]>([]);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal(false);
  private readonly panelOpenSignal = signal(false);
  private readonly markingGroupKeySignal = signal<string | null>(null);
  private readonly cookingDraftSignal = signal<RecipeCookingDraft | null>(null);
  private readonly cookingBusySignal = signal(false);
  private readonly cookingErrorSignal = signal<string | null>(null);

  readonly items = this.itemsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly panelOpen = this.panelOpenSignal.asReadonly();
  readonly markingGroupKey = this.markingGroupKeySignal.asReadonly();
  readonly cookingDraft = this.cookingDraftSignal.asReadonly();
  readonly cookingBusy = this.cookingBusySignal.asReadonly();
  readonly cookingError = this.cookingErrorSignal.asReadonly();

  readonly groupedItems = computed(() =>
    getGroupedPendingCookItems(
      this.itemsSignal(),
      toISODate(),
      addDays(toISODate(), 6)
    )
  );

  readonly totalPendingCount = computed(() =>
    this.groupedItems().reduce(
      (total, group) => total + (group.recipeId ? group.batchCount : group.count),
      0
    )
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
    this.closeCookingDialog();
  }

  closeCookingDialog(): void {
    this.cookingDraftSignal.set(null);
    this.cookingErrorSignal.set(null);
  }

  async startCooking(group: GroupedCookItem, mode: 'next' | 'all'): Promise<void> {
    if (!group.recipeId) {
      if (mode === 'all') {
        await this.markAllReady(group);
      } else {
        await this.markNextReady(group);
      }
      return;
    }

    const selection = getCookBatchSelection(group, mode);
    if (selection.itemIds.length === 0) {
      return;
    }

    this.markingGroupKeySignal.set(group.groupKey);
    this.cookingErrorSignal.set(null);

    const coveredOccurrences = group.occurrences
      .filter((occurrence) => selection.itemIds.includes(occurrence.itemId))
      .map((occurrence) => ({
        dateLabel: occurrence.dateLabel,
        mealTypeLabel: occurrence.mealTypeLabel,
      }));

    const { draft, error } = await this.recipeCookingService.buildDraft({
      recipeId: group.recipeId,
      recipeTitle: group.displayName,
      recipeYield: group.recipeYield,
      selection,
      coveredOccurrences,
    });

    this.markingGroupKeySignal.set(null);

    if (error || !draft) {
      this.cookingErrorSignal.set(error ?? 'Could not prepare cooking confirmation.');
      return;
    }

    this.cookingDraftSignal.set(draft);
  }

  async confirmCooking(draft: RecipeCookingDraft): Promise<{ error: string | null }> {
    this.cookingBusySignal.set(true);
    this.cookingErrorSignal.set(null);

    const result = await this.recipeCookingService.completeCooking(draft);
    this.cookingBusySignal.set(false);

    if (result.error) {
      this.cookingErrorSignal.set(result.error);
      return result;
    }

    this.closeCookingDialog();
    await Promise.all([
      this.refresh(),
      this.mealPlanService.getTodayMeals(),
    ]);

    return { error: null };
  }

  async markNextReady(group: GroupedCookItem): Promise<{ error: string | null }> {
    await this.startCooking(group, 'next');
    return { error: null };
  }

  async markAllReady(group: GroupedCookItem): Promise<{ error: string | null }> {
    await this.startCooking(group, 'all');
    return { error: null };
  }
}
