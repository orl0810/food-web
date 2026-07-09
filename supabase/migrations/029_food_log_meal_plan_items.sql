-- Food log fields on meal plan items (quick "what I ate" entries).

alter table public.meal_plan_items
  add column if not exists source text check (source is null or source in ('manual', 'voice', 'photo')),
  add column if not exists image_url text,
  add column if not exists transcript text;

-- Public Supabase Storage bucket for user food log photos.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-log-photos',
  'food-log-photos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read food log photos" on storage.objects;
create policy "Public read food log photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'food-log-photos');

drop policy if exists "Users can upload own food log photos" on storage.objects;
create policy "Users can upload own food log photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'food-log-photos'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users can update own food log photos" on storage.objects;
create policy "Users can update own food log photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'food-log-photos'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Users can delete own food log photos" on storage.objects;
create policy "Users can delete own food log photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'food-log-photos'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
