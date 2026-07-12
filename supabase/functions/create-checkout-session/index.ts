import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { mapErrorToResponse, billingErrorResponse } from '../_shared/errors.ts';
import {
  getAppBaseUrl,
  getPriceIdForPlan,
  getStripeClient,
  parseCheckoutPlanCode,
  requirePricingPhaseEarlyAccess,
} from '../_shared/stripe.ts';
import {
  createServiceClient,
  createUserClient,
  getAuthenticatedUserId,
} from '../_shared/supabase.ts';

interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  cancel_at_period_end: boolean;
  current_period_ends_at: string | null;
  grace_period_ends_at: string | null;
}

serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) {
    return preflight;
  }

  if (req.method !== 'POST') {
    return billingErrorResponse(
      corsHeaders(req.headers.get('Origin')),
      'METHOD_NOT_ALLOWED',
      'Method not allowed.',
      405
    );
  }

  try {
    requirePricingPhaseEarlyAccess();
    const authHeader = req.headers.get('Authorization');
    const userId = await getAuthenticatedUserId(authHeader);
    const body = await req.json();
    const planCode = parseCheckoutPlanCode(body?.planCode);
    const priceId = getPriceIdForPlan(planCode);

    const userClient = createUserClient(authHeader!);
    const { data: userData } = await userClient.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      throw new Error('UNAUTHENTICATED');
    }

    const service = createServiceClient();
    const { data: subscription, error: subError } = await service
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) {
      throw subError;
    }

    const row = subscription as SubscriptionRow | null;
    assertCanCreateCheckout(row);

    const stripe = getStripeClient();
    let customerId = row?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      await service
        .from('user_subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', userId);
    }

    const appBaseUrl = getAppBaseUrl();
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appBaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/checkout/cancel`,
        client_reference_id: userId,
        metadata: {
          supabase_user_id: userId,
          plan_code: planCode,
        },
        subscription_data: {
          metadata: {
            supabase_user_id: userId,
            plan_code: planCode,
          },
        },
      },
      {
        idempotencyKey: `checkout-${userId}-${planCode}-${new Date().toISOString().slice(0, 13)}`,
      }
    );

    if (!session.url) {
      throw new Error('BILLING_CONFIGURATION_ERROR');
    }

    return jsonResponse(req, { url: session.url, planCode });
  } catch (error) {
    return mapErrorToResponse(req, error);
  }
});

function assertCanCreateCheckout(row: SubscriptionRow | null): void {
  if (!row) {
    return;
  }

  const now = Date.now();
  const periodEnd = row.current_period_ends_at
    ? new Date(row.current_period_ends_at).getTime()
    : 0;
  const graceEnd = row.grace_period_ends_at
    ? new Date(row.grace_period_ends_at).getTime()
    : 0;

  const hasActivePaidAccess =
    row.subscription_status === 'active' ||
    (row.subscription_status === 'grace_period' && graceEnd > now) ||
    (row.cancel_at_period_end && periodEnd > now) ||
    (row.subscription_status === 'canceled' && periodEnd > now);

  if (hasActivePaidAccess) {
    throw new Error('ACTIVE_SUBSCRIPTION_EXISTS');
  }

  if (row.subscription_status === 'past_due' || row.subscription_status === 'grace_period') {
    throw new Error('PAYMENT_RECOVERY_REQUIRED');
  }

  if (row.subscription_status === 'incomplete' && row.stripe_subscription_id) {
    throw new Error('PAYMENT_RECOVERY_REQUIRED');
  }
}
