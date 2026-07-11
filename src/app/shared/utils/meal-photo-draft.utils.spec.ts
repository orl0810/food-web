import { TestBed } from '@angular/core/testing';
import {
  buildDetectedItemsNotes,
  draftToFormValue,
  formValueToPhotoFoodLogInput,
  getConfidenceLevel,
  mapAnalysisError,
  normalizeDraftFromAi,
  normalizeNutritionEstimate,
  shouldHighlightField,
} from './meal-photo-draft.utils';
import { MealPhotoDraft } from '../../core/models/meal-photo-analysis.model';

function makeDraft(overrides: Partial<MealPhotoDraft> = {}): MealPhotoDraft {
  return {
    analysisId: 'analysis-1',
    title: 'Grilled chicken bowl',
    description: null,
    detectedItems: [
      {
        id: 'item-1',
        name: 'Grilled chicken',
        estimatedQuantity: 150,
        unit: 'g',
        preparation: 'grilled',
        confidence: 0.9,
        alternatives: [],
        userModified: false,
      },
    ],
    estimatedServing: { amount: 1, unit: 'bowl' },
    nutritionEstimate: {
      calories: 420,
      protein_g: 35,
      carbohydrates_g: 20,
      fat_g: 12,
      fiber_g: 4,
      sugar_g: null,
    },
    confidence: {
      overall: 0.82,
      foodIdentification: 0.9,
      portionEstimation: 0.6,
      nutritionEstimation: 0.55,
    },
    assumptions: ['Rice portion estimated visually'],
    clarificationQuestions: [],
    warnings: [],
    ...overrides,
  };
}

describe('meal-photo-draft.utils', () => {
  it('maps confidence levels', () => {
    expect(getConfidenceLevel(0.85)).toBe('high');
    expect(getConfidenceLevel(0.65)).toBe('medium');
    expect(getConfidenceLevel(0.3)).toBe('low');
    expect(getConfidenceLevel(null)).toBe('low');
  });

  it('highlights low-confidence fields only', () => {
    expect(shouldHighlightField(0.9)).toBeFalse();
    expect(shouldHighlightField(0.4)).toBeTrue();
  });

  it('preserves null nutrition values', () => {
    expect(normalizeNutritionEstimate({ calories: null, protein_g: 10, sugar_g: undefined })).toEqual({
      calories: null,
      protein_g: 10,
      carbohydrates_g: null,
      fat_g: null,
      fiber_g: null,
      sugar_g: null,
    });
  });

  it('rejects negative nutrition values', () => {
    expect(normalizeNutritionEstimate({ calories: -5, protein_g: 12 })).toEqual({
      calories: null,
      protein_g: 12,
      carbohydrates_g: null,
      fat_g: null,
      fiber_g: null,
      sugar_g: null,
    });
  });

  it('maps draft to form value with defaults', () => {
    const form = draftToFormValue(makeDraft(), {
      date: '2026-07-11',
      mealType: 'lunch',
      status: 'prepared',
    });

    expect(form.title).toBe('Grilled chicken bowl');
    expect(form.date).toBe('2026-07-11');
    expect(form.mealType).toBe('lunch');
    expect(form.status).toBe('prepared');
    expect(form.items.length).toBe(1);
    expect(form.nutrition.calories).toBe(420);
  });

  it('builds detected item notes', () => {
    const notes = buildDetectedItemsNotes([
      { name: 'Salad', estimatedQuantity: 1, unit: 'cup', preparation: 'raw' },
    ]);
    expect(notes).toContain('Salad');
    expect(notes).toContain('1 cup');
  });

  it('maps form value to photo food log input with nutrition snapshots', () => {
    const form = draftToFormValue(makeDraft(), {
      date: '2026-07-11',
      mealType: 'dinner',
    });
    form.status = 'eaten';

    const input = formValueToPhotoFoodLogInput({
      formValue: form,
      imageUrl: 'https://example.com/photo.jpg',
      analysisId: 'analysis-1',
    });

    expect(input.name).toBe('Grilled chicken bowl');
    expect(input.status).toBe('eaten');
    expect(input.analysisId).toBe('analysis-1');
    expect(input.nutritionEstimate?.calories).toBe(420);
    expect(input.detectedItemsSummary?.length).toBe(1);
  });

  it('normalizes AI draft payload', () => {
    const draft = normalizeDraftFromAi('abc', {
      title: 'Pasta',
      detectedItems: [
        {
          name: 'Penne',
          estimatedQuantity: 200,
          unit: 'g',
          confidence: 0.7,
          alternatives: ['Rigatoni'],
        },
      ],
      nutritionEstimate: {
        caloriesKcal: 500,
        proteinG: 18,
      },
      confidence: { overall: 0.75 },
      assumptions: [],
      warnings: [],
      clarificationQuestions: [],
    });

    expect(draft?.title).toBe('Pasta');
    expect(draft?.detectedItems[0].name).toBe('Penne');
    expect(draft?.nutritionEstimate.calories).toBe(500);
    expect(draft?.nutritionEstimate.protein_g).toBe(18);
  });

  it('returns null when AI draft has no items', () => {
    expect(
      normalizeDraftFromAi('abc', {
        title: 'Empty',
        detectedItems: [],
      })
    ).toBeNull();
  });

  it('maps known analysis error codes', () => {
    expect(mapAnalysisError('rate_limited', null)).toContain('limit');
    expect(mapAnalysisError('no_food_detected', null)).toContain('No food');
    expect(mapAnalysisError('unknown', 'Custom message')).toBe('Custom message');
  });
});
