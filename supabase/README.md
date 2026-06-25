# Supabase setup

PantryFlow uses Supabase for auth and data storage. Production (Vercel) talks to Supabase directly (`useLocalApi: false`).

## Initial setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy your project URL and anon key into `src/environments/environment.ts` and `environment.prod.ts`.
3. In **Authentication → Providers**, enable the **Email** provider with:
   - Magic link / OTP sign-in
   - Email + password sign-in
4. In **Authentication → URL Configuration**, set:
   - **Site URL**: your production Vercel URL
   - **Redirect URLs** (add all that apply):
     - `http://localhost:4200/auth/callback`
     - `http://localhost:4200/auth/reset-password`
     - `https://food-web-orlando-0810.vercel.app/auth/callback`
     - `https://food-web-orlando-0810.vercel.app/auth/reset-password`
5. Optional: disable email confirmation in **Authentication → Providers → Email** for faster local testing.

Never commit real Supabase keys to a public repository.

## Production auth URLs (verified)

For the deployed app at `https://food-web-orlando-0810.vercel.app`, confirm these values in the Supabase Dashboard under **Authentication → URL Configuration**:

| Setting | Value |
|---------|-------|
| Site URL | `https://food-web-orlando-0810.vercel.app` |
| Redirect URL | `https://food-web-orlando-0810.vercel.app/auth/callback` |
| Redirect URL | `https://food-web-orlando-0810.vercel.app/auth/reset-password` |

`environment.prod.ts` sets `authSiteUrl` to the production domain so magic-link and password-reset emails always redirect correctly.

Auth logs should show `referer: https://food-web-orlando-0810.vercel.app` on sign-in requests. If redirects fail, add the URLs above and redeploy.

## Custom SMTP (recommended for production)

Supabase's built-in email provider has strict rate limits (~2–4 emails/hour on the free tier). Magic-link login can hit `429 email rate limit exceeded` when users resend links.

To avoid this:

1. Open **Authentication → Email** in the Supabase Dashboard.
2. Enable **Custom SMTP** (e.g. [Resend](https://resend.com), SendGrid, or Amazon SES).
3. Use a verified sender domain (e.g. `noreply@yourdomain.com`).
4. Test with a magic-link sign-in after saving.

Password sign-in (`signInWithPassword`) does not send email and is unaffected by email rate limits. The production login page defaults to password sign-in for this reason.

## Auth redirect URLs

The Angular app sends users back to `/auth/callback` after magic-link sign-in and to `/auth/reset-password` after a password-reset email. Configure `authSiteUrl` in environment files (`http://localhost:4200` for dev). Production can leave `authSiteUrl` empty to use `window.location.origin` at runtime, or set it explicitly in `environment.prod.ts`.

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
| `005_meal_plan.sql` | 3 | Legacy weekly meal plan (replaced by 012) |
| `006_repair_recipe_fks.sql` | 2/3 | Repair missing FKs for PostgREST embeds |
| `007_shopping_items.sql` | 4 | Shopping list + RLS |
| `008_normalize_recipe_tags.sql` | 2 | Recipe tag normalization |
| `009_food_item_history_times_added.sql` | 1 | History usage counter |
| `010_normalize_food_item_names.sql` | 1 | Inventory name normalization |
| `011_food_icons.sql` | 1 | Catalog icon columns |
| `012_prepared_portions_and_meal_plan_items.sql` | 3 | Prepared portions, meal plan items; drops legacy `meal_plan` |
| `013_meal_plan_item_status.sql` | 3 | Meal plan item completion status |
| `014_user_food_profile.sql` | 1 | User food profile + preferences + allergies + RLS |
| `015_user_onboarding.sql` | 1 | Onboarding columns on `user_food_profiles` |

### Production requirements

The deployed app needs migrations **001–015** applied in order for the full feature set:

- **001–004**: inventory and recipes
- **007**: shopping list
- **012–013**: meal plan and prepared portions
- **014–015**: user profile and onboarding

Recipes load with a nested PostgREST select (`ingredients:recipe_ingredients(*)`). That requires a foreign key from `recipe_ingredients.recipe_id` to `recipes.id`. If you see error **PGRST200**, run `006_repair_recipe_fks.sql`.

### Row Level Security (RLS)

All user-owned tables enforce `auth.uid() = user_id` for SELECT, INSERT, UPDATE, and DELETE:

- `food_items`, `food_item_history`, `recipes`, `shopping_items`
- `prepared_portions`, `meal_plan_items`
- `user_food_profiles`, `user_dietary_preferences`, `user_ingredient_preferences`, `user_allergies`

`recipe_ingredients` is scoped through parent recipe ownership. Global catalog tables (`food_categories`, `food_catalog_items`) are read-only for authenticated users.

Every table with a `user_id` column references `auth.users(id)` with `ON DELETE CASCADE`.

### Verify schema

```sql
-- Tables should exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'recipes', 'recipe_ingredients', 'meal_plan_items', 'prepared_portions',
    'shopping_items', 'user_food_profiles'
  );

-- FKs required for nested selects
select con.conname, conrelid::regclass as from_table, confrelid::regclass as to_table
from pg_constraint con
where con.contype = 'f'
  and con.connamespace = 'public'::regnamespace
  and (
    (con.conrelid = 'public.recipe_ingredients'::regclass and con.confrelid = 'public.recipes'::regclass)
    or (con.conrelid = 'public.meal_plan_items'::regclass and con.confrelid = 'public.recipes'::regclass)
  );
```

After applying migrations, reload the PostgREST schema cache:

```sql
notify pgrst, 'reload schema';
```

`006_repair_recipe_fks.sql` includes this notify automatically.

## Edge functions (AI recipe generation)

Onboarding and recipe suggestions use the `generate-ai-recipes` edge function, which calls OpenAI.

1. Set secrets in your Supabase project:

```bash
supabase secrets set OPENAI_API_KEY=your_openai_api_key
```

Optional: override the model (defaults to `gpt-4o-mini`):

```bash
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

2. Deploy the function:

```bash
supabase functions deploy generate-ai-recipes
```

3. Production (`useLocalApi: false`) requires this function and `OPENAI_API_KEY` for onboarding plan generation. Local dev (`useLocalApi: true`) uses a preference-aware mock generator instead.
