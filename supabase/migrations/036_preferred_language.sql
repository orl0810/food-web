-- Add preferred language to user food profiles for i18n persistence
alter table public.user_food_profiles
  add column if not exists preferred_language text not null default 'en';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_food_profiles_preferred_language_check'
  ) then
    alter table public.user_food_profiles
      add constraint user_food_profiles_preferred_language_check
      check (preferred_language in ('en', 'es'));
  end if;
end $$;
