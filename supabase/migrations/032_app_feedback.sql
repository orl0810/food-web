-- Soozi: In-app user feedback (rating + comment)
-- Safe to run more than once.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  app_context text,
  created_at timestamptz not null default now()
);

create index if not exists app_feedback_user_id_idx
  on public.app_feedback (user_id);

create index if not exists app_feedback_created_at_idx
  on public.app_feedback (created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists "Users can view own feedback" on public.app_feedback;
create policy "Users can view own feedback"
  on public.app_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own feedback" on public.app_feedback;
create policy "Users can insert own feedback"
  on public.app_feedback for insert
  with check (auth.uid() = user_id);
