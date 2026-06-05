-- PantryFlow: persistent food item history for form suggestions

create table public.food_item_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  name_key text not null,
  category text,
  unit text,
  location text not null check (location in ('fridge', 'freezer', 'pantry')),
  default_quantity numeric not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, name_key)
);

create index food_item_history_user_id_idx on public.food_item_history (user_id);
create index food_item_history_last_used_idx on public.food_item_history (user_id, last_used_at desc);

alter table public.food_item_history enable row level security;

create policy "Users can view own food item history"
  on public.food_item_history
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own food item history"
  on public.food_item_history
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own food item history"
  on public.food_item_history
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own food item history"
  on public.food_item_history
  for delete
  using (auth.uid() = user_id);

-- Backfill from existing inventory (most recent row per normalized name)
insert into public.food_item_history (
  user_id,
  name,
  name_key,
  category,
  unit,
  location,
  default_quantity,
  last_used_at,
  created_at
)
select distinct on (fi.user_id, lower(trim(fi.name)))
  fi.user_id,
  fi.name,
  lower(trim(fi.name)),
  fi.category,
  fi.unit,
  fi.location,
  fi.quantity,
  fi.created_at,
  fi.created_at
from public.food_items fi
order by fi.user_id, lower(trim(fi.name)), fi.created_at desc
on conflict (user_id, name_key) do nothing;
