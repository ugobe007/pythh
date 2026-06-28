# Fixed Migration - startup_investor_matches

## What Was Wrong

The original migration likely failed because:
1. **Foreign key constraints** were trying to reference tables that might not exist
2. **Policy conflicts** if the table already existed
3. **Dependency issues** when creating constraints inline

## New Migration (v2)

I've created a **robust version** that:
- ✅ Creates the table **without** foreign keys first
- ✅ Checks if referenced tables exist **before** adding constraints
- ✅ Drops existing policies to avoid conflicts
- ✅ Provides clear error messages
- ✅ Handles edge cases gracefully

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/sql/new
2. Open: `migrations/create_startup_investor_matches_v2.sql`
3. Copy the entire file
4. Paste into SQL Editor
5. Click **"Run"** (or Cmd+Enter)

### Option 2: If You Get Errors

If you still get errors, run it in **parts**:

#### Part 1: Just create the table (no constraints)
```sql
CREATE TABLE IF NOT EXISTS startup_investor_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL,
  investor_id UUID NOT NULL,
  match_score DECIMAL(5,2) CHECK (match_score >= 0 AND match_score <= 100),
  confidence_level VARCHAR(20),
  reasoning TEXT,
  why_you_match TEXT[],
  status VARCHAR(50) DEFAULT 'suggested',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(startup_id, investor_id)
);
```

#### Part 2: Add indexes
```sql
CREATE INDEX IF NOT EXISTS idx_startup_investor_matches_startup_id 
ON startup_investor_matches(startup_id);

CREATE INDEX IF NOT EXISTS idx_startup_investor_matches_investor_id 
ON startup_investor_matches(investor_id);

CREATE INDEX IF NOT EXISTS idx_startup_investor_matches_match_score 
ON startup_investor_matches(match_score DESC NULLS LAST);
```

#### Part 3: Enable RLS and policies
```sql
ALTER TABLE startup_investor_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to matches"
  ON startup_investor_matches FOR SELECT USING (true);

CREATE POLICY "Allow public insert on matches"
  ON startup_investor_matches FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on matches"
  ON startup_investor_matches FOR UPDATE USING (true) WITH CHECK (true);
```

## Troubleshooting

### Error: "relation startup_uploads does not exist"
- **Solution**: The foreign keys will be skipped if tables don't exist
- The table will still be created, just without foreign key constraints
- This is OK - you can add constraints later when tables exist

### Error: "relation startup_investor_matches already exists"
- **Solution**: Either:
  1. Drop it first: `DROP TABLE IF EXISTS startup_investor_matches CASCADE;`
  2. Or uncomment the DROP line at the top of the migration

### Error: "policy already exists"
- **Solution**: The v2 migration now drops existing policies first
- If you still get this, manually drop: `DROP POLICY IF EXISTS "policy_name" ON startup_investor_matches;`

### Error: "permission denied"
- **Solution**: Make sure you're using the SQL Editor in Supabase Dashboard
- Or use the service_role key (not anon key) for admin operations

## Verify It Worked

After running, check:

1. **Table exists**: 
   - Go to Table Editor → Should see `startup_investor_matches`

2. **Check structure**:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'startup_investor_matches';
   ```

3. **Test query**:
   ```sql
   SELECT COUNT(*) FROM startup_investor_matches;
   ```
   Should return 0 (table is empty, which is expected)

## Next Steps

Once the table is created:
1. ✅ Restart your dev server
2. ✅ The "Database table not found" error should be gone
3. ⚠️ You'll see "No matches available" until matches are generated
4. 🔄 Run the queue processor to generate matches

