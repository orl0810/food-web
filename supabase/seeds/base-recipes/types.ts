export type RecipeDifficulty = 'easy' | 'medium' | 'hard';
export type RecipeMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type BaseRecipeImageStatus = 'pending' | 'generating' | 'completed' | 'failed';

export interface BaseRecipeImageSeed {
  image_url?: string | null;
  image_status?: BaseRecipeImageStatus;
  image_storage_provider?: string;
  image_storage_key?: string;
  image_prompt?: string;
}

export interface BaseRecipeIngredientSeed {
  id?: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface BaseRecipeSeed extends BaseRecipeImageSeed {
  id: string;
  title: string;
  description: string;
  meal_type: RecipeMealType;
  category: string;
  ingredients: BaseRecipeIngredientSeed[];
  instructions: string[];
  tags: string[];
  portions: number;
  prep_time_minutes: number;
  cook_time_minutes: number;
  difficulty: RecipeDifficulty;
}
