import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Recipe } from '../models/recipe.model';
import { RecipeImagePromptBuilder } from '../utils/recipe-image-prompt.builder';
import { SupabaseService } from './supabase.service';

interface GenerateRecipeImageResponse {
  image_url?: string;
  image_status?: string;
  error?: string;
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

    try {
      const { data, error } = await client.functions.invoke<GenerateRecipeImageResponse>(
        'generate-recipe-image',
        {
          body: { recipeId, regenerate },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (error) {
        return { image_url: null, image_status: null, error: error.message };
      }

      if (data?.error) {
        return { image_url: null, image_status: null, error: data.error };
      }

      return {
        image_url: data?.image_url ?? null,
        image_status: data?.image_status ?? null,
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
}
