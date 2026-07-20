alter table public.user_food_profiles
drop constraint if exists user_food_profiles_preferred_language_check;

alter table public.user_food_profiles
drop column if exists preferred_language;
