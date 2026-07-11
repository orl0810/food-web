import { MealType } from './meal-plan.model';

export type MealPhotoAnalysisStatus =
  | 'uploaded'
  | 'processing'
  | 'draft_ready'
  | 'confirmed'
  | 'failed'
  | 'expired';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface MealPhotoAnalysisRecord {
  id: string;
  user_id: string;
  storage_path: string;
  status: MealPhotoAnalysisStatus;
  provider: string | null;
  model: string | null;
  raw_result: unknown;
  normalized_draft: MealPhotoDraft | null;
  confirmed_payload: unknown;
  overall_confidence: number | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  image_bytes: number | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  expires_at: string;
}

export interface AnalyzeMealPhotoRequest {
  analysisId: string;
  mealType?: MealType;
  eatenAt?: string;
  userContext?: MealPhotoUserContext;
}

export interface MealPhotoUserContext {
  preferredUnits?: 'metric' | 'imperial';
  dietaryPreferences?: string[];
  allergies?: string[];
  dislikedIngredients?: string[];
}

export interface DetectedMealItem {
  id: string;
  name: string;
  estimatedQuantity: number | null;
  unit: string | null;
  preparation: string | null;
  confidence: number;
  alternatives: string[];
  userModified: boolean;
}

export interface MealNutritionEstimate {
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
}

export interface MealPhotoConfidence {
  overall: number;
  foodIdentification: number;
  portionEstimation: number;
  nutritionEstimation: number;
}

export interface MealClarificationQuestion {
  id: string;
  question: string;
  type: 'single-choice' | 'number' | 'text';
  options?: string[];
  affectedFields?: string[];
}

export interface MealPhotoDraft {
  analysisId: string;
  title: string;
  description: string | null;
  detectedItems: DetectedMealItem[];
  estimatedServing: {
    amount: number | null;
    unit: string | null;
  };
  nutritionEstimate: MealNutritionEstimate;
  confidence: MealPhotoConfidence;
  assumptions: string[];
  clarificationQuestions: MealClarificationQuestion[];
  warnings: string[];
}

export interface AnalyzeMealPhotoResponse {
  draft: MealPhotoDraft;
}

export interface MealPhotoDraftFormValue {
  title: string;
  date: string;
  mealType: MealType;
  status: 'planned' | 'prepared' | 'eaten';
  notes: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    preparation: string | null;
    confidence: number;
  }>;
  nutrition: MealNutritionEstimate;
}

export interface MealPhotoAnalysisCompleteEvent {
  file: File;
  previewUrl: string;
  draft: MealPhotoDraft;
  analysisId: string;
}
