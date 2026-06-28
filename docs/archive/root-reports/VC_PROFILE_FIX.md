# VC Profile Data Issue & Fix

## Problem
- VC cards showing mostly blank (sector_focus: null, portfolio_size: 0)
- Enrichment script works but hits Supabase schema cache error
- Error: "Could not find the 'sector_focus' column of 'investors' in the schema cache"

## Root Cause
**Supabase PostgREST schema cache is stale** - Same issue as before! The cache doesn't know about the `sector_focus` column even though it exists in the database.

## Solution (MUST DO IN SUPABASE DASHBOARD)

### Option 1: SQL Editor (Quick - 10 seconds)
1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Run this command:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
4. Wait 5 seconds
5. Run enrichment again: `npx tsx enrich-investor-data.ts`

### Option 2: Settings Page (Takes 2-3 minutes)
1. Go to **Supabase Dashboard** → **Settings** → **Data API**
2. Look for "Schema Cache" section
3. Click **"Reload Schema Cache"** button
4. Wait for confirmation
5. Run enrichment again

## After Cache Reload

The enrichment script will:
- ✅ Extract sector focus from OpenAI (AI/ML, Fintech, SaaS, etc.)
- ✅ Extract stage focus (seed, series_a, series_b, growth)
- ✅ Get portfolio size (number of companies)
- ✅ Get notable investments (array of companies)
- ✅ Get check size range ($1M - $50M, etc.)
- ✅ Get exit count

## Expected Results

**Before:**
```json
{
  "name": "Tiger Global Management",
  "firm": "Tiger Global Management",
  "bio": "Technology-focused hedge fund",
  "sector_focus": null,
  "portfolio_size": 0,
  "notable_investments": null
}
```

**After:**
```json
{
  "name": "Tiger Global Management",
  "firm": "Tiger Global Management",
  "bio": "Technology-focused hedge fund and venture capital firm",
  "sector_focus": ["Technology", "Consumer Internet", "E-commerce", "Financial Services"],
  "portfolio_size": 200,
  "notable_investments": [
    {"company": "Flipkart", "stage": "growth", "year": 2014},
    {"company": "Stripe", "stage": "series_b", "year": 2012}
  ],
  "check_size_min": 1,
  "check_size_max": 100
}
```

## Temporary Workaround (If You Can't Reload Cache)

Update VCs manually via SQL:
```sql
UPDATE investors SET
  sector_focus = ARRAY['AI/ML', 'SaaS', 'Enterprise'],
  portfolio_size = 150,
  notable_investments = ARRAY['OpenAI', 'Anthropic', 'Scale AI']
WHERE name = 'Tiger Global Management';
```

## Long-term Fix

Add this to continuous-scraper.js to auto-reload cache:
```javascript
// Reload schema cache every 2 hours
setInterval(async () => {
  await supabase.rpc('reload_schema_cache');
}, 2 * 60 * 60 * 1000);
```
