-- PantryFlow: global food categories and catalog items for form suggestions

create table public.food_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null
);

create table public.food_catalog_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.food_categories (id) on delete cascade,
  name text not null,
  name_key text not null,
  default_unit text,
  default_location text not null check (default_location in ('fridge', 'freezer', 'pantry')),
  default_quantity numeric not null default 1,
  unique (category_id, name_key)
);

create index food_catalog_items_category_id_idx on public.food_catalog_items (category_id);

alter table public.food_categories enable row level security;
alter table public.food_catalog_items enable row level security;

create policy "Authenticated users can view food categories"
  on public.food_categories
  for select
  to authenticated
  using (true);

create policy "Authenticated users can view food catalog items"
  on public.food_catalog_items
  for select
  to authenticated
  using (true);

insert into public.food_categories (name, sort_order) values
  ('Vegetables', 1),
  ('Fruits', 2),
  ('Meat & Poultry', 3),
  ('Fish & Seafood', 4),
  ('Dairy & Eggs', 5),
  ('Grains & Pasta', 6),
  ('Bread & Bakery', 7),
  ('Legumes & Beans', 8),
  ('Canned & Jarred Goods', 9),
  ('Frozen Food', 10),
  ('Sauces & Condiments', 11),
  ('Oils, Vinegars & Fats', 12),
  ('Spices & Seasonings', 13),
  ('Snacks', 14),
  ('Drinks', 15),
  ('Baking & Sweeteners', 16),
  ('Prepared / Leftovers', 17);

insert into public.food_catalog_items (category_id, name, name_key, default_unit, default_location, default_quantity)
select c.id, v.name, lower(trim(v.name)), v.default_unit, v.default_location, 1
from public.food_categories c
cross join (values
  ('Vegetables', 'tomato', 'kg', 'fridge'),
  ('Vegetables', 'onion', 'kg', 'fridge'),
  ('Vegetables', 'garlic', 'pcs', 'fridge'),
  ('Vegetables', 'carrot', 'kg', 'fridge'),
  ('Vegetables', 'mushrooms', 'kg', 'fridge'),
  ('Vegetables', 'lettuce', 'pcs', 'fridge'),
  ('Fruits', 'banana', 'pcs', 'fridge'),
  ('Fruits', 'apple', 'pcs', 'fridge'),
  ('Fruits', 'lemon', 'pcs', 'fridge'),
  ('Fruits', 'avocado', 'pcs', 'fridge'),
  ('Fruits', 'berries', 'kg', 'fridge'),
  ('Meat & Poultry', 'chicken breast', 'kg', 'fridge'),
  ('Meat & Poultry', 'beef', 'kg', 'fridge'),
  ('Meat & Poultry', 'pork', 'kg', 'fridge'),
  ('Meat & Poultry', 'turkey', 'kg', 'fridge'),
  ('Fish & Seafood', 'tuna', 'kg', 'fridge'),
  ('Fish & Seafood', 'salmon', 'kg', 'fridge'),
  ('Fish & Seafood', 'shrimp', 'kg', 'fridge'),
  ('Fish & Seafood', 'cod', 'kg', 'fridge'),
  ('Dairy & Eggs', 'milk', 'L', 'fridge'),
  ('Dairy & Eggs', 'cheese', 'kg', 'fridge'),
  ('Dairy & Eggs', 'yogurt', 'pcs', 'fridge'),
  ('Dairy & Eggs', 'butter', 'pcs', 'fridge'),
  ('Dairy & Eggs', 'eggs', 'pcs', 'fridge'),
  ('Grains & Pasta', 'rice', 'kg', 'pantry'),
  ('Grains & Pasta', 'pasta', 'kg', 'pantry'),
  ('Grains & Pasta', 'couscous', 'kg', 'pantry'),
  ('Grains & Pasta', 'quinoa', 'kg', 'pantry'),
  ('Grains & Pasta', 'oats', 'kg', 'pantry'),
  ('Bread & Bakery', 'bread', 'pcs', 'pantry'),
  ('Bread & Bakery', 'wraps', 'pcs', 'pantry'),
  ('Bread & Bakery', 'pita', 'pcs', 'pantry'),
  ('Bread & Bakery', 'tortillas', 'pcs', 'pantry'),
  ('Legumes & Beans', 'lentils', 'kg', 'pantry'),
  ('Legumes & Beans', 'chickpeas', 'kg', 'pantry'),
  ('Legumes & Beans', 'black beans', 'kg', 'pantry'),
  ('Legumes & Beans', 'peas', 'kg', 'pantry'),
  ('Canned & Jarred Goods', 'canned tuna', 'pcs', 'pantry'),
  ('Canned & Jarred Goods', 'tomato sauce', 'pcs', 'pantry'),
  ('Canned & Jarred Goods', 'canned beans', 'pcs', 'pantry'),
  ('Canned & Jarred Goods', 'olives', 'pcs', 'pantry'),
  ('Frozen Food', 'frozen vegetables', 'kg', 'freezer'),
  ('Frozen Food', 'frozen chicken', 'kg', 'freezer'),
  ('Frozen Food', 'frozen fish', 'kg', 'freezer'),
  ('Frozen Food', 'frozen meals', 'pcs', 'freezer'),
  ('Sauces & Condiments', 'ketchup', 'pcs', 'fridge'),
  ('Sauces & Condiments', 'mayo', 'pcs', 'fridge'),
  ('Sauces & Condiments', 'soy sauce', 'pcs', 'fridge'),
  ('Sauces & Condiments', 'mustard', 'pcs', 'fridge'),
  ('Sauces & Condiments', 'pesto', 'pcs', 'fridge'),
  ('Oils, Vinegars & Fats', 'olive oil', 'L', 'pantry'),
  ('Oils, Vinegars & Fats', 'sunflower oil', 'L', 'pantry'),
  ('Oils, Vinegars & Fats', 'vinegar', 'L', 'pantry'),
  ('Oils, Vinegars & Fats', 'cooking spray', 'pcs', 'pantry'),
  ('Spices & Seasonings', 'salt', 'pcs', 'pantry'),
  ('Spices & Seasonings', 'pepper', 'pcs', 'pantry'),
  ('Spices & Seasonings', 'paprika', 'pcs', 'pantry'),
  ('Spices & Seasonings', 'oregano', 'pcs', 'pantry'),
  ('Spices & Seasonings', 'curry', 'pcs', 'pantry'),
  ('Snacks', 'nuts', 'kg', 'pantry'),
  ('Snacks', 'chips', 'pcs', 'pantry'),
  ('Snacks', 'crackers', 'pcs', 'pantry'),
  ('Snacks', 'protein bars', 'pcs', 'pantry'),
  ('Drinks', 'water', 'L', 'pantry'),
  ('Drinks', 'juice', 'L', 'fridge'),
  ('Drinks', 'soda', 'L', 'fridge'),
  ('Drinks', 'coffee', 'pcs', 'pantry'),
  ('Drinks', 'tea', 'pcs', 'pantry'),
  ('Baking & Sweeteners', 'flour', 'kg', 'pantry'),
  ('Baking & Sweeteners', 'sugar', 'kg', 'pantry'),
  ('Baking & Sweeteners', 'honey', 'pcs', 'pantry'),
  ('Baking & Sweeteners', 'baking powder', 'pcs', 'pantry'),
  ('Baking & Sweeteners', 'chocolate', 'pcs', 'pantry'),
  ('Prepared / Leftovers', 'cooked chicken', 'kg', 'fridge'),
  ('Prepared / Leftovers', 'cooked rice', 'kg', 'fridge'),
  ('Prepared / Leftovers', 'soup', 'pcs', 'fridge'),
  ('Prepared / Leftovers', 'meal prep portions', 'pcs', 'fridge')
) as v(category_name, name, default_unit, default_location)
where c.name = v.category_name;
