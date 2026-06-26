import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Recipe, RecipeMealType } from '../models/recipe.model';

export type RecipeImagePlaceholderKey = RecipeMealType | 'default';

@Injectable({ providedIn: 'root' })
export class RecipeImageUrlService {
  getRecipeImageUrl(recipe: Pick<Recipe, 'image_url' | 'image_storage_key'>): string | null {
    const directUrl = recipe.image_url?.trim();
    if (directUrl) {
      return directUrl;
    }

    const storageKey = recipe.image_storage_key?.trim();
    if (storageKey) {
      return this.buildR2PublicUrl(storageKey);
    }

    return null;
  }

  buildR2PublicUrl(storageKey: string): string {
    const baseUrl = environment.recipeImagesBaseUrl.trim().replace(/\/+$/, '');
    const normalizedKey = storageKey.trim().replace(/^\/+/, '');

    if (!baseUrl) {
      return normalizedKey;
    }

    return `${baseUrl}/${normalizedKey}`;
  }

  getFallbackImageForRecipe(
    recipe: Pick<Recipe, 'meal_type' | 'category'>
  ): RecipeImagePlaceholderKey {
    if (recipe.meal_type) {
      return recipe.meal_type;
    }
    return 'default';
  }

  shouldShowImage(
    recipe: Pick<Recipe, 'image_url' | 'image_storage_key' | 'image_status'>
  ): boolean {
    return recipe.image_status === 'completed' && this.getRecipeImageUrl(recipe) !== null;
  }

  isLoadingState(recipe: Pick<Recipe, 'image_status'>): boolean {
    return recipe.image_status === 'generating';
  }

  isFailedState(recipe: Pick<Recipe, 'image_status'>): boolean {
    return recipe.image_status === 'failed';
  }
}
