# Startup Name & Data Quality Scripts

Scripts and instructions for validating startup names, cleaning garbage, and running tests.

---

## Quick Reference

| Script | Purpose |
|--------|---------|
| `npm run pipeline:full` | **Full automated pipeline** (cleanup → discover → import → enrich → recalc → match) |
| `npm run pipeline:full:cleanup` | Same + actually delete garbage (not just dry run) |
| `node scripts/test-startup-name-validation.js` | Run unit tests for validator, extractor, garbage logic |
| `node scripts/cleanup-garbage.js` | Dry run: list garbage startup names |
| `node scripts/cleanup-garbage.js --delete` | Delete garbage entries from database |
| `npm run cleanup:pending-junk` | Dry run: junk names in **pending/reviewing** approval queue |
| `npm run cleanup:pending-junk -- --execute` | Reject those rows (`status=rejected`, `admin_notes` set) |
| `npm run cleanup:enrich` | **Cleanup + enrich pipeline** (dry-run cleanup → enrich startups+investors → recalc) |
| `npm run cleanup:enrich:delete` | Same but actually delete garbage before enriching |
| `npm run cleanup:enrich:fast` | Same but **skip investor enrichment** (use when it times out or is blocked) |

---

## Full Data Pipeline (Automated)

Runs the complete workflow: resolve garbage → discover → import → enrich → recalculate → match.

```bash
# Full run (cleanup dry-run, then discover → import → enrich → recalc → match)
npm run pipeline:full

# Same but actually delete garbage names
npm run pipeline:full:cleanup

# Skip discovery (import → enrich → recalc → match only)
node scripts/run-full-pipeline.js --quick

# Run continuously every 2 hours
node scripts/run-full-pipeline.js --daemon
```

**Pipeline steps:**

| Step | Script | What it does |
|------|--------|--------------|
| 0. Cleanup | `cleanup-garbage.js` | Lists (or deletes with `--cleanup-delete`) junk startup names |
| 1. Discovery | `simple-rss-scraper`, `extract-missing-series-a-b`, `discover-more-startups` | Scrapes RSS, extracts Series A/B, discovers more |
| 2. Import | `auto-import-pipeline.js` | Moves discovered → startup_uploads (gate validates names) |
| 3. Enrich | `enrichment-orchestrator.js` | Tiered enrichment (correct startups only) |
| 4. Recalc | `recalculate-scores.ts` | Recalculates GOD scores |
| 5. Populate queue | `populate-matching-queue.js` | Adds startups needing matches to queue |
| 6. Match | `queue-processor-v16.js --run-once` | Generates investor matches, exits when queue empty |

**PM2 cron (every 6 hours):**
```bash
pm2 start scripts/run-full-pipeline.js --name full-pipeline --cron "0 */6 * * *"
```

---

## 1. Testing

### `npm run test:validation`  
**or** `node scripts/test-startup-name-validation.js`

Runs unit tests for:
- `isValidStartupName` — valid names (Deel, 1Password, Stripe) vs garbage (headlines, law firm phrases)
- `extractCompanyName` — headline → company extraction
- `isGarbage` — cleanup logic and known-good allowlist

**Requirements:** None (no DB needed)

**Expected:** All 38 tests pass; exit code 0

---

## 2. Garbage Cleanup

### Dry run (preview only)
```bash
node scripts/cleanup-garbage.js
```

- Fetches all approved startups from `startup_uploads`
- Identifies garbage using `GARBAGE_PATTERNS`, `isValidStartupName`, and `KNOWN_GOOD_STARTUPS`
- Prints total approved count and list of garbage entries
- **No changes** to the database

### Delete garbage
```bash
node scripts/cleanup-garbage.js --delete
```

- Same identification as dry run
- Deletes in order: `startup_investor_matches` → `score_history` → `match_gen_logs` → `startup_uploads`
- Logs each step

**Requirements:**
- `.env` with `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (or `SUPABASE_ANON_KEY`)

---

## 3. Insert Gate & Rejection Logging

To log rejected startup names to the database for monitoring:

```bash
LOG_STARTUP_REJECTIONS=1 node scripts/core/simple-rss-scraper.js
```

Rejections are written to `startup_insert_rejections` (requires migration `20260329000000_startup_insert_rejections.sql`).

Optional debug logging:
```bash
DEBUG_STARTUP_GATE=1 node <your-script>
```

---

## 4. Discovery & Import Pipelines

| Script | What it does |
|--------|--------------|
| `node scripts/core/simple-rss-scraper.js` | Scrapes RSS, extracts startups → `discovered_startups` via gate |
| `node scripts/discover-more-startups.js` | Discover startups from RSS using headline extractor + gate |
| `node scripts/extract-missing-series-a-b-from-rss-pattern-based.js` | Pattern-based extraction → `discovered_startups` via gate |
| `node scripts/core/auto-import-pipeline.js` | Imports discovered → `startup_uploads` via gate |
| `node scripts/force-approve-all-discovered.js` | Approves discovered startups → `startup_uploads` via gate |

All use `lib/startupInsertGate` for validation before insert.

---

## 5. Cleanup & Enrich Pipeline (Startups + Investors)

One script to clean garbage and enrich sparse records for both startups and investors:

```bash
# Full run: dry-run cleanup → enrich startups+investors → recalc
npm run cleanup:enrich

# Same but actually DELETE garbage before enriching
npm run cleanup:enrich:delete

# Skip cleanup, run enrichment + recalc only
node scripts/cleanup-and-enrich.js --enrich-only

# Cleanup only (no enrichment)
node scripts/cleanup-and-enrich.js --cleanup-only
node scripts/cleanup-and-enrich.js --cleanup-only --cleanup-delete

# Recalc only (after manual enrichment)
node scripts/cleanup-and-enrich.js --recalc-only
```

**Steps:** Startup cleanup → Investor cleanup → Enrich sparse startups (run-all) → Enrich sparse investors (run-all) → Recalculate GOD scores.

---

## 6. Sparse Startup Enrichment

Targeted enrichment for data-sparse startups (score &lt; 70, phase 2–4):

```bash
# Process up to 200 (default chunk size)
node scripts/enrich-sparse-startups.js --limit=200

# Run until entire pool is exhausted (chunks of 200, 3s pause between)
node scripts/enrich-sparse-startups.js --run-all

# Custom chunk size for run-all
node scripts/enrich-sparse-startups.js --run-all --limit=100

# Include holding status (retry previously failed)
node scripts/enrich-sparse-startups.js --run-all --include-holding

# HTML-only (skip Google News when blocked). Infers URL from name when missing, then scrapes.
node scripts/enrich-sparse-startups.js --run-all --include-holding --html-only
```

---

## 7. Sparse Investor Enrichment

News-inference enrichment for investors missing sectors, stage, check size, portfolio, or bio:

```bash
# Process up to 50 (default)
node scripts/enrich-sparse-investors.js

# Run until entire sparse pool is exhausted
node scripts/enrich-sparse-investors.js --run-all

# Custom limit
node scripts/enrich-sparse-investors.js --run-all --limit=100

# Dry run (preview only)
node scripts/enrich-sparse-investors.js --limit=5 --dry-run
```

---

## 8. Core Libraries

| File | Purpose |
|------|---------|
| `lib/startupNameValidator.js` | Shared validator; rejects headlines, law firm phrases, junk patterns |
| `lib/headlineExtractor.js` | Extracts company names from RSS/article headlines |
| `lib/startupInsertGate.js` | Single insert gate for `discovered_startups` and `startup_uploads` |

---

## 9. Suggested Workflow

1. **After bulk imports or RSS runs:**  
   `node scripts/cleanup-garbage.js` (dry run) → review → `--delete` if satisfied

2. **To clean DB and enrich sparse startups + investors:**  
   `npm run cleanup:enrich` (dry-run cleanup first) or `npm run cleanup:enrich:delete` to actually delete garbage

3. **Before deploying scraper changes:**  
   `npm run test:validation`

4. **To monitor what gets rejected:**  
   Set `LOG_STARTUP_REJECTIONS=1` in staging, then query `startup_insert_rejections`
