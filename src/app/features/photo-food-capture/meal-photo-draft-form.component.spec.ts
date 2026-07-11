import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MealPhotoDraftFormComponent } from './meal-photo-draft-form.component';
import { FoodLogService } from '../../core/services/food-log.service';
import { FoodLogPhotoService } from '../../core/services/food-log-photo.service';
import { MealPhotoAnalysisService } from '../../core/services/meal-photo-analysis.service';
import { MealPhotoDraft } from '../../core/models/meal-photo-analysis.model';

function makeDraft(): MealPhotoDraft {
  return {
    analysisId: 'analysis-1',
    title: 'Chicken salad',
    description: null,
    detectedItems: [
      {
        id: 'item-1',
        name: 'Chicken',
        estimatedQuantity: 120,
        unit: 'g',
        preparation: 'grilled',
        confidence: 0.4,
        alternatives: [],
        userModified: false,
      },
    ],
    estimatedServing: { amount: 1, unit: 'plate' },
    nutritionEstimate: {
      calories: 350,
      protein_g: 30,
      carbohydrates_g: 10,
      fat_g: 12,
      fiber_g: 2,
      sugar_g: null,
    },
    confidence: {
      overall: 0.7,
      foodIdentification: 0.75,
      portionEstimation: 0.5,
      nutritionEstimation: 0.5,
    },
    assumptions: ['Dressing amount estimated'],
    clarificationQuestions: [
      {
        id: 'q-1',
        question: 'Was there cheese on the salad?',
        type: 'single-choice',
        options: ['Yes', 'No'],
      },
    ],
    warnings: ['Portion size is approximate'],
  };
}

describe('MealPhotoDraftFormComponent', () => {
  let component: MealPhotoDraftFormComponent;
  let fixture: ComponentFixture<MealPhotoDraftFormComponent>;
  let createPhotoFoodLogSpy: jasmine.Spy;
  let markConfirmedSpy: jasmine.Spy;

  beforeEach(async () => {
    createPhotoFoodLogSpy = jasmine
      .createSpy('createPhotoFoodLog')
      .and.resolveTo({ item: { id: 'item-1' }, error: null });
    markConfirmedSpy = jasmine.createSpy('markConfirmed').and.resolveTo(undefined);

    await TestBed.configureTestingModule({
      imports: [MealPhotoDraftFormComponent],
      providers: [
        {
          provide: FoodLogService,
          useValue: { createPhotoFoodLog: createPhotoFoodLogSpy },
        },
        {
          provide: FoodLogPhotoService,
          useValue: {
            uploadFoodPhoto: async () => 'https://example.com/photo.jpg',
          },
        },
        {
          provide: MealPhotoAnalysisService,
          useValue: { markConfirmed: markConfirmedSpy },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MealPhotoDraftFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('draft', makeDraft());
    fixture.componentRef.setInput('file', new File(['x'], 'meal.jpg', { type: 'image/jpeg' }));
    fixture.componentRef.setInput('previewUrl', 'blob:preview');
    fixture.componentRef.setInput('analysisId', 'analysis-1');
    fixture.detectChanges();
  });

  it('renders draft title and detected item', () => {
    expect(component.form.controls.title.value).toBe('Chicken salad');
    expect(component.items.length).toBe(1);
  });

  it('allows adding and removing items', () => {
    component.addItem();
    expect(component.items.length).toBe(2);
    component.removeItem(1);
    expect(component.items.length).toBe(1);
  });

  it('highlights low-confidence items', () => {
    expect(component.shouldHighlightItem(0)).toBeTrue();
    expect(component.confidenceLabel(0)).toContain('review');
  });

  it('saves confirmed meal and marks analysis confirmed', async () => {
    const savedSpy = spyOn(component.saved, 'emit');
    await component.save();

    expect(createPhotoFoodLogSpy).toHaveBeenCalled();
    expect(markConfirmedSpy).toHaveBeenCalledWith('analysis-1', jasmine.any(Object));
    expect(savedSpy).toHaveBeenCalled();
  });

  it('prevents duplicate save while saving', async () => {
    createPhotoFoodLogSpy.and.returnValue(new Promise(() => undefined));
    void component.save();
    expect(component.saving()).toBeTrue();
    await component.save();
    expect(createPhotoFoodLogSpy).toHaveBeenCalledTimes(1);
  });
});
