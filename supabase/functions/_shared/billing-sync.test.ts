import {
  assertEquals,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  normalizeStripeSubscriptionStatus,
  resolvePlanCodeFromPriceId,
} from './stripe.ts';

Deno.test('resolvePlanCodeFromPriceId maps configured monthly price', () => {
  Deno.env.set('STRIPE_EARLY_ACCESS_MONTHLY_PRICE_ID', 'price_monthly_test');
  Deno.env.set('STRIPE_EARLY_ACCESS_ANNUAL_PRICE_ID', 'price_annual_test');

  assertEquals(resolvePlanCodeFromPriceId('price_monthly_test'), 'early_access_monthly');
  assertEquals(resolvePlanCodeFromPriceId('price_annual_test'), 'early_access_annual');
});

Deno.test('unknown price id returns null and must not grant premium', () => {
  Deno.env.set('STRIPE_EARLY_ACCESS_MONTHLY_PRICE_ID', 'price_monthly_test');
  assertEquals(resolvePlanCodeFromPriceId('price_unknown'), null);
});

Deno.test('grace period status takes precedence', () => {
  const graceEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
  assertEquals(
    normalizeStripeSubscriptionStatus('active', false, graceEnd),
    'grace_period'
  );
});

Deno.test('cancel at period end maps to canceled normalized status', () => {
  assertEquals(
    normalizeStripeSubscriptionStatus('active', true, null),
    'canceled'
  );
});
