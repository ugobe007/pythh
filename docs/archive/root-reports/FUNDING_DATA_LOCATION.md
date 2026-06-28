# Finding Funding Data 📍

## Current Situation

The `funding_data` table doesn't exist. Funding information is likely stored in:

1. **`extracted_data` JSONB field** in `startup_uploads` table
2. **News articles/RSS feeds** that mention funding
3. **External APIs** (Crunchbase, etc.)

## Step 1: Find Where Funding Data Is

Run this SQL in Supabase SQL Editor:

```sql
-- See what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check for funding data in extracted_data
SELECT 
  COUNT(*) as total_startups,
  COUNT(CASE 
    WHEN extracted_data->>'funding_amount' IS NOT NULL OR
         extracted_data->>'latest_funding' IS NOT NULL OR
         extracted_data->>'funding_round' IS NOT NULL
    THEN 1 
  END) as with_funding_info
FROM startup_uploads
WHERE extracted_data IS NOT NULL;

-- See sample funding data
SELECT 
  name,
  extracted_data->>'funding_amount' as funding_amount,
  extracted_data->>'latest_funding' as latest_funding,
  extracted_data->>'funding_round' as funding_round,
  extracted_data->>'funding_stage' as funding_stage
FROM startup_uploads
WHERE extracted_data IS NOT NULL
AND (
  extracted_data->>'funding_amount' IS NOT NULL OR
  extracted_data->>'latest_funding' IS NOT NULL OR
  extracted_data->>'funding_round' IS NOT NULL
)
LIMIT 10;
```

## Step 2: Extract Funding Rounds

Once you know where the data is, you can:

### Option A: Use the Node.js Script
```bash
node extract-funding-from-jsonb.js
```

This will:
- Read funding info from `extracted_data` JSONB
- Parse amounts and round types
- Create `funding_rounds` records
- Skip duplicates

### Option B: Use SQL (if you prefer)

I can create a SQL version that extracts directly from JSONB.

## Next Steps

1. **Run the find query** to see what funding data exists
2. **Run the extraction script** to populate `funding_rounds`
3. **Verify** with: `SELECT COUNT(*) FROM funding_rounds;`

Let me know what the find query shows and I'll help you extract it! 🚀





