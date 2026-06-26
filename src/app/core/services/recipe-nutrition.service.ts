import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  RecipeNutrition,
  RecipeNutritionEstimateRequest,
} from '../models/recipe.model';
import { SupabaseService } from './supabase.service';

interface RecipeNutritionResponse {
  nutrition?: {
    calories: number;
    fat_g: number;
    cholesterol_mg: number;
    protein_g: number;
    sugar_g: number;
    sodium_mg: number;
    carbs_g: number;
    fiber_g: number;
  };
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class RecipeNutritionService {
  private readonly supabaseService = inject(SupabaseService);

  async estimateNutrition(
    request: RecipeNutritionEstimateRequest
  ): Promise<{ nutrition: RecipeNutrition | null; error: string | null }> {
    if (environment.useLocalApi) {
      return { nutrition: null, error: null };
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return { nutrition: null, error: 'Nutrition estimation is only available in the browser.' };
    }

    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { nutrition: null, error: 'You must be signed in to estimate nutrition.' };
    }

    try {
      const { data, error } = await client.functions.invoke<RecipeNutritionResponse>(
        'estimate-recipe-nutrition',
        {
          body: this.cleanRequest(request),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (error) {
        return { nutrition: null, error: error.message };
      }

      if (data?.error) {
        return { nutrition: null, error: data.error };
      }

      const nutrition = this.normalizeNutrition(data?.nutrition);
      if (!nutrition) {
        return { nutrition: null, error: 'Could not estimate nutrition right now.' };
      }

      return { nutrition, error: null };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not estimate nutrition right now. Please try again.';
      return { nutrition: null, error: message };
    }
  }

  private cleanRequest(request: RecipeNutritionEstimateRequest): RecipeNutritionEstimateRequest {
    return {
      title: request.title.trim(),
      description: request.description?.trim() || null,
      portions: request.portions ?? null,
      ingredients: request.ingredients
        .map((ingredient) => ({
          name: ingredient.name.trim(),
          quantity: ingredient.quantity ?? null,
          unit: ingredient.unit?.trim() || null,
        }))
        .filter((ingredient) => ingredient.name.length > 0),
    };
  }

  private normalizeNutrition(
    values: RecipeNutritionResponse['nutrition']
  ): RecipeNutrition | null {
    if (!values) {
      return null;
    }

    const calories = this.toNutritionNumber(values.calories);
    const fat_g = this.toNutritionNumber(values.fat_g);
    const cholesterol_mg = this.toNutritionNumber(values.cholesterol_mg);
    const protein_g = this.toNutritionNumber(values.protein_g);
    const sugar_g = this.toNutritionNumber(values.sugar_g);
    const sodium_mg = this.toNutritionNumber(values.sodium_mg);
    const carbs_g = this.toNutritionNumber(values.carbs_g);
    const fiber_g = this.toNutritionNumber(values.fiber_g);

    if (
      calories === null ||
      fat_g === null ||
      cholesterol_mg === null ||
      protein_g === null ||
      sugar_g === null ||
      sodium_mg === null ||
      carbs_g === null ||
      fiber_g === null
    ) {
      return null;
    }

    return {
      calories,
      fat_g,
      cholesterol_mg,
      protein_g,
      sugar_g,
      sodium_mg,
      carbs_g,
      fiber_g,
      calculated_at: new Date().toISOString(),
    };
  }

  private toNutritionNumber(value: unknown): number | null {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      return null;
    }
    return Math.round(num * 10) / 10;
  }
}
