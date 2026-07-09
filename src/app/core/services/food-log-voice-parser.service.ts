import { Injectable } from '@angular/core';
import { MealType } from '../models/meal-plan.model';
import { FoodLogSource } from '../models/meal-slot-item.model';

export interface FoodLogVoiceParseResult {
  name: string;
  mealType?: MealType;
}

const MEAL_SLOT_PATTERNS: { pattern: RegExp; mealType: MealType }[] = [
  { pattern: /\bfor\s+breakfast\b/i, mealType: 'breakfast' },
  { pattern: /\bat\s+breakfast\b/i, mealType: 'breakfast' },
  { pattern: /\bbreakfast\b/i, mealType: 'breakfast' },
  { pattern: /\bfor\s+lunch\b/i, mealType: 'lunch' },
  { pattern: /\bat\s+lunch\b/i, mealType: 'lunch' },
  { pattern: /\blunch\b/i, mealType: 'lunch' },
  { pattern: /\bfor\s+dinner\b/i, mealType: 'dinner' },
  { pattern: /\bat\s+dinner\b/i, mealType: 'dinner' },
  { pattern: /\bdinner\b/i, mealType: 'dinner' },
  { pattern: /\bfor\s+(a\s+)?snack\b/i, mealType: 'snack' },
  { pattern: /\bas\s+(a\s+)?snack\b/i, mealType: 'snack' },
  { pattern: /\bsnack\b/i, mealType: 'snack' },
];

const LEADING_PHRASES = [
  /^i\s+had\s+/i,
  /^i\s+ate\s+/i,
  /^i\s+just\s+had\s+/i,
  /^i\s+just\s+ate\s+/i,
  /^had\s+/i,
  /^ate\s+/i,
];

@Injectable({ providedIn: 'root' })
export class FoodLogVoiceParserService {
  parseFoodLogFromTranscript(transcript: string): FoodLogVoiceParseResult {
    const trimmed = transcript.trim();
    if (!trimmed) {
      return { name: '' };
    }

    let mealType: MealType | undefined;
    let working = trimmed;

    for (const { pattern, mealType: type } of MEAL_SLOT_PATTERNS) {
      if (pattern.test(working)) {
        mealType = type;
        working = working.replace(pattern, ' ').trim();
        break;
      }
    }

    for (const phrase of LEADING_PHRASES) {
      working = working.replace(phrase, '').trim();
    }

    working = working.replace(/[.,!?]+$/, '').trim();

    const name = this.capitalizeFirst(working);

    return {
      name: name || trimmed,
      mealType,
    };
  }

  private capitalizeFirst(value: string): string {
    if (!value) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
