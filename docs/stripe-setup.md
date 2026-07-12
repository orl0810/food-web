# Stripe Setup — PantryFlow Early Access

This guide covers Stripe Dashboard configuration for the Early Access subscription system (`PRICING_PHASE=early_access`).

## 1. Products and Prices

Create one product (e.g. **PantryFlow Early Access**) with two recurring prices:

| Plan | Amount | Interval | Internal plan code |
|------|--------|----------|-------------------|
| Early Access Monthly | €3.00 | Monthly | `early_access_monthly` |
| Early Access Annual | €20.00 | Yearly | `early_access_annual` |

**Important:** Do not edit active Early Access prices when launching public pricing later. Create new prices for future phases; existing subscribers retain their original Stripe Price while continuously subscribed.

## 2. Supabase Edge Function secrets

Set these in the Supabase project (Dashboard → Edge Functions → Secrets, or CLI):

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_EARLY_ACCESS_MONTHLY_PRICE_ID=price_...
supabase secrets set STRIPE_EARLY_ACCESS_ANNUAL_PRICE_ID=price_...
supabase secrets set APP_BASE_URL=https://your-app.vercel.app
supabase secrets set PRICING_PHASE=early_access
supabase secrets set TRIAL_DURATION_DAYS=20
supabase secrets set PAYMENT_GRACE_PERIOD_DAYS=3
supabase secrets set FREE_PERSONAL_RECIPE_LIMIT=10
supabase secrets set FREE_SMART_SUGGESTIONS_PER_MONTH=3
```

Never expose `STRIPE_SECRET_KEY` or Price IDs in Angular.

## 3. Customer Portal

In Stripe Dashboard → **Settings → Billing → Customer portal**:

- Enable subscription cancellation (**at period end only**)
- Enable payment method updates
- Enable invoice history
- Set business name and support email

## 4. Webhook endpoint

**URL:**

```text
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Deploy without JWT verification:

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

Also configured in [`supabase/config.toml`](../supabase/config.toml) (`verify_jwt = false`).

## 5. Webhook signing secret

After creating the endpoint in Stripe, copy the **Signing secret** (`whsec_...`) and set `STRIPE_WEBHOOK_SECRET`.

## 6. Required webhook events

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`

## 7. Deploy all billing functions

```bash
supabase db push   # applies migration 20260712000000_billing_subscriptions.sql
supabase functions deploy create-checkout-session
supabase functions deploy create-customer-portal-session
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy admin-sync-subscription
supabase functions deploy generate-ai-recipes   # includes smart-suggestion metering
```

## 8. Stripe test mode workflow

1. Use **Test mode** keys (`sk_test_...`) and test Price IDs.
2. Sign up a test user in the app (20-day trial starts automatically).
3. Visit `/pricing` and subscribe with a test card.
4. Confirm webhook events appear in Stripe → Developers → Webhooks.
5. Verify entitlements via `/account/billing` or `get_user_entitlements` RPC.

## 9. Stripe CLI local webhook testing

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
# Copy whsec_... from CLI output into STRIPE_WEBHOOK_SECRET for local stack
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
```

## 10. Test cards

| Scenario | Card number |
|----------|-------------|
| Success | `4242 4242 4242 4242` |
| Decline | `4000 0000 0000 0002` |
| Requires authentication | `4000 0025 0000 3155` |

Use any future expiry, any CVC, any billing ZIP.

## 11. Test → Live migration

1. Create **Live mode** Products/Prices (new Price IDs — do not reuse test IDs).
2. Update Supabase secrets with live `STRIPE_SECRET_KEY`, live Price IDs, live `STRIPE_WEBHOOK_SECRET`, and production `APP_BASE_URL`.
3. Create a **live** webhook endpoint pointing to the same function URL.
4. Redeploy edge functions.
5. Run a real checkout smoke test with a small plan before announcing.

## 12. Founding price retention reminder

- Early Access subscribers keep their Stripe Price while continuously active.
- Canceled subscribers lose entitlement to the old price after the paid period ends.
- Returning subscribers get whatever prices are available in the current `PRICING_PHASE`.
