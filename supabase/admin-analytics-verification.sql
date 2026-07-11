-- Manual verification queries for the admin analytics module.
-- Run in the Supabase SQL editor after applying migrations 033-035.

-- 1) Default role is user for existing profiles
select role, count(*) from public.user_food_profiles group by role;

-- 2) Promote an administrator (replace UUID)
-- update public.user_food_profiles set role = 'admin' where user_id = '<SUPABASE_USER_UUID>';

-- 3) Revert administrator role
-- update public.user_food_profiles set role = 'user' where user_id = '<SUPABASE_USER_UUID>';

-- 4) Client role self-escalation is blocked (run as authenticated user via API, should fail)
-- update public.user_food_profiles set role = 'admin' where user_id = auth.uid();

-- 5) Admin RPC rejects non-admin users (expect exception when run as regular user JWT)
-- select public.get_admin_analytics(now() - interval '30 days', now());

-- 6) Admin RPC succeeds for administrators
-- select public.get_admin_analytics(now() - interval '30 days', now());

-- 7) Product event RLS blocks spoofed user_id (expect policy violation)
-- insert into public.product_events (user_id, event_name)
-- values ('00000000-0000-4000-8000-000000000099', 'critical_workflow_failed');

-- 8) Product event select is blocked for normal users (expect permission denied / empty)
-- select * from public.product_events limit 1;

-- 9) Empty database returns valid zero metrics
-- select public.get_admin_analytics(null, null);

-- 10) Date filtering changes new user counts
-- select
--   (public.get_admin_analytics(now() - interval '7 days', now()) -> 'users' ->> 'new_users') as last_7_days,
--   (public.get_admin_analytics(now() - interval '30 days', now()) -> 'users' ->> 'new_users') as last_30_days;
