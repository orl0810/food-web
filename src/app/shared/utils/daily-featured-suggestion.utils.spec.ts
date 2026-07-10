import { Recipe } from '../../core/models/recipe.model';
import { SmartSuggestion } from '../../core/models/smart-suggestion.model';
import {
  applyDailyFeatured,
  resolveDailyFeatured,
} from './daily-featured-suggestion.utils';

function createMockSuggestion(id: string, score: number): SmartSuggestion {
  return {
    recipe: { id, title: `Recipe ${id}` } as Recipe,
    score,
    matchPercentage: 0,
    difficulty: null,
    scoreBreakdown: { inventory: 0, expiring: 0, time: 0, variety: 0 },
    availableIngredients: [],
    missingIngredients: [],
    expiringIngredientsUsed: [],
    reasons: [],
    suggestionType: 'not_planned_this_week',
  };
}

describe('daily-featured-suggestion.utils', () => {
  const today = '2026-07-10';
  const yesterday = '2026-07-09';

  describe('resolveDailyFeatured', () => {
    it('returns null when there are no suggestions', () => {
      expect(resolveDailyFeatured([], null, today)).toBeNull();
    });

    it('keeps the stored pick for the same day when the recipe still exists', () => {
      const suggestions = [
        createMockSuggestion('recipe-a', 90),
        createMockSuggestion('recipe-b', 80),
      ];
      const previous = {
        date: today,
        recipeId: 'recipe-b',
        recentRecipeIds: ['recipe-b'],
      };

      expect(resolveDailyFeatured(suggestions, previous, today)).toEqual(previous);
    });

    it('picks the top-scored recipe not in recentRecipeIds on a new day', () => {
      const suggestions = [
        createMockSuggestion('recipe-a', 90),
        createMockSuggestion('recipe-b', 80),
        createMockSuggestion('recipe-c', 70),
      ];
      const previous = {
        date: yesterday,
        recipeId: 'recipe-a',
        recentRecipeIds: ['recipe-a'],
      };

      expect(resolveDailyFeatured(suggestions, previous, today)).toEqual({
        date: today,
        recipeId: 'recipe-b',
        recentRecipeIds: ['recipe-a', 'recipe-b'],
      });
    });

    it('re-picks when the stored recipe no longer exists', () => {
      const suggestions = [
        createMockSuggestion('recipe-b', 80),
        createMockSuggestion('recipe-c', 70),
      ];
      const previous = {
        date: today,
        recipeId: 'recipe-a',
        recentRecipeIds: ['recipe-a'],
      };

      expect(resolveDailyFeatured(suggestions, previous, today)).toEqual({
        date: today,
        recipeId: 'recipe-b',
        recentRecipeIds: ['recipe-a', 'recipe-b'],
      });
    });

    it('falls back to avoiding only yesterdays pick when the recent pool is exhausted', () => {
      const suggestions = [
        createMockSuggestion('recipe-a', 90),
        createMockSuggestion('recipe-b', 80),
      ];
      const previous = {
        date: yesterday,
        recipeId: 'recipe-b',
        recentRecipeIds: ['recipe-a', 'recipe-b'],
      };

      expect(resolveDailyFeatured(suggestions, previous, today)).toEqual({
        date: today,
        recipeId: 'recipe-a',
        recentRecipeIds: ['recipe-b', 'recipe-a'],
      });
    });

    it('falls back to the top overall suggestion when only one recipe exists', () => {
      const suggestions = [createMockSuggestion('recipe-a', 90)];
      const previous = {
        date: yesterday,
        recipeId: 'recipe-a',
        recentRecipeIds: ['recipe-a'],
      };

      expect(resolveDailyFeatured(suggestions, previous, today)).toEqual({
        date: today,
        recipeId: 'recipe-a',
        recentRecipeIds: ['recipe-a'],
      });
    });

    it('picks the top suggestion on first run', () => {
      const suggestions = [
        createMockSuggestion('recipe-a', 90),
        createMockSuggestion('recipe-b', 80),
      ];

      expect(resolveDailyFeatured(suggestions, null, today)).toEqual({
        date: today,
        recipeId: 'recipe-a',
        recentRecipeIds: ['recipe-a'],
      });
    });
  });

  describe('applyDailyFeatured', () => {
    it('moves the featured suggestion to the front', () => {
      const suggestions = [
        createMockSuggestion('recipe-a', 90),
        createMockSuggestion('recipe-b', 80),
        createMockSuggestion('recipe-c', 70),
      ];

      const result = applyDailyFeatured(suggestions, 'recipe-c');

      expect(result.map((suggestion) => suggestion.recipe.id)).toEqual([
        'recipe-c',
        'recipe-a',
        'recipe-b',
      ]);
    });

    it('returns the original list when the featured recipe is already first', () => {
      const suggestions = [
        createMockSuggestion('recipe-a', 90),
        createMockSuggestion('recipe-b', 80),
      ];

      expect(applyDailyFeatured(suggestions, 'recipe-a')).toBe(suggestions);
    });

    it('returns the original list when the featured recipe is missing', () => {
      const suggestions = [
        createMockSuggestion('recipe-a', 90),
        createMockSuggestion('recipe-b', 80),
      ];

      expect(applyDailyFeatured(suggestions, 'recipe-z')).toBe(suggestions);
    });
  });
});
