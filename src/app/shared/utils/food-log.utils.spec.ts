import { getDefaultMealTypeForNow } from './food-log.utils';

describe('getDefaultMealTypeForNow', () => {
  it('returns breakfast in the morning', () => {
    expect(getDefaultMealTypeForNow(new Date('2026-07-09T08:00:00'))).toBe('breakfast');
  });

  it('returns lunch around midday', () => {
    expect(getDefaultMealTypeForNow(new Date('2026-07-09T12:30:00'))).toBe('lunch');
  });

  it('returns dinner in the evening', () => {
    expect(getDefaultMealTypeForNow(new Date('2026-07-09T19:00:00'))).toBe('dinner');
  });

  it('returns snack late at night', () => {
    expect(getDefaultMealTypeForNow(new Date('2026-07-09T23:00:00'))).toBe('snack');
  });
});
