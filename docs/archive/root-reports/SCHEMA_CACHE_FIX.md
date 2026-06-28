# 🔥 SCHEMA CACHE FIX - STEP BY STEP

## What You're Doing
Reloading Supabase's PostgREST schema cache so it knows about the `sector_focus`, `stage_focus`, `portfolio_size` columns.

## Steps (Takes 30 seconds)

### 1. Open Supabase SQL Editor
- Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt
- Click **"SQL Editor"** in left sidebar
- Click **"New Query"** button

### 2. Run This Command
```sql
NOTIFY pgrst, 'reload schema';
```

### 3. Verify Success
You should see:
```
Success. No rows returned
```

That's it! The cache is now reloaded.

## After Cache Reload

Tell the assistant "Done!" and they will:
1. Run `./enrich-vcs.sh` to fill all VC profiles
2. It will use OpenAI to extract:
   - Sector focus (AI/ML, Fintech, SaaS, Healthcare, etc.)
   - Stage focus (seed, series_a, series_b, growth)
   - Portfolio size (number of portfolio companies)
   - Notable investments (famous companies they've funded)
   - Check sizes ($1M - $50M ranges)
   - Exit counts

## Expected Timeline
- Schema reload: 5 seconds
- Enrichment: 2-3 minutes (processing 53 VCs with OpenAI)
- Result: All VC cards will have full profiles!

## If It Still Fails

Alternative method (takes 2-3 min):
1. Go to **Settings** → **Data API**
2. Find "Schema Cache" section
3. Click **"Reload Schema Cache"** button
4. Wait for green checkmark

## Why This Happens

Supabase caches your database schema for performance. When you add new columns, the cache doesn't automatically update. You need to manually reload it.

This is the SECOND time this has happened because:
1. First time: Added `type`, `bio`, `location` columns
2. Second time: Added `sector_focus`, `stage_focus`, `portfolio_size`, `notable_investments`

## Prevention

We could add auto-reload to the continuous scraper, but manual reload is actually better for production (prevents accidental cache thrashing).
