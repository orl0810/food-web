# PantryFlow

Personal meal planner web app — Phase 1 focuses on food inventory and expiration tracking.

## Local development (SQLite)

Local dev uses a SQLite database via a small Express API. Production on Vercel uses Supabase.

### Quick start

```bash
npm install
npm run dev
```

This starts:

- **Local API** at `http://localhost:3001` (SQLite)
- **Angular app** at `http://localhost:4200`

### Seeded local account

- Email: `dev@local.test`
- Password: `password`

You can also create new accounts from the login page — they are stored only in your local SQLite file.

### Run separately

```bash
# Terminal 1 — SQLite API
npm run start:api

# Terminal 2 — Angular dev server
npm start
```

The SQLite database file is created at `local-api/data/pantryflow.sqlite` (gitignored).

## Production (Vercel + Supabase)

Production builds use `environment.prod.ts` with `useLocalApi: false`, so the app talks directly to Supabase.

Every push to `master` triggers a Vercel deployment. Configure these environment variables in the Vercel project if you move Supabase keys out of source:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

(Current builds use the values in `environment.prod.ts`.)

### Build

```bash
npm run build
```

Output: `dist/food-web/browser` (static SPA for Vercel).

## Project structure

```txt
local-api/          # Local SQLite + Express API (dev only)
src/app/
  core/services/    # Auth, inventory, Supabase, local API
  features/         # Dashboard, inventory, login
supabase/           # Production PostgreSQL migrations
```
