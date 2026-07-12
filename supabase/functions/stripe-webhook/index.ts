import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'npm:stripe@17.7.0';
import {
  computeGracePeriodEnd,
  markSubscriptionEnded,
  resolveUserIdFromStripeObject,
  syncStripeSubscription,
} from '../_shared/billing-sync.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
]);

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const stripe = getStripeClient();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    return new Response('Webhook not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const service = createServiceClient();

  const { error: insertError } = await service.from('stripe_webhook_events').insert({
    stripe_event_id: event.id,
    event_type: event.type,
    event_created_at: new Date(event.created * 1000).toISOString(),
    processing_status: 'processing',
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('Failed to record webhook event');
    return new Response('Failed to record event', { status: 500 });
  }

  try {
    if (!relevantEvents.has(event.type)) {
      await markProcessed(service, event.id, 'ignored');
      return ok();
    }

    await processEvent(stripe, service, event);
    await markProcessed(service, event.id, 'processed');
    return ok();
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown error';
    await service
      .from('stripe_webhook_events')
      .update({
        processing_status: 'failed',
        processing_error: message,
        processed_at: new Date().toISOString(),
      })
      .eq('stripe_event_id', event.id);
    console.error('Webhook processing failed', { eventType: event.type });
    return new Response('Webhook handler failed', { status: 500 });
  }
});

async function processEvent(
  stripe: Stripe,
  service: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(stripe, service, event);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(stripe, service, event);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(service, event);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(stripe, service, event);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(stripe, service, event);
      break;
    case 'invoice.payment_action_required':
      await handleInvoiceActionRequired(stripe, service, event);
      break;
  }
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  service: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = await resolveUserIdFromStripeObject(
    service,
    session.metadata ?? undefined,
    typeof session.customer === 'string' ? session.customer : session.customer?.id
  );
  if (!userId || !session.subscription) {
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncStripeSubscription(service, subscription, {
    supabaseUserId: userId,
    stripeEventCreatedAt: event.created,
  });

  if (session.customer) {
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer.id;
    await service
      .from('user_subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', userId);
  }
}

async function handleSubscriptionChange(
  stripe: Stripe,
  service: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const userId = await resolveUserIdFromStripeObject(
    service,
    subscription.metadata,
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id
  );
  if (!userId) {
    return;
  }

  await syncStripeSubscription(service, subscription, {
    supabaseUserId: userId,
    stripeEventCreatedAt: event.created,
  });
}

async function handleSubscriptionDeleted(
  service: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const userId = await resolveUserIdFromStripeObject(
    service,
    subscription.metadata,
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id
  );
  if (!userId) {
    return;
  }

  await markSubscriptionEnded(service, userId, event.created);
}

async function handleInvoicePaid(
  stripe: Stripe,
  service: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = await resolveUserIdFromStripeObject(
    service,
    subscription.metadata,
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id
  );
  if (!userId) {
    return;
  }

  await syncStripeSubscription(service, subscription, {
    supabaseUserId: userId,
    stripeEventCreatedAt: event.created,
    lastPaymentAt: new Date(),
    clearGracePeriod: true,
  });
}

async function handleInvoicePaymentFailed(
  stripe: Stripe,
  service: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = await resolveUserIdFromStripeObject(
    service,
    subscription.metadata,
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id
  );
  if (!userId) {
    return;
  }

  const failedAt = new Date();
  await syncStripeSubscription(service, subscription, {
    supabaseUserId: userId,
    stripeEventCreatedAt: event.created,
    lastPaymentFailedAt: failedAt,
    gracePeriodEndsAt: computeGracePeriodEnd(failedAt),
  });
}

async function handleInvoiceActionRequired(
  stripe: Stripe,
  service: ReturnType<typeof createServiceClient>,
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = await resolveUserIdFromStripeObject(
    service,
    subscription.metadata,
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id
  );
  if (!userId) {
    return;
  }

  await syncStripeSubscription(service, subscription, {
    supabaseUserId: userId,
    stripeEventCreatedAt: event.created,
  });
}

async function markProcessed(
  service: ReturnType<typeof createServiceClient>,
  eventId: string,
  status: 'processed' | 'ignored'
): Promise<void> {
  await service
    .from('stripe_webhook_events')
    .update({
      processing_status: status,
      processed_at: new Date().toISOString(),
    })
    .eq('stripe_event_id', eventId);
}

function ok(): Response {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
