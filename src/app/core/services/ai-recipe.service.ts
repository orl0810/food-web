import { Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  AiRecipeSuggestion,
  AiRecipeSuggestionRequest,
  AiRecipeSuggestionResponse,
} from '../models/ai-recipe-suggestion.model';
import { normalizeTags } from '../../shared/utils/tag.utils';
import { AnalyticsService } from '../analytics/analytics.service';
import { ProductEvent } from '../analytics/analytics-events';
import { billingErrorMessage } from '../models/billing.model';
import { SupabaseService } from './supabase.service';

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Injectable({ providedIn: 'root' })
export class AiRecipeService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly analyticsService = inject(AnalyticsService);

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  async generateRecipesFromInventory(
    request: AiRecipeSuggestionRequest
  ): Promise<AiRecipeSuggestionResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    const startedAt = Date.now();

    try {
      if (environment.useLocalApi) {
        throw new Error('AI recipe generation requires Supabase mode.');
      }

      void this.analyticsService.track(ProductEvent.AiRecipeGenerationStarted, {
        source: 'ai_recipe_service',
        method: request.mealType,
      });

      const client = this.supabaseService.getClient();
      if (!client) {
        throw new Error('AI recipe generation is only available in the browser.');
      }

      const { data: sessionData } = await client.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('You must be signed in to generate AI recipes.');
      }

      const { data, error } = await client.functions.invoke<
        AiRecipeSuggestionResponse & { code?: string; error?: string }
      >(
        'generate-ai-recipes',
        {
          body: {
            ...this.cleanRequest(request),
            idempotencyKey: createIdempotencyKey(),
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(billingErrorMessage(data.code, data.error));
      }

      const response = this.normalizeResponse(data);
      void this.analyticsService.track(ProductEvent.AiRecipeGenerationCompleted, {
        source: 'ai_recipe_service',
        duration_ms: Date.now() - startedAt,
      });
      this.loadingSignal.set(false);
      return response;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not generate recipes right now. Please try again.';
      void this.analyticsService.track(ProductEvent.AiRecipeGenerationFailed, {
        source: 'ai_recipe_service',
        failure_stage: 'edge_function',
        error_code: 'GENERATION_FAILED',
        duration_ms: Date.now() - startedAt,
      });
      this.errorSignal.set(message);
      this.loadingSignal.set(false);
      return { suggestions: [] };
    }
  }

  private cleanRequest(request: AiRecipeSuggestionRequest): AiRecipeSuggestionRequest {
    const cleaned: AiRecipeSuggestionRequest = {
      mealType: request.mealType,
      maxPrepTimeMinutes: Number(request.maxPrepTimeMinutes),
      prioritizeExpiringIngredients: Boolean(request.prioritizeExpiringIngredients),
      includeMissingIngredients: Boolean(request.includeMissingIngredients),
      numberOfSuggestions: Math.min(Math.max(Number(request.numberOfSuggestions) || 2, 1), 5),
    };
    if (request.onboardingContext) {
      cleaned.onboardingContext = request.onboardingContext;
    }
    const excludeTitles = this.cleanExcludeTitles(request.excludeTitles);
    if (excludeTitles.length > 0) {
      cleaned.excludeTitles = excludeTitles;
    }
    const customPrompt = request.customPrompt?.trim().slice(0, 200);
    if (customPrompt) {
      cleaned.customPrompt = customPrompt;
    }
    return cleaned;
  }

  private cleanExcludeTitles(titles: string[] | undefined): string[] {
    if (!titles?.length) {
      return [];
    }
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const title of titles) {
      const trimmed = title.trim();
      if (!trimmed) {
        continue;
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cleaned.push(trimmed);
      if (cleaned.length >= 10) {
        break;
      }
    }
    return cleaned;
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
      previewImageUrl: suggestion.previewImageUrl ?? null,
      previewImageStatus: suggestion.previewImageStatus ?? 'idle',
    };
  }
}
