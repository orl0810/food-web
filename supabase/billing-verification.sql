-- PantryFlow billing verification queries
-- Run in Supabase SQL editor after applying migration 20260712000000_billing_subscriptions.sql

-- 1. Confirm subscription table exists
select count(*) as subscription_rows from public.user_subscriptions;

-- 2. Verify trial backfill (existing users should have trialing rows)
select
  u.email,
  s.plan_code,
  s.subscription_status,
  s.trial_started_at,
  s.trial_ends_at
from auth.users u
left join public.user_subscriptions s on s.user_id = u.id
order by u.created_at desc
limit 20;

-- 3. Test entitlements RPC (run as authenticated user in app, or substitute auth.uid())
-- select public.get_user_entitlements();

-- 4. Confirm RLS: authenticated users cannot update billing state
-- (should fail when run as authenticated role via PostgREST)
-- update public.user_subscriptions set plan_code = 'early_access_monthly' where user_id = auth.uid();

-- 5. Admin billing list (requires admin role)
-- select public.admin_list_billing(null);

-- 6. Webhook idempotency table (service role only)
-- select * from public.stripe_webhook_events order by created_at desc limit 10;

-- 7. Smart suggestion usage
-- select * from public.user_monthly_smart_suggestion_usage limit 10;
