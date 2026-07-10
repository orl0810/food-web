-- Barcode product catalog, private user products, preferences, and immutable meal snapshots.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  barcode text not null check (barcode ~ '^[0-9]{6,14}$'),
  name text not null check (length(trim(name)) between 1 and 200),
  brand text, image_url text,
  package_quantity numeric check (package_quantity is null or package_quantity > 0), package_unit text,
  serving_quantity numeric check (serving_quantity is null or serving_quantity > 0), serving_unit text,
  serving_grams numeric check (serving_grams is null or serving_grams > 0),
  calories_per_100g numeric, protein_per_100g numeric, carbohydrates_per_100g numeric,
  fat_per_100g numeric, sugar_per_100g numeric, fiber_per_100g numeric, sodium_mg_per_100g numeric,
  ingredients text, allergens text[], nutrition_grade text,
  source text not null check (source in ('open_food_facts','user_created')),
  source_product_id text, verification_status text not null default 'unverified'
    check (verification_status in ('unverified','provider','verified')),
  data_completeness numeric check (data_completeness between 0 and 1),
  provider_payload jsonb, last_verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((source = 'user_created' and owner_id is not null) or (source <> 'user_created' and owner_id is null))
);
create unique index if not exists products_shared_barcode_uidx on public.products(barcode) where owner_id is null;
create unique index if not exists products_owner_barcode_uidx on public.products(owner_id, barcode) where owner_id is not null;
create index if not exists products_owner_idx on public.products(owner_id) where owner_id is not null;
alter table public.products enable row level security;
drop policy if exists "Read shared and own products" on public.products;
create policy "Read shared and own products" on public.products for select to authenticated
  using (owner_id is null or owner_id = (select auth.uid()));
drop policy if exists "Create own manual products" on public.products;
create policy "Create own manual products" on public.products for insert to authenticated
  with check (owner_id = (select auth.uid()) and source = 'user_created');
drop policy if exists "Update own manual products" on public.products;
create policy "Update own manual products" on public.products for update to authenticated
  using (owner_id = (select auth.uid()) and source = 'user_created')
  with check (owner_id = (select auth.uid()) and source = 'user_created');

create table if not exists public.user_product_preferences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  default_serving_quantity numeric, default_serving_unit text, default_serving_grams numeric,
  default_meal_slot text check (default_meal_slot is null or default_meal_slot in ('breakfast','lunch','dinner','snack')),
  times_used integer not null default 0 check (times_used >= 0), last_used_at timestamptz,
  is_favorite boolean not null default false, custom_name text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);
create index if not exists user_product_preferences_user_idx on public.user_product_preferences(user_id);
alter table public.user_product_preferences enable row level security;
drop policy if exists "Manage own product preferences" on public.user_product_preferences;
create policy "Manage own product preferences" on public.user_product_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.meal_plan_items add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.meal_plan_items add column if not exists grams_consumed numeric;
alter table public.meal_plan_items add column if not exists servings numeric;
alter table public.meal_plan_items add column if not exists calories_snapshot numeric;
alter table public.meal_plan_items add column if not exists protein_snapshot numeric;
alter table public.meal_plan_items add column if not exists carbohydrates_snapshot numeric;
alter table public.meal_plan_items add column if not exists fat_snapshot numeric;
alter table public.meal_plan_items add column if not exists sugar_snapshot numeric;
alter table public.meal_plan_items add column if not exists fiber_snapshot numeric;
alter table public.meal_plan_items add column if not exists sodium_mg_snapshot numeric;
alter table public.meal_plan_items add column if not exists product_name_snapshot text;
alter table public.meal_plan_items add column if not exists brand_snapshot text;
alter table public.meal_plan_items add column if not exists product_image_url_snapshot text;
alter table public.meal_plan_items drop constraint if exists meal_plan_items_item_type_check;
alter table public.meal_plan_items add constraint meal_plan_items_item_type_check
  check (item_type in ('recipe','prepared_portion','inventory_item','custom','product'));
create index if not exists meal_plan_items_product_idx on public.meal_plan_items(product_id) where product_id is not null;
grant select, insert, update on public.products to authenticated;
grant select, insert, update, delete on public.user_product_preferences to authenticated;
