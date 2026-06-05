# Supabase setup (Phase 1)

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Copy your project URL and anon key into `src/environments/environment.ts`.
3. Run the SQL in `supabase/migrations/001_food_items.sql` in the Supabase SQL Editor.
4. In **Authentication → URL Configuration**, add:
   - Site URL: `http://localhost:4200`
   - Redirect URLs: `http://localhost:4200/auth/callback`
5. Enable the **Email** provider for magic link sign-in.

Never commit real Supabase keys to a public repository.
