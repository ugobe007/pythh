# Historical match validation (matched investors → verified funding)

Answers: **After Pythh predicted startup × investor, did a funding event occur?**

This is separate from:
- **`funding_outcomes`** — startup-level press ML (no investor pair)
- **`pythh_fundraising_outcomes`** — in-app outreach funnel

## Core tables

| Table | Role |
|-------|------|
| `startup_investor_matches` | Prediction. **`created_at`** = match timestamp |
| `match_validation_evidence` | Pair-level proof. **`event_at`** must be **>** `match.created_at` |
| `match_outcome_classifications` | Per-match label: `verified_funding`, `unresolved`, `censored`, `no_observed_funding` |
| `funding_evidence_search_queue` | Startups queued for Gemini web search |
| `startup_events` | RSS `FUNDING` events (input to correlate script / SQL RPC) |
| `investor_investments` | Portfolio rows (needs `investment_date` + `source_url` to ingest — many rows missing today) |

## Temporal rule

```text
event_at > match.created_at   (strict)
```

Latest match for the pair before the event wins.

## Workflow (run on Mac from repo root)

### 0. Baseline report

```bash
npm run outcomes:report
npm run outcomes:matched   # verified pairs + pending queue with source tiers
```

### 1. Seed + web search (Gemini)

```bash
node scripts/search-startup-funding-evidence.mjs --seed
npm run outcomes:search-funding -- --limit=20          # dry-run
npm run outcomes:search-funding -- --apply --limit=50 --delay=1200
```

Requires `GEMINI_API_KEY`. CI runs apply on a schedule (`.github/workflows/funding-evidence-search.yml`).

### 2. RSS / structured events

```bash
# Prefer SQL RPC (fast); JS script loads full startup/investor tables and may timeout
npm run outcomes:correlate-funding -- --limit=2000     # dry-run if it completes

# In psql / Supabase SQL editor:
SELECT * FROM correlate_structured_investment_events(50000);
SELECT * FROM resolve_investment_startup_ids(50000);
SELECT * FROM ingest_canonical_investment_evidence(50000);
```

### 3. Review candidates → verified (required for official positives)

Scripts insert evidence with **`verified=false`**. Positives in `historical_match_validation_dataset` require **`verified=true`**.

```bash
npm run outcomes:review -- --list --limit=50
npm run outcomes:review -- --apply --verify --limit=10   # after human check
npm run outcomes:review -- --apply --reject --id=<uuid> --note="speculative headline"
```

Set `PYTHH_REVIEWER_USER_ID` to an `auth.users` uuid if needed.

### 4. Refresh classifications

```sql
SELECT refresh_match_outcome_classifications(50000);
```

### 5. Query results

```sql
-- Official verified post-prediction funding pairs
SELECT su.name startup, i.name investor, e.event_at, m.created_at match_at
FROM match_validation_evidence e
JOIN startup_investor_matches m ON m.id = e.match_id
JOIN startup_uploads su ON su.id = e.startup_id
JOIN investors i ON i.id = e.investor_id
WHERE e.verified AND e.event_at > m.created_at
ORDER BY e.event_at DESC;

SELECT classification, count(*) FROM match_outcome_classifications GROUP BY 1;
```

## Current gaps (as of Aug 2026)

1. **37 pending evidence rows, 12 verified** — review queue shrinking; verify issuer-primary sources first (`resend.com/blog`, `prnewswire.com`, issuer `/blog`, `/newsroom`).
2. **`investor_investments`**: no `investment_date` / `source_url` on most rows — portfolio ingest path blocked until backfilled.
3. **3.8M matches since Jan 2026** — most rows `censored` until 365-day window + search complete.
4. **`outcomes:correlate-funding` JS** may timeout loading all startups/investors; use SQL RPC instead.

## Tests

```bash
npm run test:historical-validation
```

Logic lives in `lib/historicalMatchValidation.js` and Aug 2026 migrations under `supabase/migrations/20260816*`.
