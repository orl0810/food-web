-- PantryFlow Phase 1: food inventory table with RLS
-- Run this in the Supabase SQL Editor

create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text,
  quantity numeric not null default 1,
  unit text,
  expiration_date date,
  location text not null check (location in ('fridge', 'freezer', 'pantry')),
  created_at timestamptz not null default now()
);

create index food_items_user_id_idx on public.food_items (user_id);
create index food_items_expiration_date_idx on public.food_items (expiration_date);

alter table public.food_items enable row level security;

create policy "Users can view own food items"
  on public.food_items
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own food items"
  on public.food_items
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own food items"
  on public.food_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own food items"
  on public.food_items
  for delete
  using (auth.uid() = user_id);
