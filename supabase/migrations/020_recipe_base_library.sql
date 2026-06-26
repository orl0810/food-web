-- PantryFlow: base recipe library (starter templates on recipes table)

alter table public.recipes
  add column if not exists is_base_recipe boolean not null default false,
  add column if not exists base_recipe_id uuid references public.recipes (id) on delete set null,
  add column if not exists meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  add column if not exists category text,
  add column if not exists difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  add column if not exists cook_time_minutes int,
  add column if not exists instructions text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

-- Allow null user_id for base recipes
alter table public.recipes alter column user_id drop not null;

alter table public.recipes drop constraint if exists recipes_ownership_check;
alter table public.recipes add constraint recipes_ownership_check check (
  (is_base_recipe = true and user_id is null)
  or (is_base_recipe = false and user_id is not null)
);

create index if not exists recipes_is_base_recipe_idx on public.recipes (is_base_recipe);
create index if not exists recipes_meal_type_idx on public.recipes (meal_type) where meal_type is not null;
create index if not exists recipes_category_idx on public.recipes (category) where category is not null;
create index if not exists recipes_base_recipe_id_idx on public.recipes (base_recipe_id) where base_recipe_id is not null;

-- Recipes RLS: read base templates + own recipes; write own non-base only
drop policy if exists "Users can view own recipes" on public.recipes;
create policy "Users can view own recipes"
  on public.recipes
  for select
  using (is_base_recipe = true or auth.uid() = user_id);

drop policy if exists "Users can insert own recipes" on public.recipes;
create policy "Users can insert own recipes"
  on public.recipes
  for insert
  with check (auth.uid() = user_id and is_base_recipe = false);

drop policy if exists "Users can update own recipes" on public.recipes;
create policy "Users can update own recipes"
  on public.recipes
  for update
  using (auth.uid() = user_id and is_base_recipe = false)
  with check (auth.uid() = user_id and is_base_recipe = false);

drop policy if exists "Users can delete own recipes" on public.recipes;
create policy "Users can delete own recipes"
  on public.recipes
  for delete
  using (auth.uid() = user_id and is_base_recipe = false);

-- Recipe ingredients RLS: read base template ingredients + own; write own non-base only
drop policy if exists "Users can view ingredients of own recipes" on public.recipe_ingredients;
create policy "Users can view ingredients of own recipes"
  on public.recipe_ingredients
  for select
  using (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and (r.is_base_recipe = true or r.user_id = auth.uid())
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
        and r.is_base_recipe = false
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
        and r.is_base_recipe = false
    )
  )
  with check (
    exists (
      select 1
      from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
        and r.is_base_recipe = false
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
        and r.is_base_recipe = false
    )
  );
