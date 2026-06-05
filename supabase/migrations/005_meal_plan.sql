-- PantryFlow Phase 3: weekly meal plan with RLS
-- Run this in the Supabase SQL Editor. Safe to run more than once.

create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references public.recipes (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, date, meal_type)
);

create index if not exists meal_plan_user_id_idx on public.meal_plan (user_id);
create index if not exists meal_plan_user_date_idx on public.meal_plan (user_id, date);

alter table public.meal_plan enable row level security;

drop policy if exists "Users can view own meal plan entries" on public.meal_plan;
create policy "Users can view own meal plan entries"
  on public.meal_plan
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal plan entries" on public.meal_plan;
create policy "Users can insert own meal plan entries"
  on public.meal_plan
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own meal plan entries" on public.meal_plan;
create policy "Users can update own meal plan entries"
  on public.meal_plan
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own meal plan entries" on public.meal_plan;
create policy "Users can delete own meal plan entries"
  on public.meal_plan
  for delete
  using (auth.uid() = user_id);
