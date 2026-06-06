# Supabase setup

PantryFlow uses Supabase for auth and data storage. Production (Vercel) talks to Supabase directly (`useLocalApi: false`).

## Initial setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy your project URL and anon key into `src/environments/environment.ts` and `environment.prod.ts`.
3. In **Authentication → Providers**, enable the **Email** provider with email + password sign-in.
4. Optional: disable email confirmation in **Authentication → Providers → Email** for faster local testing.

Never commit real Supabase keys to a public repository.

## Migrations

Run migrations **in order** in the Supabase SQL Editor, or link the project and push with the Supabase CLI:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

| File | Phase | Purpose |
|------|-------|---------|
| `001_food_items.sql` | 1 | Food inventory table + RLS |
| `002_food_item_history.sql` | 1 | Form suggestion history |
| `003_food_categories_catalog.sql` | 1 | Global category catalog |
| `004_recipes.sql` | 2 | Recipes + recipe ingredients + RLS |
| `005_meal_plan.sql` | 3 | Weekly meal plan + RLS |
| `006_repair_recipe_fks.sql` | 2/3 | Repair missing FKs for PostgREST embeds |

### Production requirements

The deployed app needs at least migrations **001–004** for inventory and recipes, and **005** for the meal plan page.

Recipes load with a nested PostgREST select (`ingredients:recipe_ingredients(*)`). That requires a foreign key from `recipe_ingredients.recipe_id` to `recipes.id`. If you see error **PGRST200**, run `006_repair_recipe_fks.sql`.

### Verify schema

```sql
-- Tables should exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('recipes', 'recipe_ingredients', 'meal_plan');

-- FKs required for nested selects
select con.conname, conrelid::regclass as from_table, confrelid::regclass as to_table
from pg_constraint con
where con.contype = 'f'
  and con.connamespace = 'public'::regnamespace
  and (
    (con.conrelid = 'public.recipe_ingredients'::regclass and con.confrelid = 'public.recipes'::regclass)
    or (con.conrelid = 'public.meal_plan'::regclass and con.confrelid = 'public.recipes'::regclass)
  );
```

After applying migrations, reload the PostgREST schema cache:

```sql
notify pgrst, 'reload schema';
```

`006_repair_recipe_fks.sql` includes this notify automatically.
