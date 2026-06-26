-- Per-portion nutrition estimates for recipes (calculated once at creation).

alter table public.recipes
  add column if not exists nutrition_calories numeric,
  add column if not exists nutrition_fat_g numeric,
  add column if not exists nutrition_cholesterol_mg numeric,
  add column if not exists nutrition_protein_g numeric,
  add column if not exists nutrition_sugar_g numeric,
  add column if not exists nutrition_sodium_mg numeric,
  add column if not exists nutrition_carbs_g numeric,
  add column if not exists nutrition_fiber_g numeric,
  add column if not exists nutrition_calculated_at timestamptz;
