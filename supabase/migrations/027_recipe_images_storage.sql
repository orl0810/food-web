-- Public Supabase Storage bucket for generated recipe images.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read recipe images" on storage.objects;
create policy "Public read recipe images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'recipe-images');
