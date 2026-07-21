import { findPersonalCopyOfBase, isSharedRecipe } from './shared-recipe.utils';
import { Recipe } from '../../core/models/recipe.model';

describe('shared-recipe.utils', () => {
  const baseRecipe: Recipe = {
    id: 'base-1',
    user_id: null,
    title: 'Shared Oats',
    description: null,
    prep_time_minutes: 5,
    cook_time_minutes: null,
    portions: 1,
    tags: [],
    rating: null,
    image_url: null,
    image_status: 'pending',
    is_base_recipe: true,
    base_recipe_id: null,
    meal_type: 'breakfast',
    category: 'Oats',
    difficulty: 'easy',
    instructions: [],
    created_at: '2026-01-01T00:00:00Z',
  };

  const personalCopy: Recipe = {
    ...baseRecipe,
    id: 'copy-1',
    user_id: 'user-1',
    is_base_recipe: false,
    base_recipe_id: 'base-1',
  };

  it('identifies shared recipes', () => {
    expect(isSharedRecipe(baseRecipe)).toBeTrue();
    expect(isSharedRecipe(personalCopy)).toBeFalse();
  });

  it('finds an existing personal copy by base recipe id', () => {
    expect(findPersonalCopyOfBase([personalCopy], 'base-1')).toEqual(personalCopy);
    expect(findPersonalCopyOfBase([baseRecipe], 'base-1')).toBeUndefined();
  });
});
