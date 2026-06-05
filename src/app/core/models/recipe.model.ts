export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  prep_time_minutes: number | null;
  portions: number | null;
  tags: string[];
  created_at: string;
  ingredients?: RecipeIngredient[];
}

export interface RecipeInput {
  title: string;
  description?: string | null;
  prep_time_minutes?: number | null;
  portions?: number | null;
  tags: string[];
}

export interface RecipeIngredientInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}
