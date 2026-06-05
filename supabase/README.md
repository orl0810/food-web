# Supabase setup (Phase 1)

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy your project URL and anon key into `src/environments/environment.ts`.
3. Run the SQL in `supabase/migrations/001_food_items.sql` in the Supabase SQL Editor.
4. In **Authentication → Providers**, enable the **Email** provider with email + password sign-in.
5. Optional: disable email confirmation in **Authentication → Providers → Email** for faster local testing.

Never commit real Supabase keys to a public repository.
