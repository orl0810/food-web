import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  AiRecipeSuggestion,
  AiRecipeSuggestionRequest,
  AiOnboardingContext,
} from '../models/ai-recipe-suggestion.model';
import { AiRecipeService } from './ai-recipe.service';
import { SupabaseService } from './supabase.service';

function makeAiSuggestion(title: string): AiRecipeSuggestion {
  return {
    title,
    description: `${title} description`,
    prepTimeMinutes: 25,
    portions: 2,
    difficulty: 'easy',
    tags: ['quick'],
    ingredients: [{ name: 'Tomato', quantity: 2, unit: null }],
    steps: ['Cook it'],
    usedInventoryIngredients: ['Tomato'],
    missingIngredients: [],
    reason: 'Uses what you have',
  };
}

function makeAiRequest(
  overrides: Partial<AiRecipeSuggestionRequest> = {}
): AiRecipeSuggestionRequest {
  return {
    mealType: 'dinner',
    maxPrepTimeMinutes: 30,
    prioritizeExpiringIngredients: true,
    includeMissingIngredients: false,
    numberOfSuggestions: 3,
    ...overrides,
  };
}

describe('AiRecipeService', () => {
  let service: AiRecipeService;
  let invokeSpy: jasmine.Spy;
  let getSessionSpy: jasmine.Spy;
  let originalUseLocalApi: boolean;

  beforeEach(() => {
    originalUseLocalApi = environment.useLocalApi;
    environment.useLocalApi = false;

    invokeSpy = jasmine.createSpy('invoke').and.resolveTo({
      data: {
        suggestions: [
          makeAiSuggestion('Recipe A'),
          makeAiSuggestion('Recipe B'),
          makeAiSuggestion('Recipe C'),
        ],
      },
      error: null,
    });
    getSessionSpy = jasmine.createSpy('getSession').and.resolveTo({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });

    const mockClient = {
      auth: { getSession: getSessionSpy },
      functions: { invoke: invokeSpy },
    };

    TestBed.configureTestingModule({
      providers: [
        AiRecipeService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => mockClient,
          },
        },
      ],
    });

    service = TestBed.inject(AiRecipeService);
  });

  afterEach(() => {
    environment.useLocalApi = originalUseLocalApi;
  });

  it('returns normalized suggestions and clears loading on success', async () => {
    const promise = service.generateRecipesFromInventory(makeAiRequest());
    expect(service.loading()).toBeTrue();

    const response = await promise;

    expect(response.suggestions.length).toBe(3);
    expect(response.suggestions[0].title).toBe('Recipe A');
    expect(response.suggestions[0].difficulty).toBe('easy');
    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeNull();
  });

  it('forwards cleaned request fields to the edge function', async () => {
    const onboardingContext: AiOnboardingContext = {
      dietaryPreferences: ['vegan'],
      allergies: ['Peanuts'],
      dislikedIngredients: ['Mushrooms'],
      goals: [],
      cookingEffort: 'two_cooking_sessions',
    };

    await service.generateRecipesFromInventory(
      makeAiRequest({
        mealType: 'lunch',
        maxPrepTimeMinutes: 45,
        prioritizeExpiringIngredients: false,
        includeMissingIngredients: true,
        numberOfSuggestions: 3,
        onboardingContext,
        excludeTitles: ['Old Recipe', 'Old Recipe', '  '],
      })
    );

    expect(invokeSpy).toHaveBeenCalledWith('generate-ai-recipes', {
      body: jasmine.objectContaining({
        mealType: 'lunch',
        maxPrepTimeMinutes: 45,
        prioritizeExpiringIngredients: false,
        includeMissingIngredients: true,
        numberOfSuggestions: 3,
        onboardingContext,
        excludeTitles: ['Old Recipe'],
        idempotencyKey: jasmine.any(String),
      }),
      headers: {
        Authorization: 'Bearer test-token',
      },
    });
  });

  it('forwards prioritizeExpiringIngredients when true', async () => {
    await service.generateRecipesFromInventory(
      makeAiRequest({ prioritizeExpiringIngredients: true })
    );

    expect(invokeSpy.calls.mostRecent().args[1].body.prioritizeExpiringIngredients).toBeTrue();
  });

  it('forwards prioritizeExpiringIngredients when false', async () => {
    await service.generateRecipesFromInventory(
      makeAiRequest({ prioritizeExpiringIngredients: false })
    );

    expect(invokeSpy.calls.mostRecent().args[1].body.prioritizeExpiringIngredients).toBeFalse();
  });

  it('forwards includeMissingIngredients when true', async () => {
    await service.generateRecipesFromInventory(
      makeAiRequest({ includeMissingIngredients: true })
    );

    expect(invokeSpy.calls.mostRecent().args[1].body.includeMissingIngredients).toBeTrue();
  });

  it('forwards includeMissingIngredients when false', async () => {
    await service.generateRecipesFromInventory(
      makeAiRequest({ includeMissingIngredients: false })
    );

    expect(invokeSpy.calls.mostRecent().args[1].body.includeMissingIngredients).toBeFalse();
  });

  it('forwards trimmed customPrompt to the edge function', async () => {
    await service.generateRecipesFromInventory(
      makeAiRequest({ customPrompt: '  Use fish  ' })
    );

    expect(invokeSpy.calls.mostRecent().args[1].body.customPrompt).toBe('Use fish');
  });

  it('omits empty customPrompt from the edge function request', async () => {
    await service.generateRecipesFromInventory(makeAiRequest({ customPrompt: '   ' }));

    expect(invokeSpy.calls.mostRecent().args[1].body.customPrompt).toBeUndefined();
  });

  it('sets error and returns empty suggestions when there is no session token', async () => {
    getSessionSpy.and.resolveTo({ data: { session: null }, error: null });

    const response = await service.generateRecipesFromInventory(makeAiRequest());

    expect(response).toEqual({ suggestions: [] });
    expect(service.error()).toBe('You must be signed in to generate AI recipes.');
    expect(service.loading()).toBeFalse();
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('sets error and returns empty suggestions when the edge function fails', async () => {
    invokeSpy.and.resolveTo({
      data: null,
      error: { message: 'Upstream failure' },
    });

    const response = await service.generateRecipesFromInventory(makeAiRequest());

    expect(response).toEqual({ suggestions: [] });
    expect(service.error()).toBe('Upstream failure');
    expect(service.loading()).toBeFalse();
  });

  it('sets error when useLocalApi is enabled', async () => {
    environment.useLocalApi = true;

    const response = await service.generateRecipesFromInventory(makeAiRequest());

    expect(response).toEqual({ suggestions: [] });
    expect(service.error()).toBe('AI recipe generation requires Supabase mode.');
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('sets error when Supabase client is unavailable', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AiRecipeService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => null },
        },
      ],
    });
    const offlineService = TestBed.inject(AiRecipeService);

    const response = await offlineService.generateRecipesFromInventory(makeAiRequest());

    expect(response).toEqual({ suggestions: [] });
    expect(offlineService.error()).toBe('AI recipe generation is only available in the browser.');
  });
});
