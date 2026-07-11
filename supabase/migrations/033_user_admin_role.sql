-- PantryFlow: administrator role on user_food_profiles
-- Safe to run more than once.

alter table public.user_food_profiles
  add column if not exists role text not null default 'user'
    check (role in ('user', 'admin'));

comment on column public.user_food_profiles.role is
  'Application role. Only change via SQL editor or service_role; clients cannot self-escalate.';

-- Security-sensitive: blocks authenticated PostgREST users from changing their own role.
create or replace function public.prevent_user_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() = 'authenticated' then
    raise exception 'Role changes are not allowed through the client';
  end if;
  return new;
end;
$$;

drop trigger if exists user_food_profiles_prevent_role_change on public.user_food_profiles;
create trigger user_food_profiles_prevent_role_change
  before update on public.user_food_profiles
  for each row
  execute function public.prevent_user_role_self_escalation();

-- Security-sensitive: used by admin RPC to verify caller is an administrator.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_food_profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Returns true when the current JWT user has role=admin in user_food_profiles.';

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
