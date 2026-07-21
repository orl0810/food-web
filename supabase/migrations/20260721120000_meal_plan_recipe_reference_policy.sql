-- Restrict meal plan recipe references to shared recipes or recipes owned by the user.

drop policy if exists "Users can insert own meal plan items" on public.meal_plan_items;
create policy "Users can insert own meal plan items"
  on public.meal_plan_items
  for insert
  with check (
    auth.uid() = user_id
    and (
      recipe_id is null
      or exists (
        select 1
        from public.recipes r
        where r.id = recipe_id
          and (r.is_base_recipe = true or r.user_id = auth.uid())
      )
    )
  );

drop policy if exists "Users can update own meal plan items" on public.meal_plan_items;
create policy "Users can update own meal plan items"
  on public.meal_plan_items
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      recipe_id is null
      or exists (
        select 1
        from public.recipes r
        where r.id = recipe_id
          and (r.is_base_recipe = true or r.user_id = auth.uid())
      )
    )
  );
