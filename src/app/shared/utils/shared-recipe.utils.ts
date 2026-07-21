import { Recipe } from '../../core/models/recipe.model';

export function isSharedRecipe(recipe: Pick<Recipe, 'is_base_recipe'>): boolean {
  return recipe.is_base_recipe;
}

export function findPersonalCopyOfBase(
  recipes: Recipe[],
  baseRecipeId: string
): Recipe | undefined {
  return recipes.find(
    (recipe) => !recipe.is_base_recipe && recipe.base_recipe_id === baseRecipeId
  );
}
