import { Injectable } from '@angular/core';
import { StorageLocation } from '../models/food-item.model';
import {
  VoiceInventoryDraftItem,
  VoiceInventoryParseResult,
} from '../models/voice-inventory.model';

interface QuantityAndUnit {
  name: string;
  quantity: number | null;
  unit: string | null;
}

const numberWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const units = [
  'bag',
  'bags',
  'bottle',
  'bottles',
  'box',
  'boxes',
  'bunch',
  'bunches',
  'can',
  'cans',
  'carton',
  'cartons',
  'cup',
  'cups',
  'gram',
  'grams',
  'g',
  'kilo',
  'kilos',
  'kilogram',
  'kilograms',
  'kg',
  'liter',
  'liters',
  'litre',
  'litres',
  'l',
  'pack',
  'packs',
  'package',
  'packages',
  'piece',
  'pieces',
  'pound',
  'pounds',
  'lb',
  'lbs',
];

@Injectable({ providedIn: 'root' })
export class InventoryVoiceParserService {
  parseTranscriptToInventoryItems(transcript: string): VoiceInventoryParseResult {
    const cleanedTranscript = transcript.trim();
    const normalizedTranscript = this.normalizeNumberWords(cleanedTranscript.toLowerCase());
    const candidates = this.extractItemCandidates(normalizedTranscript);
    const warnings: string[] = [];

    const items = candidates
      .map((candidate) => this.buildDraftItem(candidate, normalizedTranscript, warnings))
      .filter((item): item is VoiceInventoryDraftItem => item !== null);

    if (items.length === 0 && cleanedTranscript) {
      warnings.push('I could not detect food items from the transcript. Please add drafts manually.');
    }

    if (items.some((item) => item.location === 'fridge')) {
      const missingLocations = items.filter((item) => !this.hasLocationHint(item.name, normalizedTranscript));
      if (missingLocations.length > 0) {
        warnings.push('I could not detect the location for some items. Please review them before saving.');
      }
    }

    return {
      items,
      transcript: cleanedTranscript,
      warnings: [...new Set(warnings)],
    };
  }

  normalizeNumberWords(text: string): string {
    return text.replace(/\b(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, (match) =>
      String(numberWords[match.toLowerCase()] ?? match)
    );
  }

  detectLocation(text: string): StorageLocation | null {
    const normalized = text.toLowerCase();
    if (/\bfreezer\b/.test(normalized)) {
      return 'freezer';
    }
    if (/\bpantry\b|\bcupboard\b|\bcabinet\b/.test(normalized)) {
      return 'pantry';
    }
    if (/\bfridge\b|\brefrigerator\b/.test(normalized)) {
      return 'fridge';
    }
    return null;
  }

  detectExpirationDate(text: string, today: Date = new Date()): string | null {
    const normalized = this.normalizeNumberWords(text.toLowerCase());
    const inDaysMatch = normalized.match(/\b(?:expires?\s+in|good\s+for|use\s+in)\s+(\d+)\s+days?\b/);
    if (inDaysMatch) {
      return this.toIsoDate(this.addDays(today, Number(inDaysMatch[1])));
    }

    if (/\bexpires?\s+tomorrow\b|\buse\s+by\s+tomorrow\b|\buse\s+before\s+tomorrow\b/.test(normalized)) {
      return this.toIsoDate(this.addDays(today, 1));
    }

    if (/\bexpires?\s+today\b|\buse\s+today\b/.test(normalized)) {
      return this.toIsoDate(today);
    }

    if (/\bexpires?\s+next\s+week\b|\bgood\s+for\s+next\s+week\b/.test(normalized)) {
      return this.toIsoDate(this.addDays(today, 7));
    }

    const weekdayMatch = normalized.match(/\b(?:use\s+before|use\s+by|expires?\s+on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (weekdayMatch) {
      return this.toIsoDate(this.nextWeekday(today, weekdayMatch[1]));
    }

    return null;
  }

  extractQuantityAndUnit(text: string): QuantityAndUnit {
    const normalized = this.normalizeNumberWords(text.toLowerCase()).trim();
    const unitPattern = units.join('|');
    const unitMatch = normalized.match(
      new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+(${unitPattern})(?:\\s+of)?\\s+(.+)$`, 'i')
    );

    if (unitMatch) {
      return {
        quantity: Number(unitMatch[1]),
        unit: unitMatch[2],
        name: this.cleanItemName(unitMatch[3]),
      };
    }

    const countMatch = normalized.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (countMatch) {
      return {
        quantity: Number(countMatch[1]),
        unit: null,
        name: this.cleanItemName(countMatch[2]),
      };
    }

    return {
      quantity: 1,
      unit: null,
      name: this.cleanItemName(normalized),
    };
  }

  private buildDraftItem(
    candidate: string,
    transcript: string,
    warnings: string[]
  ): VoiceInventoryDraftItem | null {
    const quantity = this.extractQuantityAndUnit(candidate);
    const name = this.toTitleCase(quantity.name);
    if (!name) {
      return null;
    }

    const itemContext = this.getItemContext(quantity.name, transcript);
    const location = this.detectLocation(candidate) ?? this.detectLocation(itemContext) ?? 'fridge';
    const expirationDate = this.detectExpirationDate(candidate) ?? this.detectExpirationDate(itemContext);

    if (!this.detectLocation(candidate) && !this.detectLocation(itemContext)) {
      warnings.push(`No location detected for ${name}.`);
    }

    return {
      name,
      category: null,
      quantity: quantity.quantity,
      unit: quantity.unit,
      expiration_date: expirationDate,
      location,
    };
  }

  private extractItemCandidates(transcript: string): string[] {
    const itemListText = this.getLikelyItemList(transcript);
    return itemListText
      .replace(/\band\b/gi, ',')
      .split(',')
      .map((item) => this.cleanItemName(item))
      .filter((item) => item.length > 0)
      .filter((item) => !this.isInstructionPhrase(item));
  }

  private getLikelyItemList(transcript: string): string {
    const firstSentence = transcript.split(/[.!?]/)[0] ?? transcript;
    const introMatch = firstSentence.match(
      /\b(?:i\s+)?(?:bought|got|picked\s+up|added?|want\s+to\s+add|need\s+to\s+add|have)\s+(.+)$/i
    );

    return introMatch?.[1] ?? firstSentence;
  }

  private getItemContext(itemName: string, transcript: string): string {
    const key = itemName.split(/\s+/)[0];
    if (!key) {
      return transcript;
    }

    const sentences = transcript
      .split(/[.!?]/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    return sentences.filter((sentence) => sentence.includes(key)).join(' ');
  }

  private hasLocationHint(itemName: string, transcript: string): boolean {
    const context = this.getItemContext(itemName.toLowerCase(), transcript);
    return this.detectLocation(context) !== null;
  }

  private isInstructionPhrase(text: string): boolean {
    return /\b(go(?:es)?|put|keep|store|expires?|use\s+before|good\s+for)\b/i.test(text);
  }

  private cleanItemName(text: string): string {
    return text
      .replace(/\b(?:please|also|and|then|the|my)\b/gi, ' ')
      .replace(/\b(?:go(?:es)?|put|keep|store)\s+(?:in|into|to)\s+(?:the\s+)?(?:fridge|freezer|pantry)\b/gi, ' ')
      .replace(/\b(?:expires?|good\s+for|use\s+before|use\s+by)\b.+$/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private nextWeekday(today: Date, weekday: string): Date {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = weekdays.indexOf(weekday);
    const currentDay = today.getDay();
    const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
    return this.addDays(today, daysUntil);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toTitleCase(text: string): string {
    return text
      .split(' ')
      .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : ''))
      .join(' ')
      .trim();
  }
}
