create table if not exists users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists food_items (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  name text not null,
  category text,
  quantity real not null default 1,
  unit text,
  expiration_date text,
  location text not null check (location in ('fridge', 'freezer', 'pantry')),
  created_at text not null default (datetime('now'))
);

create index if not exists food_items_user_id_idx on food_items (user_id);
create index if not exists food_items_expiration_date_idx on food_items (expiration_date);

create table if not exists food_item_history (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  name text not null,
  name_key text not null,
  category text,
  unit text,
  location text not null check (location in ('fridge', 'freezer', 'pantry')),
  default_quantity real not null default 1,
  last_used_at text not null default (datetime('now')),
  created_at text not null default (datetime('now')),
  times_added integer not null default 1,
  unique (user_id, name_key)
);

create index if not exists food_item_history_user_id_idx on food_item_history (user_id);
create index if not exists food_item_history_last_used_idx on food_item_history (user_id, last_used_at desc);

-- Backfill from existing inventory (most recent row per normalized name)
insert or ignore into food_item_history (
  id,
  user_id,
  name,
  name_key,
  category,
  unit,
  location,
  default_quantity,
  last_used_at,
  created_at
)
select
  fi.id,
  fi.user_id,
  fi.name,
  lower(trim(fi.name)),
  fi.category,
  fi.unit,
  fi.location,
  fi.quantity,
  fi.created_at,
  fi.created_at
from food_items fi
where fi.id = (
  select fi2.id
  from food_items fi2
  where fi2.user_id = fi.user_id
    and lower(trim(fi2.name)) = lower(trim(fi.name))
  order by fi2.created_at desc
  limit 1
);

create table if not exists recipes (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  title text not null,
  description text,
  prep_time_minutes integer,
  portions integer,
  tags text not null default '[]',
  created_at text not null default (datetime('now'))
);

create index if not exists recipes_user_id_idx on recipes (user_id);

create table if not exists recipe_ingredients (
  id text primary key,
  recipe_id text not null references recipes (id) on delete cascade,
  name text not null,
  quantity real,
  unit text
);

create index if not exists recipe_ingredients_recipe_id_idx on recipe_ingredients (recipe_id);

create table if not exists prepared_portions (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('recipe', 'custom', 'leftover')),
  recipe_id text references recipes (id) on delete set null,
  total_portions integer not null check (total_portions > 0),
  available_portions integer not null check (available_portions >= 0),
  cooked_at text not null default (date('now')),
  expires_at text,
  storage_location text check (storage_location in ('fridge', 'freezer', 'pantry')),
  notes text,
  status text not null default 'available' check (status in ('available', 'finished', 'expired')),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index if not exists prepared_portions_user_id_idx on prepared_portions (user_id);
create index if not exists prepared_portions_user_status_idx on prepared_portions (user_id, status);

create table if not exists meal_plan_items (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  date text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  item_type text not null check (item_type in ('recipe', 'prepared_portion', 'inventory_item', 'custom')),
  recipe_id text references recipes (id) on delete set null,
  prepared_portion_id text references prepared_portions (id) on delete set null,
  inventory_item_id text references food_items (id) on delete set null,
  custom_name text,
  quantity real,
  unit text,
  portions_used integer not null default 1 check (portions_used > 0),
  notes text,
  sort_order integer not null default 0,
  status text not null default 'planned' check (status in ('planned', 'prepared', 'eaten', 'skipped')),
  completed_at text,
  created_at text not null default (datetime('now'))
);

create index if not exists meal_plan_items_slot_idx on meal_plan_items (user_id, date, meal_type);

create table if not exists shopping_items (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  name text not null,
  quantity real,
  unit text,
  is_checked integer not null default 0,
  source text not null default 'manual' check (source in ('manual', 'meal_plan')),
  created_at text not null default (datetime('now'))
);

create index if not exists shopping_items_user_id_idx on shopping_items (user_id);

create table if not exists user_food_profiles (
  id text primary key,
  user_id text not null unique references users (id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  default_meals_per_day integer not null default 3 check (default_meals_per_day between 1 and 6),
  enabled_meal_slots text not null default '["breakfast","lunch","dinner"]',
  preferred_cooking_days text,
  preferred_shopping_day text,
  preferred_units text not null default 'metric' check (preferred_units in ('metric', 'imperial')),
  household_size integer not null default 2 check (household_size between 1 and 20),
  default_portions_per_recipe integer not null default 4 check (default_portions_per_recipe between 1 and 20),
  expiring_items_reminder_enabled integer not null default 1,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index if not exists user_food_profiles_user_id_idx on user_food_profiles (user_id);

create table if not exists user_dietary_preferences (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  preference text not null check (preference in (
    'none', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian',
    'high_protein', 'low_carb', 'gluten_free', 'dairy_free',
    'mediterranean', 'budget_friendly', 'quick_meals', 'meal_prep_focused'
  )),
  unique (user_id, preference)
);

create index if not exists user_dietary_preferences_user_id_idx on user_dietary_preferences (user_id);

create table if not exists user_ingredient_preferences (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  ingredient_name text not null,
  normalized_name text not null,
  category text,
  preference_type text not null check (preference_type in ('favorite', 'disliked')),
  source text not null default 'manual' check (source in ('manual', 'auto_detected')),
  usage_count integer,
  last_used_at text,
  unique (user_id, normalized_name, preference_type)
);

create index if not exists user_ingredient_preferences_user_id_idx on user_ingredient_preferences (user_id);

create table if not exists user_allergies (
  id text primary key,
  user_id text not null references users (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  severity text check (severity in ('low', 'medium', 'high')),
  notes text,
  strict_exclusion integer not null default 1,
  unique (user_id, normalized_name)
);

create index if not exists user_allergies_user_id_idx on user_allergies (user_id);

create table if not exists food_categories (
  id text primary key,
  name text not null unique,
  sort_order integer not null,
  icon text not null default '🍽️'
);

create table if not exists food_catalog_items (
  id text primary key,
  category_id text not null references food_categories (id) on delete cascade,
  name text not null,
  name_key text not null,
  icon text not null default '🍽️',
  default_unit text,
  default_location text not null check (default_location in ('fridge', 'freezer', 'pantry')),
  default_quantity real not null default 1,
  unique (category_id, name_key)
);

create index if not exists food_catalog_items_category_id_idx on food_catalog_items (category_id);

insert or ignore into food_categories (id, name, sort_order, icon) values
  ('fc-001', 'Vegetables', 1, '🥕'),
  ('fc-002', 'Fruits', 2, '🍎'),
  ('fc-003', 'Meat & Poultry', 3, '🥩'),
  ('fc-004', 'Fish & Seafood', 4, '🐟'),
  ('fc-005', 'Dairy & Eggs', 5, '🥛'),
  ('fc-006', 'Grains & Pasta', 6, '🍝'),
  ('fc-007', 'Bread & Bakery', 7, '🍞'),
  ('fc-008', 'Legumes & Beans', 8, '🫘'),
  ('fc-009', 'Canned & Jarred Goods', 9, '🫙'),
  ('fc-010', 'Frozen Food', 10, '🧊'),
  ('fc-011', 'Sauces & Condiments', 11, '🫙'),
  ('fc-012', 'Oils, Vinegars & Fats', 12, '🫒'),
  ('fc-013', 'Spices & Seasonings', 13, '🧂'),
  ('fc-014', 'Snacks', 14, '🍿'),
  ('fc-015', 'Drinks', 15, '🥤'),
  ('fc-016', 'Baking & Sweeteners', 16, '🧁'),
  ('fc-017', 'Prepared / Leftovers', 17, '🍱');

insert or ignore into food_catalog_items (id, category_id, name, name_key, icon, default_unit, default_location, default_quantity) values
  ('fci-001', 'fc-001', 'tomato', 'tomato', '🍅', 'kg', 'fridge', 1),
  ('fci-002', 'fc-001', 'onion', 'onion', '🧅', 'kg', 'fridge', 1),
  ('fci-003', 'fc-001', 'garlic', 'garlic', '🧄', 'pcs', 'fridge', 1),
  ('fci-004', 'fc-001', 'carrot', 'carrot', '🥕', 'kg', 'fridge', 1),
  ('fci-005', 'fc-001', 'mushrooms', 'mushrooms', '🍄', 'kg', 'fridge', 1),
  ('fci-006', 'fc-001', 'lettuce', 'lettuce', '🥬', 'pcs', 'fridge', 1),
  ('fci-007', 'fc-002', 'banana', 'banana', '🍌', 'pcs', 'fridge', 1),
  ('fci-008', 'fc-002', 'apple', 'apple', '🍎', 'pcs', 'fridge', 1),
  ('fci-009', 'fc-002', 'lemon', 'lemon', '🍋', 'pcs', 'fridge', 1),
  ('fci-010', 'fc-002', 'avocado', 'avocado', '🥑', 'pcs', 'fridge', 1),
  ('fci-011', 'fc-002', 'berries', 'berries', '🫐', 'kg', 'fridge', 1),
  ('fci-012', 'fc-003', 'chicken breast', 'chicken breast', '🍗', 'kg', 'fridge', 1),
  ('fci-013', 'fc-003', 'beef', 'beef', '🥩', 'kg', 'fridge', 1),
  ('fci-014', 'fc-003', 'pork', 'pork', '🥩', 'kg', 'fridge', 1),
  ('fci-015', 'fc-003', 'turkey', 'turkey', '🦃', 'kg', 'fridge', 1),
  ('fci-016', 'fc-004', 'tuna', 'tuna', '🐟', 'kg', 'fridge', 1),
  ('fci-017', 'fc-004', 'salmon', 'salmon', '🐟', 'kg', 'fridge', 1),
  ('fci-018', 'fc-004', 'shrimp', 'shrimp', '🦐', 'kg', 'fridge', 1),
  ('fci-019', 'fc-004', 'cod', 'cod', '🐟', 'kg', 'fridge', 1),
  ('fci-020', 'fc-005', 'milk', 'milk', '🥛', 'L', 'fridge', 1),
  ('fci-021', 'fc-005', 'cheese', 'cheese', '🧀', 'kg', 'fridge', 1),
  ('fci-022', 'fc-005', 'yogurt', 'yogurt', '🥛', 'pcs', 'fridge', 1),
  ('fci-023', 'fc-005', 'butter', 'butter', '🧈', 'pcs', 'fridge', 1),
  ('fci-024', 'fc-005', 'eggs', 'eggs', '🥚', 'pcs', 'fridge', 1),
  ('fci-025', 'fc-006', 'rice', 'rice', '🍚', 'kg', 'pantry', 1),
  ('fci-026', 'fc-006', 'pasta', 'pasta', '🍝', 'kg', 'pantry', 1),
  ('fci-027', 'fc-006', 'couscous', 'couscous', '🌾', 'kg', 'pantry', 1),
  ('fci-028', 'fc-006', 'quinoa', 'quinoa', '🌾', 'kg', 'pantry', 1),
  ('fci-029', 'fc-006', 'oats', 'oats', '🥣', 'kg', 'pantry', 1),
  ('fci-030', 'fc-007', 'bread', 'bread', '🍞', 'pcs', 'pantry', 1),
  ('fci-031', 'fc-007', 'wraps', 'wraps', '🌯', 'pcs', 'pantry', 1),
  ('fci-032', 'fc-007', 'pita', 'pita', '🫓', 'pcs', 'pantry', 1),
  ('fci-033', 'fc-007', 'tortillas', 'tortillas', '🌯', 'pcs', 'pantry', 1),
  ('fci-034', 'fc-008', 'lentils', 'lentils', '🫘', 'kg', 'pantry', 1),
  ('fci-035', 'fc-008', 'chickpeas', 'chickpeas', '🫘', 'kg', 'pantry', 1),
  ('fci-036', 'fc-008', 'black beans', 'black beans', '🫘', 'kg', 'pantry', 1),
  ('fci-037', 'fc-008', 'peas', 'peas', '🫛', 'kg', 'pantry', 1),
  ('fci-038', 'fc-009', 'canned tuna', 'canned tuna', '🐟', 'pcs', 'pantry', 1),
  ('fci-039', 'fc-009', 'tomato sauce', 'tomato sauce', '🍅', 'pcs', 'pantry', 1),
  ('fci-040', 'fc-009', 'canned beans', 'canned beans', '🫘', 'pcs', 'pantry', 1),
  ('fci-041', 'fc-009', 'olives', 'olives', '🫒', 'pcs', 'pantry', 1),
  ('fci-042', 'fc-010', 'frozen vegetables', 'frozen vegetables', '🥦', 'kg', 'freezer', 1),
  ('fci-043', 'fc-010', 'frozen chicken', 'frozen chicken', '🍗', 'kg', 'freezer', 1),
  ('fci-044', 'fc-010', 'frozen fish', 'frozen fish', '🐟', 'kg', 'freezer', 1),
  ('fci-045', 'fc-010', 'frozen meals', 'frozen meals', '🍱', 'pcs', 'freezer', 1),
  ('fci-046', 'fc-011', 'ketchup', 'ketchup', '🍅', 'pcs', 'fridge', 1),
  ('fci-047', 'fc-011', 'mayo', 'mayo', '🫙', 'pcs', 'fridge', 1),
  ('fci-048', 'fc-011', 'soy sauce', 'soy sauce', '🫙', 'pcs', 'fridge', 1),
  ('fci-049', 'fc-011', 'mustard', 'mustard', '🫙', 'pcs', 'fridge', 1),
  ('fci-050', 'fc-011', 'pesto', 'pesto', '🫙', 'pcs', 'fridge', 1),
  ('fci-051', 'fc-012', 'olive oil', 'olive oil', '🫒', 'L', 'pantry', 1),
  ('fci-052', 'fc-012', 'sunflower oil', 'sunflower oil', '🫒', 'L', 'pantry', 1),
  ('fci-053', 'fc-012', 'vinegar', 'vinegar', '🫙', 'L', 'pantry', 1),
  ('fci-054', 'fc-012', 'cooking spray', 'cooking spray', '🫒', 'pcs', 'pantry', 1),
  ('fci-055', 'fc-013', 'salt', 'salt', '🧂', 'pcs', 'pantry', 1),
  ('fci-056', 'fc-013', 'pepper', 'pepper', '🌶️', 'pcs', 'pantry', 1),
  ('fci-057', 'fc-013', 'paprika', 'paprika', '🌶️', 'pcs', 'pantry', 1),
  ('fci-058', 'fc-013', 'oregano', 'oregano', '🌿', 'pcs', 'pantry', 1),
  ('fci-059', 'fc-013', 'curry', 'curry', '🍛', 'pcs', 'pantry', 1),
  ('fci-060', 'fc-014', 'nuts', 'nuts', '🥜', 'kg', 'pantry', 1),
  ('fci-061', 'fc-014', 'chips', 'chips', '🍟', 'pcs', 'pantry', 1),
  ('fci-062', 'fc-014', 'crackers', 'crackers', '🍘', 'pcs', 'pantry', 1),
  ('fci-063', 'fc-014', 'protein bars', 'protein bars', '🍫', 'pcs', 'pantry', 1),
  ('fci-064', 'fc-015', 'water', 'water', '💧', 'L', 'pantry', 1),
  ('fci-065', 'fc-015', 'juice', 'juice', '🧃', 'L', 'fridge', 1),
  ('fci-066', 'fc-015', 'soda', 'soda', '🥤', 'L', 'fridge', 1),
  ('fci-067', 'fc-015', 'coffee', 'coffee', '☕', 'pcs', 'pantry', 1),
  ('fci-068', 'fc-015', 'tea', 'tea', '🍵', 'pcs', 'pantry', 1),
  ('fci-069', 'fc-016', 'flour', 'flour', '🌾', 'kg', 'pantry', 1),
  ('fci-070', 'fc-016', 'sugar', 'sugar', '🍬', 'kg', 'pantry', 1),
  ('fci-071', 'fc-016', 'honey', 'honey', '🍯', 'pcs', 'pantry', 1),
  ('fci-072', 'fc-016', 'baking powder', 'baking powder', '🧁', 'pcs', 'pantry', 1),
  ('fci-073', 'fc-016', 'chocolate', 'chocolate', '🍫', 'pcs', 'pantry', 1),
  ('fci-074', 'fc-017', 'cooked chicken', 'cooked chicken', '🍗', 'kg', 'fridge', 1),
  ('fci-075', 'fc-017', 'cooked rice', 'cooked rice', '🍚', 'kg', 'fridge', 1),
  ('fci-076', 'fc-017', 'soup', 'soup', '🍲', 'pcs', 'fridge', 1),
  ('fci-077', 'fc-017', 'meal prep portions', 'meal prep portions', '🍱', 'pcs', 'fridge', 1);
