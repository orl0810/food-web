import { FOOD_UNIT_OTHER, FOOD_UNITS } from '../../core/models/food-item.model';

export interface UnitFormFields {
  unit: string;
  unit_custom: string;
}

export function resolveUnitFormFields(unit: string | null | undefined): UnitFormFields {
  const trimmed = unit?.trim() ?? '';

  if (!trimmed) {
    return { unit: '', unit_custom: '' };
  }

  if ((FOOD_UNITS as readonly string[]).includes(trimmed)) {
    return { unit: trimmed, unit_custom: '' };
  }

  return { unit: FOOD_UNIT_OTHER, unit_custom: trimmed };
}

export function resolveStoredUnit(
  unit: string | null | undefined,
  unitCustom: string | null | undefined
): string | null {
  if (unit === FOOD_UNIT_OTHER) {
    return unitCustom?.trim() || null;
  }

  return unit?.trim() || null;
}
