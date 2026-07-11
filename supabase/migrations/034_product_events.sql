-- PantryFlow: low-volume product milestone events (failures and non-derivable actions)
-- Safe to run more than once.

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_events_event_name_check check (
    event_name in (
      'ai_recipe_generation_started',
      'ai_recipe_generation_completed',
      'ai_recipe_generation_failed',
      'shopping_list_generation_failed',
      'barcode_lookup_failed',
      'critical_workflow_failed'
    )
  ),
  constraint product_events_properties_size_check check (pg_column_size(properties) <= 2048)
);

comment on table public.product_events is
  'Low-volume product events for milestones and failures that cannot be inferred from domain tables.';

create index if not exists product_events_event_name_created_at_idx
  on public.product_events (event_name, created_at desc);

create index if not exists product_events_user_id_created_at_idx
  on public.product_events (user_id, created_at desc);

alter table public.product_events enable row level security;

drop policy if exists "Authenticated users can insert their own product events" on public.product_events;
create policy "Authenticated users can insert their own product events"
  on public.product_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No select/update/delete policies: users cannot read cross-user event data from the client.
revoke all on public.product_events from public, anon;
grant insert on public.product_events to authenticated;
