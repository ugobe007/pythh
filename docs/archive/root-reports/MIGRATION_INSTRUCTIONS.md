# Database Migration Required: Industry GOD Score

## Issue
The scoring script is trying to update `industry_god_score` and `primary_industry` columns that don't exist yet in the database.

## Solution: Run the Migration

You have two options:

### Option 1: Run via Supabase Dashboard (Easiest)

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `migrations/add_industry_god_score.sql`
4. Click **Run**

### Option 2: Run via Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push

# Or directly via psql
psql $DATABASE_URL < migrations/add_industry_god_score.sql
```

### Option 3: Manual SQL Execution

Execute this SQL in your Supabase SQL Editor:

```sql
-- Add industry_god_score column (industry-adjusted score)
ALTER TABLE startup_uploads
ADD COLUMN IF NOT EXISTS industry_god_score INTEGER DEFAULT NULL;

-- Add primary_industry column (stores the identified primary industry)
ALTER TABLE startup_uploads
ADD COLUMN IF NOT EXISTS primary_industry TEXT DEFAULT NULL;

-- Add index for filtering/sorting by industry score
CREATE INDEX IF NOT EXISTS idx_startup_industry_god_score ON startup_uploads(industry_god_score DESC NULLS LAST);

-- Add index for industry filtering
CREATE INDEX IF NOT EXISTS idx_startup_primary_industry ON startup_uploads(primary_industry);

-- Add composite index for common query pattern (industry score + status)
CREATE INDEX IF NOT EXISTS idx_startup_industry_scored_approved 
ON startup_uploads(primary_industry, industry_god_score DESC NULLS LAST) 
WHERE status = 'approved';
```

## Verify Migration

After running the migration, verify the columns exist:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'startup_uploads' 
AND column_name IN ('industry_god_score', 'primary_industry');
```

You should see both columns listed.

## Then Re-run Scoring

After migration, re-run the scoring script:

```bash
node scripts/core/god-score-formula.js
```

The script will now successfully store both `total_god_score` and `industry_god_score` for each startup.

## Temporary Workaround

If you can't run the migration right now, the script has been updated to gracefully skip industry score updates if the columns don't exist. It will still calculate and display industry scores in the console output, but won't store them in the database until the migration is run.
