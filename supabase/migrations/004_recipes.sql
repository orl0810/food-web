-- Soozi Phase 2: recipes + recipe ingredients with RLS
-- Run this in the Supabase SQL Editor. Safe to run more than once.

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  prep_time_minutes int,
  portions int,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text
);

create index if not exists recipes_user_id_idx on public.recipes (user_id);
create index if not exists recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Recipes: users can only access their own rows
drop policy if exists "Users can view own recipes" on public.recipes;
create policy "Users can view own recipes"
  on public.recipes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own recipes" on public.recipes;
create policy "Users can insert own recipes"
  on public.recipes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own recipes" on public.recipes;
create policy "Users can update own recipes"
  on public.recipes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recipes" on public.recipes;
create policy "Users can delete own recipes"
  on public.recipes
  for delete
  using (auth.uid() = user_id);

-- Recipe ingredients: access is gated by ownership of the parent recipe
drop policy if exists "Users can view ingredients of own recipes" on public.recipe_ingredients;
create policy "Users can view ingredients of own recipes"
  on public.recipe_ingredients
  for select
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert ingredients for own recipes" on public.recipe_ingredients;
create policy "Users can insert ingredients for own recipes"
  on public.recipe_ingredients
  for insert
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update ingredients of own recipes" on public.recipe_ingredients;
create policy "Users can update ingredients of own recipes"
  on public.recipe_ingredients
  for update
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete ingredients of own recipes" on public.recipe_ingredients;
create policy "Users can delete ingredients of own recipes"
  on public.recipe_ingredients
  for delete
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );
