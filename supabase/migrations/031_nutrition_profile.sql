-- PantryFlow: Nutrition profile fields on user_food_profiles
-- Safe to run more than once.

alter table public.user_food_profiles
  add column if not exists weight_kg numeric,
  add column if not exists height_cm numeric,
  add column if not exists age integer check (age is null or (age between 13 and 120)),
  add column if not exists sex text check (sex is null or sex in ('male', 'female')),
  add column if not exists activity_level text check (
    activity_level is null or activity_level in (
      'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'athlete'
    )
  ),
  add column if not exists nutrition_goal text check (
    nutrition_goal is null or nutrition_goal in (
      'maintain', 'fat_loss', 'muscle_gain', 'general_health'
    )
  );
