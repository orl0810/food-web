-- Soozi: aggregated admin analytics RPC (security definer, admin-only)
-- Safe to run more than once.
--
-- Metric definitions:
--   Activated user: onboarding completed AND at least one meal_plan_items row with status='eaten'.
--   Active user: performed a meaningful product action in the window (meal plan, recipe, inventory,
--     shopping list, or prepared portion activity — not login alone).
--   Meal plan created: distinct (user_id, date) planning days.
--   Shopping list generated: distinct (user_id, date(created_at)) where source='meal_plan'.
--   Cooked meal: status='prepared'. Completed meal: status='eaten'. Skipped excluded from rates.

create or replace function public.get_admin_analytics(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Access denied';
  end if;

  v_end := coalesce(p_end_date, now());
  v_start := coalesce(p_start_date, '1970-01-01'::timestamptz);

  with bounds as (
    select v_start as start_at, v_end as end_at
  ),
  all_users as (
    select u.id, u.created_at as registered_at
    from auth.users u
  ),
  cohort_users as (
    select au.id, au.registered_at
    from all_users au, bounds b
    where au.registered_at >= b.start_at
      and au.registered_at < b.end_at
  ),
  profiles as (
    select
      p.user_id,
      p.onboarding_status,
      p.onboarding_completed_at,
      p.created_at as profile_created_at
    from public.user_food_profiles p
  ),
  meaningful_actions as (
    select user_id, action_at
    from (
      select mpi.user_id, mpi.created_at as action_at
      from public.meal_plan_items mpi, bounds b
      where mpi.created_at >= b.start_at and mpi.created_at < b.end_at
      union all
      select mpi.user_id, mpi.completed_at as action_at
      from public.meal_plan_items mpi, bounds b
      where mpi.completed_at is not null
        and mpi.completed_at >= b.start_at and mpi.completed_at < b.end_at
      union all
      select r.user_id, r.created_at as action_at
      from public.recipes r, bounds b
      where r.user_id is not null
        and coalesce(r.is_base_recipe, false) = false
        and r.created_at >= b.start_at and r.created_at < b.end_at
      union all
      select fi.user_id, fi.created_at as action_at
      from public.food_items fi, bounds b
      where fi.created_at >= b.start_at and fi.created_at < b.end_at
      union all
      select si.user_id, si.created_at as action_at
      from public.shopping_items si, bounds b
      where si.created_at >= b.start_at and si.created_at < b.end_at
      union all
      select pp.user_id, pp.created_at as action_at
      from public.prepared_portions pp, bounds b
      where pp.created_at >= b.start_at and pp.created_at < b.end_at
    ) actions
    where user_id is not null
  ),
  lifetime_meaningful_users as (
    select distinct user_id
    from (
      select mpi.user_id from public.meal_plan_items mpi
      union
      select r.user_id from public.recipes r
        where r.user_id is not null and coalesce(r.is_base_recipe, false) = false
      union
      select fi.user_id from public.food_items fi
      union
      select si.user_id from public.shopping_items si
      union
      select pp.user_id from public.prepared_portions pp
    ) t
    where user_id is not null
  ),
  activated_users_set as (
    select distinct p.user_id
    from profiles p
    inner join public.meal_plan_items mpi on mpi.user_id = p.user_id and mpi.status = 'eaten'
    where p.onboarding_status = 'completed'
  ),
  period_active_users as (
    select distinct ma.user_id
    from meaningful_actions ma
  ),
  eaten_in_period as (
    select mpi.user_id, count(*)::bigint as cnt
    from public.meal_plan_items mpi, bounds b
    where mpi.status = 'eaten'
      and (
        (mpi.completed_at is not null and mpi.completed_at >= b.start_at and mpi.completed_at < b.end_at)
        or (mpi.completed_at is null and mpi.created_at >= b.start_at and mpi.created_at < b.end_at)
      )
    group by mpi.user_id
  ),
  user_counts as (
    select
      (select count(*)::bigint from all_users) as total_users,
      (select count(*)::bigint from cohort_users) as new_users,
      (select count(*)::bigint from profiles where onboarding_status <> 'pending') as onboarding_started_lifetime,
      (select count(*)::bigint from profiles p, bounds b
        where p.onboarding_status <> 'pending'
          and p.profile_created_at >= b.start_at and p.profile_created_at < b.end_at) as onboarding_started_period,
      (select count(*)::bigint from profiles where onboarding_status = 'completed') as onboarding_completed_lifetime,
      (select count(*)::bigint from profiles p, bounds b
        where p.onboarding_status = 'completed'
          and p.onboarding_completed_at is not null
          and p.onboarding_completed_at >= b.start_at and p.onboarding_completed_at < b.end_at) as onboarding_completed_period,
      (select count(*)::bigint from activated_users_set) as activated_users_lifetime,
      (select count(*)::bigint from activated_users_set a
        inner join cohort_users c on c.id = a.user_id) as activated_users_cohort,
      (select count(*)::bigint from all_users au
        left join lifetime_meaningful_users lm on lm.user_id = au.id
        where lm.user_id is null) as users_with_no_meaningful_action
  ),
  engagement_counts as (
    select
      (select count(distinct ma.user_id)::bigint
        from meaningful_actions ma, bounds b
        where ma.action_at >= (b.end_at - interval '1 day') and ma.action_at < b.end_at) as dau,
      (select count(distinct ma.user_id)::bigint
        from meaningful_actions ma, bounds b
        where ma.action_at >= (b.end_at - interval '7 days') and ma.action_at < b.end_at) as wau,
      (select count(distinct ma.user_id)::bigint
        from meaningful_actions ma, bounds b
        where ma.action_at >= (b.end_at - interval '30 days') and ma.action_at < b.end_at) as mau,
      (select count(distinct pa.user_id)::bigint
        from period_active_users pa
        where exists (
          select 1 from meaningful_actions ma, bounds b
          where ma.user_id = pa.user_id and ma.action_at < b.start_at
        )) as returning_users,
      (select count(distinct w1.user_id)::bigint
        from (
          select distinct ma.user_id
          from meaningful_actions ma, bounds b
          where ma.action_at >= (b.end_at - interval '7 days') and ma.action_at < b.end_at
        ) w1
        inner join (
          select distinct ma.user_id
          from meaningful_actions ma, bounds b
          where ma.action_at >= (b.end_at - interval '14 days')
            and ma.action_at < (b.end_at - interval '7 days')
        ) w0 on w0.user_id = w1.user_id) as consecutive_week_users
  ),
  meal_counts as (
    select
      (select count(distinct (mpi.user_id, mpi.date))::bigint
        from public.meal_plan_items mpi, bounds b
        where mpi.created_at >= b.start_at and mpi.created_at < b.end_at) as total_meal_plans,
      (select count(distinct mpi.user_id)::bigint
        from public.meal_plan_items mpi, bounds b
        where mpi.created_at >= b.start_at and mpi.created_at < b.end_at) as unique_planning_users,
      (select count(*)::bigint from public.meal_plan_items mpi, bounds b
        where mpi.status = 'planned'
          and mpi.created_at >= b.start_at and mpi.created_at < b.end_at) as planned_meals,
      (select count(*)::bigint from public.meal_plan_items mpi, bounds b
        where mpi.status = 'prepared'
          and (
            (mpi.completed_at is not null and mpi.completed_at >= b.start_at and mpi.completed_at < b.end_at)
            or (mpi.completed_at is null and mpi.created_at >= b.start_at and mpi.created_at < b.end_at)
          )) as cooked_meals,
      (select count(*)::bigint from public.meal_plan_items mpi, bounds b
        where mpi.status = 'eaten'
          and (
            (mpi.completed_at is not null and mpi.completed_at >= b.start_at and mpi.completed_at < b.end_at)
            or (mpi.completed_at is null and mpi.created_at >= b.start_at and mpi.created_at < b.end_at)
          )) as completed_meals,
      (select count(*)::bigint from public.meal_plan_items mpi, bounds b
        where mpi.status in ('planned', 'prepared', 'eaten')
          and mpi.created_at >= b.start_at and mpi.created_at < b.end_at) as meal_denominator
  ),
  usage_counts as (
    select
      (select count(*)::bigint from public.recipes r, bounds b
        where r.user_id is not null and coalesce(r.is_base_recipe, false) = false
          and r.created_at >= b.start_at and r.created_at < b.end_at) as recipes_created,
      (select count(distinct r.user_id)::bigint from public.recipes r, bounds b
        where r.user_id is not null and coalesce(r.is_base_recipe, false) = false
          and r.created_at >= b.start_at and r.created_at < b.end_at) as recipe_creators,
      (select count(*)::bigint from public.food_items fi, bounds b
        where fi.created_at >= b.start_at and fi.created_at < b.end_at) as inventory_items_added,
      (select count(distinct (si.user_id, date_trunc('day', si.created_at)))::bigint
        from public.shopping_items si, bounds b
        where si.source = 'meal_plan'
          and si.created_at >= b.start_at and si.created_at < b.end_at) as shopping_lists_generated,
      (select count(*)::bigint from public.prepared_portions pp, bounds b
        where pp.created_at >= b.start_at and pp.created_at < b.end_at) as prepared_portions_created,
      (select coalesce(sum(greatest(pp.total_portions - pp.available_portions, 0)), 0)::bigint
        from public.prepared_portions pp, bounds b
        where pp.created_at >= b.start_at and pp.created_at < b.end_at) as prepared_portions_consumed
  ),
  friction_counts as (
    select
      (select count(*)::bigint from profiles p
        where p.onboarding_status = 'in_progress'
          and p.profile_created_at < now() - interval '48 hours') as onboarding_abandoned,
      (select count(*)::bigint from profiles p
        where p.onboarding_status = 'completed'
          and not exists (
            select 1 from public.meal_plan_items mpi where mpi.user_id = p.user_id
          )) as users_without_meal_plan_after_onboarding,
      (select count(*)::bigint from public.product_events pe, bounds b
        where pe.event_name = 'ai_recipe_generation_failed'
          and pe.created_at >= b.start_at and pe.created_at < b.end_at) as meal_plan_generation_failures,
      (select count(*)::bigint from public.product_events pe, bounds b
        where pe.event_name = 'ai_recipe_generation_started'
          and pe.created_at >= b.start_at and pe.created_at < b.end_at) as recipe_import_started,
      (select count(*)::bigint from public.product_events pe, bounds b
        where pe.event_name = 'ai_recipe_generation_completed'
          and pe.created_at >= b.start_at and pe.created_at < b.end_at) as recipe_import_completed,
      (select count(*)::bigint from public.product_events pe, bounds b
        where pe.event_name = 'ai_recipe_generation_failed'
          and pe.created_at >= b.start_at and pe.created_at < b.end_at) as recipe_import_failures,
      (select count(*)::bigint from public.product_events pe, bounds b
        where pe.event_name = 'critical_workflow_failed'
          and pe.created_at >= b.start_at and pe.created_at < b.end_at) as critical_workflow_failures,
      (select count(*)::bigint from public.meal_photo_analyses mpa, bounds b
        where mpa.status = 'failed'
          and mpa.created_at >= b.start_at and mpa.created_at < b.end_at) as meal_photo_analysis_failures
  ),
  funnel_counts as (
    select
      (select count(*)::bigint from cohort_users) as registered,
      (select count(*)::bigint from cohort_users c
        inner join profiles p on p.user_id = c.id
        where p.onboarding_status = 'completed') as onboarding_completed,
      (select count(*)::bigint from cohort_users c
        where exists (select 1 from public.meal_plan_items mpi where mpi.user_id = c.id)) as first_meal_plan,
      (select count(*)::bigint from cohort_users c
        where exists (
          select 1 from public.meal_plan_items mpi
          where mpi.user_id = c.id and mpi.status = 'eaten'
        )) as first_meal_eaten
  ),
  retention_day7 as (
    select
      count(*)::bigint as cohort_size,
      count(*) filter (where retained)::bigint as retained_count
    from (
      select
        c.id,
        exists (
          select 1 from meaningful_actions ma
          where ma.user_id = c.id
            and ma.action_at >= c.registered_at + interval '1 day'
            and ma.action_at < c.registered_at + interval '8 days'
        ) as retained
      from cohort_users c, bounds b
      where c.registered_at <= b.end_at - interval '7 days'
    ) t
  ),
  retention_week4 as (
    select
      count(*)::bigint as cohort_size,
      count(*) filter (where retained)::bigint as retained_count
    from (
      select
        c.id,
        exists (
          select 1 from meaningful_actions ma
          where ma.user_id = c.id
            and ma.action_at >= c.registered_at + interval '22 days'
            and ma.action_at < c.registered_at + interval '29 days'
        ) as retained
      from cohort_users c, bounds b
      where c.registered_at <= b.end_at - interval '28 days'
    ) t
  ),
  avg_eaten as (
    select coalesce(avg(eip.cnt), 0)::numeric as avg_completed
    from eaten_in_period eip
    inner join period_active_users pau on pau.user_id = eip.user_id
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end
    ),
    'users', jsonb_build_object(
      'total_users', uc.total_users,
      'new_users', uc.new_users,
      'onboarding_started', uc.onboarding_started_period,
      'onboarding_completed', uc.onboarding_completed_period,
      'onboarding_completion_rate', case
        when uc.onboarding_started_period > 0
          then round((uc.onboarding_completed_period::numeric / uc.onboarding_started_period::numeric) * 100, 2)
        else 0
      end,
      'activated_users', uc.activated_users_cohort,
      'activation_rate', case
        when uc.new_users > 0
          then round((uc.activated_users_cohort::numeric / uc.new_users::numeric) * 100, 2)
        else 0
      end,
      'users_with_no_meaningful_action', uc.users_with_no_meaningful_action
    ),
    'engagement', jsonb_build_object(
      'daily_active_users', ec.dau,
      'weekly_active_users', ec.wau,
      'monthly_active_users', ec.mau,
      'returning_users', ec.returning_users,
      'consecutive_week_users', ec.consecutive_week_users,
      'day_seven_retention_rate', case
        when rd7.cohort_size > 0
          then round((rd7.retained_count::numeric / rd7.cohort_size::numeric) * 100, 2)
        else null
      end,
      'week_four_retention_rate', case
        when rw4.cohort_size > 0
          then round((rw4.retained_count::numeric / rw4.cohort_size::numeric) * 100, 2)
        else null
      end
    ),
    'meal_plans', jsonb_build_object(
      'total_meal_plans', mc.total_meal_plans,
      'unique_planning_users', mc.unique_planning_users,
      'planned_meals', mc.planned_meals,
      'cooked_meals', mc.cooked_meals,
      'completed_meals', mc.completed_meals,
      'meal_completion_rate', case
        when mc.meal_denominator > 0
          then round((mc.completed_meals::numeric / mc.meal_denominator::numeric) * 100, 2)
        else 0
      end,
      'average_completed_meals_per_active_user', round(ae.avg_completed, 2)
    ),
    'product_usage', jsonb_build_object(
      'recipes_created', uc2.recipes_created,
      'recipe_creators', uc2.recipe_creators,
      'inventory_items_added', uc2.inventory_items_added,
      'shopping_lists_generated', uc2.shopping_lists_generated,
      'prepared_portions_created', uc2.prepared_portions_created,
      'prepared_portions_consumed', uc2.prepared_portions_consumed
    ),
    'friction', jsonb_build_object(
      'onboarding_abandoned', fc.onboarding_abandoned,
      'users_without_meal_plan_after_onboarding', fc.users_without_meal_plan_after_onboarding,
      'meal_plan_generation_failures', fc.meal_plan_generation_failures,
      'recipe_import_started', fc.recipe_import_started,
      'recipe_import_completed', fc.recipe_import_completed,
      'recipe_import_failures', fc.recipe_import_failures,
      'recipe_import_completion_rate', case
        when fc.recipe_import_started > 0
          then round((fc.recipe_import_completed::numeric / fc.recipe_import_started::numeric) * 100, 2)
        else null
      end,
      'critical_workflow_failures', fc.critical_workflow_failures,
      'meal_photo_analysis_failures', fc.meal_photo_analysis_failures
    ),
    'funnel', jsonb_build_object(
      'registered', fn.registered,
      'onboarding_completed', fn.onboarding_completed,
      'first_meal_plan', fn.first_meal_plan,
      'first_meal_eaten', fn.first_meal_eaten
    )
  )
  into v_result
  from user_counts uc
  cross join engagement_counts ec
  cross join meal_counts mc
  cross join usage_counts uc2
  cross join friction_counts fc
  cross join funnel_counts fn
  cross join retention_day7 rd7
  cross join retention_week4 rw4
  cross join avg_eaten ae;

  return v_result;
end;
$$;

comment on function public.get_admin_analytics(timestamptz, timestamptz) is
  'Returns aggregated MVP product metrics. Caller must be an administrator. No PII is returned.';

revoke all on function public.get_admin_analytics(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_admin_analytics(timestamptz, timestamptz) to authenticated;
