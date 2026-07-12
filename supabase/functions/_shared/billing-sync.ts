import type Stripe from 'npm:stripe@17.7.0';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0';
import {
  getGracePeriodDays,
  isKnownPriceId,
  normalizeStripeSubscriptionStatus,
  resolvePlanCodeFromPriceId,
  type InternalPlanCode,
  type NormalizedSubscriptionStatus,
} from './stripe.ts';

export interface SyncOptions {
  supabaseUserId: string;
  stripeEventCreatedAt?: number | null;
  preserveGracePeriod?: boolean;
  lastPaymentAt?: Date | null;
  lastPaymentFailedAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
  clearGracePeriod?: boolean;
}

export interface SyncResult {
  updated: boolean;
  ignored: boolean;
  reason?: string;
  planCode?: InternalPlanCode | null;
  status?: NormalizedSubscriptionStatus;
}

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function unixToDate(unix: number | null | undefined): Date | null {
  if (!unix) {
    return null;
  }
  return new Date(unix * 1000);
}

export function extractPrimaryPriceId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items.data[0];
  return item?.price?.id ?? null;
}

export function extractBillingInterval(
  subscription: Stripe.Subscription
): 'month' | 'year' | null {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval === 'month' || interval === 'year') {
    return interval;
  }
  return null;
}

export async function syncStripeSubscription(
  supabase: SupabaseClient,
  subscription: Stripe.Subscription,
  options: SyncOptions
): Promise<SyncResult> {
  const priceId = extractPrimaryPriceId(subscription);
  const planCode = resolvePlanCodeFromPriceId(priceId);

  if (priceId && !isKnownPriceId(priceId)) {
    console.warn('Unknown Stripe price ID received; not granting premium.', {
      priceIdPrefix: priceId.slice(0, 8),
      subscriptionIdPrefix: subscription.id.slice(0, 8),
    });
    return { updated: false, ignored: true, reason: 'unknown_price_id' };
  }

  const { data: existing, error: loadError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', options.supabaseUserId)
    .maybeSingle();

  if (loadError) {
    throw loadError;
  }

  if (
    options.stripeEventCreatedAt &&
    existing?.stripe_event_created_at &&
    new Date(existing.stripe_event_created_at).getTime() >
      options.stripeEventCreatedAt * 1000
  ) {
    return { updated: false, ignored: true, reason: 'out_of_order_event' };
  }

  const now = new Date();
  let gracePeriodEndsAt = options.gracePeriodEndsAt ?? null;
  if (options.clearGracePeriod) {
    gracePeriodEndsAt = null;
  } else if (!gracePeriodEndsAt && existing?.grace_period_ends_at) {
    gracePeriodEndsAt = new Date(existing.grace_period_ends_at);
  }

  const normalizedStatus = normalizeStripeSubscriptionStatus(
    subscription.status,
    subscription.cancel_at_period_end,
    gracePeriodEndsAt,
    now
  );

  const resolvedPlanCode: InternalPlanCode =
    planCode ??
    (existing?.plan_code as InternalPlanCode | undefined) ??
    'free';

  const payload = {
    user_id: options.supabaseUserId,
    stripe_customer_id:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id ?? existing?.stripe_customer_id ?? null,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan_code: planCode ?? resolvedPlanCode,
    subscription_status: normalizedStatus,
    billing_interval: extractBillingInterval(subscription),
    current_period_started_at: toIso(unixToDate(subscription.current_period_start)),
    current_period_ends_at: toIso(unixToDate(subscription.current_period_end)),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: toIso(unixToDate(subscription.canceled_at)),
    ended_at:
      subscription.status === 'canceled' || subscription.status === 'unpaid'
        ? toIso(unixToDate(subscription.ended_at ?? subscription.canceled_at))
        : null,
    last_payment_at: options.lastPaymentAt
      ? toIso(options.lastPaymentAt)
      : existing?.last_payment_at ?? null,
    last_payment_failed_at: options.lastPaymentFailedAt
      ? toIso(options.lastPaymentFailedAt)
      : options.clearGracePeriod
      ? null
      : existing?.last_payment_failed_at ?? null,
    grace_period_ends_at: gracePeriodEndsAt ? toIso(gracePeriodEndsAt) : null,
    stripe_event_created_at: options.stripeEventCreatedAt
      ? new Date(options.stripeEventCreatedAt * 1000).toISOString()
      : existing?.stripe_event_created_at ?? null,
    updated_at: now.toISOString(),
  };

  if (!existing) {
    const { error: insertError } = await supabase.from('user_subscriptions').insert({
      ...payload,
      trial_started_at: now.toISOString(),
      trial_ends_at: now.toISOString(),
    });
    if (insertError) {
      throw insertError;
    }
    return { updated: true, ignored: false, planCode, status: normalizedStatus };
  }

  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update(payload)
    .eq('user_id', options.supabaseUserId);

  if (updateError) {
    throw updateError;
  }

  return { updated: true, ignored: false, planCode, status: normalizedStatus };
}

export async function markSubscriptionEnded(
  supabase: SupabaseClient,
  supabaseUserId: string,
  stripeEventCreatedAt?: number | null
): Promise<SyncResult> {
  const { data: existing } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', supabaseUserId)
    .maybeSingle();

  if (!existing) {
    return { updated: false, ignored: true, reason: 'no_subscription_row' };
  }

  if (
    stripeEventCreatedAt &&
    existing.stripe_event_created_at &&
    new Date(existing.stripe_event_created_at).getTime() > stripeEventCreatedAt * 1000
  ) {
    return { updated: false, ignored: true, reason: 'out_of_order_event' };
  }

  const now = new Date();
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      subscription_status: 'expired',
      plan_code: 'free',
      stripe_subscription_id: null,
      ended_at: now.toISOString(),
      cancel_at_period_end: false,
      grace_period_ends_at: null,
      stripe_event_created_at: stripeEventCreatedAt
        ? new Date(stripeEventCreatedAt * 1000).toISOString()
        : existing.stripe_event_created_at,
      updated_at: now.toISOString(),
    })
    .eq('user_id', supabaseUserId);

  if (error) {
    throw error;
  }

  return { updated: true, ignored: false, status: 'expired', planCode: 'free' };
}

export function computeGracePeriodEnd(from: Date): Date {
  const days = getGracePeriodDays();
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function resolveUserIdFromStripeObject(
  supabase: SupabaseClient,
  metadata: Record<string, string | undefined> | null | undefined,
  customerId: string | null | undefined
): Promise<string | null> {
  if (metadata?.supabase_user_id) {
    return metadata.supabase_user_id;
  }

  if (!customerId) {
    return null;
  }

  const { data } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}
