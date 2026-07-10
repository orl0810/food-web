import { SmartSuggestion } from '../../core/models/smart-suggestion.model';

export const DAILY_FEATURED_STORAGE_KEY = 'pantryflow.suggestions.dailyFeatured';
export const MAX_RECENT_FEATURED_DAYS = 7;

export interface DailyFeaturedState {
  date: string;
  recipeId: string;
  recentRecipeIds: string[];
}

function suggestionExists(suggestions: SmartSuggestion[], recipeId: string): boolean {
  return suggestions.some((suggestion) => suggestion.recipe.id === recipeId);
}

function pickBestEligible(
  suggestions: SmartSuggestion[],
  excludedIds: Set<string>
): SmartSuggestion | null {
  for (const suggestion of suggestions) {
    if (!excludedIds.has(suggestion.recipe.id)) {
      return suggestion;
    }
  }

  return null;
}

function updateRecentIds(previous: string[], newRecipeId: string): string[] {
  const withoutDuplicate = previous.filter((id) => id !== newRecipeId);
  return [...withoutDuplicate, newRecipeId].slice(-MAX_RECENT_FEATURED_DAYS);
}

export function resolveDailyFeatured(
  suggestions: SmartSuggestion[],
  previous: DailyFeaturedState | null,
  today: string
): DailyFeaturedState | null {
  if (suggestions.length === 0) {
    return null;
  }

  if (
    previous &&
    previous.date === today &&
    suggestionExists(suggestions, previous.recipeId)
  ) {
    return previous;
  }

  const recentIds = previous?.recentRecipeIds ?? [];
  const recentSet = new Set(recentIds);
  const yesterdayPick = previous && previous.date !== today ? previous.recipeId : null;

  let pick = pickBestEligible(suggestions, recentSet);

  if (!pick && yesterdayPick) {
    pick = pickBestEligible(suggestions, new Set([yesterdayPick]));
  }

  if (!pick) {
    pick = suggestions[0];
  }

  return {
    date: today,
    recipeId: pick.recipe.id,
    recentRecipeIds: updateRecentIds(recentIds, pick.recipe.id),
  };
}

export function applyDailyFeatured(
  suggestions: SmartSuggestion[],
  featuredRecipeId: string | null
): SmartSuggestion[] {
  if (!featuredRecipeId || suggestions.length === 0) {
    return suggestions;
  }

  const featuredIndex = suggestions.findIndex(
    (suggestion) => suggestion.recipe.id === featuredRecipeId
  );

  if (featuredIndex <= 0) {
    return suggestions;
  }

  const featured = suggestions[featuredIndex];
  const rest = suggestions.filter((_, index) => index !== featuredIndex);
  return [featured, ...rest];
}

export function isDailyFeaturedState(value: unknown): value is DailyFeaturedState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const state = value as DailyFeaturedState;
  return (
    typeof state.date === 'string' &&
    typeof state.recipeId === 'string' &&
    Array.isArray(state.recentRecipeIds) &&
    state.recentRecipeIds.every((id) => typeof id === 'string')
  );
}

export function dailyFeaturedStatesEqual(
  left: DailyFeaturedState | null,
  right: DailyFeaturedState | null
): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.date === right.date &&
    left.recipeId === right.recipeId &&
    left.recentRecipeIds.length === right.recentRecipeIds.length &&
    left.recentRecipeIds.every((id, index) => id === right.recentRecipeIds[index])
  );
}
