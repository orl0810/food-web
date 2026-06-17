-- Add optional 1–5 star rating on saved recipes
alter table public.recipes
  add column if not exists rating smallint
  check (rating is null or (rating >= 1 and rating <= 5));
