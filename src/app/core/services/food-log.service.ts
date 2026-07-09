import { Injectable, inject } from '@angular/core';
import { MealSlotItem } from '../models/meal-slot-item.model';
import {
  CreateFoodLogInput,
  CreatePhotoFoodLogInput,
  CreateVoiceFoodLogInput,
} from '../models/food-log.model';
import { MealPlanService } from './meal-plan.service';

@Injectable({ providedIn: 'root' })
export class FoodLogService {
  private readonly mealPlanService = inject(MealPlanService);

  async createManualFoodLog(
    input: CreateFoodLogInput
  ): Promise<{ item: MealSlotItem | null; error: string | null }> {
    return this.createFoodLog(input, 'manual');
  }

  async createVoiceFoodLog(
    input: CreateVoiceFoodLogInput
  ): Promise<{ item: MealSlotItem | null; error: string | null }> {
    return this.createFoodLog(input, 'voice', { transcript: input.transcript });
  }

  async createPhotoFoodLog(
    input: CreatePhotoFoodLogInput
  ): Promise<{ item: MealSlotItem | null; error: string | null }> {
    const name = input.name.trim();
    if (!name) {
      return { item: null, error: 'Food name is required.' };
    }

    return this.mealPlanService.addSlotItem({
      date: input.date,
      meal_type: input.mealType,
      item_type: 'custom',
      custom_name: name,
      quantity: input.quantity ?? null,
      unit: input.unit?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      source: 'photo',
      image_url: input.imageUrl,
      status: input.markAsConsumed === false ? 'planned' : 'eaten',
      completed_at: input.markAsConsumed === false ? null : new Date().toISOString(),
    });
  }

  getFoodLogsByDate(date: string): MealSlotItem[] {
    return this.mealPlanService
      .entries()
      .filter((item) => item.date === date && item.source !== null);
  }

  async deleteFoodLogEntry(id: string): Promise<{ error: string | null }> {
    return this.mealPlanService.removeSlotItem(id);
  }

  private async createFoodLog(
    input: CreateFoodLogInput,
    source: 'manual' | 'voice',
    extra?: { transcript?: string }
  ): Promise<{ item: MealSlotItem | null; error: string | null }> {
    const name = input.name.trim();
    if (!name) {
      return { item: null, error: 'Food name is required.' };
    }

    return this.mealPlanService.addSlotItem({
      date: input.date,
      meal_type: input.mealType,
      item_type: 'custom',
      custom_name: name,
      quantity: input.quantity ?? null,
      unit: input.unit?.trim() ?? null,
      notes: input.notes?.trim() ?? null,
      source,
      transcript: extra?.transcript?.trim() ?? null,
      status: input.markAsConsumed === false ? 'planned' : 'eaten',
      completed_at: input.markAsConsumed === false ? null : new Date().toISOString(),
    });
  }
}
