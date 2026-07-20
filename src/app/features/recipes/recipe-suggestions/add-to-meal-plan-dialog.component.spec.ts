import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Recipe } from '../../../core/models/recipe.model';
import { MealPlanService } from '../../../core/services/meal-plan.service';
import { AddToMealPlanDialogComponent } from './add-to-meal-plan-dialog.component';

function makeRecipe(): Recipe {
  return {
    id: 'recipe-1',
    user_id: 'user-1',
    title: 'Chicken and Rice',
    description: null,
    prep_time_minutes: 20,
    cook_time_minutes: 30,
    portions: 4,
    tags: [],
    rating: null,
    image_url: null,
    image_status: 'completed',
    is_base_recipe: false,
    base_recipe_id: null,
    meal_type: 'dinner',
    category: null,
    difficulty: 'easy',
    instructions: [],
    created_at: '2026-07-01T00:00:00Z',
  };
}

describe('AddToMealPlanDialogComponent', () => {
  let fixture: ComponentFixture<AddToMealPlanDialogComponent>;
  let component: AddToMealPlanDialogComponent;
  let addRecipeSlotsBatchSpy: jasmine.Spy;
  let loadWeekAndTodaySpy: jasmine.Spy;

  beforeEach(async () => {
    addRecipeSlotsBatchSpy = jasmine
      .createSpy('addRecipeSlotsBatch')
      .and.resolveTo({
        items: [],
        error: null,
      });
    loadWeekAndTodaySpy = jasmine.createSpy('loadWeekAndToday').and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [AddToMealPlanDialogComponent],
      providers: [
        {
          provide: MealPlanService,
          useValue: {
            addRecipeSlotsBatch: addRecipeSlotsBatchSpy,
            loadWeekAndToday: loadWeekAndTodaySpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddToMealPlanDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('recipe', makeRecipe());
    fixture.detectChanges();
  });

  it('loads the selected date week after saving the recipe', async () => {
    const savedSpy = jasmine.createSpy('saved');
    component.saved.subscribe(savedSpy);
    component.selectedDates.set(['2026-07-14']);
    component.selectedMealType.set('lunch');

    await component.confirm();

    expect(addRecipeSlotsBatchSpy).toHaveBeenCalledOnceWith([
      {
        date: '2026-07-14',
        mealType: 'lunch',
        recipeId: 'recipe-1',
      },
    ]);
    expect(loadWeekAndTodaySpy).toHaveBeenCalledOnceWith('2026-07-14');
    expect(savedSpy).toHaveBeenCalled();
  });

  it('adds the recipe to every selected date', async () => {
    const savedSpy = jasmine.createSpy('saved');
    component.saved.subscribe(savedSpy);
    component.selectedDates.set(['2026-07-14', '2026-07-16']);
    component.selectedMealType.set('dinner');

    await component.confirm();

    expect(addRecipeSlotsBatchSpy).toHaveBeenCalledOnceWith([
      {
        date: '2026-07-14',
        mealType: 'dinner',
        recipeId: 'recipe-1',
      },
      {
        date: '2026-07-16',
        mealType: 'dinner',
        recipeId: 'recipe-1',
      },
    ]);
    expect(loadWeekAndTodaySpy).toHaveBeenCalledOnceWith('2026-07-14');
    expect(savedSpy).toHaveBeenCalled();
  });

  it('toggles dates on and off', () => {
    component.selectedDates.set(['2026-07-14']);

    component.toggleDate('2026-07-16');
    expect(component.selectedDates()).toEqual(['2026-07-14', '2026-07-16']);

    component.toggleDate('2026-07-14');
    expect(component.selectedDates()).toEqual(['2026-07-16']);
  });

  it('keeps the dialog open and does not change weeks when saving fails', async () => {
    addRecipeSlotsBatchSpy.and.resolveTo({
      items: [],
      error: 'Could not add recipes to your meal plan. No meals were saved.',
    });
    const savedSpy = jasmine.createSpy('saved');
    component.saved.subscribe(savedSpy);

    await component.confirm();

    expect(component.error()).toBe(
      'Could not add recipes to your meal plan. No meals were saved.'
    );
    expect(loadWeekAndTodaySpy).not.toHaveBeenCalled();
    expect(savedSpy).not.toHaveBeenCalled();
  });

  it('does not save when no dates are selected', async () => {
    const savedSpy = jasmine.createSpy('saved');
    component.saved.subscribe(savedSpy);
    component.selectedDates.set([]);

    await component.confirm();

    expect(component.error()).toBe('Select at least one day.');
    expect(addRecipeSlotsBatchSpy).not.toHaveBeenCalled();
    expect(savedSpy).not.toHaveBeenCalled();
  });
});
