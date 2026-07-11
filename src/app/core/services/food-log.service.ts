import { Injectable, inject } from '@angular/core';
import { MealSlotItem } from '../models/meal-slot-item.model';
import {
  CreateFoodLogInput,
  CreatePhotoFoodLogInput,
  CreateVoiceFoodLogInput,
} from '../models/food-log.model';
import { buildDetectedItemsNotes } from '../../shared/utils/meal-photo-draft.utils';
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

    const status = this.resolvePhotoFoodLogStatus(input);
    const completedAt = status === 'planned' ? null : new Date().toISOString();
    const notes = this.buildPhotoNotes(input);

    return this.mealPlanService.addSlotItem({
      date: input.date,
      meal_type: input.mealType,
      item_type: 'custom',
      custom_name: name,
      quantity: input.quantity ?? null,
      unit: input.unit?.trim() ?? null,
      notes,
      source: 'photo',
      image_url: input.imageUrl,
      status,
      completed_at: completedAt,
      calories_snapshot: input.nutritionEstimate?.calories ?? null,
      protein_snapshot: input.nutritionEstimate?.protein_g ?? null,
      carbohydrates_snapshot: input.nutritionEstimate?.carbohydrates_g ?? null,
      fat_snapshot: input.nutritionEstimate?.fat_g ?? null,
      fiber_snapshot: input.nutritionEstimate?.fiber_g ?? null,
      sugar_snapshot: input.nutritionEstimate?.sugar_g ?? null,
    });
  }

  private buildPhotoNotes(input: CreatePhotoFoodLogInput): string | null {
    const manualNotes = input.notes?.trim();
    const detectedNotes = input.detectedItemsSummary?.length
      ? buildDetectedItemsNotes(input.detectedItemsSummary)
      : '';

    if (manualNotes && detectedNotes) {
      return `${manualNotes}\n\n${detectedNotes}`;
    }
    return manualNotes || detectedNotes || null;
  }

  private resolvePhotoFoodLogStatus(input: CreatePhotoFoodLogInput): MealSlotItem['status'] {
    if (input.status) {
      return input.status;
    }
    return input.markAsConsumed === false ? 'planned' : 'eaten';
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
