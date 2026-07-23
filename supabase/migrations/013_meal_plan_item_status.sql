-- Soozi: meal plan item lifecycle status (planned/prepared/eaten/skipped)
-- Safe to run more than once.

alter table public.meal_plan_items
  add column if not exists status text not null default 'planned'
    check (status in ('planned', 'prepared', 'eaten', 'skipped'));

alter table public.meal_plan_items
  add column if not exists completed_at timestamptz;
