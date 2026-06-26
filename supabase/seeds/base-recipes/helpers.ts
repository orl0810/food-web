import type {
  BaseRecipeImageSeed,
  BaseRecipeIngredientSeed,
  BaseRecipeSeed,
  RecipeDifficulty,
  RecipeMealType,
} from './types';

interface RecipeDef extends BaseRecipeImageSeed {
  title: string;
  description: string;
  meal_type: RecipeMealType;
  category: string;
  ingredients: BaseRecipeIngredientSeed[];
  instructions: string[];
  tags: string[];
  portions?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  difficulty?: RecipeDifficulty;
}

/** 4-char meal block used in the UUID suffix (12 hex chars total). */
export function baseRecipeId(mealCode: string, recipeIndex: number): string {
  const suffix = `${mealCode}${String(recipeIndex).padStart(4, '0')}0000`;
  if (suffix.length !== 12) {
    throw new Error(`Invalid recipe UUID suffix: ${suffix}`);
  }
  return `00000000-0000-4000-8000-${suffix}`;
}

export function baseRecipeIngredientId(
  mealCode: string,
  recipeIndex: number,
  ingredientIndex: number
): string {
  const suffix = `${mealCode}${String(recipeIndex).padStart(4, '0')}${String(ingredientIndex).padStart(4, '0')}`;
  if (suffix.length !== 12) {
    throw new Error(`Invalid ingredient UUID suffix: ${suffix}`);
  }
  return `00000000-0000-4001-8000-${suffix}`;
}

export function baseRecipeSlug(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function baseRecipeStorageKey(slug: string): string {
  return `recipe-images/base/${slug}.webp`;
}

export function defineBaseRecipes(
  mealCode: string,
  recipes: RecipeDef[]
): BaseRecipeSeed[] {
  return recipes.map((recipe, index) => {
    const recipeIndex = index + 1;
    const id = baseRecipeId(mealCode, recipeIndex);
    const slug = baseRecipeSlug(recipe.title);

    return {
      id,
      title: recipe.title,
      description: recipe.description,
      meal_type: recipe.meal_type,
      category: recipe.category,
      ingredients: recipe.ingredients.map((ingredient, ingredientIndex) => ({
        ...ingredient,
        id: baseRecipeIngredientId(mealCode, recipeIndex, ingredientIndex + 1),
      })),
      instructions: recipe.instructions,
      tags: recipe.tags,
      portions: recipe.portions ?? 1,
      prep_time_minutes: recipe.prep_time_minutes ?? 10,
      cook_time_minutes: recipe.cook_time_minutes ?? 0,
      difficulty: recipe.difficulty ?? 'easy',
      image_url: recipe.image_url ?? null,
      image_status: recipe.image_status ?? 'pending',
      image_storage_provider: recipe.image_storage_provider ?? 'cloudflare_r2',
      image_storage_key: recipe.image_storage_key ?? baseRecipeStorageKey(slug),
      image_prompt: recipe.image_prompt,
    };
  });
}
