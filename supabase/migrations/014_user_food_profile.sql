-- Soozi: User Food Profile (preferences, allergies, settings)
-- Safe to run more than once.

create table if not exists public.user_food_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  default_meals_per_day int not null default 3 check (default_meals_per_day between 1 and 6),
  enabled_meal_slots jsonb not null default '["breakfast","lunch","dinner"]'::jsonb,
  preferred_cooking_days jsonb,
  preferred_shopping_day text,
  preferred_units text not null default 'metric' check (preferred_units in ('metric', 'imperial')),
  household_size int not null default 2 check (household_size between 1 and 20),
  default_portions_per_recipe int not null default 4 check (default_portions_per_recipe between 1 and 20),
  expiring_items_reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_food_profiles_user_id_idx
  on public.user_food_profiles (user_id);

alter table public.user_food_profiles enable row level security;

drop policy if exists "Users can view own food profile" on public.user_food_profiles;
create policy "Users can view own food profile"
  on public.user_food_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own food profile" on public.user_food_profiles;
create policy "Users can insert own food profile"
  on public.user_food_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own food profile" on public.user_food_profiles;
create policy "Users can update own food profile"
  on public.user_food_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own food profile" on public.user_food_profiles;
create policy "Users can delete own food profile"
  on public.user_food_profiles for delete
  using (auth.uid() = user_id);

create table if not exists public.user_dietary_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  preference text not null check (preference in (
    'none', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian',
    'high_protein', 'low_carb', 'gluten_free', 'dairy_free',
    'mediterranean', 'budget_friendly', 'quick_meals', 'meal_prep_focused'
  )),
  unique (user_id, preference)
);

create index if not exists user_dietary_preferences_user_id_idx
  on public.user_dietary_preferences (user_id);

alter table public.user_dietary_preferences enable row level security;

drop policy if exists "Users can view own dietary preferences" on public.user_dietary_preferences;
create policy "Users can view own dietary preferences"
  on public.user_dietary_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own dietary preferences" on public.user_dietary_preferences;
create policy "Users can insert own dietary preferences"
  on public.user_dietary_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own dietary preferences" on public.user_dietary_preferences;
create policy "Users can update own dietary preferences"
  on public.user_dietary_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own dietary preferences" on public.user_dietary_preferences;
create policy "Users can delete own dietary preferences"
  on public.user_dietary_preferences for delete
  using (auth.uid() = user_id);

create table if not exists public.user_ingredient_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_name text not null,
  normalized_name text not null,
  category text,
  preference_type text not null check (preference_type in ('favorite', 'disliked')),
  source text not null default 'manual' check (source in ('manual', 'auto_detected')),
  usage_count integer,
  last_used_at timestamptz,
  unique (user_id, normalized_name, preference_type)
);

create index if not exists user_ingredient_preferences_user_id_idx
  on public.user_ingredient_preferences (user_id);

alter table public.user_ingredient_preferences enable row level security;

drop policy if exists "Users can view own ingredient preferences" on public.user_ingredient_preferences;
create policy "Users can view own ingredient preferences"
  on public.user_ingredient_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own ingredient preferences" on public.user_ingredient_preferences;
create policy "Users can insert own ingredient preferences"
  on public.user_ingredient_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own ingredient preferences" on public.user_ingredient_preferences;
create policy "Users can update own ingredient preferences"
  on public.user_ingredient_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own ingredient preferences" on public.user_ingredient_preferences;
create policy "Users can delete own ingredient preferences"
  on public.user_ingredient_preferences for delete
  using (auth.uid() = user_id);

create table if not exists public.user_allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  severity text check (severity in ('low', 'medium', 'high')),
  notes text,
  strict_exclusion boolean not null default true,
  unique (user_id, normalized_name)
);

create index if not exists user_allergies_user_id_idx
  on public.user_allergies (user_id);

alter table public.user_allergies enable row level security;

drop policy if exists "Users can view own allergies" on public.user_allergies;
create policy "Users can view own allergies"
  on public.user_allergies for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own allergies" on public.user_allergies;
create policy "Users can insert own allergies"
  on public.user_allergies for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own allergies" on public.user_allergies;
create policy "Users can update own allergies"
  on public.user_allergies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own allergies" on public.user_allergies;
create policy "Users can delete own allergies"
  on public.user_allergies for delete
  using (auth.uid() = user_id);
