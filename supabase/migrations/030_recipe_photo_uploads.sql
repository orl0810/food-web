-- User-uploaded recipe photos in the existing recipe-images bucket.

drop policy if exists "Users can upload own recipe photos" on storage.objects;
create policy "Users can upload own recipe photos"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (storage.foldername(name))[3] = 'uploads'
  );

drop policy if exists "Users can update own recipe photos" on storage.objects;
create policy "Users can update own recipe photos"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (storage.foldername(name))[3] = 'uploads'
  );

drop policy if exists "Users can delete own recipe photos" on storage.objects;
create policy "Users can delete own recipe photos"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
    and (storage.foldername(name))[3] = 'uploads'
  );
