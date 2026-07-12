import Stripe from 'npm:stripe@17.7.0';

export type CheckoutPlanCode = 'early_access_monthly' | 'early_access_annual';
export type InternalPlanCode =
  | 'beta_trial'
  | 'early_access_monthly'
  | 'early_access_annual'
  | 'free';

export type NormalizedSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'
  | 'free';

export function getStripeClient(): Stripe {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) {
    throw new Error('BILLING_CONFIGURATION_ERROR');
  }
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function requirePricingPhaseEarlyAccess(): void {
  const phase = Deno.env.get('PRICING_PHASE') ?? 'early_access';
  if (phase !== 'early_access') {
    throw new Error('PRICING_PHASE_NOT_AVAILABLE');
  }
}

export function getPriceIdForPlan(planCode: CheckoutPlanCode): string {
  const priceByPlan: Record<CheckoutPlanCode, string | undefined> = {
    early_access_monthly: Deno.env.get('STRIPE_EARLY_ACCESS_MONTHLY_PRICE_ID'),
    early_access_annual: Deno.env.get('STRIPE_EARLY_ACCESS_ANNUAL_PRICE_ID'),
  };

  const priceId = priceByPlan[planCode];
  if (!priceId) {
    throw new Error('BILLING_CONFIGURATION_ERROR');
  }
  return priceId;
}

export function resolvePlanCodeFromPriceId(priceId: string | null | undefined): InternalPlanCode | null {
  if (!priceId) {
    return null;
  }
  const monthly = Deno.env.get('STRIPE_EARLY_ACCESS_MONTHLY_PRICE_ID');
  const annual = Deno.env.get('STRIPE_EARLY_ACCESS_ANNUAL_PRICE_ID');
  if (priceId === monthly) {
    return 'early_access_monthly';
  }
  if (priceId === annual) {
    return 'early_access_annual';
  }
  return null;
}

export function isKnownPriceId(priceId: string | null | undefined): boolean {
  return resolvePlanCodeFromPriceId(priceId) !== null;
}

export function normalizeStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status,
  cancelAtPeriodEnd: boolean,
  gracePeriodEndsAt: Date | null,
  now = new Date()
): NormalizedSubscriptionStatus {
  if (gracePeriodEndsAt && gracePeriodEndsAt > now) {
    return 'grace_period';
  }

  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return cancelAtPeriodEnd ? 'canceled' : 'active';
    case 'past_due':
      return gracePeriodEndsAt && gracePeriodEndsAt > now ? 'grace_period' : 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    case 'paused':
      return 'past_due';
    default:
      return 'expired';
  }
}

export function getAppBaseUrl(): string {
  const base = Deno.env.get('APP_BASE_URL');
  if (!base) {
    throw new Error('BILLING_CONFIGURATION_ERROR');
  }
  return base.replace(/\/$/, '');
}

export function parseCheckoutPlanCode(input: unknown): CheckoutPlanCode {
  if (input === 'early_access_monthly' || input === 'early_access_annual') {
    return input;
  }
  throw new Error('INVALID_PLAN_CODE');
}

export function getGracePeriodDays(): number {
  const raw = Deno.env.get('PAYMENT_GRACE_PERIOD_DAYS');
  const parsed = raw ? Number(raw) : 3;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}
