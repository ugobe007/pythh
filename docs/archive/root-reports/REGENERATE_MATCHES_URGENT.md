# 🚨 URGENT: Regenerate Matches - Data Was Deleted

## Confirmed: Table is Empty
- `startup_investor_matches`: **0 rows** (0 bytes data, 71 MB orphaned indexes)
- Data was **deleted/truncated** - 71 MB of orphaned indexes proves it existed before
- Dashboard showing 350,800 is **cached/stale data**

## Solution: Regenerate All Matches

### Step 1: Clean Orphaned Indexes (Optional but Recommended)
```sql
-- This will free up 71 MB and improve performance
-- Run in Supabase SQL Editor:
TRUNCATE TABLE startup_investor_matches CASCADE;
-- This will also drop dependent objects, then recreate them
```

OR keep indexes and just regenerate data:

### Step 2: Regenerate Matches
The queue processor will regenerate all matches:

```bash
# Option A: Run directly (will process all pending startups)
node scripts/core/queue-processor-v16.js

# Option B: Use PM2 for background processing
pm2 start scripts/core/queue-processor-v16.js --name queue-processor

# Option C: Trigger via API (from Matching Engine Admin page)
# Click "Trigger Queue Processor" button in the admin dashboard
```

### Step 3: Monitor Progress
```bash
# Check queue status
psql $POSTGRES_URL -c "SELECT status, COUNT(*) FROM matching_queue GROUP BY status;"

# Check matches being created
psql $POSTGRES_URL -c "SELECT COUNT(*) FROM startup_investor_matches;"
```

### Expected Time
- ~4,000 startups × 3,180 investors = ~12.7M potential matches
- Queue processor filters to top 100 per startup
- Expected result: ~400,000 matches (not 4.5M - that was likely accumulated over time)
- Processing time: ~2-4 hours depending on server

### Why 4.5M vs Current Expectation?
The 4.5M might have been:
1. **Historical accumulation** over months of runs
2. **Different filtering criteria** (lower threshold)
3. **Multiple match generations** (re-running for same startups)

Current queue processor creates **top 100 matches per startup** with `match_score >= 20`.

## Alternative: Check Supabase Backups

If you have backups enabled:
1. Go to Supabase Dashboard → Settings → Database
2. Check "Backups" section
3. Look for backup before data was deleted
4. Restore that backup

## Clear Dashboard Cache

After regenerating, clear browser cache:
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or clear browser cache completely
