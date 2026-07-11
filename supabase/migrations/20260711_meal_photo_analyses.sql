-- Temporary meal photo analysis records and private storage for AI vision pipeline.

create table if not exists public.meal_photo_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  status text not null default 'uploaded',
  provider text,
  model text,
  raw_result jsonb,
  normalized_draft jsonb,
  confirmed_payload jsonb,
  overall_confidence numeric,
  error_code text,
  error_message text,
  latency_ms integer,
  image_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint meal_photo_analyses_status_check check (
    status in ('uploaded', 'processing', 'draft_ready', 'confirmed', 'failed', 'expired')
  )
);

create index if not exists meal_photo_analyses_user_id_idx
  on public.meal_photo_analyses (user_id);

create index if not exists meal_photo_analyses_status_idx
  on public.meal_photo_analyses (status);

create index if not exists meal_photo_analyses_created_at_idx
  on public.meal_photo_analyses (created_at desc);

create index if not exists meal_photo_analyses_expires_at_idx
  on public.meal_photo_analyses (expires_at);

alter table public.meal_photo_analyses enable row level security;

drop policy if exists "Users can view own meal photo analyses" on public.meal_photo_analyses;
create policy "Users can view own meal photo analyses"
  on public.meal_photo_analyses
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own meal photo analyses" on public.meal_photo_analyses;
create policy "Users can insert own meal photo analyses"
  on public.meal_photo_analyses
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own meal photo analyses" on public.meal_photo_analyses;
create policy "Users can update own meal photo analyses"
  on public.meal_photo_analyses
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own meal photo analyses" on public.meal_photo_analyses;
create policy "Users can delete own meal photo analyses"
  on public.meal_photo_analyses
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Private bucket for temporary analysis images (no public access).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-analysis-images',
  'meal-analysis-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own meal analysis images" on storage.objects;
create policy "Users can upload own meal analysis images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'meal-analysis-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read own meal analysis images" on storage.objects;
create policy "Users can read own meal analysis images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'meal-analysis-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own meal analysis images" on storage.objects;
create policy "Users can delete own meal analysis images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'meal-analysis-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
