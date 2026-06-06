-- PantryFlow: repair missing FK between recipe_ingredients and recipes
-- Safe to run more than once. Run after 004_recipes.sql if PostgREST returns PGRST200.
--
-- Verify orphans before adding the constraint (should return 0 rows):
--   select ri.*
--   from public.recipe_ingredients ri
--   where not exists (
--     select 1 from public.recipes r where r.id = ri.recipe_id
--   );

delete from public.recipe_ingredients ri
where not exists (
  select 1
  from public.recipes r
  where r.id = ri.recipe_id
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipe_ingredients_recipe_id_fkey'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.recipe_ingredients
      add constraint recipe_ingredients_recipe_id_fkey
      foreign key (recipe_id) references public.recipes (id) on delete cascade;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'meal_plan'
  )
  and not exists (
    select 1
    from pg_constraint
    where conname = 'meal_plan_recipe_id_fkey'
      and connamespace = 'public'::regnamespace
  ) then
    alter table public.meal_plan
      add constraint meal_plan_recipe_id_fkey
      foreign key (recipe_id) references public.recipes (id) on delete set null;
  end if;
end $$;

notify pgrst, 'reload schema';
