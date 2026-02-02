# Phase 3: VC Faith Signals - Quick Start

All scripts now auto-load from `.env.bak`. No manual key passing needed.

## Prerequisites
- ✅ `.env.bak` restored (contains all your keys)
- ✅ Migration `20260126_faith_signals_schema.sql` applied
- ✅ Scripts configured to auto-load environment

## Run Commands (Simple)

### 1. Add 100+ RSS Sources (Quick Win) ✅ DONE
```bash
node scripts/add-rss-sources-batch.js
```
**Status**: Already loaded (203 sources active)

### 2. Fetch SEC Form D Filings (Portfolio Exhaust)
```bash
npx tsx scripts/edgar/sec-formd-fetcher.ts --top50 --limit 25
```
**Status**: ✅ Working (added 2 filings from 2 VCs, 3 CIKs need updating)

### 3. List Available Investors (get UUID for next step)
```bash
npx tsx scripts/list-investors.ts
```
**Output**: Shows investor UUIDs and names from your database

### 4. Extract VC Faith Signals (Claude)
First, get investor UUID from step 3, then:
```bash
npx tsx scripts/faith-signal-extractor.ts \
  --investor-id "a1b2c3d4-5678-90ab-cdef-1234567890ab" \
  --investor-name "Sequoia Capital" \
  --url "https://www.sequoiacap.com/article/vision/"
```
**Replace**: Use actual UUID from step 3, real investor name, and their blog/thesis URL

### 5. Run Faith Validation Engine
```bash
npx tsx scripts/faith-validation-engine.ts --limit 200
```
**Status**: ✅ Runs (0 matches because no faith signals extracted yet - run step 4 first)

## No Key Passing Required
All scripts now read from `.env.bak` automatically. Just run the commands.

## Check Results
```sql
-- View faith signals
SELECT investor_id, signal_type, signal_text, confidence 
FROM vc_faith_signals 
LIMIT 10;

-- View portfolio exhaust
SELECT investor_id, startup_name, source_type, filing_date 
FROM vc_portfolio_exhaust 
LIMIT 10;

-- View faith alignment matches
SELECT startup_id, investor_id, faith_alignment_score, rationale 
FROM faith_alignment_matches 
ORDER BY faith_alignment_score DESC 
LIMIT 10;
```

## What's Next
1. Map CIK → investor_id for better SEC linking
2. Add more VC blog URLs for faith extraction
3. Refine matching heuristics with embeddings
