# PantryFlow — Agent Instructions

Instructions for Cursor Cloud Agents (including the iOS app). Human developers can use `README.md` for the same setup details.

## Read first

Before changing code, follow the rules in `.cursor/rules/`:

- `project-overview.mdc` — product goals and philosophy
- `development-workflow.mdc` — scope and quality bar
- `phase-roadmap.mdc` — what to build and what to avoid
- `angular-standards.mdc` — Angular patterns (standalone, signals, services)
- `supabase-standards.mdc` — Supabase usage rules
- `ui-ux-standards.mdc` — layout and UX expectations

When a user prompt conflicts with these rules, follow the **user prompt** but call out scope expansion.

## Default scope

Unless the user explicitly asks otherwise:

- **Prefer Phase 1 work:** auth, inventory CRUD, dashboard, expiration logic, location filters.
- **Do not add** new AI features, payments, barcode scanning, or multi-user accounts.
- The repo already contains later-phase features (recipes, meal plan, shopping list). Do not expand them unless requested.

## Architecture: dual backend

PantryFlow switches backends via `environment.useLocalApi`:

| Mode | Config file | Backend | When to use |
|------|-------------|---------|-------------|
| **Local dev** | `src/environments/environment.ts` | Express + SQLite (`local-api/`) | Default for cloud agents and local development |
| **Production** | `src/environments/environment.prod.ts` | Supabase (PostgreSQL + Auth) | Vercel builds only; do not change unless asked |

Services branch on `environment.useLocalApi` and call either `LocalApiService` or Supabase. **Never call Supabase or `fetch` directly from components** — keep data access in `src/app/core/services/`.

### Cloud agent default: local API

In cloud VMs, use the committed dev environment as-is:

- `useLocalApi: true`
- `skipLogin: true` — auto-signs in as the seeded dev user
- Local API: `http://localhost:3001`
- Angular dev server: `http://localhost:4200`

Seeded dev account (created on first API start):

- Email: `dev@local.test`
- Password: `password`

The SQLite database is created at `local-api/data/pantryflow.sqlite` (gitignored). Delete that file to reset local data.

### When to use Supabase in agent work

Use Supabase directly only when the user explicitly asks to:

- Test production auth flows
- Work on RLS policies or migrations in `supabase/migrations/`
- Debug Vercel/production-only behavior

For Supabase work, `environment.prod.ts` already contains the project URL and anon key. Do not add secret keys to the repo. Service-role keys belong in the Cursor Cloud dashboard as secrets, never in source.

### AI / Edge Functions

`AiRecipeService` and Supabase Edge Functions require network access to Supabase and may not work fully against the local API (`useLocalApi` blocks AI calls). Do not test AI features unless the user requests it and Supabase is available.

## Setup and commands

```bash
# Install dependencies (required on fresh VMs)
npm install

# Start local API + Angular (preferred for verification)
npm run dev

# Or run separately:
npm run start:api   # SQLite API on :3001
npm start           # Angular on :4200

# Unit tests (headless, non-interactive)
npm test -- --watch=false --browsers=ChromeHeadless

# Production build
npm run build
```

Build output: `dist/food-web/browser` (static SPA).

## Verification checklist

Before opening a PR, agents should:

1. Run `npm test -- --watch=false --browsers=ChromeHeadless`.
   - There is currently **1 known failing test** in `user-meal-plan-stats.utils.spec.ts` (planning streak). Do not introduce additional failures.
2. For UI changes: start `npm run dev`, confirm the app loads at `http://localhost:4200`, and exercise the affected screen.
3. For inventory/expiration changes: verify `src/app/shared/utils/expiration.utils.ts` helpers (`isExpired`, `isExpiringSoon`, `getExpirationLabel`) and reuse them instead of duplicating date logic.
4. Keep changes minimal and focused on the requested task.

## Code conventions (quick reference)

- **Angular:** standalone components, signals for state, reactive forms for forms.
- **Services:** `src/app/core/services/` — all Supabase and local API calls live here.
- **Features:** `src/app/features/{auth,dashboard,inventory,...}/`
- **Shared utils:** `src/app/shared/utils/` — expiration, units, validation helpers.
- **Models:** `src/app/core/models/` — typed interfaces, avoid `any`.
- **Styling:** Tailwind CSS 4 + SCSS; mobile-friendly cards and clear empty states.

## High-value gaps (good task targets)

These are useful, PR-sized improvements aligned with product goals:

1. **Expired filter on inventory** — dashboard shows expired counts, but inventory filters lack a dedicated "Expired" tab.
2. **Meal completion → inventory deduction** — `MealPlanProgressService.applyInventoryUsageForCompletedMeal` is stubbed (TODO).
3. **Expiration/dashboard tests** — add coverage for stat counts and edge cases (null expiration dates).
4. **Notification bell** — header placeholder has no behavior yet.

## PR expectations

- Work on a feature branch (`cursor/<descriptive-name>-c45c`).
- One focused change per PR when possible.
- Commit messages: clear, imperative mood (e.g. "Add expired filter to inventory page").
- PR description: what changed, why, and how you verified it.
- Attach a screenshot or short note of manual verification for UI changes.

## iOS / async agent tips

When started from the iOS Cursor app:

- State scope explicitly in the prompt ("Phase 1 only", or name the feature area).
- Prefer tasks that end with a test run and PR, not open-ended refactors.
- Use `npm run dev` + browser verification for UI work; local API must be running for inventory/auth flows.
- For tasks that need your Mac's exact local setup, the user should use **Remote Control** instead of a cloud VM.

## Network

Cloud agents may need outbound access to:

- `*.supabase.co` — production Supabase (if testing prod flows)
- `pub-*.r2.dev` / `cdk.orlando-photo.com` — recipe images (CDN)

Local-only work (`npm run dev` + SQLite) does not require Supabase network access.
