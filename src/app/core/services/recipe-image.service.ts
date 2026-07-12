import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Recipe } from '../models/recipe.model';
import { RecipeImagePromptBuilder } from '../utils/recipe-image-prompt.builder';
import { SupabaseService } from './supabase.service';

interface GenerateRecipeImageResponse {
  image_url?: string;
  image_status?: string;
  error?: string;
  message?: string;
}

interface GenerateSuggestionPreviewImageResponse {
  previewImageUrl?: string;
  error?: string;
}

export interface SuggestionPreviewImageRequest {
  title: string;
  mealType?: string | null;
  tags?: string[];
  ingredients?: string[];
}

@Injectable({ providedIn: 'root' })
export class RecipeImageService {
  private readonly supabaseService = inject(SupabaseService);

  buildPromptForRecipe(
    recipe: Pick<Recipe, 'title' | 'meal_type' | 'category' | 'tags'> & {
      ingredients?: string[];
    }
  ): string {
    const ingredientNames =
      recipe.ingredients ??
      (recipe as Recipe).ingredients?.map((ingredient) => ingredient.name) ??
      [];

    return RecipeImagePromptBuilder.buildPrompt({
      ...recipe,
      ingredients: ingredientNames,
    });
  }

  async requestRecipeImageGeneration(
    recipeId: string
  ): Promise<{ image_url: string | null; image_status: string | null; error: string | null }> {
    return this.invokeGeneration(recipeId, false);
  }

  async regenerateRecipeImage(
    recipeId: string
  ): Promise<{ image_url: string | null; image_status: string | null; error: string | null }> {
    return this.invokeGeneration(recipeId, true);
  }

  async requestSuggestionPreviewImage(
    request: SuggestionPreviewImageRequest
  ): Promise<{ previewImageUrl: string | null; error: string | null }> {
    if (environment.useLocalApi) {
      return { previewImageUrl: null, error: null };
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return {
        previewImageUrl: null,
        error: 'Recipe image generation is only available in the browser.',
      };
    }

    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return {
        previewImageUrl: null,
        error: 'You must be signed in to generate preview images.',
      };
    }

    const supabaseUrl = environment.supabaseUrl.replace(/\/+$/, '');
    const anonKey = environment.supabaseAnonKey;

    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-suggestion-preview-image`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: request.title,
            mealType: request.mealType ?? null,
            tags: request.tags ?? [],
            ingredients: request.ingredients ?? [],
          }),
        }
      );

      const body = (await response.json().catch(() => ({}))) as GenerateSuggestionPreviewImageResponse;

      if (!response.ok) {
        return {
          previewImageUrl: null,
          error: body.error?.trim() || `Could not generate preview image right now (${response.status}).`,
        };
      }

      if (body.error) {
        return { previewImageUrl: null, error: body.error };
      }

      return {
        previewImageUrl: body.previewImageUrl ?? null,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not generate preview image right now.';
      return { previewImageUrl: null, error: message };
    }
  }

  private async invokeGeneration(
    recipeId: string,
    regenerate: boolean
  ): Promise<{ image_url: string | null; image_status: string | null; error: string | null }> {
    if (environment.useLocalApi) {
      return { image_url: null, image_status: null, error: null };
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      return {
        image_url: null,
        image_status: null,
        error: 'Recipe image generation is only available in the browser.',
      };
    }

    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return {
        image_url: null,
        image_status: null,
        error: 'You must be signed in to generate recipe images.',
      };
    }

    const supabaseUrl = environment.supabaseUrl.replace(/\/+$/, '');
    const anonKey = environment.supabaseAnonKey;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-recipe-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipeId, regenerate }),
      });

      const body = (await response.json().catch(() => ({}))) as GenerateRecipeImageResponse;

      if (!response.ok) {
        return {
          image_url: null,
          image_status: null,
          error: this.resolveResponseError(body, response.status),
        };
      }

      if (body.error) {
        return { image_url: null, image_status: null, error: body.error };
      }

      return {
        image_url: body.image_url ?? null,
        image_status: body.image_status ?? null,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not request recipe image generation right now.';
      return { image_url: null, image_status: null, error: message };
    }
  }

  private resolveResponseError(body: GenerateRecipeImageResponse, status: number): string {
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error.trim();
    }

    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message.trim();
    }

    return `Could not generate recipe image right now (${status}).`;
  }
}
