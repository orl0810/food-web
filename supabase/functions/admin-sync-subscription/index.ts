import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { billingErrorResponse, mapErrorToResponse } from '../_shared/errors.ts';
import { syncStripeSubscription } from '../_shared/billing-sync.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { assertAdmin, createServiceClient } from '../_shared/supabase.ts';

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
    const authHeader = req.headers.get('Authorization');
    const adminUserId = await assertAdmin(authHeader!);
    const body = await req.json();
    const targetUserId = body?.userId;

    if (!targetUserId || typeof targetUserId !== 'string') {
      throw new Error('BILLING_CONFIGURATION_ERROR');
    }

    const service = createServiceClient();
    const { data: subscriptionRow, error } = await service
      .from('user_subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!subscriptionRow?.stripe_subscription_id) {
      throw new Error('NO_STRIPE_CUSTOMER');
    }

    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(
      subscriptionRow.stripe_subscription_id
    );

    const result = await syncStripeSubscription(service, subscription, {
      supabaseUserId: targetUserId,
      stripeEventCreatedAt: Math.floor(Date.now() / 1000),
    });

    await service.from('product_events').insert({
      user_id: targetUserId,
      event_name: 'admin_subscription_sync_requested',
      properties: {
        admin_user_id: adminUserId,
        updated: result.updated,
        ignored: result.ignored,
        reason: result.reason ?? null,
      },
    });

    return jsonResponse(req, {
      synced: result.updated,
      ignored: result.ignored,
      reason: result.reason ?? null,
      status: result.status ?? null,
      planCode: result.planCode ?? null,
    });
  } catch (error) {
    return mapErrorToResponse(req, error);
  }
});
