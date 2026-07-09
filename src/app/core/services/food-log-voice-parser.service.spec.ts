import { TestBed } from '@angular/core/testing';
import { FoodLogVoiceParserService } from './food-log-voice-parser.service';

describe('FoodLogVoiceParserService', () => {
  let service: FoodLogVoiceParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FoodLogVoiceParserService);
  });

  it('strips leading phrase and detects lunch', () => {
    const result = service.parseFoodLogFromTranscript(
      'I had chicken sandwich and orange juice for lunch.'
    );

    expect(result.name).toBe('Chicken sandwich and orange juice');
    expect(result.mealType).toBe('lunch');
  });

  it('detects breakfast from transcript', () => {
    const result = service.parseFoodLogFromTranscript('Yogurt and banana for breakfast');

    expect(result.name).toContain('Yogurt');
    expect(result.mealType).toBe('breakfast');
  });

  it('returns full transcript as name when parsing yields empty', () => {
    const result = service.parseFoodLogFromTranscript('Banana');

    expect(result.name).toBe('Banana');
    expect(result.mealType).toBeUndefined();
  });
});
