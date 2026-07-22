-- PantryFlow: atomic recipe cooking completion (meal status + inventory + ready portions)
-- Safe to run more than once.

create or replace function public.complete_recipe_cooking(
  p_recipe_id uuid,
  p_meal_plan_item_ids uuid[],
  p_inventory_changes jsonb default '[]'::jsonb,
  p_inventory_creates jsonb default '[]'::jsonb,
  p_ready_portion jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item_id uuid;
  v_change jsonb;
  v_create jsonb;
  v_expected numeric;
  v_remaining numeric;
  v_current numeric;
  v_name text;
  v_completed_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_meal_plan_item_ids, 1), 0) = 0 then
    raise exception 'At least one meal plan item is required';
  end if;

  foreach v_item_id in array p_meal_plan_item_ids loop
    if not exists (
      select 1
      from public.meal_plan_items mpi
      where mpi.id = v_item_id
        and mpi.user_id = v_user_id
        and mpi.status = 'planned'
    ) then
      raise exception 'One or more meals are no longer planned. Refresh and try again.';
    end if;
  end loop;

  for v_change in select * from jsonb_array_elements(coalesce(p_inventory_changes, '[]'::jsonb)) loop
    v_name := coalesce(v_change->>'name', 'item');
    v_expected := (v_change->>'expectedQuantity')::numeric;
    v_remaining := (v_change->>'remainingQuantity')::numeric;

    select fi.quantity
      into v_current
    from public.food_items fi
    where fi.id = (v_change->>'itemId')::uuid
      and fi.user_id = v_user_id
    for update;

    if not found then
      raise exception 'Inventory item not found: %', v_name;
    end if;

    if abs(v_current - v_expected) > 0.000001 then
      raise exception 'Inventory changed for %. Refresh and try again.', v_name;
    end if;

    if v_remaining <= 0 then
      delete from public.food_items
      where id = (v_change->>'itemId')::uuid
        and user_id = v_user_id;
    else
      update public.food_items
      set quantity = v_remaining
      where id = (v_change->>'itemId')::uuid
        and user_id = v_user_id;
    end if;
  end loop;

  for v_create in select * from jsonb_array_elements(coalesce(p_inventory_creates, '[]'::jsonb)) loop
    v_name := trim(coalesce(v_create->>'name', ''));
    v_remaining := (v_create->>'quantity')::numeric;

    if v_name = '' or v_remaining is null or v_remaining <= 0 then
      continue;
    end if;

    insert into public.food_items (
      user_id,
      name,
      category,
      quantity,
      unit,
      expiration_date,
      location
    ) values (
      v_user_id,
      v_name,
      null,
      v_remaining,
      nullif(trim(v_create->>'unit'), ''),
      null,
      coalesce(nullif(trim(v_create->>'location'), ''), 'pantry')::text
    );
  end loop;

  update public.meal_plan_items mpi
  set status = 'prepared',
      completed_at = v_completed_at
  where mpi.user_id = v_user_id
    and mpi.id = any (p_meal_plan_item_ids)
    and mpi.status = 'planned';

  if (
    select count(*)
    from public.meal_plan_items mpi
    where mpi.user_id = v_user_id
      and mpi.id = any (p_meal_plan_item_ids)
      and mpi.status = 'prepared'
      and mpi.completed_at = v_completed_at
  ) <> coalesce(array_length(p_meal_plan_item_ids, 1), 0) then
    raise exception 'One or more meals are no longer planned. Refresh and try again.';
  end if;

  if p_ready_portion is not null and coalesce((p_ready_portion->>'portions')::int, 0) > 0 then
    insert into public.prepared_portions (
      user_id,
      name,
      source_type,
      recipe_id,
      total_portions,
      available_portions,
      cooked_at,
      expires_at,
      storage_location,
      notes,
      status,
      updated_at
    ) values (
      v_user_id,
      coalesce(nullif(trim(p_ready_portion->>'name'), ''), 'Ready portion'),
      'recipe',
      p_recipe_id,
      (p_ready_portion->>'portions')::int,
      (p_ready_portion->>'portions')::int,
      current_date,
      nullif(p_ready_portion->>'expiresAt', '')::date,
      coalesce(nullif(trim(p_ready_portion->>'storageLocation'), ''), 'fridge'),
      null,
      'available',
      v_completed_at
    );
  end if;

  return jsonb_build_object('updatedMealPlanItemIds', to_jsonb(p_meal_plan_item_ids));
end;
$$;

grant execute on function public.complete_recipe_cooking(uuid, uuid[], jsonb, jsonb, jsonb) to authenticated;
