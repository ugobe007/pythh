# AGENTS.md

## Cursor Cloud specific instructions

Durable, non-obvious notes for running **pythh.ai (hot-honey)** in a Cloud Agent VM. The update
script already runs `npm install` at the repo root on boot, so this section focuses on how to
run/test the app and the gotchas discovered during setup. Standard commands live in
`PYTHH_AI_CURSOR_COPILOT_HANDOFF.md` and root `package.json` scripts — prefer those; only the
caveats below are non-obvious.

### Pull requests (automate — do not wait)

User preference (**2026-08-29**): **automate PRs**. For every branch with commits:

1. **Push** then **create or update** the PR the same turn (ManagePullRequest / equivalent).
2. Open PRs **ready for review** (`draft: false`) — do **not** leave them as drafts unless the
   user explicitly asks for a draft.
3. Update the PR body when ops evidence or scope changes; include artifact paths when relevant.
4. Do **not** merge unless the user explicitly asks to merge.

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

- **Node.js version:** use **Node 22 LTS** (`nvm use` reads `.nvmrc`). **Node 24+ breaks** ops scripts
  (`undici`, `@supabase/supabase-js` AuthClient load failures). If you see
  `Class extends value #<Object> is not a constructor or null` or `webidl.converters`, run
  `nvm install 22 && nvm use 22` then `rm -rf node_modules && npm install`.
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
3. Claim readiness: `npm run funding:claim-readiness -- --summary` for metrics without dumping every `confirmed_outcomes` row (full dump looks “stuck”; use without `--summary` only when you need the row list). Needs ≥100 audited hit/miss outcomes with complete participant lists and event/discovery after `predicted_at`. Startup identity for claim sets is **serve-grade** (URL↔name aligned); do not require prior funding language in the description or we only evaluate companies that already raised. Hit@5 firm identity matches on investor id, reviewed organization id, **or** cleaned firm label (same as reconcile) so duplicate firm profiles like Insight Partners / Insightpartners count as hits. For a human-readable answer to “which startups did we predict funders for who later funded?”, run `npm run funding:hit5:startup-report -- --horizon=180` (add `--with-reconcile` to attach delta-reason buckets; `--json` for machine output). Triage **pending horizon maturity** and hunt unfunded startups with untrusted-but-rostered events via `npm run funding:hit5:pending-triage -- --horizon=180 --within-days=90` (`--json` for machine output). After participant/org repairs, re-run `npm run funding:repair:organization-links:apply` so outcome-linked orgs also attach membership on prediction-side firm rows.
4. Participant completeness: `npm run funding:participants -- --apply` (and `--retry-failed`) marks `metadata.participant_list_complete` when an article has explicit lead/participation roster language (including `backed by` / `raises … from`) and ≥1 extracted participant. Prefer `npm run funding:participants:prediction-linked -- --apply --limit=100` to drain incomplete post-prediction events first; use `--event-ids=…` for targeted retries. Title-only rosters count when body fetch is blocked (FinSMEs Cloudflare, Google News RSS). When CF/aggregators still block, seed from non-CF primaries via `npm run funding:participants:seed-indeterminate -- --apply` (Business Wire / PR Newswire / company blogs) and reject VC-fundraise false positives. **Audited ingest titles must pass `classifyFundingEvidence`** (e.g. `raises $X in Series Y`); headlines like “SpaceX alum nabs $22M” stamp `verified` but stay unfunded because `trustedOutcome` rejects them. **Post-#52:** fix classifier-safe titles in `ingest-audited-funding-events.mjs` and reject junk gap events (Malwarebytes review, Thrive “set to raise”, public listings, block trades, VC roundups). Triage unfunded gaps: `npm run funding:hit5:gap-unlocks -- --json`. **Post-#47 Pulse2-complete batch:** seed rosters in `seed-indeterminate-funding-participants.mjs`, unlock trust via issuer-wire `ingest-audited-funding-events.mjs --apply`, then `corroborate-funding-evidence-rounds.mjs --apply`; reject mislinked Fortune World Cup / Werize $28M duplicate. **Post-#48 mature-unfunded batch:** unlock Titan / Traversal / Rizon / Coderabbit via seed+ingest; repair duplicate YC proof-grade snapshots via `node scripts/repair-hit5-duplicate-firm-snapshots.mjs --apply`. **Post-#49 gap-roster batch:** Kinfolk / Beycome / Novee / Claroty / Skeleton / AIRMO (use post-`predicted_at` event dates; classifier-safe audited titles). Named participants need not resolve into the investor universe for a miss to audit. Without completeness, funded outcomes stay indeterminate and cannot count as Hit@5 misses. Hit@5 / claim-readiness evaluate **round clusters** via `groupSourceOutcomesByRoundCluster` (same soft-merge as corroboration) so a complete Pulse2 roster on `unknown|$45M` merges with an incomplete typed `series-b|$45M` duplicate instead of leaving the startup indeterminate. Observed events stay unfunded until `verified`/`corroborated` or a **reviewed** trusted source (`fundingSourceTrust.js` — includes TNW / Tech.eu / **SiliconANGLE** specialist domains; never Pulse2/FinSMEs). `node scripts/corroborate-funding-evidence-rounds.mjs --apply` soft-merges `unknown` vs typed round/amount keys (amount-anchored or round-anchored) so multi-publisher copies of the same raise can corroborate. Issuer-wire unlocks for single-source stuck raises: `node scripts/ingest-audited-funding-events.mjs --apply` (**audited `source_title` must pass `classifyFundingEvidence`** — prefer “raises $X in Series Y” over “bags $X” or “invests in AI operations” headlines).
5. Do **not** retune GOD/fit weights until claim inventory has mature horizons; use `funding:reconcile:historical:summary` only for triage buckets (`candidate_generation_miss` vs `ranked_outside_top_five`). When `candidate_generation_miss` dominates, expand who enters the persisted match pool via `server/lib/frequentLedgerFunders.js` (force-include + top-N reserve in `instantSubmit` / `match-regenerator`; prefer true firm profiles over high-scoring partner rows) — do not retune GOD/fit first. Triage never-pre-matched **qualified firms** from `funding:audit:candidate-misses` → `topNeverPreMatched` (not unresolved `topMissing` junk). Unresolved `Firm - Publisher` / `Person’s Firm` raw names are cleaned in `resolveCanonicalEntity` via `stripInvestorHeadlineNoise` before coverage resolve (also unicode NBSP, curly apostrophes, program suffixes, legal suffixes including trailing `LP`, `Rainmatter by Zerodha`→brand while keeping `Leaps by Bayer`, geo prefixes like `India-based …`, trailing `VC`→`Venture Capital`, country possessives on SWFs like `Singapore's GIC`→`GIC`, `Person of Firm`→firm, `& Others` / `also participating` / `For AI-Native…` / `Firm in October 2025` roster debris, and legacy `Kleiner Perkins Caufield & Byers`→`Kleiner Perkins`). Bare country labels stay junk; **do not delete sovereign wealth funds** tied to country names (Temasek, GIC, Mubadala, …). Coverage apply also accepts firm-safe `normalized` short aliases (`Menlo`→`Menlo Ventures`) and exact firm-preferred disambiguation (`Peak XV`, `Wing VC`); do not equate distinct org suffixes (`Circle Ventures`≠`Circle Partners`). Drain missing firms with `node scripts/canonicalize-funding-investor-organizations.mjs --apply` then `node scripts/seed-missing-funding-investor-profiles.mjs --apply`, then `npm run funding:participants:seed-indeterminate -- --apply` (**before** coverage resolve — seed must paginate the full investor universe and must not overwrite already-resolved `investor_id` with null), then `npm run funding:coverage:investors:resolve:apply`, then `npm run funding:repair:organization-links:apply`. Scrub extraction junk with `npm run funding:participants:scrub -- --apply` (implausible names → role unknown). Keep expanding `frequentLedgerFunders` aliases from `topNeverPreMatched` (Advent International, Rainmatter, Jane Street, Georgian, USIT, …). Convert remaining Hit@5 indeterminates via `npm run funding:participants:seed-indeterminate -- --apply` (seed complete rosters from non-CF primaries; reject public-market equity offerings, IPO/listings, “raised alarms” lawsuits, Fortune-list PRs, and “set to raise” rumors).

### Matched-investment funding workflow (DB scripts)

Resolve **which matched investors actually funded** a startup (pair-level, not startup-only press):

**Live loop (preferred):**
1. URL submit → matches written (clock preserved) → **freeze top-5 snapshot if absent** → **auto-enqueued** (qualified+url boosted; junk skipped; weak parked)
2. **Automated drain to 5000:** `npm run outcomes:resolution-loop -- --apply --limit=100 --max-waves=50` — runs each wave separately: release stuck queue → `outcomes:agent` → rematch missing participants → (every 3 waves) seed investor profiles + indeterminate rosters + coverage resolve + org links + prediction-linked participants → (every 5 waves) audited ingest + corroborate + audit. Stops at target, `--max-waves`, or stall (no progress for `--stall-waves`). Writes `reports/resolution-loop-*.json`.
3. GitHub Actions every ~20m / `npm run outcomes:agent -- --apply --limit=400`:
   - `outcomes:recover-urls` — find missing/publisher websites (required for scoring + matching + search). Needs `DATABASE_URL`. If a recovered domain is already owned by another `startup_uploads` row (`startup_uploads_website_unique`), try the next candidate; when names match and the owner is stronger, park the orphan as junk (`parked_duplicates`). Chronic `skip_website_taken` clogs (Instagram/Venturefizz/Mattermark, dynadot for-sale, unrelated polluted owners) are parked as `junk`/`url_blocked` (`parked_website_taken`) so they stop eating every batch. After recover prints JSON, **triage + search keep running** (often 10–40+ silent minutes) — that is not a hang; wait for `[search]` / final progress. Prefer `npm run outcomes:agent -- --apply --skip-recover --limit=100` right after a recover run. **CI:** if `DATABASE_URL` is unset in Actions secrets, the agent **auto-skips recover + triage + promote** and still runs ontology search via Supabase (reviewer via `PYTHH_REVIEWER_USER_ID` or `auth.admin`). Set `DATABASE_URL` for full drain. Do **not** paste JSON output into zsh (`parse error near '}'`).
   - `outcomes:triage-queue` — rectify `earliest_match_at` to min(match.created_at), boost cohort, park weak, scrub Accel pollution, boost post-match ledger
   - inference / ontology search (priority>0; SEC Form D + NSF/SBIR + USASpending + news; seeds from `funding_evidence_events` wire URLs; parks missing/publisher URLs for news-only; older clocks first)
   - `outcomes:promote-ledger` (issuer-primary → auto-verify clean hits; never sets queue clock to announce date)
4. Progress target: **5000** qualified+url startups searched/resolved — agent prints `progress.resolved_count`
5. Admin UI **Browser:** `https://pythh.ai/admin/match-outcomes` (local: `http://localhost:5173/admin/match-outcomes`)
6. Or CLI: `npm run outcomes:review -- --list` / `--apply --verify --id=<uuid>`

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

### Production deploy (pythh.ai)

- Frontend prod is **Vercel project `pythh`** (GHA `vercel-deploy.yml` on `main`), not legacy
  `hot-money-honey`. API is **Fly** (`fly-deploy.yml`). See `docs/DEPLOY_PYTHH_AI.md` for the GHA
  success/failure PR list (#23–#50 green; #3–#22 failed workflow but shipped on cumulative #23+).
- After merge, verify: `npm run check:deploy-cache` and `npm run check:deploy-sha`. If SHA meta
  shows a feature-branch tip but tree matches `main`, the verify script accepts tree equivalence;
  dual Vercel Git + GHA deploys can cause that cosmetic drift.

### Scrapers & discovery (portfolio open book)

- **Portfolio inception:** **2025-11-25** — anything after that date is in-book for the virtual portfolio / recording window.
- **Fly API** still runs `simple-rss-scraper` every ~4h (discovered_startups + `rss_sources.last_scraped`).
- **GHA Automated Startup Discovery** (`automated-scraper.yml`) — SSOT RSS → `startup_events` every **12h** (re-enabled; was paused as closed-corpus).
- **GHA High-Volume Discovery** (`high-volume-discovery.yml`) — every **6h** → `discovered_startups` + `scraper_runs`.
- **Event resolver** daily promotes `discovered` → uploads (not uploads-only).
- Local smoke: `RSS_MAX_SOURCES=10 npm run scrape:ssot` · `npm run scrape:high-volume:smoke`
- **Signal Art Daily** may fail while Gemini prepaid credits are depleted — unrelated to discovery scrapers.

### Hit@5 roadmap & match→funding audit

- Scheduled waves and metrics interpretation: `docs/HIT5_IMPROVEMENT_ROADMAP.md`
- **Prospective proof cohort (URL submits, no signup):** `docs/PROOF_COHORT_SPEC.md` — weekly `npm run proof-cohort:report -- --since=2026-08-25`
- Repair dark instrumentation (missing seals/queues): `npm run proof-cohort:instrument:apply -- --since=2026-08-25 --limit=200`
- Drain unmatched high-GOD URL startups (match latency SLA): `npm run proof-cohort:drain-unmatched:apply -- --since=2026-08-25 --min-god=80 --limit=25`
- Mark publisher-article scrapes as junk (VentureBurn/PE Hub/…): `npm run proof-cohort:mark-publisher-junk:apply`
- **Paid funding search cascade:** Anthropic web search → OpenAI web search → inference (Google News).
  `npm run outcomes:search-funding:cascade -- --apply --limit=50 --delay=1200`
  Requires `ANTHROPIC_API_KEY` (preferred) and/or `OPENAI_API_KEY`; a missing key skips that step.
  Gemini prepaid is depleted — do not use `--provider=gemini` unless credits are restored.
  Single-provider: `npm run outcomes:search-funding:anthropic` or `:openai`. 429 / overloaded / credit errors fall through the cascade (or to inference for a single paid provider).
  Retired `claude-sonnet-4-20250514` is filtered before any request (even if `ANTHROPIC_SEARCH_MODEL` still names it). A model 404 is cached for the rest of the batch so the next job goes straight to OpenAI.
- Targeted proof-cohort search (skip junk names, sealed + GOD≥55): `npm run proof-cohort:search:cascade -- --apply --limit=25 --delay=1200`
- Instant submit investor cache **must paginate** (`getInvestors` in `server/routes/instantSubmit.js`) — PostgREST 1000-row default caused generation misses / zero-match windows.
- **Funding source ontology (match product architecture):** `docs/FUNDING_SOURCE_ONTOLOGY.md` — entities, evidence hierarchy, source map, and inference rules for capital discovery beyond a single investor database.
- One-shot audit after each ops batch: `npm run funding:match-funding-audit`
- Match→fund lag buckets (60–90d window + sealed aging): `npm run funding:match-fund-lag` / `npm run funding:match-fund-lag:cohort`

### GOD scoring (proof cohort + live weights)

**Default gate:** do **not** further retune **startup** GOD or core match fit weights until the prospective URL cohort has **≥5 startups with verified post-prediction funding pairs** (`proof-cohort:report` → `signup_evidence_met`). Diagnose cohort misses via `funding:audit:candidate-misses` before changing weights again.

**Allowed without that gate:** filling missing *investor-side data signals* (operator / successful-founder public thesis → investor GOD + stage fit via `lib/operatorFounderInvestors.js`) — that is data completeness, not retuning startup fundability weights.

**Signal-before-GOD (live):** load `pythh_signal_events` into scoring-profile features *before* `calculateHotScore` (`lib/signalInformedGod.js`, `docs/SIGNAL_INFORMED_GOD.md`).

**Signal-informed componentWeights (live, user override 2026-08-28):** team 0.22 / traction 0.30 / market 0.20 / product 0.15 / vision 0.13 in `GOD_SCORE_CONFIG` (`startupScoringService.ts`). Hit@5 remains dominated by `candidate_generation_miss` — keep expanding `frequentLedgerFunders` from never-pre-matched qualified firms.

### Ops scripts: stuck terminal / hung Wave 2 chain

- **Do not paste the full Wave 2 block into one terminal** (`promote-ledger` → `prediction-linked` →
  `seed-indeterminate` → `ingest` → `corroborate` → coverage → org-links → audit). If any step hangs,
  the shell blocks and you cannot type new commands. Run each step separately, or in tmux with logging.
- **`corroborate-funding-evidence-rounds.mjs --apply` can hang** on a stalled Supabase read/update
  (often `wait_woken`, ~0% CPU for hours). Apply batches have 45s per-update timeouts (#56), but the
  initial full-table scan has no timeout. **Unblock:** find the PID with
  `ps aux | grep corroborate-funding-evidence` and `kill <pid>` (use the numeric PID — do **not**
  `pkill -f`, which can match your own grep/monitor line).
- **`outcomes:agent` silence:** `recover-urls` (limit 150–200) can run 20–45+ minutes before
  `[search]` logs appear. Prefer `npm run outcomes:recover-urls -- --apply --limit=80` first, then
  agent with `--delay=600+`.
- **Stuck search queue rows:** `npm run outcomes:release-stuck-queue:apply` (needs main #58 — ESM
  `main()` wrapper). Check `processing` rows older than 30m.
- **False “search still running” loop:** `pgrep -f search-startup-funding-evidence.mjs` matches the
  monitor’s own bash line; grep the process list manually instead.

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
