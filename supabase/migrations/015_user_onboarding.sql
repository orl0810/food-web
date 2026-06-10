-- PantryFlow: onboarding status and draft state on user_food_profiles

alter table public.user_food_profiles
  add column if not exists onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending', 'in_progress', 'completed', 'skipped')),
  add column if not exists onboarding_current_step text,
  add column if not exists onboarding_goals jsonb not null default '[]'::jsonb,
  add column if not exists onboarding_cooking_effort text,
  add column if not exists onboarding_planning_days int,
  add column if not exists onboarding_draft_state jsonb,
  add column if not exists onboarding_first_smart_action jsonb,
  add column if not exists onboarding_completed_at timestamptz;
