-- Soozi: Daily meal completion streak summary
-- Safe to run more than once.

create table if not exists public.user_meal_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_completed_date date,
  streak_rule text not null default 'at_least_one_meal_completed'
    check (streak_rule in ('at_least_one_meal_completed', 'all_planned_meals_completed')),
  updated_at timestamptz not null default now()
);

create index if not exists user_meal_streaks_user_id_idx
  on public.user_meal_streaks (user_id);

alter table public.user_meal_streaks enable row level security;

drop policy if exists "Users can view own meal streak" on public.user_meal_streaks;
create policy "Users can view own meal streak"
  on public.user_meal_streaks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal streak" on public.user_meal_streaks;
create policy "Users can insert own meal streak"
  on public.user_meal_streaks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own meal streak" on public.user_meal_streaks;
create policy "Users can update own meal streak"
  on public.user_meal_streaks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
