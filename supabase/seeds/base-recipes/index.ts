import { breakfastBaseRecipes } from './breakfast';
import { lunchBaseRecipes } from './lunch';
import { dinnerBaseRecipes } from './dinner';
import { snackBaseRecipes } from './snacks';
import { inspirationBaseRecipes } from './inspiration';
import type { BaseRecipeSeed } from './types';

export const allBaseRecipeSeeds: BaseRecipeSeed[] = [
  ...breakfastBaseRecipes,
  ...lunchBaseRecipes,
  ...dinnerBaseRecipes,
  ...snackBaseRecipes,
  ...inspirationBaseRecipes,
];

export {
  breakfastBaseRecipes,
  lunchBaseRecipes,
  dinnerBaseRecipes,
  snackBaseRecipes,
  inspirationBaseRecipes,
};
