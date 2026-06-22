import { FOOD_UNIT_OTHER } from '../../core/models/food-item.model';
import { resolveStoredUnit, resolveUnitFormFields } from './food-unit.utils';

describe('food-unit.utils', () => {
  describe('resolveUnitFormFields', () => {
    it('returns empty fields for blank unit', () => {
      expect(resolveUnitFormFields(null)).toEqual({ unit: '', unit_custom: '' });
      expect(resolveUnitFormFields('  ')).toEqual({ unit: '', unit_custom: '' });
    });

    it('maps standard units directly', () => {
      expect(resolveUnitFormFields('g')).toEqual({ unit: 'g', unit_custom: '' });
      expect(resolveUnitFormFields('pcs')).toEqual({ unit: 'pcs', unit_custom: '' });
    });

    it('maps custom units to Other', () => {
      expect(resolveUnitFormFields('cup')).toEqual({
        unit: FOOD_UNIT_OTHER,
        unit_custom: 'cup',
      });
    });
  });

  describe('resolveStoredUnit', () => {
    it('returns standard unit value', () => {
      expect(resolveStoredUnit('kg', '')).toBe('kg');
    });

    it('returns custom value when Other is selected', () => {
      expect(resolveStoredUnit(FOOD_UNIT_OTHER, 'bottle')).toBe('bottle');
    });

    it('returns null for empty values', () => {
      expect(resolveStoredUnit('', '')).toBeNull();
      expect(resolveStoredUnit(FOOD_UNIT_OTHER, '  ')).toBeNull();
    });
  });
});
