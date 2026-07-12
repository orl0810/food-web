import {
  calculateTrialDaysRemainingUtc,
  createLocalDevEntitlements,
  getTrialBannerTier,
  normalizeEntitlements,
} from './entitlement.utils';

describe('entitlement.utils', () => {
  it('creates local dev premium stub', () => {
    const entitlements = createLocalDevEntitlements();
    expect(entitlements.isPremium).toBeTrue();
    expect(entitlements.planCode).toBe('beta_trial');
  });

  it('calculates trial days remaining with UTC ceiling', () => {
    const now = new Date('2026-07-01T12:00:00.000Z');
    const trialEndsAt = '2026-07-02T11:00:00.000Z';
    expect(calculateTrialDaysRemainingUtc(trialEndsAt, now)).toBe(1);
  });

  it('returns zero when trial expired', () => {
    const now = new Date('2026-07-03T00:00:00.000Z');
    expect(calculateTrialDaysRemainingUtc('2026-07-01T00:00:00.000Z', now)).toBe(0);
  });

  it('normalizes entitlements payload', () => {
    const normalized = normalizeEntitlements({
      accessLevel: 'free',
      planCode: 'free',
      subscriptionStatus: 'expired',
      isPremium: false,
      isTrial: false,
      isPaidSubscriber: false,
      trialStartedAt: null,
      trialEndsAt: null,
      trialDaysRemaining: null,
      currentPeriodStartedAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      gracePeriodEndsAt: null,
      canManageBilling: false,
      limits: {
        activeMealPlanWeeks: 1,
        personalRecipes: 10,
        smartSuggestionsPerMonth: 3,
        manualPlanningEnabled: true,
        basicInventoryEnabled: true,
      },
      usage: {
        activeMealPlanWeeks: 1,
        personalRecipes: 10,
        smartSuggestionsUsedThisMonth: 3,
        smartSuggestionsRemainingThisMonth: 0,
      },
    });

    expect(normalized?.isPremium).toBeFalse();
    expect(normalized?.usage.personalRecipes).toBe(10);
  });

  it('maps trial banner tiers', () => {
    const trial = normalizeEntitlements({
      accessLevel: 'premium',
      planCode: 'beta_trial',
      subscriptionStatus: 'trialing',
      isPremium: true,
      isTrial: true,
      isPaidSubscriber: false,
      trialStartedAt: '2026-07-01T00:00:00.000Z',
      trialEndsAt: '2026-07-08T00:00:00.000Z',
      trialDaysRemaining: 5,
      currentPeriodStartedAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      gracePeriodEndsAt: null,
      canManageBilling: false,
      limits: {
        activeMealPlanWeeks: null,
        personalRecipes: null,
        smartSuggestionsPerMonth: null,
        manualPlanningEnabled: true,
        basicInventoryEnabled: true,
      },
      usage: {
        activeMealPlanWeeks: 0,
        personalRecipes: 0,
        smartSuggestionsUsedThisMonth: 0,
        smartSuggestionsRemainingThisMonth: null,
      },
    });

    expect(getTrialBannerTier(trial)).toBe('intro_pricing');
  });
});
