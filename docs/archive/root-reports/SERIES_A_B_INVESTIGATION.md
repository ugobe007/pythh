# 🔍 Series A/B Funding Stage Investigation

## Problem
Most startups are not tagged as Series A or B, even though funding signals exist in the data.

## Root Cause Analysis

### Issue #1: Stage Field Type Mismatch
- **`stage` field**: INTEGER (1-5 scale)
  - 0 = Pre-seed/Angel
  - 1 = Seed
  - 2 = Series A
  - 3 = Series B
  - 4 = Series C
  - 5 = Series D+
- **`funding_stage` field**: TEXT ("Series A", "Series B", etc.)
- **Problem**: When importing, funding_stage text is not converted to numeric stage

### Issue #2: Missing Stage Mapping During Import
When `discovered_startups` are imported to `startup_uploads`:
- `funding_stage` text is stored in `extracted_data.funding_stage`
- But `stage` field is set to `null` or default (1 = Seed)
- No conversion from text "Series A" → numeric 2

### Issue #3: Signals Exist But Aren't Used
- RSS articles mention "Series A", "Series B"
- AI extraction captures `funding_stage` correctly
- But import process doesn't map it to `stage` field

## Solution

### Step 1: Run Diagnostic Query
**File:** `migrations/analyze_funding_stage_signals.sql`

This will show:
- Current stage distribution
- Funding signals in extracted_data
- RSS articles with Series A/B mentions
- Startups that should be Series A/B but aren't

### Step 2: Fix Existing Data
**File:** `scripts/fix-missing-series-a-b-stages.js`

This script:
- Finds startups with Series A/B signals but wrong stage
- Updates stage field based on:
  - `funding_rounds` table (most reliable)
  - `extracted_data.funding_stage`
  - `raise_type` field
  - Funding amount inference ($5M-$15M = Series A, $15M-$50M = Series B)

### Step 3: Fix Import Process
**File:** `scripts/approve-all-discovered-startups.js` (UPDATED)

Now properly:
- Converts `funding_stage` text to numeric `stage`
- Maps "Series A" → 2, "Series B" → 3
- Preserves original text in `raise_type` and `extracted_data`

## Quick Fix Command

```bash
# Fix existing startups with missing Series A/B stages
node scripts/fix-missing-series-a-b-stages.js

# For future imports, the approve script is now fixed
```

## Expected Results

After running the fix:
- Series A startups: Stage = 2
- Series B startups: Stage = 3
- Better match quality for Series A/B investors
- More accurate stage filtering
