import {
  formatInventoryName,
  normalizeNameKey,
} from './name-normalization.utils';
import {
  AllergyInput,
  IngredientPreferenceInput,
  UserAllergy,
  UserFoodProfile,
  UserIngredientPreference,
} from '../../core/models/user-profile.model';

export interface ProfileValidationError {
  code:
    | 'duplicate'
    | 'favorite_disliked_conflict'
    | 'allergy_favorite_conflict'
    | 'allergy_disliked_conflict'
    | 'invalid_notes';
  message: string;
}

const MAX_NOTES_LENGTH = 500;

export function sanitizeNotes(notes: string | null | undefined): string | null {
  if (!notes) {
    return null;
  }
  const trimmed = notes.trim().slice(0, MAX_NOTES_LENGTH);
  return trimmed || null;
}

export function normalizeIngredientInput(name: string): string {
  return formatInventoryName(name);
}

export function validateIngredientAddition(
  profile: UserFoodProfile,
  preferenceType: 'favorite' | 'disliked',
  input: IngredientPreferenceInput
): ProfileValidationError | null {
  const normalizedName = normalizeNameKey(input.ingredientName);
  if (!normalizedName) {
    return { code: 'duplicate', message: 'Ingredient name is required.' };
  }

  const targetList =
    preferenceType === 'favorite' ? profile.favoriteIngredients : profile.dislikedIngredients;
  const oppositeList =
    preferenceType === 'favorite' ? profile.dislikedIngredients : profile.favoriteIngredients;

  if (targetList.some((item) => item.normalizedName === normalizedName)) {
    return { code: 'duplicate', message: 'This ingredient is already in the list.' };
  }

  if (oppositeList.some((item) => item.normalizedName === normalizedName)) {
    return {
      code: 'favorite_disliked_conflict',
      message:
        preferenceType === 'favorite'
          ? 'This ingredient is marked as disliked. Remove it from disliked first.'
          : 'This ingredient is marked as a favorite. Remove it from favorites first.',
    };
  }

  if (profile.allergies.some((allergy) => allergy.normalizedName === normalizedName)) {
    return {
      code: 'allergy_favorite_conflict',
      message: 'This ingredient is listed as an allergy and cannot be added here.',
    };
  }

  return null;
}

export function validateAllergyAddition(
  profile: UserFoodProfile,
  input: AllergyInput
): ProfileValidationError | null {
  const normalizedName = normalizeNameKey(input.name);
  if (!normalizedName) {
    return { code: 'duplicate', message: 'Allergy name is required.' };
  }

  if (profile.allergies.some((allergy) => allergy.normalizedName === normalizedName)) {
    return { code: 'duplicate', message: 'This allergy is already listed.' };
  }

  if (input.notes && input.notes.trim().length > MAX_NOTES_LENGTH) {
    return { code: 'invalid_notes', message: `Notes must be ${MAX_NOTES_LENGTH} characters or less.` };
  }

  return null;
}

export function getAllergyConflictsForFavorite(
  profile: UserFoodProfile,
  ingredient: UserIngredientPreference
): UserAllergy | undefined {
  return profile.allergies.find((allergy) => allergy.normalizedName === ingredient.normalizedName);
}

export function buildIngredientPreference(
  input: IngredientPreferenceInput,
  preferenceType: 'favorite' | 'disliked',
  id?: string
): Omit<UserIngredientPreference, 'id'> & { id: string } {
  const ingredientName = normalizeIngredientInput(input.ingredientName);
  return {
    id: id ?? crypto.randomUUID(),
    ingredientName,
    normalizedName: normalizeNameKey(ingredientName),
    category: input.category ?? null,
    source: input.source ?? 'manual',
    usageCount: input.usageCount ?? null,
    lastUsedAt: null,
  };
}

export function buildAllergy(input: AllergyInput, id?: string): UserAllergy {
  const name = normalizeIngredientInput(input.name);
  return {
    id: id ?? crypto.randomUUID(),
    name,
    normalizedName: normalizeNameKey(name),
    severity: input.severity ?? null,
    notes: sanitizeNotes(input.notes),
    strictExclusion: true,
  };
}
