import { MealType } from './meal-plan.model';

export type PhotoCaptureDestination = 'recipe' | 'mealPlan' | 'foodLog';

export type PhotoCaptureSource = 'camera' | 'upload';

export interface PhotoCaptureContext {
  defaultDate?: string;
  defaultMealType?: MealType;
}

export interface FoodPhotoAnalysisResult {
  suggestedName?: string;
  suggestedMealType?: MealType;
  possibleIngredients?: string[];
  confidence?: number;
  warnings?: string[];
}

export interface RecipePhotoDraft {
  file: File;
  previewUrl: string;
  analysis?: FoodPhotoAnalysisResult | null;
}

export interface PhotoCaptureSelection {
  destination: PhotoCaptureDestination;
  file: File;
  previewUrl: string;
  analysis?: FoodPhotoAnalysisResult | null;
}
