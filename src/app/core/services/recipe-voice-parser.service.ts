import { Injectable, inject } from '@angular/core';
import {
  RecipeVoiceDraft,
  RecipeVoiceDraftIngredient,
  RecipeVoiceParseResult,
} from '../models/voice-recipe.model';
import { InventoryVoiceParserService } from './inventory-voice-parser.service';

@Injectable({ providedIn: 'root' })
export class RecipeVoiceParserService {
  private readonly inventoryParser = inject(InventoryVoiceParserService);

  parseTranscriptToRecipeDraft(transcript: string): RecipeVoiceParseResult {
    const cleanedTranscript = transcript.trim();
    const normalized = this.inventoryParser.normalizeNumberWords(cleanedTranscript.toLowerCase());
    const warnings: string[] = [];

    const sections = this.splitSections(normalized);
    const metadata = this.extractMetadata(normalized);

    const titleInfo = this.extractTitleAndDescription(sections.intro, metadata);
    const ingredients = this.extractIngredients(sections.ingredients, warnings);
    const instructions = this.extractInstructions(sections.instructions, warnings);

    if (!titleInfo.title && ingredients.length === 0 && instructions.length === 0) {
      warnings.push(
        'I could not detect recipe details from the transcript. The form will open with your text as the title.'
      );
    }

    if (ingredients.length === 0) {
      warnings.push('No ingredients detected. You can add them in the form.');
    }

    if (instructions.length === 0) {
      warnings.push('No instruction steps detected. You can add them in the form.');
    }

    const draft: RecipeVoiceDraft = {
      title: titleInfo.title || cleanedTranscript,
      description: titleInfo.description,
      portions: metadata.portions,
      prep_time_minutes: metadata.prepTimeMinutes,
      cook_time_minutes: metadata.cookTimeMinutes,
      ingredients,
      instructions,
    };

    return {
      draft,
      transcript: cleanedTranscript,
      warnings: [...new Set(warnings)],
    };
  }

  private splitSections(transcript: string): {
    intro: string;
    ingredients: string;
    instructions: string;
  } {
    const ingredientsMatch = transcript.match(
      /\b(?:ingredients?|you(?:'ll)? need|what you need)\s*[:\-]?\s*/i
    );
    const instructionsMatch = transcript.match(
      /\b(?:steps?|instructions?|directions?|method|how to (?:make|cook))\s*[:\-]?\s*/i
    );

    const ingredientsIndex = ingredientsMatch?.index ?? -1;
    const instructionsIndex = instructionsMatch?.index ?? -1;

    if (ingredientsIndex === -1 && instructionsIndex === -1) {
      return { intro: transcript, ingredients: '', instructions: '' };
    }

    if (ingredientsIndex !== -1 && (instructionsIndex === -1 || ingredientsIndex < instructionsIndex)) {
      const intro = transcript.slice(0, ingredientsIndex).trim();
      const afterIngredients = transcript.slice(ingredientsIndex + (ingredientsMatch?.[0].length ?? 0));

      if (instructionsIndex !== -1 && instructionsIndex > ingredientsIndex) {
        const relativeInstructionsIndex =
          instructionsIndex - ingredientsIndex - (ingredientsMatch?.[0].length ?? 0);
        return {
          intro,
          ingredients: afterIngredients.slice(0, relativeInstructionsIndex).trim(),
          instructions: afterIngredients.slice(relativeInstructionsIndex + (instructionsMatch?.[0].length ?? 0)).trim(),
        };
      }

      return { intro, ingredients: afterIngredients.trim(), instructions: '' };
    }

    const intro = transcript.slice(0, instructionsIndex).trim();
    const instructions = transcript
      .slice(instructionsIndex + (instructionsMatch?.[0].length ?? 0))
      .trim();

    return { intro, ingredients: '', instructions };
  }

  private extractMetadata(transcript: string): {
    portions: number | null;
    prepTimeMinutes: number | null;
    cookTimeMinutes: number | null;
  } {
    const servesMatch = transcript.match(
      /\b(?:serves?|servings?|portions?|for)\s+(\d+)\s*(?:people|persons|portions|servings)?\b/
    );
    const prepMatch = transcript.match(
      /\b(?:prep(?:aration)?(?:\s+time)?|takes?)\s+(?:about\s+)?(\d+)\s*(?:minutes?|mins?)\b/
    );
    const cookMatch = transcript.match(
      /\b(?:cook(?:ing)?(?:\s+time)?)\s+(?:about\s+)?(\d+)\s*(?:minutes?|mins?)\b/
    );
    const totalTimeMatch = transcript.match(
      /\b(?:total\s+time|ready\s+in)\s+(?:about\s+)?(\d+)\s*(?:minutes?|mins?)\b/
    );

    let prepTimeMinutes = prepMatch ? Number(prepMatch[1]) : null;
    const cookTimeMinutes = cookMatch ? Number(cookMatch[1]) : null;

    if (!prepTimeMinutes && totalTimeMatch && !cookTimeMinutes) {
      prepTimeMinutes = Number(totalTimeMatch[1]);
    }

    return {
      portions: servesMatch ? Number(servesMatch[1]) : null,
      prepTimeMinutes,
      cookTimeMinutes,
    };
  }

  private extractTitleAndDescription(
    intro: string,
    metadata: { portions: number | null; prepTimeMinutes: number | null; cookTimeMinutes: number | null }
  ): { title: string; description: string | null } {
    let text = intro.trim();

    text = text
      .replace(
        /\b(?:serves?|servings?|portions?|for)\s+\d+\s*(?:people|persons|portions|servings)?\b/gi,
        ' '
      )
      .replace(/\b(?:prep(?:aration)?|cook(?:ing)?|total)\s+(?:time\s+)?(?:about\s+)?\d+\s*(?:minutes?|mins?)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) {
      return { title: '', description: null };
    }

    const sentences = text
      .split(/[.!?]/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    const title = this.capitalizeSentence(sentences[0] ?? text);
    const descriptionParts = sentences.slice(1);

    if (metadata.portions || metadata.prepTimeMinutes || metadata.cookTimeMinutes) {
      const metaParts: string[] = [];
      if (metadata.portions) {
        metaParts.push(`Serves ${metadata.portions}`);
      }
      if (metadata.prepTimeMinutes) {
        metaParts.push(`Prep ${metadata.prepTimeMinutes} min`);
      }
      if (metadata.cookTimeMinutes) {
        metaParts.push(`Cook ${metadata.cookTimeMinutes} min`);
      }
      descriptionParts.unshift(metaParts.join(' · '));
    }

    return {
      title,
      description: descriptionParts.length > 0 ? descriptionParts.join('. ') : null,
    };
  }

  private extractIngredients(section: string, warnings: string[]): RecipeVoiceDraftIngredient[] {
    if (!section.trim()) {
      return [];
    }

    const candidates = section
      .replace(/\band\b/gi, ',')
      .split(',')
      .map((item) => this.cleanPhrase(item))
      .filter((item) => item.length > 0);

    const ingredients: RecipeVoiceDraftIngredient[] = [];

    for (const candidate of candidates) {
      const parsed = this.inventoryParser.extractQuantityAndUnit(candidate);
      const name = parsed.name.trim();
      if (!name) {
        continue;
      }
      ingredients.push({
        name: this.capitalizeWords(name),
        quantity: parsed.quantity,
        unit: parsed.unit,
      });
    }

    if (candidates.length > 0 && ingredients.length === 0) {
      warnings.push('Could not parse ingredient quantities. Check them in the form.');
    }

    return ingredients;
  }

  private extractInstructions(section: string, warnings: string[]): string[] {
    if (!section.trim()) {
      return [];
    }

    const ordinalSplit = section.split(
      /\b(?:step\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)(?:st|nd|rd|th)?\s*[:\-.,]?\s*/i
    );
    const thenSplit = section.split(/\s+then\s+/i);
    const numberedSplit = section.split(/\bstep\s+\d+\s*[:\-.,]?\s*/i);

    let steps: string[] = [];

    if (numberedSplit.length > 1) {
      steps = numberedSplit.map((step) => this.cleanPhrase(step)).filter(Boolean);
    } else if (thenSplit.length > 1) {
      steps = thenSplit.map((step) => this.cleanPhrase(step)).filter(Boolean);
    } else if (ordinalSplit.length > 1) {
      steps = ordinalSplit.map((step) => this.cleanPhrase(step)).filter(Boolean);
    } else {
      const sentenceSteps = section
        .split(/[.!?]/)
        .map((step) => this.cleanPhrase(step))
        .filter((step) => step.length > 3);
      steps = sentenceSteps.length > 0 ? sentenceSteps : [this.cleanPhrase(section)];
    }

    const cleanedSteps = steps
      .map((step) => this.capitalizeSentence(step))
      .filter((step) => step.length > 0);

    if (section.trim() && cleanedSteps.length === 0) {
      warnings.push('Could not split instructions into steps. They were added as one step.');
      return [this.capitalizeSentence(this.cleanPhrase(section))];
    }

    return cleanedSteps;
  }

  private cleanPhrase(text: string): string {
    return text
      .replace(/\b(?:please|also|and|then|the|my|first|next|finally)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private capitalizeSentence(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  private capitalizeWords(text: string): string {
    return text
      .split(/\s+/)
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ');
  }
}
