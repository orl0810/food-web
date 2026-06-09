-- Normalize existing inventory and history names to title case.
-- Merge food_item_history rows that collide after normalization.

update public.food_items
set name = initcap(lower(trim(name)))
where name is not null
  and name <> initcap(lower(trim(name)));

update public.food_item_history
set
  name = initcap(lower(trim(name))),
  name_key = lower(trim(initcap(lower(trim(name)))))
where name is not null;

with ranked as (
  select
    id,
    sum(times_added) over (partition by user_id, name_key) as total_times,
    row_number() over (
      partition by user_id, name_key
      order by last_used_at desc, created_at desc
    ) as rn
  from public.food_item_history
)
update public.food_item_history h
set times_added = r.total_times
from ranked r
where h.id = r.id
  and r.rn = 1;

delete from public.food_item_history
where id in (
  select id
  from (
    select
      id,
      row_number() over (
        partition by user_id, name_key
        order by last_used_at desc, created_at desc
      ) as rn
    from public.food_item_history
  ) duplicates
  where rn > 1
);
