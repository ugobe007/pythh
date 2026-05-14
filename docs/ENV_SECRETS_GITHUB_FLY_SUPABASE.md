# Environment variables: GitHub Actions, Fly.io, and Supabase

Use this checklist when rotating keys, moving projects, or onboarding. Values come from your Supabase project (Dashboard → Settings → API / Database), your Fly app, and local `.env`.

---

## Local development (`.env`)

See repo root `.env.example` for the full template. Highlights:

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Browser / Vite app → Supabase |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Node scripts and server → Supabase (service role bypasses RLS) |
| `OPENAI_API_KEY`, `VITE_OPENAI_API_KEY` | AI features |
| `DATABASE_URL` | Direct Postgres (optional): `npm run dq:runbook`, `psql`, tools using `server/db.js` |
| `DATABASE_SSL` | Optional. `dq:runbook` rewrites Supabase URLs to `sslmode=no-verify` for Node `pg` unless `DATABASE_SSL=false`. See `.env.example`. |

**Postgres URL:** use the full URI from Supabase (Settings → Database), with the password between `:` and `@`. `?sslmode=require` in the URI is fine locally; the runbook adjusts it for `pg` when connecting to `*.supabase.co` / `supabase.com`.

---

## GitHub (Repository → Settings → Secrets and variables → Actions)

Workflows under `.github/workflows/` read these names.

### Required for deploy (`fly-deploy.yml`)

| Secret | Notes |
|--------|--------|
| `FLY_API_TOKEN` | Fly deploy |
| `SUPABASE_URL` **or** `VITE_SUPABASE_URL` | Vite build in CI |
| `SUPABASE_ANON_KEY` **or** `VITE_SUPABASE_ANON_KEY` | Publishable anon key; inlined at build time |

### Used by automation / scripts

| Secret | Notes |
|--------|--------|
| `SUPABASE_SERVICE_KEY` **or** `SUPABASE_SERVICE_ROLE_KEY` | Admin API access for workflows (`enrich-vcs`, `god-golden`, `god-score-health-check`, `automated-scraper`, `cleanup`, `god-score-monitor`, …) |
| `OPENAI_API_KEY` | `god-score-recalculation`, `automated-scraper` |

### Naming inconsistency

Some workflows only reference `SUPABASE_URL` / `SUPABASE_ANON_KEY` (no `VITE_` fallback), e.g. `god-score-monitor`, `god-score-recalculation`, `automated-scraper`. Easiest approach: define **both** `SUPABASE_*` and `VITE_*` with the same values, or standardize names and update workflows.

**Not used in GitHub today:** `DATABASE_URL` / `DATABASE_SSL` unless you add a workflow that runs `dq:runbook` or direct SQL against Postgres.

---

## Fly.io (`fly secrets set` and `fly.toml`)

### In `fly.toml` `[env]` and Docker build args

Public Supabase **project URL** and **anon (publishable) key** are set for the image/runtime defaults. If you rotate the anon key or change projects, update:

- `fly.toml` (`[env]` and `[build.args]`)
- `Dockerfile` stage-2 `RUNTIME_SUPABASE_*` defaults (if you keep them)

Or move URL + anon key to **Fly secrets** only and drop hardcoded defaults for stricter hygiene.

### Prefer secrets (sensitive)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_KEY` | Service role for server routes that need RLS bypass (`fly.toml` comment) |

### Other production secrets (set as needed)

The Express server (`server/index.js`) and routes may require:

- `OPENAI_API_KEY` / `VITE_OPENAI_API_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`, `STRIPE_PORTAL_RETURN_URL`
- Email: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SECRET`
- Admin: `ADMIN_KEY`, `ADMIN_SECRET_KEY`, `ADMIN_SESSION_SECRET`
- Links: `APP_BASE_URL`, `APP_URL`, `SITE_URL`
- `MCP_API_KEY_SECRET` (if MCP keys are used)
- `SAM_GOV_API_KEY` (if grants source is used)
- `LOG_LEVEL` (optional; see `docs/DEPLOY.md`)

### Direct Postgres on Fly

| Variable | When |
|----------|------|
| `DATABASE_URL` | Only if runtime code uses `server/db.js` / direct `pg` against Supabase Postgres |
| `DATABASE_SSL=true` | If Node `pg` hits `SELF_SIGNED_CERT_IN_CHAIN` with Supabase pooler (see `server/db.js`) |

The main app path is Supabase over HTTPS with URL + keys, not necessarily `DATABASE_URL`.

---

## Supabase (Dashboard)

There is no single “env file” for the hosted project. You maintain the **project** and **keys**:

| Location | What to update |
|----------|----------------|
| **Settings → API** | Project URL, `anon` key, `service_role` key (when rotating) |
| **Settings → Database** | Database password, connection string / pooler URI |
| **Authentication → URL configuration** | Site URL, redirect URLs if domains change |
| **SQL Editor / CLI migrations** | Schema (`supabase/migrations/*`) — applied to the database, not shipped inside the Fly image |

After rotating **service_role** or **anon**:

1. Update **Fly secrets** / `fly.toml` as appropriate.
2. Update **GitHub Actions** secrets.
3. Redeploy so the Vite build and CI jobs pick up new values.

---

## Related docs

- `docs/DEPLOY.md` — Fly deploy, migrations, `LOG_LEVEL`
- `.env.example` — local variable list and `DATABASE_URL` / `DATABASE_SSL` notes for `dq:runbook`
