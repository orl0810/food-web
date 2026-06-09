-- PantryFlow: Ready Portions + multi-item meal plan
-- Safe to run more than once.

-- Prepared portions (cooked food batches)
create table if not exists public.prepared_portions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('recipe', 'custom', 'leftover')),
  recipe_id uuid references public.recipes (id) on delete set null,
  total_portions int not null check (total_portions > 0),
  available_portions int not null check (available_portions >= 0),
  cooked_at date not null default current_date,
  expires_at date,
  storage_location text check (storage_location in ('fridge', 'freezer', 'pantry')),
  notes text,
  status text not null default 'available'
    check (status in ('available', 'finished', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prepared_portions_user_id_idx
  on public.prepared_portions (user_id);
create index if not exists prepared_portions_user_status_idx
  on public.prepared_portions (user_id, status);
create index if not exists prepared_portions_user_expires_idx
  on public.prepared_portions (user_id, expires_at);

alter table public.prepared_portions enable row level security;

drop policy if exists "Users can view own prepared portions" on public.prepared_portions;
create policy "Users can view own prepared portions"
  on public.prepared_portions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own prepared portions" on public.prepared_portions;
create policy "Users can insert own prepared portions"
  on public.prepared_portions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own prepared portions" on public.prepared_portions;
create policy "Users can update own prepared portions"
  on public.prepared_portions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own prepared portions" on public.prepared_portions;
create policy "Users can delete own prepared portions"
  on public.prepared_portions for delete
  using (auth.uid() = user_id);

-- Multi-item meal plan (replaces single-recipe meal_plan rows)
create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  item_type text not null check (item_type in ('recipe', 'prepared_portion', 'inventory_item', 'custom')),
  recipe_id uuid references public.recipes (id) on delete set null,
  prepared_portion_id uuid references public.prepared_portions (id) on delete set null,
  inventory_item_id uuid references public.food_items (id) on delete set null,
  custom_name text,
  quantity numeric,
  unit text,
  portions_used int not null default 1 check (portions_used > 0),
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists meal_plan_items_slot_idx
  on public.meal_plan_items (user_id, date, meal_type);

alter table public.meal_plan_items enable row level security;

drop policy if exists "Users can view own meal plan items" on public.meal_plan_items;
create policy "Users can view own meal plan items"
  on public.meal_plan_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal plan items" on public.meal_plan_items;
create policy "Users can insert own meal plan items"
  on public.meal_plan_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own meal plan items" on public.meal_plan_items;
create policy "Users can update own meal plan items"
  on public.meal_plan_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own meal plan items" on public.meal_plan_items;
create policy "Users can delete own meal plan items"
  on public.meal_plan_items for delete
  using (auth.uid() = user_id);

-- Migrate existing meal_plan data into meal_plan_items
insert into public.meal_plan_items (
  id, user_id, date, meal_type, item_type, recipe_id, created_at
)
select id, user_id, date, meal_type, 'recipe', recipe_id, created_at
from public.meal_plan
where recipe_id is not null
  and not exists (
    select 1 from public.meal_plan_items mpi where mpi.id = meal_plan.id
  );

-- Drop legacy table after migration
drop table if exists public.meal_plan;
