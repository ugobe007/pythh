# Data-Sparse 30-Day Policy

**Policy:** Approved startups that are data-sparse get 30 days to be enriched. If they cannot be enriched after 30 days, they are removed (status = `rejected`).

## Why it wasn’t enforced before

1. **Funnel gap** — Only startups that go through `enrich-sparse-startups.js` get `enrichment_status = 'waiting'` and, after 3 failed attempts, `'holding'` with `holding_since`. Many approved startups never enter this funnel (e.g. `enrichment_status` is null or `'enriched'` from another path, or the enrichment cron only processes a limit per day).
2. **holding-review-worker** only processes `enrichment_status = 'holding'`. It doesn’t catch approved + data-sparse + 30d old that are still `waiting` or null.
3. **deadwood-purge.mjs** only handles `waiting` 30d+: it deletes junk names and marks the rest as `enriched`; it doesn’t reject “cannot be enriched” by data richness.

## What enforces it now

1. **holding-review-worker.js** (daily 3am)  
   Retries enrichment for `holding` startups. If still no data and `holding_since` ≥ 30 days → **reject** (was hard-delete; now `status = 'rejected'` for audit).

2. **enforce-sparse-30day-policy.js** (daily 3:30am)  
   - Finds approved + **holding** with `holding_since` ≥ 30 days → reject.  
   - Finds approved + **waiting** or **null** + **created_at** ≥ 30 days ago + data-sparse (no website, richness ≤ 2) → reject.  
   So startups that never made it into `holding` are still removed after 30 days if they’re unenrichable.

## Commands

- **Dry run:** `node scripts/enforce-sparse-30day-policy.js --dry-run`
- **Run:** `node scripts/enforce-sparse-30day-policy.js` or `npm run enforce:sparse-30day`
- **With limit:** `node scripts/enforce-sparse-30day-policy.js --limit=500`

## Cron (ecosystem.config.js)

- `holding-review-worker`: `0 3 * * *` (3am)
- `enforce-sparse-30day-policy`: `30 3 * * *` (3:30am)
