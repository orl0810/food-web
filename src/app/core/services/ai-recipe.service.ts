import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AiRecipeSuggestion,
  AiRecipeSuggestionRequest,
  AiRecipeSuggestionResponse,
} from '../models/ai-recipe-suggestion.model';
import { normalizeTags } from '../../shared/utils/tag.utils';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AiRecipeService {
  private readonly supabaseService = inject(SupabaseService);

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  async generateRecipesFromInventory(
    request: AiRecipeSuggestionRequest
  ): Promise<AiRecipeSuggestionResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      if (environment.useLocalApi) {
        throw new Error('AI recipe generation requires Supabase mode.');
      }

      const client = this.supabaseService.getClient();
      if (!client) {
        throw new Error('AI recipe generation is only available in the browser.');
      }

      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('You must be signed in to generate AI recipes.');
      }

      const { data, error } = await client.functions.invoke<AiRecipeSuggestionResponse>(
        'generate-ai-recipes',
        {
          body: this.cleanRequest(request),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const response = this.normalizeResponse(data);
      this.loadingSignal.set(false);
      return response;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not generate recipes right now. Please try again.';
      this.errorSignal.set(message);
      this.loadingSignal.set(false);
      return { suggestions: [] };
    }
  }

  private cleanRequest(request: AiRecipeSuggestionRequest): AiRecipeSuggestionRequest {
    return {
      mealType: request.mealType,
      maxPrepTimeMinutes: Number(request.maxPrepTimeMinutes),
      prioritizeExpiringIngredients: Boolean(request.prioritizeExpiringIngredients),
      includeMissingIngredients: Boolean(request.includeMissingIngredients),
      numberOfSuggestions: Math.min(Math.max(Number(request.numberOfSuggestions) || 3, 1), 5),
    };
  }

  private normalizeResponse(data: AiRecipeSuggestionResponse | null): AiRecipeSuggestionResponse {
    if (!data || !Array.isArray(data.suggestions)) {
      return { suggestions: [] };
    }

    return {
      suggestions: data.suggestions.map((suggestion) => this.normalizeSuggestion(suggestion)),
    };
  }

  private normalizeSuggestion(suggestion: AiRecipeSuggestion): AiRecipeSuggestion {
    return {
      title: suggestion.title,
      description: suggestion.description,
      prepTimeMinutes: Number(suggestion.prepTimeMinutes),
      portions: Number(suggestion.portions),
      difficulty: 'easy',
      tags: normalizeTags(suggestion.tags ?? []),
      ingredients: suggestion.ingredients ?? [],
      steps: suggestion.steps ?? [],
      usedInventoryIngredients: suggestion.usedInventoryIngredients ?? [],
      missingIngredients: suggestion.missingIngredients ?? [],
      reason: suggestion.reason,
    };
  }
}
