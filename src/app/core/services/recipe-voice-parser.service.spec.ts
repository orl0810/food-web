import { TestBed } from '@angular/core/testing';
import { RecipeVoiceParserService } from './recipe-voice-parser.service';

describe('RecipeVoiceParserService', () => {
  let service: RecipeVoiceParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecipeVoiceParserService);
  });

  it('parses title, ingredients, and steps from structured transcript', () => {
    const result = service.parseTranscriptToRecipeDraft(
      'Pasta carbonara. Serves 4. Ingredients: 200 grams spaghetti, 2 eggs, 100 grams bacon. Steps: boil the pasta, then fry the bacon, then mix with eggs.'
    );

    expect(result.draft.title).toBe('Pasta carbonara');
    expect(result.draft.portions).toBe(4);
    expect(result.draft.ingredients.length).toBe(3);
    expect(result.draft.ingredients[0].name).toContain('Spaghetti');
    expect(result.draft.ingredients[0].quantity).toBe(200);
    expect(result.draft.instructions.length).toBeGreaterThanOrEqual(2);
  });

  it('uses full transcript as title when sections are missing', () => {
    const result = service.parseTranscriptToRecipeDraft('Quick tomato soup');

    expect(result.draft.title).toBe('Quick tomato soup');
    expect(result.draft.ingredients.length).toBe(0);
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it('detects prep and cook times', () => {
    const result = service.parseTranscriptToRecipeDraft(
      'Garlic bread. Prep time 10 minutes. Cook time 15 minutes. Ingredients: 1 baguette, 2 cloves garlic.'
    );

    expect(result.draft.prep_time_minutes).toBe(10);
    expect(result.draft.cook_time_minutes).toBe(15);
    expect(result.draft.ingredients.length).toBeGreaterThanOrEqual(2);
  });
});
