export interface RecipeVoiceDraftIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

export interface RecipeVoiceDraft {
  title: string;
  description?: string | null;
  portions?: number | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  ingredients: RecipeVoiceDraftIngredient[];
  instructions: string[];
}

export interface RecipeVoiceParseResult {
  draft: RecipeVoiceDraft;
  transcript: string;
  warnings?: string[];
}
