-- PantryFlow: Early Access billing, trials, entitlements, and free-tier limits
-- Safe to run more than once.
--
-- Existing-user backfill: users without a subscription row receive a NEW 20-day trial
-- starting at migration deployment time (now()), NOT from original account creation date.
-- Idempotent: ON CONFLICT DO NOTHING — never overwrites existing subscription rows or trial dates.

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_subscriptions
-- ---------------------------------------------------------------------------

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_code text not null default 'beta_trial'
    check (plan_code in ('beta_trial', 'early_access_monthly', 'early_access_annual', 'free')),
  subscription_status text not null default 'trialing'
    check (subscription_status in (
      'trialing', 'active', 'grace_period', 'past_due',
      'canceled', 'expired', 'incomplete', 'free'
    )),
  billing_interval text check (billing_interval in ('month', 'year')),
  trial_started_at timestamptz not null,
  trial_ends_at timestamptz not null,
  current_period_started_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  ended_at timestamptz,
  last_payment_at timestamptz,
  last_payment_failed_at timestamptz,
  grace_period_ends_at timestamptz,
  stripe_event_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_subscriptions is
  'Normalized billing and trial state. Modified only by service role and SECURITY DEFINER functions.';

drop trigger if exists user_subscriptions_set_updated_at on public.user_subscriptions;
create trigger user_subscriptions_set_updated_at
  before update on public.user_subscriptions
  for each row execute function public.set_updated_at();

create index if not exists user_subscriptions_stripe_customer_id_idx
  on public.user_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists user_subscriptions_stripe_subscription_id_idx
  on public.user_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- stripe_webhook_events (idempotency)
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  event_created_at timestamptz,
  processing_status text not null
    check (processing_status in ('processing', 'processed', 'failed', 'ignored')),
  processing_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.stripe_webhook_events is
  'Stripe webhook idempotency and processing audit. Service role only.';

-- ---------------------------------------------------------------------------
-- Smart suggestion usage (AI generation metering)
-- ---------------------------------------------------------------------------

create table if not exists public.user_monthly_smart_suggestion_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  success_count integer not null default 0 check (success_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

drop trigger if exists user_monthly_smart_suggestion_usage_set_updated_at
  on public.user_monthly_smart_suggestion_usage;
create trigger user_monthly_smart_suggestion_usage_set_updated_at
  before update on public.user_monthly_smart_suggestion_usage
  for each row execute function public.set_updated_at();

create table if not exists public.smart_suggestion_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists smart_suggestion_usage_events_user_month_idx
  on public.smart_suggestion_usage_events (user_id, month_key);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.user_subscriptions enable row level security;
alter table public.user_monthly_smart_suggestion_usage enable row level security;
alter table public.smart_suggestion_usage_events enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop policy if exists "Users can view own subscription" on public.user_subscriptions;
create policy "Users can view own subscription"
  on public.user_subscriptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view own smart suggestion usage" on public.user_monthly_smart_suggestion_usage;
create policy "Users can view own smart suggestion usage"
  on public.user_monthly_smart_suggestion_usage for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can view own smart suggestion events" on public.smart_suggestion_usage_events;
create policy "Users can view own smart suggestion events"
  on public.smart_suggestion_usage_events for select to authenticated
  using (auth.uid() = user_id);

-- No client INSERT/UPDATE/DELETE on billing tables. stripe_webhook_events has no policies.

revoke all on public.stripe_webhook_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trial creation on auth.users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_subscriptions (
    user_id,
    plan_code,
    subscription_status,
    trial_started_at,
    trial_ends_at
  ) values (
    new.id,
    'beta_trial',
    'trialing',
    new.created_at,
    new.created_at + interval '20 days'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_user_subscription();

-- ---------------------------------------------------------------------------
-- Backfill existing users (20-day trial from deployment time)
-- ---------------------------------------------------------------------------

insert into public.user_subscriptions (
  user_id,
  plan_code,
  subscription_status,
  trial_started_at,
  trial_ends_at
)
select
  u.id,
  'beta_trial',
  'trialing',
  now(),
  now() + interval '20 days'
from auth.users u
where not exists (
  select 1 from public.user_subscriptions s where s.user_id = u.id
)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- UTC Monday week helpers (authoritative for free-tier meal-plan limits)
-- ---------------------------------------------------------------------------

create or replace function public.utc_monday_of_week(p_date date default (now() at time zone 'UTC')::date)
returns date
language sql
immutable
as $$
  select (p_date - ((extract(isodow from p_date)::int - 1) || ' days')::interval)::date;
$$;

create or replace function public.utc_sunday_of_week(p_date date default (now() at time zone 'UTC')::date)
returns date
language sql
immutable
as $$
  select public.utc_monday_of_week(p_date) + 6;
$$;

create or replace function public.utc_month_key(p_ts timestamptz default now())
returns text
language sql
immutable
as $$
  select to_char(p_ts at time zone 'UTC', 'YYYY-MM');
$$;

-- ---------------------------------------------------------------------------
-- Premium access check
-- ---------------------------------------------------------------------------

create or replace function public.has_premium_access(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sub public.user_subscriptions%rowtype;
  v_now timestamptz := now();
begin
  select * into v_sub from public.user_subscriptions where user_id = p_user_id;
  if not found then
    return false;
  end if;

  -- Active trial (server UTC)
  if v_sub.subscription_status = 'trialing' and v_sub.trial_ends_at > v_now then
    return true;
  end if;

  -- Payment grace period
  if v_sub.subscription_status = 'grace_period'
     and v_sub.grace_period_ends_at is not null
     and v_sub.grace_period_ends_at > v_now then
    return true;
  end if;

  -- Active paid subscription
  if v_sub.subscription_status = 'active' then
    return true;
  end if;

  -- Canceled but paid period not ended
  if v_sub.current_period_ends_at is not null
     and v_sub.current_period_ends_at > v_now
     and (
       v_sub.subscription_status in ('canceled', 'active')
       or v_sub.cancel_at_period_end = true
     ) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.has_premium_access(uuid) from public;
grant execute on function public.has_premium_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Smart suggestion allowance (AI generation)
-- ---------------------------------------------------------------------------

create or replace function public.get_smart_suggestion_usage(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month text := public.utc_month_key();
  v_count integer := 0;
  v_limit integer := 3;
  v_premium boolean;
begin
  v_premium := public.has_premium_access(p_user_id);

  select coalesce(success_count, 0) into v_count
  from public.user_monthly_smart_suggestion_usage
  where user_id = p_user_id and month_key = v_month;

  if not found then
    v_count := 0;
  end if;

  return jsonb_build_object(
    'monthKey', v_month,
    'used', v_count,
    'limit', case when v_premium then null else v_limit end,
    'remaining', case when v_premium then null else greatest(0, v_limit - v_count) end,
    'isPremium', v_premium
  );
end;
$$;

create or replace function public.check_smart_suggestion_allowance(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usage jsonb;
  v_remaining integer;
begin
  v_usage := public.get_smart_suggestion_usage(p_user_id);

  if (v_usage->>'isPremium')::boolean then
    return jsonb_build_object('allowed', true, 'usage', v_usage);
  end if;

  v_remaining := (v_usage->>'remaining')::integer;
  if v_remaining <= 0 then
    return jsonb_build_object(
      'allowed', false,
      'errorCode', 'SMART_SUGGESTION_LIMIT_REACHED',
      'usage', v_usage
    );
  end if;

  return jsonb_build_object('allowed', true, 'usage', v_usage);
end;
$$;

create or replace function public.record_smart_suggestion_usage(
  p_user_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := public.utc_month_key();
  v_limit integer := 3;
  v_premium boolean;
  v_existing uuid;
  v_count integer;
begin
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'Idempotency key is required';
  end if;

  v_premium := public.has_premium_access(p_user_id);
  if v_premium then
    return jsonb_build_object(
      'recorded', false,
      'reason', 'premium_unlimited',
      'usage', public.get_smart_suggestion_usage(p_user_id)
    );
  end if;

  -- Idempotent: duplicate key returns current state without consuming again
  select id into v_existing
  from public.smart_suggestion_usage_events
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'recorded', false,
      'reason', 'duplicate',
      'usage', public.get_smart_suggestion_usage(p_user_id)
    );
  end if;

  insert into public.user_monthly_smart_suggestion_usage (user_id, month_key, success_count)
  values (p_user_id, v_month, 0)
  on conflict (user_id, month_key) do nothing;

  select success_count into v_count
  from public.user_monthly_smart_suggestion_usage
  where user_id = p_user_id and month_key = v_month
  for update;

  if v_count >= v_limit then
    raise exception 'SMART_SUGGESTION_LIMIT_REACHED';
  end if;

  insert into public.smart_suggestion_usage_events (user_id, month_key, idempotency_key)
  values (p_user_id, v_month, p_idempotency_key);

  update public.user_monthly_smart_suggestion_usage
  set success_count = success_count + 1
  where user_id = p_user_id and month_key = v_month;

  return jsonb_build_object(
    'recorded', true,
    'usage', public.get_smart_suggestion_usage(p_user_id)
  );
end;
$$;

revoke all on function public.check_smart_suggestion_allowance(uuid) from public;
grant execute on function public.check_smart_suggestion_allowance(uuid) to authenticated;
revoke all on function public.record_smart_suggestion_usage(uuid, text) from public;
grant execute on function public.record_smart_suggestion_usage(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Free-tier enforcement triggers
-- ---------------------------------------------------------------------------

create or replace function public.enforce_personal_recipe_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_limit integer := 10;
begin
  if new.is_base_recipe = true or new.user_id is null then
    return new;
  end if;

  if public.has_premium_access(new.user_id) then
    return new;
  end if;

  select count(*) into v_count
  from public.recipes
  where user_id = new.user_id and is_base_recipe = false;

  if v_count >= v_limit then
    raise exception 'PERSONAL_RECIPE_LIMIT_REACHED'
      using hint = jsonb_build_object('max', v_limit, 'used', v_count)::text;
  end if;

  return new;
end;
$$;

drop trigger if exists recipes_enforce_personal_limit on public.recipes;
create trigger recipes_enforce_personal_limit
  before insert on public.recipes
  for each row execute function public.enforce_personal_recipe_limit();

create or replace function public.enforce_active_meal_plan_week_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monday date;
  v_sunday date;
begin
  if public.has_premium_access(new.user_id) then
    return new;
  end if;

  v_monday := public.utc_monday_of_week((now() at time zone 'UTC')::date);
  v_sunday := public.utc_sunday_of_week((now() at time zone 'UTC')::date);

  if new.date < v_monday or new.date > v_sunday then
    raise exception 'ACTIVE_MEAL_PLAN_LIMIT_REACHED'
      using hint = jsonb_build_object(
        'activeWeekStart', v_monday,
        'activeWeekEnd', v_sunday,
        'attemptedDate', new.date
      )::text;
  end if;

  return new;
end;
$$;

drop trigger if exists meal_plan_items_enforce_active_week on public.meal_plan_items;
create trigger meal_plan_items_enforce_active_week
  before insert on public.meal_plan_items
  for each row execute function public.enforce_active_meal_plan_week_limit();

-- ---------------------------------------------------------------------------
-- get_user_entitlements RPC
-- ---------------------------------------------------------------------------

create or replace function public.get_user_entitlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub public.user_subscriptions%rowtype;
  v_now timestamptz := now();
  v_premium boolean;
  v_trial_days integer;
  v_personal_recipes integer;
  v_active_weeks integer;
  v_suggestion_usage jsonb;
  v_access_level text;
  v_plan_code text;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_sub from public.user_subscriptions where user_id = v_user_id;
  if not found then
    return jsonb_build_object(
      'accessLevel', 'free',
      'planCode', 'free',
      'subscriptionStatus', 'free',
      'isPremium', false,
      'isTrial', false,
      'isPaidSubscriber', false,
      'trialStartedAt', null,
      'trialEndsAt', null,
      'trialDaysRemaining', null,
      'currentPeriodStartedAt', null,
      'currentPeriodEndsAt', null,
      'cancelAtPeriodEnd', false,
      'gracePeriodEndsAt', null,
      'canManageBilling', false,
      'limits', jsonb_build_object(
        'activeMealPlanWeeks', 1,
        'personalRecipes', 10,
        'smartSuggestionsPerMonth', 3,
        'manualPlanningEnabled', true,
        'basicInventoryEnabled', true
      ),
      'usage', jsonb_build_object(
        'activeMealPlanWeeks', 0,
        'personalRecipes', 0,
        'smartSuggestionsUsedThisMonth', 0,
        'smartSuggestionsRemainingThisMonth', 3
      )
    );
  end if;

  v_premium := public.has_premium_access(v_user_id);

  v_trial_days := case
    when v_sub.trial_ends_at > v_now then
      greatest(0, ceil(extract(epoch from (v_sub.trial_ends_at - v_now)) / 86400.0)::integer)
    else 0
  end;

  select count(*) into v_personal_recipes
  from public.recipes
  where user_id = v_user_id and is_base_recipe = false;

  select count(distinct public.utc_monday_of_week(mpi.date)) into v_active_weeks
  from public.meal_plan_items mpi
  where mpi.user_id = v_user_id
    and mpi.date >= public.utc_monday_of_week((now() at time zone 'UTC')::date)
    and mpi.date <= public.utc_sunday_of_week((now() at time zone 'UTC')::date);

  v_suggestion_usage := public.get_smart_suggestion_usage(v_user_id);

  v_access_level := case when v_premium then 'premium' else 'free' end;
  v_plan_code := case
    when v_premium then v_sub.plan_code
    when v_sub.trial_ends_at <= v_now and v_sub.subscription_status = 'trialing' then 'free'
    else coalesce(nullif(v_sub.plan_code, 'beta_trial'), 'free')
  end;
  if not v_premium and v_sub.subscription_status not in ('active', 'grace_period', 'canceled') then
    v_plan_code := 'free';
  end if;

  v_status := case
    when v_premium and v_sub.subscription_status = 'trialing' then 'trialing'
    when v_premium then v_sub.subscription_status
    when v_sub.trial_ends_at <= v_now and v_sub.subscription_status = 'trialing' then 'expired'
    else 'free'
  end;

  return jsonb_build_object(
    'accessLevel', v_access_level,
    'planCode', v_plan_code,
    'subscriptionStatus', v_status,
    'isPremium', v_premium,
    'isTrial', v_premium and v_sub.subscription_status = 'trialing' and v_sub.trial_ends_at > v_now,
    'isPaidSubscriber', v_premium and v_sub.plan_code in ('early_access_monthly', 'early_access_annual'),
    'trialStartedAt', v_sub.trial_started_at,
    'trialEndsAt', v_sub.trial_ends_at,
    'trialDaysRemaining', case when v_sub.trial_ends_at > v_now then v_trial_days else null end,
    'currentPeriodStartedAt', v_sub.current_period_started_at,
    'currentPeriodEndsAt', v_sub.current_period_ends_at,
    'cancelAtPeriodEnd', v_sub.cancel_at_period_end,
    'gracePeriodEndsAt', v_sub.grace_period_ends_at,
    'canManageBilling', v_sub.stripe_customer_id is not null,
    'limits', jsonb_build_object(
      'activeMealPlanWeeks', case when v_premium then null else 1 end,
      'personalRecipes', case when v_premium then null else 10 end,
      'smartSuggestionsPerMonth', case when v_premium then null else 3 end,
      'manualPlanningEnabled', true,
      'basicInventoryEnabled', true
    ),
    'usage', jsonb_build_object(
      'activeMealPlanWeeks', v_active_weeks,
      'personalRecipes', v_personal_recipes,
      'smartSuggestionsUsedThisMonth', (v_suggestion_usage->>'used')::integer,
      'smartSuggestionsRemainingThisMonth', case
        when v_premium then null
        else (v_suggestion_usage->>'remaining')::integer
      end
    )
  );
end;
$$;

revoke all on function public.get_user_entitlements() from public;
grant execute on function public.get_user_entitlements() to authenticated;

-- ---------------------------------------------------------------------------
-- Admin billing RPCs
-- ---------------------------------------------------------------------------

alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (
  event_name in (
    'ai_recipe_generation_started',
    'ai_recipe_generation_completed',
    'ai_recipe_generation_failed',
    'shopping_list_generation_failed',
    'barcode_lookup_failed',
    'critical_workflow_failed',
    'admin_trial_extended',
    'admin_subscription_sync_requested'
  )
);

create or replace function public.admin_list_billing(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Access denied';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.email), '[]'::jsonb)
  into v_result
  from (
    select
      u.id as user_id,
      u.email,
      p.display_name,
      s.plan_code,
      s.subscription_status,
      s.billing_interval,
      s.trial_started_at,
      s.trial_ends_at,
      s.current_period_ends_at,
      s.cancel_at_period_end,
      s.grace_period_ends_at,
      s.last_payment_at,
      s.last_payment_failed_at,
      public.has_premium_access(u.id) as is_premium
    from auth.users u
    left join public.user_food_profiles p on p.user_id = u.id
    left join public.user_subscriptions s on s.user_id = u.id
    where p_search is null
      or u.email ilike '%' || p_search || '%'
      or p.display_name ilike '%' || p_search || '%'
    limit 200
  ) t;

  return v_result;
end;
$$;

create or replace function public.admin_extend_trial(p_user_id uuid, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.user_subscriptions%rowtype;
  v_new_end timestamptz;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Access denied';
  end if;

  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'Invalid trial extension days';
  end if;

  select * into v_sub from public.user_subscriptions where user_id = p_user_id for update;
  if not found then
    raise exception 'Subscription record not found';
  end if;

  v_new_end := greatest(v_sub.trial_ends_at, now()) + (p_days || ' days')::interval;

  update public.user_subscriptions
  set
    trial_ends_at = v_new_end,
    subscription_status = case
      when subscription_status in ('expired', 'free') then 'trialing'
      else subscription_status
    end,
    plan_code = case
      when plan_code = 'free' then 'beta_trial'
      else plan_code
    end
  where user_id = p_user_id;

  insert into public.product_events (user_id, event_name, properties)
  values (
    p_user_id,
    'admin_trial_extended',
    jsonb_build_object(
      'admin_user_id', auth.uid(),
      'days_added', p_days,
      'new_trial_ends_at', v_new_end
    )
  );

  return jsonb_build_object(
    'userId', p_user_id,
    'trialEndsAt', v_new_end,
    'daysAdded', p_days
  );
end;
$$;

revoke all on function public.admin_list_billing(text) from public;
grant execute on function public.admin_list_billing(text) to authenticated;
revoke all on function public.admin_extend_trial(uuid, integer) from public;
grant execute on function public.admin_extend_trial(uuid, integer) to authenticated;
