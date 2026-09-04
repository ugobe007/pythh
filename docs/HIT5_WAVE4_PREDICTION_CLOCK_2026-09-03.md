# Hit@5 Wave 4 — prediction-clock triage — 2026-09-03

Continues the OpenAI search drain after PRs #112–#115. This pass does **not**
ingest the Wave 3 “real-looking hits”: every one announced **on or before**
`predicted_at`, so they cannot grow sealed Hit@5.

## Do not ingest (pre-prediction)

| Startup | Predicted at (UTC) | Public announce | Why skipped |
|---------|--------------------|-----------------|-------------|
| Atorie | 2026-08-28 04:13 | TechCrunch 2026-08-27 17:00 | Event before seal |
| Curaa | 2026-08-26 18:55 | ET 2026-08-26 09:34 | Same-day, before seal |
| Lupin Dental | 2026-08-29 15:25 | Articles 2026-08-28 | Event before seal |
| Eisen | 2026-08-29 14:13 | Business Wire 2026-05-19 | Months before seal |
| Transfyr | 2026-08-29 15:46 | Issuer / FinSMEs **2026-08-26** | Pulse2 `announced_at` 08-30 is scrape lag, not the round |

Mintlify Series B (2026-04-17) is also before its 2026-07-04 seal.

`funding:ingest:audited` now prints `predicted_at` + `post_prediction` per row
so a pre-prediction title cannot be applied by accident.

## Queue (this VM, 2026-09-03)

| Bucket | Count |
|--------|------:|
| High-priority pending | **1** (`Senior` / VentureFizz job URL — junk) |
| Complete + `result_count=0`, priority ≥ 55k | **3,045** |
| Requeueable under 7-day hold | **0** |
| Parked pending | 9,878 |

`--requeue-priority-empty` correctly stays quiet: last search is inside the
7-day complete-status hold from #112. Do not force-reopen.

## Script hardening

- `lib/loadFundingLibs.mjs` loads CJS helpers via `createRequire` first (the
  Mac `canonicalRoundKey is not a function` failure mode). Ingest, promote,
  claim-readiness, corroborate, seed-indeterminate, and gap-unlocks use it.
- Need **Node 22** (`nvm use`). Node 24 still breaks `@supabase/supabase-js`.
- If `git pull` reports a truncated packfile, stay in a **fresh clone**. Do
  not run ops from the corrupt tree.

## Park public-company leftovers before the next paid wave

Wave 3 still searched Tim Hortons, PagerDuty, Malwarebytes, Miss Universe,
SPIR-V, GLSL, Brent Kovar, Gavin Potenza. They remain `entity_gate=qualified`
at priority 55k–99k. `--skip-junk-names` now uses the name gate + an exact
denylist + VentureFizz/Mattermark hosts.

```bash
# Park complete + pending junk (no OpenAI/Gemini calls)
npm run outcomes:search-funding -- --park-complete-junk --apply --limit=1

# After the 7-day hold (or on a real OPENAI_API_KEY), drain — do not requeue
npm run outcomes:search-funding:openai -- --apply --limit=50 --delay=1200
```

Promote-ledger still needs `DATABASE_URL`. This Cloud Agent key is a
placeholder — paid search was not run here.

See `docs/HIT5_OPENAI_SEARCH_CONTINUE_2026-09-03.md`, `docs/HIT5_IMPROVEMENT_ROADMAP.md`.
