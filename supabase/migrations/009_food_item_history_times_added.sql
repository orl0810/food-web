-- Add usage count to food item history for "frequently added" sorting

alter table public.food_item_history
  add column if not exists times_added integer not null default 1;

update public.food_item_history
set times_added = 1
where times_added is null;
