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
  let addSlotItemSpy: jasmine.Spy;
  let loadWeekAndTodaySpy: jasmine.Spy;

  beforeEach(async () => {
    addSlotItemSpy = jasmine.createSpy('addSlotItem').and.resolveTo({
      item: null,
      error: null,
    });
    loadWeekAndTodaySpy = jasmine.createSpy('loadWeekAndToday').and.resolveTo();

    await TestBed.configureTestingModule({
      imports: [AddToMealPlanDialogComponent],
      providers: [
        {
          provide: MealPlanService,
          useValue: {
            addSlotItem: addSlotItemSpy,
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
    component.selectedDate.set('2026-07-14');
    component.selectedMealType.set('lunch');

    await component.confirm();

    expect(addSlotItemSpy).toHaveBeenCalledOnceWith({
      date: '2026-07-14',
      meal_type: 'lunch',
      item_type: 'recipe',
      recipe_id: 'recipe-1',
    });
    expect(loadWeekAndTodaySpy).toHaveBeenCalledOnceWith('2026-07-14');
    expect(savedSpy).toHaveBeenCalled();
  });

  it('keeps the dialog open and does not change weeks when saving fails', async () => {
    addSlotItemSpy.and.resolveTo({
      item: null,
      error: 'Could not add this item. Please try again.',
    });
    const savedSpy = jasmine.createSpy('saved');
    component.saved.subscribe(savedSpy);

    await component.confirm();

    expect(component.error()).toBe('Could not add this item. Please try again.');
    expect(loadWeekAndTodaySpy).not.toHaveBeenCalled();
    expect(savedSpy).not.toHaveBeenCalled();
  });
});
