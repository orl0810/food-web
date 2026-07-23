-- Soozi Phase 4: shopping list with RLS
-- Run this in the Supabase SQL Editor. Safe to run more than once.

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  is_checked boolean not null default false,
  source text not null default 'manual'
    check (source in ('manual', 'meal_plan')),
  created_at timestamptz not null default now()
);

create index if not exists shopping_items_user_id_idx on public.shopping_items (user_id);

alter table public.shopping_items enable row level security;

drop policy if exists "Users can view own shopping items" on public.shopping_items;
create policy "Users can view own shopping items"
  on public.shopping_items
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own shopping items" on public.shopping_items;
create policy "Users can insert own shopping items"
  on public.shopping_items
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own shopping items" on public.shopping_items;
create policy "Users can update own shopping items"
  on public.shopping_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own shopping items" on public.shopping_items;
create policy "Users can delete own shopping items"
  on public.shopping_items
  for delete
  using (auth.uid() = user_id);
