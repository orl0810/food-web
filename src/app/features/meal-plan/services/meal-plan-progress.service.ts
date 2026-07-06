import { Injectable, inject } from '@angular/core';
import { MEAL_TYPES, MealType } from '../../../core/models/meal-plan.model';
import { MealSlotItem, MealSlotItemStatus } from '../../../core/models/meal-slot-item.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { DayMealProgress } from '../models/day-meal-progress.model';
import {
  calculateDayProgress,
  isSlotCompleted,
  shouldTriggerDayCompletedCelebration,
} from '../utils/meal-slot-completion.utils';
import {
  getPendingMealsToPrepare,
  PendingMealSlot,
} from '../utils/meal-slot-status.utils';

@Injectable({ providedIn: 'root' })
export class MealPlanProgressService {
  private readonly mealPlanService = inject(MealPlanService);

  calculateDayProgress(
    date: string,
    items: MealSlotItem[],
    activeMealTypes: MealType[] = MEAL_TYPES
  ): DayMealProgress {
    return calculateDayProgress(date, items, activeMealTypes);
  }

  shouldTriggerDayCompletedCelebration(
    previous: DayMealProgress,
    current: DayMealProgress
  ): boolean {
    return shouldTriggerDayCompletedCelebration(previous, current);
  }

  async setMealSlotStatus(
    date: string,
    mealType: MealType,
    status: MealSlotItemStatus,
    itemsOverride?: MealSlotItem[]
  ): Promise<{ error: string | null }> {
    const items = itemsOverride ?? this.mealPlanService.getItemsForSlot(date, mealType);

    if (items.length === 0) {
      return { error: null };
    }

    const results = await Promise.all(
      items.map((item) => this.mealPlanService.updateSlotItemStatus(item.id, status))
    );

    const firstError = results.find((result) => result.error)?.error ?? null;
    return { error: firstError };
  }

  async markMealAsReady(
    date: string,
    mealType: MealType
  ): Promise<{ error: string | null }> {
    return this.setMealSlotStatus(date, mealType, 'prepared');
  }

  async markMealAsConsumed(
    date: string,
    mealType: MealType
  ): Promise<{ error: string | null }> {
    return this.setMealSlotStatus(date, mealType, 'eaten');
  }

  async undoMealConsumed(
    date: string,
    mealType: MealType
  ): Promise<{ error: string | null }> {
    return this.setMealSlotStatus(date, mealType, 'prepared');
  }

  getPendingMealsToPrepare(
    items: MealSlotItem[],
    startDate: string,
    endDate?: string
  ): PendingMealSlot[] {
    return getPendingMealsToPrepare(items, startDate, endDate);
  }

  async toggleMealSlotCompletion(
    date: string,
    mealType: MealType
  ): Promise<{ error: string | null }> {
    const items = this.mealPlanService.getItemsForSlot(date, mealType);

    if (items.length === 0) {
      return { error: null };
    }

    const targetStatus = isSlotCompleted(items) ? 'planned' : 'eaten';
    return this.setMealSlotStatus(date, mealType, targetStatus);
  }

  // TODO: integrate with dashboard inventory deduction when reliable
  applyInventoryUsageForCompletedMeal(_mealSlotKey: string): void {}
}
