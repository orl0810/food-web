import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FoodItem } from '../../../core/models/food-item.model';
import {
  AiRecipeSuggestion,
  AiRecipeSuggestionRequest,
} from '../../../core/models/ai-recipe-suggestion.model';
import { UserFoodProfile } from '../../../core/models/user-profile.model';
import { AiRecipeService } from '../../../core/services/ai-recipe.service';
import { FoodInventoryService } from '../../../core/services/food-inventory.service';
import { PreparedPortionService } from '../../../core/services/prepared-portion.service';
import { RecipeService } from '../../../core/services/recipe.service';
import { ShoppingListService } from '../../../core/services/shopping-list.service';
import { SmartSuggestionService } from '../../../core/services/smart-suggestion.service';
import { UserProfileFacadeService } from '../../user-profile/services/user-profile-facade.service';
import { RecipeSuggestionsComponent } from './recipe-suggestions.component';

function makeFoodItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'food-1',
    user_id: 'user-1',
    name: 'Tomato',
    category: null,
    quantity: 2,
    unit: null,
    expiration_date: '2026-06-25',
    location: 'fridge',
    created_at: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

function makeAiSuggestion(
  title: string,
  overrides: Partial<AiRecipeSuggestion> = {}
): AiRecipeSuggestion {
  return {
    title,
    description: `${title} description`,
    prepTimeMinutes: 25,
    portions: 2,
    difficulty: 'easy',
    tags: ['quick'],
    ingredients: [{ name: 'Tomato', quantity: 2, unit: null }],
    steps: ['Cook it'],
    usedInventoryIngredients: ['Tomato'],
    missingIngredients: [],
    reason: 'Uses what you have',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserFoodProfile> = {}): UserFoodProfile {
  return {
    id: '1',
    userId: 'u1',
    displayName: 'Test',
    dietaryPreferences: ['vegan'],
    favoriteIngredients: [],
    dislikedIngredients: [
      {
        id: 'd1',
        ingredientName: 'Mushrooms',
        normalizedName: 'mushrooms',
        source: 'manual',
      },
    ],
    allergies: [
      {
        id: 'a1',
        name: 'Peanuts',
        normalizedName: 'peanuts',
        strictExclusion: true,
      },
    ],
    mealPlanningSettings: {
      defaultMealsPerDay: 3,
      enabledMealSlots: ['breakfast', 'lunch', 'dinner'],
      preferredUnits: 'metric',
      householdSize: 2,
      defaultPortionsPerRecipe: 4,
      expiringItemsReminderEnabled: true,
    },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function findButtonByText(root: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  );
}

describe('RecipeSuggestionsComponent AI generation', () => {
  let fixture: ComponentFixture<RecipeSuggestionsComponent>;
  let component: RecipeSuggestionsComponent;
  let inventoryItems: ReturnType<typeof signal<FoodItem[]>>;
  let generateSpy: jasmine.Spy<
    (request: AiRecipeSuggestionRequest) => Promise<{ suggestions: AiRecipeSuggestion[] }>
  >;
  let aiLoading: ReturnType<typeof signal<boolean>>;
  let aiError: ReturnType<typeof signal<string | null>>;
  let profileForSuggestions: UserFoodProfile | null;

  beforeEach(async () => {
    inventoryItems = signal([makeFoodItem()]);
    aiLoading = signal(false);
    aiError = signal<string | null>(null);
    profileForSuggestions = makeProfile();
    generateSpy = jasmine
      .createSpy('generateRecipesFromInventory')
      .and.resolveTo({
        suggestions: [
          makeAiSuggestion('Tomato Pasta'),
          makeAiSuggestion('Veggie Stir Fry'),
          makeAiSuggestion('Quick Salad'),
        ],
      });

    await TestBed.configureTestingModule({
      imports: [RecipeSuggestionsComponent],
      providers: [
        provideRouter([]),
        {
          provide: FoodInventoryService,
          useValue: {
            items: inventoryItems.asReadonly(),
          },
        },
        {
          provide: AiRecipeService,
          useValue: {
            loading: aiLoading.asReadonly(),
            error: aiError.asReadonly(),
            generateRecipesFromInventory: generateSpy,
          },
        },
        {
          provide: UserProfileFacadeService,
          useValue: {
            getProfileForSuggestions: () => profileForSuggestions,
          },
        },
        {
          provide: SmartSuggestionService,
          useValue: {
            refresh: jasmine.createSpy('refresh').and.resolveTo(),
            loadPlannedRecipeIds: jasmine.createSpy('loadPlannedRecipeIds').and.resolveTo(),
            getSmartSuggestions: () => [],
          },
        },
        {
          provide: PreparedPortionService,
          useValue: {
            loadPortions: jasmine.createSpy('loadPortions').and.resolveTo(),
            expiringSoonPortions: signal([]).asReadonly(),
          },
        },
        {
          provide: RecipeService,
          useValue: {
            recipes: signal([]).asReadonly(),
            createRecipe: jasmine.createSpy('createRecipe'),
          },
        },
        {
          provide: ShoppingListService,
          useValue: {
            getShoppingItems: jasmine.createSpy('getShoppingItems').and.resolveTo(),
            items: signal([]).asReadonly(),
            addShoppingItem: jasmine.createSpy('addShoppingItem'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeSuggestionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await component.ngOnInit();
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function expandAiSection(): void {
    component.aiExpanded.set(true);
    fixture.detectChanges();
  }

  async function generateAiRecipes(): Promise<void> {
    await component.generateAiRecipes();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function getSuggestionTitles(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('article h3') as NodeListOf<HTMLElement>
    ).map((element) => element.textContent?.trim() ?? '');
  }

  it('loads 3 recipes with meal type, prep time, and profile context when generate is clicked', async () => {
    expandAiSection();
    await generateAiRecipes();

    expect(generateSpy).toHaveBeenCalledTimes(1);
    const request = generateSpy.calls.mostRecent().args[0];
    expect(request.numberOfSuggestions).toBe(3);
    expect(request.mealType).toBe('dinner');
    expect(request.maxPrepTimeMinutes).toBe(30);
    expect(request.onboardingContext).toEqual({
      dietaryPreferences: ['vegan'],
      allergies: ['Peanuts'],
      dislikedIngredients: ['Mushrooms'],
      goals: [],
      cookingEffort: 'two_cooking_sessions',
    });
    expect(getSuggestionTitles()).toEqual([
      'Tomato Pasta',
      'Veggie Stir Fry',
      'Quick Salad',
    ]);
  });

  it('sends updated meal type and max prep time in the request', async () => {
    component.aiMealType.set('lunch');
    component.aiMaxPrepTime.set(45);
    expandAiSection();
    await generateAiRecipes();

    const request = generateSpy.calls.mostRecent().args[0];
    expect(request.mealType).toBe('lunch');
    expect(request.maxPrepTimeMinutes).toBe(45);
  });

  it('sends prioritizeExpiringIngredients true by default', async () => {
    expandAiSection();
    await generateAiRecipes();

    expect(generateSpy.calls.mostRecent().args[0].prioritizeExpiringIngredients).toBeTrue();
  });

  it('sends prioritizeExpiringIngredients false when unchecked', async () => {
    component.aiPrioritizeExpiring.set(false);
    expandAiSection();
    await generateAiRecipes();

    expect(generateSpy.calls.mostRecent().args[0].prioritizeExpiringIngredients).toBeFalse();
  });

  it('sends includeMissingIngredients true when checked', async () => {
    component.aiIncludeMissing.set(true);
    expandAiSection();
    await generateAiRecipes();

    expect(generateSpy.calls.mostRecent().args[0].includeMissingIngredients).toBeTrue();
  });

  it('sends includeMissingIngredients false by default and hides missing ingredients in cards', async () => {
    generateSpy.and.resolveTo({
      suggestions: [
        makeAiSuggestion('Pantry Bowl', { missingIngredients: [] }),
        makeAiSuggestion('Simple Soup', { missingIngredients: [] }),
        makeAiSuggestion('Rice Plate', { missingIngredients: [] }),
      ],
    });

    expandAiSection();
    await generateAiRecipes();

    expect(generateSpy.calls.mostRecent().args[0].includeMissingIngredients).toBeFalse();
    expect(fixture.nativeElement.textContent).not.toContain('Missing ingredients');
  });

  it('includes profile dietary restrictions in onboardingContext', async () => {
    profileForSuggestions = makeProfile({
      dietaryPreferences: ['vegan'],
      allergies: [{ id: 'a1', name: 'Peanuts', normalizedName: 'peanuts', strictExclusion: true }],
      dislikedIngredients: [
        {
          id: 'd1',
          ingredientName: 'Mushrooms',
          normalizedName: 'mushrooms',
          source: 'manual',
        },
      ],
    });

    expandAiSection();
    await generateAiRecipes();

    expect(generateSpy.calls.mostRecent().args[0].onboardingContext).toEqual({
      dietaryPreferences: ['vegan'],
      allergies: ['Peanuts'],
      dislikedIngredients: ['Mushrooms'],
      goals: [],
      cookingEffort: 'two_cooking_sessions',
    });
  });

  it('blocks generation and shows an error when inventory is empty', async () => {
    inventoryItems.set([]);
    fixture.detectChanges();
    expandAiSection();
    await generateAiRecipes();

    expect(generateSpy).not.toHaveBeenCalled();
    expect(component.aiError()).toBe('Add some ingredients to your inventory first.');
  });

  it('passes excludeTitles and replaces suggestions on regenerate', async () => {
    generateSpy.and.callFake(async (request) => {
      if (request.excludeTitles?.length) {
        return {
          suggestions: [
            makeAiSuggestion('Herb Omelette'),
            makeAiSuggestion('Bean Tacos'),
            makeAiSuggestion('Garlic Toast'),
          ],
        };
      }
      return {
        suggestions: [
          makeAiSuggestion('Tomato Pasta'),
          makeAiSuggestion('Veggie Stir Fry'),
          makeAiSuggestion('Quick Salad'),
        ],
      };
    });

    expandAiSection();
    await generateAiRecipes();
    expect(getSuggestionTitles()).toEqual([
      'Tomato Pasta',
      'Veggie Stir Fry',
      'Quick Salad',
    ]);

    await generateAiRecipes();

    expect(generateSpy).toHaveBeenCalledTimes(2);
    expect(generateSpy.calls.mostRecent().args[0].excludeTitles).toEqual([
      'Tomato Pasta',
      'Veggie Stir Fry',
      'Quick Salad',
    ]);
    expect(getSuggestionTitles()).toEqual([
      'Herb Omelette',
      'Bean Tacos',
      'Garlic Toast',
    ]);

    const firstBatch = ['Tomato Pasta', 'Veggie Stir Fry', 'Quick Salad'];
    const secondBatch = getSuggestionTitles();
    expect(secondBatch.some((title) => firstBatch.includes(title))).toBeFalse();
  });

  it('shows generating state while the AI service is loading', async () => {
    let resolveGeneration!: (value: { suggestions: AiRecipeSuggestion[] }) => void;
    const pendingGeneration = new Promise<{ suggestions: AiRecipeSuggestion[] }>((resolve) => {
      resolveGeneration = resolve;
    });
    generateSpy.and.returnValue(pendingGeneration);

    expandAiSection();
    fixture.detectChanges();

    const generationPromise = component.generateAiRecipes();
    aiLoading.set(true);
    fixture.detectChanges();

    const generatingButton = findButtonByText(fixture.nativeElement, 'Generating...');
    expect(generatingButton).not.toBeNull();
    expect(generatingButton?.disabled).toBeTrue();

    resolveGeneration({
      suggestions: [
        makeAiSuggestion('Tomato Pasta'),
        makeAiSuggestion('Veggie Stir Fry'),
        makeAiSuggestion('Quick Salad'),
      ],
    });
    aiLoading.set(false);
    await generationPromise;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(findButtonByText(fixture.nativeElement, 'Generate suggestions')).not.toBeNull();
  });
});
