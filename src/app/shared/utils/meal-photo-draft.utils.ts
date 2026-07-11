import {
  ConfidenceLevel,
  DetectedMealItem,
  MealClarificationQuestion,
  MealNutritionEstimate,
  MealPhotoConfidence,
  MealPhotoDraft,
} from '../../core/models/meal-photo-analysis.model';
import { CreatePhotoFoodLogInput } from '../../core/models/food-log.model';
import { MealSlotItemStatus } from '../../core/models/meal-slot-item.model';
import { MealType } from '../../core/models/meal-plan.model';
import { MealPhotoDraftFormValue } from '../../core/models/meal-photo-analysis.model';

export function getConfidenceLevel(value: number | null | undefined): ConfidenceLevel {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'low';
  }
  if (value >= 0.8) {
    return 'high';
  }
  if (value >= 0.5) {
    return 'medium';
  }
  return 'low';
}

export function getConfidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'High confidence';
    case 'medium':
      return 'Medium confidence';
    default:
      return 'Please review';
  }
}

export function shouldHighlightField(confidence: number | null | undefined): boolean {
  return getConfidenceLevel(confidence) === 'low';
}

export function normalizeNutritionValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num * 10) / 10;
}

export function normalizeNutritionEstimate(input: Partial<MealNutritionEstimate> | null | undefined): MealNutritionEstimate {
  return {
    calories: normalizeNutritionValue(input?.calories),
    protein_g: normalizeNutritionValue(input?.protein_g),
    carbohydrates_g: normalizeNutritionValue(input?.carbohydrates_g),
    fat_g: normalizeNutritionValue(input?.fat_g),
    fiber_g: normalizeNutritionValue(input?.fiber_g),
    sugar_g: normalizeNutritionValue(input?.sugar_g),
  };
}

export function draftToFormValue(
  draft: MealPhotoDraft,
  defaults: { date: string; mealType: MealType; status?: MealSlotItemStatus }
): MealPhotoDraftFormValue {
  const defaultStatus: MealPhotoDraftFormValue['status'] =
    defaults.status === 'eaten'
      ? 'eaten'
      : defaults.status === 'prepared'
        ? 'prepared'
        : 'planned';

  return {
    title: draft.title,
    date: defaults.date,
    mealType: defaults.mealType,
    status: defaultStatus,
    notes: buildDetectedItemsNotes(draft.detectedItems),
    items: draft.detectedItems.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.estimatedQuantity,
      unit: item.unit,
      preparation: item.preparation,
      confidence: item.confidence,
    })),
    nutrition: normalizeNutritionEstimate(draft.nutritionEstimate),
  };
}

export function buildDetectedItemsNotes(
  items: Array<{ name: string; estimatedQuantity?: number | null; unit?: string | null; preparation?: string | null }>
): string {
  if (items.length === 0) {
    return '';
  }
  const lines = items.map((item) => {
    const qty =
      item.estimatedQuantity !== null && item.estimatedQuantity !== undefined
        ? `${item.estimatedQuantity}${item.unit ? ` ${item.unit}` : ''}`
        : 'unspecified amount';
    const prep = item.preparation ? ` (${item.preparation})` : '';
    return `- ${item.name}: ${qty}${prep}`;
  });
  return `Detected from photo:\n${lines.join('\n')}`;
}

export interface PhotoFoodLogPayloadOptions {
  imageUrl: string;
  analysisId: string;
  formValue: MealPhotoDraftFormValue;
}

export function formValueToPhotoFoodLogInput(
  options: PhotoFoodLogPayloadOptions
): CreatePhotoFoodLogInput {
  const { formValue, imageUrl, analysisId } = options;
  const servingItem = formValue.items[0];

  return {
    name: formValue.title.trim(),
    date: formValue.date,
    mealType: formValue.mealType,
    quantity: servingItem?.quantity ?? null,
    unit: servingItem?.unit?.trim() || null,
    notes: formValue.notes.trim() || null,
    imageUrl,
    status: formValue.status,
    analysisId,
    nutritionEstimate: normalizeNutritionEstimate(formValue.nutrition),
    detectedItemsSummary: formValue.items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit?.trim() || null,
      preparation: item.preparation?.trim() || null,
    })),
  };
}

export function buildConfirmedPayload(
  formValue: MealPhotoDraftFormValue,
  imageUrl: string
): Record<string, unknown> {
  return {
    title: formValue.title.trim(),
    date: formValue.date,
    mealType: formValue.mealType,
    status: formValue.status,
    notes: formValue.notes.trim() || null,
    imageUrl,
    items: formValue.items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit?.trim() || null,
      preparation: item.preparation?.trim() || null,
    })),
    nutrition: normalizeNutritionEstimate(formValue.nutrition),
  };
}

export function mapAnalysisError(code: string | null | undefined, message: string | null | undefined): string {
  switch (code) {
    case 'unauthenticated':
      return 'You must be signed in to analyze photos.';
    case 'not_found':
      return 'This analysis could not be found. Please start again.';
    case 'forbidden':
      return 'You do not have access to this photo analysis.';
    case 'invalid_storage_path':
      return 'The uploaded photo could not be verified. Please try again.';
    case 'image_too_large':
      return 'The image is too large. Please choose a smaller photo.';
    case 'unsupported_mime':
      return 'This image format is not supported.';
    case 'no_food_detected':
      return 'No food was detected in this photo. Try a clearer image or continue manually.';
    case 'provider_unavailable':
    case 'provider_timeout':
      return 'Food analysis is temporarily unavailable. Please try again.';
    case 'rate_limited':
      return 'You have reached today\'s photo analysis limit. Try again tomorrow or continue manually.';
    case 'duplicate_processing':
      return 'This photo is already being analyzed. Please wait a moment.';
    case 'invalid_response':
      return 'We could not read the analysis result. Please try again.';
    default:
      return message?.trim() || 'Could not analyze this photo. Please try again.';
  }
}

export function createEmptyDraft(analysisId: string): MealPhotoDraft {
  return {
    analysisId,
    title: '',
    description: null,
    detectedItems: [],
    estimatedServing: { amount: null, unit: null },
    nutritionEstimate: normalizeNutritionEstimate(null),
    confidence: {
      overall: 0,
      foodIdentification: 0,
      portionEstimation: 0,
      nutritionEstimation: 0,
    },
    assumptions: [],
    clarificationQuestions: [],
    warnings: [],
  };
}

export function clampConfidence(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.min(1, num));
}

/** Exported for edge-function parity tests in future. */
export function normalizeDetectedItem(raw: Record<string, unknown>, index: number): DetectedMealItem | null {
  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : '';
  if (!name) {
    return null;
  }
  const alternatives = Array.isArray(raw['alternatives'])
    ? raw['alternatives'].filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 5)
    : [];

  return {
    id: typeof raw['id'] === 'string' && raw['id'].trim() ? raw['id'] : `item-${index + 1}`,
    name,
    estimatedQuantity: toPositiveNumberOrNull(raw['estimatedQuantity'] ?? raw['quantity']),
    unit: toStringOrNull(raw['unit']),
    preparation: toStringOrNull(raw['preparation']),
    confidence: clampConfidence(raw['confidence']),
    alternatives,
    userModified: false,
  };
}

function toPositiveNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeClarificationQuestion(
  raw: Record<string, unknown>,
  index: number
): MealClarificationQuestion | null {
  const question = typeof raw['question'] === 'string' ? raw['question'].trim() : '';
  if (!question) {
    return null;
  }
  const rawType = raw['type'];
  const type =
    rawType === 'single-choice' || rawType === 'number' || rawType === 'text' ? rawType : 'text';
  const options = Array.isArray(raw['options'])
    ? raw['options'].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : undefined;

  return {
    id: typeof raw['id'] === 'string' && raw['id'].trim() ? raw['id'] : `q-${index + 1}`,
    question,
    type,
    options,
    affectedFields: Array.isArray(raw['affectedFields'])
      ? raw['affectedFields'].filter((v): v is string => typeof v === 'string')
      : undefined,
  };
}

export function normalizeDraftFromAi(analysisId: string, parsed: Record<string, unknown>): MealPhotoDraft | null {
  const title = typeof parsed['title'] === 'string' ? parsed['title'].trim() : '';
  if (!title) {
    return null;
  }

  const rawItems = Array.isArray(parsed['detectedItems']) ? parsed['detectedItems'] : [];
  const detectedItems = rawItems
    .map((item, index) => (isRecord(item) ? normalizeDetectedItem(item, index) : null))
    .filter((item): item is DetectedMealItem => item !== null);

  if (detectedItems.length === 0) {
    return null;
  }

  const serving = isRecord(parsed['estimatedServing']) ? parsed['estimatedServing'] : {};
  const confidenceRaw = isRecord(parsed['confidence']) ? parsed['confidence'] : {};
  const confidence: MealPhotoConfidence = {
    overall: clampConfidence(confidenceRaw['overall'] ?? parsed['overallConfidence']),
    foodIdentification: clampConfidence(confidenceRaw['foodIdentification']),
    portionEstimation: clampConfidence(confidenceRaw['portionEstimation']),
    nutritionEstimation: clampConfidence(confidenceRaw['nutritionEstimation']),
  };

  const nutritionRaw = isRecord(parsed['nutritionEstimate'])
    ? parsed['nutritionEstimate']
    : parsed['nutrition'];
  const nutritionEstimate = isRecord(nutritionRaw)
    ? normalizeNutritionEstimate({
        calories: normalizeNutritionValue(nutritionRaw['calories'] ?? nutritionRaw['caloriesKcal']),
        protein_g: normalizeNutritionValue(nutritionRaw['protein_g'] ?? nutritionRaw['proteinG']),
        carbohydrates_g: normalizeNutritionValue(
          nutritionRaw['carbohydrates_g'] ?? nutritionRaw['carbohydratesG']
        ),
        fat_g: normalizeNutritionValue(nutritionRaw['fat_g'] ?? nutritionRaw['fatG']),
        fiber_g: normalizeNutritionValue(nutritionRaw['fiber_g'] ?? nutritionRaw['fiberG']),
        sugar_g: normalizeNutritionValue(nutritionRaw['sugar_g'] ?? nutritionRaw['sugarG']),
      })
    : normalizeNutritionEstimate(null);

  const clarificationRaw = Array.isArray(parsed['clarificationQuestions'])
    ? parsed['clarificationQuestions']
    : [];
  const clarificationQuestions = clarificationRaw
    .map((q, index) => (isRecord(q) ? normalizeClarificationQuestion(q, index) : null))
    .filter((q): q is MealClarificationQuestion => q !== null)
    .slice(0, 2);

  const assumptions = Array.isArray(parsed['assumptions'])
    ? parsed['assumptions'].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];
  const warnings = Array.isArray(parsed['warnings'])
    ? parsed['warnings'].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];

  return {
    analysisId,
    title,
    description: toStringOrNull(parsed['description']),
    detectedItems,
    estimatedServing: {
      amount: toPositiveNumberOrNull(serving['amount']),
      unit: toStringOrNull(serving['unit']),
    },
    nutritionEstimate,
    confidence,
    assumptions,
    clarificationQuestions,
    warnings,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
