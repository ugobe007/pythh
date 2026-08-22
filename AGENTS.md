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

### Product thesis gate (Hit@5)

Pythh’s claim is **not** “fit vibes” — it is: **match startups to investors who later invest**. Without sealed Hit@5 proof, the product is unproven.

**Sealed evaluation contract:**
1. `startup_investor_matches.created_at` is the prediction clock — upserts must not rewrite it (DB trigger + writers omit `created_at`). Never delete-all rematch.
2. On first durable top-5 (firm-deduped), write `funding_prediction_snapshots` via `freezeTopFiveIfAbsent` (`cohort_key=served-first-top5`, `ignoreDuplicates`) with `predicted_at = min(match.created_at)`. Backfill: `npm run funding:snapshots:backfill:served -- --apply --limit=200`.
3. Claim readiness: `npm run funding:claim-readiness -- --summary` for metrics without dumping every `confirmed_outcomes` row (full dump looks “stuck”; use without `--summary` only when you need the row list). Needs ≥100 audited hit/miss outcomes with complete participant lists and event/discovery after `predicted_at`. Startup identity for claim sets is **serve-grade** (URL↔name aligned); do not require prior funding language in the description or we only evaluate companies that already raised.
4. Participant completeness: `npm run funding:participants -- --apply` (and `--retry-failed`) marks `metadata.participant_list_complete` when an article has explicit lead/participation roster language (including `backed by` / `raises … from`) and ≥1 extracted participant. Prefer `npm run funding:participants:prediction-linked -- --apply --limit=100` to drain incomplete post-prediction events first; use `--event-ids=…` for targeted retries. Title-only rosters count when body fetch is blocked (FinSMEs Cloudflare, Google News RSS). When CF/aggregators still block, seed from non-CF primaries via `npm run funding:participants:seed-indeterminate -- --apply` (Business Wire / PR Newswire / company blogs) and reject VC-fundraise false positives. Named participants need not resolve into the investor universe for a miss to audit. Without completeness, funded outcomes stay indeterminate and cannot count as Hit@5 misses.
5. Do **not** retune GOD/fit weights until claim inventory has mature horizons; use `funding:reconcile:historical:summary` only for triage buckets (`candidate_generation_miss` vs `ranked_outside_top_five`). When `candidate_generation_miss` dominates, expand who enters the persisted match pool via `server/lib/frequentLedgerFunders.js` (force-include + top-N reserve in `instantSubmit` / `match-regenerator`; prefer true firm profiles over high-scoring partner rows) — do not retune GOD/fit first. Triage never-pre-matched **qualified firms** from `funding:audit:candidate-misses` → `topNeverPreMatched` (not unresolved `topMissing` junk). Unresolved `Firm - Publisher` / `Person’s Firm` raw names are cleaned in `resolveCanonicalEntity` via `stripInvestorHeadlineNoise` before coverage resolve (also unicode NBSP, curly apostrophes, program suffixes, legal suffixes, `Rainmatter by Zerodha`→brand while keeping `Leaps by Bayer`, geo prefixes like `India-based …`, trailing `VC`→`Venture Capital`, and country possessives on SWFs like `Singapore's GIC`→`GIC` / `Singapore's Temasek`→`Temasek`). Bare country labels stay junk; **do not delete sovereign wealth funds** tied to country names (Temasek, GIC, Mubadala, …). Coverage apply also accepts firm-safe `normalized` short aliases (`Menlo`→`Menlo Ventures`) and exact firm-preferred disambiguation (`Peak XV`, `Wing VC`); do not equate distinct org suffixes (`Circle Ventures`≠`Circle Partners`). Drain missing firms with `node scripts/canonicalize-funding-investor-organizations.mjs --apply` then `node scripts/seed-missing-funding-investor-profiles.mjs --apply`, then `npm run funding:coverage:investors:resolve:apply`. Scrub extraction junk with `npm run funding:participants:scrub -- --apply` (implausible names → role unknown). Keep expanding `frequentLedgerFunders` aliases from `topNeverPreMatched` (a16z, Susquehanna, Greenoaks, General Atlantic, Elevation, Dell, Temasek, GIC, …).

### Matched-investment funding workflow (DB scripts)

Resolve **which matched investors actually funded** a startup (pair-level, not startup-only press):

**Live loop (preferred):**
1. URL submit → matches written (clock preserved) → **freeze top-5 snapshot if absent** → **auto-enqueued** (qualified+url boosted; junk skipped; weak parked)
2. GitHub Actions every ~20m / `npm run outcomes:agent -- --apply --limit=400`:
   - `outcomes:recover-urls` — find missing/publisher websites (required for scoring + matching + search)
   - `outcomes:triage-queue` — rectify `earliest_match_at` to min(match.created_at), boost cohort, park weak, scrub Accel pollution, boost post-match ledger
   - inference search (priority>0; seeds from `funding_evidence_events` wire URLs; parks missing/publisher URLs; older clocks first)
   - `outcomes:promote-ledger` (issuer-primary → auto-verify clean hits; never sets queue clock to announce date)
3. Progress target: **5000** qualified+url startups searched/resolved — agent prints `progress.resolved_count`
4. Admin UI **Browser:** `https://pythh.ai/admin/match-outcomes` (local: `http://localhost:5173/admin/match-outcomes`)
5. Or CLI: `npm run outcomes:review -- --list` / `--apply --verify --id=<uuid>`

Prediction clock: `funding_evidence_search_queue.earliest_match_at` **must** stay `min(startup_investor_matches.created_at)`. Triage + enqueue + search sync this; promote-ledger must not overwrite it with funding announce dates.

Zero-hit batches (`results: 0` / `post_prediction_pairs: 0`) usually mean the batch drained junk “qualified” rows or polluted timestamps — run recover-urls + triage before search; prefer issuer-ledger priority (≥45000).

Matching hygiene: `EnhancedMatchingService` skips `entity_gate=junk`, raises default `minScore` to 50, and drops polluted investor firm rows (e.g. Alchemist→Accel).

**Reports:**
1. `npm run outcomes:report` — baseline counts
2. `npm run outcomes:matched` — verified pairs + pending review queue with source tiers
3. In SQL: `SELECT refresh_match_outcome_classifications(50000);`
4. `npm run funding:reconcile:historical:summary` — retrospective hit rate vs canonical rounds
5. `npm run funding:audit:candidate-misses` — why participants are `not_in_universe` / never pre-matched
6. `npm run funding:coverage:investors:resolve:apply` — link null `investor_id` rows to firm profiles (firm-vs-partner disambiguation)
7. `npm run funding:rematch:missing-participants:apply` — upsert matches for startups whose resolved funders were missing from `startup_investor_matches` (does **not** backdate `created_at`; helps live rankings + future Hit@5). Firm eligibility must not treat `type=Angel` alone as a person when `investor_type` is firm-like (VC/PE/…) — many Accel/Benchmark/etc. profiles are mis-tagged Angel.

**Candidate-generation miss pattern (common):** major firms (Accel, General Catalyst, Founders Fund) were stuck as `ambiguous`/`not_in_universe` because partner rows share `firm=` with the firm profile. Resolver now prefers the firm profile. Separately, qualified investors can still miss top-N via sector shortlist — live matching force-includes documented prior funders from the startup record; batch matching reserves historical-fit / prior-relationship candidates before the top-50 cut.

Official positives require **`match_validation_evidence.verified=true`** and **`event_at > match.created_at`**.

### Match outcomes admin UI (gotcha)

- **Browser (production):** `https://pythh.ai/admin/match-outcomes` (short `/match-outcomes` redirects there)
- **Browser (local):** `http://localhost:5173/admin/match-outcomes` with `npm run dev` + `npm run dev:server`
- Do **not** paste bare `/admin/match-outcomes` into a terminal — Node treats path-looking hosts badly (`getaddrinfo ENOTFOUND base` was Fly’s broken `DATABASE_URL` hostname `base`, not the SPA route).
- Proof API uses **Supabase service client** (not raw `DATABASE_URL`) so Fly works even if `DATABASE_URL` secret is a placeholder. Still set a real session-pooler `DATABASE_URL` for scripts/`auth.me`.
- Agent `review_url` must be absolute (`https://pythh.ai/admin/match-outcomes`).
- **Admin Matching / ML / Analytics** (`/admin/matching`, `/admin/ml`, `/admin/analytics`) also fall back to Supabase REST + `platform_stats_cache` when `DATABASE_URL` is missing or has a placeholder host (`base`). Fix Fly/Vercel `DATABASE_URL` to the real Supabase session pooler for full SQL (score buckets, exact event GROUP BYs).

API: `GET /api/admin/match-outcomes/proof`, `GET .../pending`, `POST .../review`.

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
