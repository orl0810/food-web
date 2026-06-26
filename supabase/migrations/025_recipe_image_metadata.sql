-- PantryFlow: recipe image metadata for Cloudflare R2 storage

alter table public.recipes
  add column if not exists image_status text not null default 'pending',
  add column if not exists image_prompt text,
  add column if not exists image_provider text,
  add column if not exists image_version integer not null default 1,
  add column if not exists image_generated_at timestamptz,
  add column if not exists image_error text,
  add column if not exists image_storage_provider text default 'cloudflare_r2',
  add column if not exists image_storage_key text;

alter table public.recipes
  drop constraint if exists recipes_image_status_check;

alter table public.recipes
  add constraint recipes_image_status_check
  check (image_status in ('pending', 'generating', 'completed', 'failed'));

update public.recipes
set image_status = 'completed'
where image_url is not null
  and trim(image_url) <> '';
