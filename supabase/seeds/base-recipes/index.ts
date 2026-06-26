import { breakfastBaseRecipes } from './breakfast';
import { lunchBaseRecipes } from './lunch';
import { dinnerBaseRecipes } from './dinner';
import { snackBaseRecipes } from './snacks';
import type { BaseRecipeSeed } from './types';

export const allBaseRecipeSeeds: BaseRecipeSeed[] = [
  ...breakfastBaseRecipes,
  ...lunchBaseRecipes,
  ...dinnerBaseRecipes,
  ...snackBaseRecipes,
];

export { breakfastBaseRecipes, lunchBaseRecipes, dinnerBaseRecipes, snackBaseRecipes };
