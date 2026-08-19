# AGENTS.md

## Cursor Cloud specific instructions

Durable, non-obvious notes for running **pythh.ai (hot-honey)** in a Cloud Agent VM. The update
script already runs `npm install` at the repo root on boot, so this section focuses on how to
run/test the app and the gotchas discovered during setup. Standard commands live in
`PYTHH_AI_CURSOR_COPILOT_HANDOFF.md` and root `package.json` scripts — prefer those; only the
caveats below are non-obvious.

### Services (dev)

| Service | Command | Port | Notes |
|---|---|---|---|
| Frontend (Vite, `site/`) | `npm run dev` | 5173 | Vite root is `site/` (see `vite.config.ts`); proxies `/api` → `http://localhost:3002`. |
| Backend (Express `server/index.js`) | `npm run dev:server` | 3002 | Must run under **tsx** (this script does). Serves REST API, `/api/instant/*`, and tRPC (`/api/trpc`). |

- `npm run build` → `dist/` (Vite prod build). `npm test` runs submit-flow + GOD-score contract tests.
- There is no separate install per subfolder for the core dev loop; the root `node_modules` powers both the Vite frontend and the tsx backend.

### Running both servers (gotcha)

- The documented `npm run dev:all` uses `npx concurrently`, which is **not** a dependency and
  prompts interactively ("Ok to proceed? (y)") on a fresh VM — this hangs non-interactive runs.
  Prefer starting `npm run dev:server` and `npm run dev` in **two separate terminals/tmux
  sessions** instead (or pre-install `concurrently` and answer the prompt once).
- Do **not** use `start-dev.sh` / `npm run start:dev` for full functionality: it launches the
  backend with **plain `node`**, so the tRPC router and most `site/` data endpoints do **not**
  mount (they return 503 stubs). Always run the backend via `npm run dev:server` (tsx).

### Environment / secrets (gotchas)

- Config is read from the **repo-root `.env`** (the server loads `../.env`), not `server/.env`.
  `.env*` is gitignored.
- **The backend will not boot without `OPENAI_API_KEY`.** `server/routes/oracle.js` constructs the
  OpenAI client at import time and the SDK throws on a falsy key, crashing the whole process. Set
  `OPENAI_API_KEY` to any non-empty value just to boot; a **real** key is only needed to score
  brand-new startups (the AI enrichment path). Submitting a startup that already exists in the DB
  returns cached scores/matches and needs no OpenAI call.
- **Supabase is a hosted dependency — there is no local Postgres.** The backend needs
  `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` to read/write data (e.g. `/api/instant/health` returns
  live investor counts when these are valid).
- **Browser auth (signup/login) needs `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`.** Without it,
  `GET /api/public-config` returns `503 config_unavailable` and the SPA's Supabase client stays
  null: the homepage renders and the "submit a startup URL" analysis still works, but account
  creation / login is disabled. Add the anon key to `.env` to enable the full logged-in flow.
- **Local session cookies:** do **not** set `APP_URL` / `APP_BASE_URL` to `https://pythh.ai` in the
  Cloud Agent `.env`. `site/_core/requestHost.ts` then forces `Domain=.pythh.ai` on
  `pythh_session`, and the browser will not store that cookie on `localhost`. Use
  `APP_URL=http://localhost:5173` (and the same for `APP_BASE_URL`) locally.
- **Email signup persistence needs `DATABASE_URL`.** `auth.login` sets the cookie even without it,
  but `upsertUser` / `auth.me` use Drizzle via `DATABASE_URL`. Without a working Postgres URI,
  `auth.me` returns null, `isAuthenticated` stays false, and `/matches?url=…` bounces back to
  `/signup/founder`.
- **Cloud Agent VMs often cannot use `db.<ref>.supabase.co` URIs.** That host is frequently
  **IPv6-only**; this environment has no working IPv6 route (`ENETUNREACH`). Do not mix the direct
  `db.*` hostname with pooler port `6543`. Copy the **Session pooler** URI from Supabase →
  Settings → Database → Connect → **Session mode** (host looks like
  `aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`). Paste that full string into
  `/workspace/.env` as `DATABASE_URL=…`, then restart `npm run dev:server`.
- The Mac laptop `.env` is **not** synced into the Cloud Agent VM (`/workspace/.env` is separate
  and gitignored). Copy secrets into the VM `.env` or Cursor Secrets when setting up a new agent.
- Provide real `SUPABASE_*`, `DATABASE_URL`, and `OPENAI_API_KEY` values for full E2E; the app
  degrades gracefully (homepage + submit analysis) with only the service key + a placeholder OpenAI key.

### Quick verification

- Backend health: `curl localhost:3002/ping` → `{ ok: true }`; `curl localhost:3002/api/instant/health`
  → live `active_investors` count (proves Supabase connectivity).
- Core action: `POST localhost:3002/api/instant/submit` with `{"url":"neon.tech"}` returns the
  startup's GOD/oracle score and ~50 ranked investor matches. In the UI (localhost:5173) the same
  submit shows "Analysis complete — Five matches ready" and routes to the signup step.

### Mac laptop: sync `main` when `git pull` fails (divergent branches)

If `npm run outcomes:report` or `funding:reconcile:historical:summary` says **Missing script**, local
`main` is behind remote. When `git pull origin main` fails with divergent branches:

```bash
cd ~/Desktop/hot-honey   # your clone path
git stash push -u -m "local wip before funding pull"
git fetch origin main
git reset --hard origin/main   # discards local commits on main; stash still has WIP
git stash pop                  # resolve conflicts manually if needed
npm run outcomes:matched       # verified + pending matched investments
npm run funding:reconcile:historical:summary
```

Use `git pull origin main --rebase` instead of `reset --hard` only if you need to keep local commits
on `main`. Funding scripts live on **`main`** (not the setup PR branch).

### Matched-investment funding workflow (DB scripts)

Resolve **which matched investors actually funded** a startup (pair-level, not startup-only press):

1. `npm run outcomes:report` — baseline counts
2. `npm run outcomes:matched` — verified pairs + pending review queue with source tiers
3. `npm run outcomes:review -- --list --limit=50` — human review of candidates
4. `npm run outcomes:review -- --apply --verify --id=<uuid>` — mark one pair verified (requires `DATABASE_URL`)
5. In SQL: `SELECT refresh_match_outcome_classifications(50000);`
6. `npm run funding:reconcile:historical:summary` — retrospective hit rate vs canonical rounds

Official positives require **`match_validation_evidence.verified=true`** and **`event_at > match.created_at`**.

### Lint

- ESLint is effectively not configured: `eslint.config.js` has no TypeScript parser and there is no
  `lint` npm script, so running ESLint over `.ts`/`.tsx` files only yields parse errors. Do not treat
  it as a gate. Type safety is exercised via the Vite build.

### Mac local dev (not Cloud VM)

- **`/workspace` does not exist on your Mac.** Cloud Agent paths are VM-only. On a MacBook the repo
  root is typically `/Users/<you>/Desktop/hot-honey` and the env file is **`<repo>/.env`** (same
  folder as `package.json`).
- **Open `.env` in TextEdit:** `npm run env:open` (or `open -e .env` from repo root). Edit with
  `nano .env` — not `nano .env.` (trailing dot opens the wrong file).
- **Mac `sed -i` needs a backup suffix:** use `sed -i '' '…' .env`, not `sed -i '…' .env` (BSD sed).
- **zsh + `node -e "…!"`:** history expansion breaks on `!` inside double quotes; use
  `npm run env:db-check` instead of inline one-liners.
- **`npm run dq:runbook` only needs `DATABASE_URL`** in root `.env` (database password URI from
  Supabase Connect → Session pooler :5432 — not the anon/service JWT). Set it with
  `npm run env:db-set`, verify with `npm run env:db-check`.
