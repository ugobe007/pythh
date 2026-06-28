# Match Generation Bug Fix

## Critical Bug Identified

Matches were being deleted due to multiple issues in match generation scripts:

### Issues Found:

1. **`match-regenerator.js` (line 132-138)**: Deleted ALL matches before regenerating
   - **Fixed**: Removed DELETE operation, now uses upsert to preserve matches

2. **`generate-matches-selective.js` (line 883)**: TRUNCATED the entire table
   - **Fixed**: Removed TRUNCATE, now uses upsert

3. **`generate-matches-v2.js` (line 221)**: Only processed 1000 startups (LIMIT 1000)
   - **Fixed**: Removed LIMIT to process ALL startups

4. **`generate-matches-v2.js` (line 349)**: Used INSERT instead of UPSERT
   - **Fixed**: Changed to INSERT ... ON CONFLICT DO UPDATE (preserves created_at)

## Impact

- **Yesterday**: ~240,000 matches
- **This Morning**: 344,000 → 388,744 matches (growing correctly)
- **After Bug**: Dropped to 209,253 matches (lost ~179,000 matches)

## Root Cause

When match generation scripts ran:
1. Scripts deleted/truncated all existing matches
2. Scripts only processed a subset of startups (1000 instead of all)
3. This resulted in matches being created only for the processed startups
4. Matches for unprocessed startups were permanently lost

## Fix Applied

All scripts now:
- ✅ Use UPSERT instead of DELETE/TRUNCATE
- ✅ Process ALL startups (no LIMIT)
- ✅ Preserve `created_at` timestamps on conflict
- ✅ Only update match scores/reasoning, not delete matches

## Prevention

- Only ONE match generation script should run at a time
- All scripts must process ALL startups, not a subset
- Never DELETE or TRUNCATE the matches table
- Always use UPSERT with conflict handling



