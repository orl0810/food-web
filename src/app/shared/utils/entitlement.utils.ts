import { UserEntitlements } from '../../core/models/user-entitlements.model';

export function createLocalDevEntitlements(): UserEntitlements {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
  return {
    accessLevel: 'premium',
    planCode: 'beta_trial',
    subscriptionStatus: 'trialing',
    isPremium: true,
    isTrial: true,
    isPaidSubscriber: false,
    trialStartedAt: now.toISOString(),
    trialEndsAt: trialEnd.toISOString(),
    trialDaysRemaining: 20,
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
  };
}

export function normalizeEntitlements(raw: unknown): UserEntitlements | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const data = raw as Record<string, unknown>;
  const limits = data['limits'] as Record<string, unknown> | undefined;
  const usage = data['usage'] as Record<string, unknown> | undefined;
  if (!limits || !usage) {
    return null;
  }

  return {
    accessLevel: data['accessLevel'] as UserEntitlements['accessLevel'],
    planCode: data['planCode'] as UserEntitlements['planCode'],
    subscriptionStatus: data['subscriptionStatus'] as UserEntitlements['subscriptionStatus'],
    isPremium: Boolean(data['isPremium']),
    isTrial: Boolean(data['isTrial']),
    isPaidSubscriber: Boolean(data['isPaidSubscriber']),
    trialStartedAt: (data['trialStartedAt'] as string) ?? null,
    trialEndsAt: (data['trialEndsAt'] as string) ?? null,
    trialDaysRemaining:
      data['trialDaysRemaining'] === null || data['trialDaysRemaining'] === undefined
        ? null
        : Number(data['trialDaysRemaining']),
    currentPeriodStartedAt: (data['currentPeriodStartedAt'] as string) ?? null,
    currentPeriodEndsAt: (data['currentPeriodEndsAt'] as string) ?? null,
    cancelAtPeriodEnd: Boolean(data['cancelAtPeriodEnd']),
    gracePeriodEndsAt: (data['gracePeriodEndsAt'] as string) ?? null,
    canManageBilling: Boolean(data['canManageBilling']),
    limits: {
      activeMealPlanWeeks:
        limits['activeMealPlanWeeks'] === null || limits['activeMealPlanWeeks'] === undefined
          ? null
          : Number(limits['activeMealPlanWeeks']),
      personalRecipes:
        limits['personalRecipes'] === null || limits['personalRecipes'] === undefined
          ? null
          : Number(limits['personalRecipes']),
      smartSuggestionsPerMonth:
        limits['smartSuggestionsPerMonth'] === null ||
        limits['smartSuggestionsPerMonth'] === undefined
          ? null
          : Number(limits['smartSuggestionsPerMonth']),
      manualPlanningEnabled: Boolean(limits['manualPlanningEnabled']),
      basicInventoryEnabled: Boolean(limits['basicInventoryEnabled']),
    },
    usage: {
      activeMealPlanWeeks: Number(usage['activeMealPlanWeeks'] ?? 0),
      personalRecipes: Number(usage['personalRecipes'] ?? 0),
      smartSuggestionsUsedThisMonth: Number(usage['smartSuggestionsUsedThisMonth'] ?? 0),
      smartSuggestionsRemainingThisMonth:
        usage['smartSuggestionsRemainingThisMonth'] === null ||
        usage['smartSuggestionsRemainingThisMonth'] === undefined
          ? null
          : Number(usage['smartSuggestionsRemainingThisMonth']),
    },
  };
}

export function calculateTrialDaysRemainingUtc(trialEndsAt: string, now = new Date()): number {
  const end = new Date(trialEndsAt).getTime();
  const diffMs = end - now.getTime();
  if (diffMs <= 0) {
    return 0;
  }
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function getTrialBannerTier(
  entitlements: UserEntitlements | null
): 'none' | 'discreet' | 'intro_pricing' | 'warning' | 'urgent' | 'expired' | 'grace' {
  if (!entitlements) {
    return 'none';
  }

  if (entitlements.subscriptionStatus === 'grace_period' && entitlements.gracePeriodEndsAt) {
    return 'grace';
  }

  if (entitlements.isTrial && entitlements.trialDaysRemaining !== null) {
    const days = entitlements.trialDaysRemaining;
    if (days <= 0) {
      return 'expired';
    }
    if (days <= 1) {
      return 'urgent';
    }
    if (days <= 3) {
      return 'warning';
    }
    if (days <= 7) {
      return 'intro_pricing';
    }
    return 'discreet';
  }

  if (!entitlements.isPremium && !entitlements.isPaidSubscriber) {
    return 'expired';
  }

  return 'none';
}
