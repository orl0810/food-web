import { Recipe } from '../../core/models/recipe.model';
import {
  buildRecipeCategoryIndex,
  getCategoriesWithRecipes,
  recipeMatchesCategory,
} from './recipe-category-match.utils';

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'recipe-1',
    user_id: null,
    title: 'Test Recipe',
    description: null,
    prep_time_minutes: null,
    cook_time_minutes: null,
    portions: null,
    tags: [],
    rating: null,
    image_url: null,
    image_status: 'pending',
    is_base_recipe: true,
    base_recipe_id: null,
    meal_type: 'lunch',
    category: null,
    difficulty: null,
    instructions: [],
    created_at: '2026-01-01T00:00:00.000Z',
    ingredients: [],
    ...overrides,
  };
}

describe('recipe-category-match.utils', () => {
  it('matches by exact category field (case-insensitive)', () => {
    const recipe = makeRecipe({ category: 'chicken' });
    expect(recipeMatchesCategory(recipe, 'Chicken')).toBe(true);
  });

  it('matches chicken recipes by title keyword', () => {
    const recipe = makeRecipe({
      title: 'Grilled Chicken Salad',
      category: 'Salad',
    });
    expect(recipeMatchesCategory(recipe, 'Chicken')).toBe(true);
  });

  it('matches pasta recipes by ingredient keyword', () => {
    const recipe = makeRecipe({
      title: 'Weeknight Dinner',
      category: 'Main Dish',
      ingredients: [{ id: '1', recipe_id: 'recipe-1', name: 'spaghetti', quantity: 1, unit: 'lb' }],
    });
    expect(recipeMatchesCategory(recipe, 'Pasta')).toBe(true);
  });

  it('does not false-match short keywords inside unrelated words', () => {
    const recipe = makeRecipe({
      title: 'Veggie Stir Fry',
      category: 'Asian',
    });
    expect(recipeMatchesCategory(recipe, 'Eggs')).toBe(false);
  });

  it('builds an index with recipe ids per category', () => {
    const recipes = [
      makeRecipe({ id: 'a', title: 'Chicken Wrap', category: 'Wrap' }),
      makeRecipe({ id: 'b', title: 'Beef Burger', category: 'Burgers' }),
    ];

    const index = buildRecipeCategoryIndex(recipes);
    expect(index.get('Chicken')?.has('a')).toBe(true);
    expect(index.get('Wrap')?.has('a')).toBe(true);
    expect(index.get('Burgers')?.has('b')).toBe(true);
    expect(index.get('Meat')?.has('b')).toBe(true);
  });

  it('returns only categories that have matching recipes', () => {
    const recipes = [makeRecipe({ id: 'a', title: 'Chicken Soup', category: 'Soup' })];
    const categories = getCategoriesWithRecipes(recipes);
    expect(categories).toContain('Chicken');
    expect(categories).toContain('Soup');
    expect(categories).not.toContain('Dessert');
  });
});
