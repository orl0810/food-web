import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, handleCorsPreflight, jsonResponse } from '../_shared/cors.ts';
import { billingErrorResponse, mapErrorToResponse } from '../_shared/errors.ts';
import { getAppBaseUrl, getStripeClient } from '../_shared/stripe.ts';
import {
  createServiceClient,
  getAuthenticatedUserId,
} from '../_shared/supabase.ts';

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
    const userId = await getAuthenticatedUserId(authHeader);

    const service = createServiceClient();
    const { data: subscription, error } = await service
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const customerId = subscription?.stripe_customer_id;
    if (!customerId) {
      throw new Error('NO_STRIPE_CUSTOMER');
    }

    const stripe = getStripeClient();
    const appBaseUrl = getAppBaseUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl}/account/billing`,
    });

    return jsonResponse(req, { url: portalSession.url });
  } catch (error) {
    return mapErrorToResponse(req, error);
  }
});
