# Migration Fix - user_id Column Error

## The Problem

The migration failed with:
```
ERROR: 42703: column "user_id" referenced in foreign key constraint does not exist
```

This happened because the migration tried to add a foreign key constraint on `user_id` before checking if the column actually exists in the table.

## Solution

I've created **two versions**:

### Option 1: Fixed v2 (Recommended)
**File**: `migrations/create_startup_investor_matches_v2.sql`

- ✅ Now checks if `user_id` column exists BEFORE adding FK constraint
- ✅ Still tries to add foreign keys (but safely)
- ✅ Better error handling

### Option 2: Simple Version (Guaranteed to Work)
**File**: `migrations/create_startup_investor_matches_simple.sql`

- ✅ Creates table with NO foreign key constraints
- ✅ Will definitely work
- ⚠️ You can add foreign keys manually later if needed

## How to Run

### Try Option 1 First (v2 - Fixed)

1. Open: `migrations/create_startup_investor_matches_v2.sql`
2. Copy all contents
3. Go to Supabase Dashboard → SQL Editor
4. Paste and run

### If Option 1 Still Fails, Use Option 2 (Simple)

1. Open: `migrations/create_startup_investor_matches_simple.sql`
2. Copy all contents
3. Go to Supabase Dashboard → SQL Editor
4. Paste and run
5. ✅ This will definitely work (no foreign keys)

## What Changed in v2

The key fix is in the `user_id` foreign key section:

```sql
-- OLD (broken):
IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
  ALTER TABLE ... -- This failed if user_id column didn't exist

-- NEW (fixed):
IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'startup_investor_matches' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE ... -- Only runs if column exists
```

## Verify It Worked

After running either migration:

1. **Check table exists**:
   ```sql
   SELECT * FROM startup_investor_matches LIMIT 1;
   ```
   Should return 0 rows (empty table is expected)

2. **Check structure**:
   ```sql
   \d startup_investor_matches
   ```
   Or in Supabase: Table Editor → `startup_investor_matches`

3. **Check indexes**:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'startup_investor_matches';
   ```

## Adding Foreign Keys Later (Optional)

If you used the simple version and want to add foreign keys later:

```sql
-- Add startup FK (if startup_uploads exists)
ALTER TABLE startup_investor_matches
ADD CONSTRAINT fk_startup_investor_matches_startup 
FOREIGN KEY (startup_id) REFERENCES startup_uploads(id) ON DELETE CASCADE;

-- Add investor FK (if investors exists)
ALTER TABLE startup_investor_matches
ADD CONSTRAINT fk_startup_investor_matches_investor 
FOREIGN KEY (investor_id) REFERENCES investors(id) ON DELETE CASCADE;

-- Add user FK (if auth.users exists AND user_id column exists)
ALTER TABLE startup_investor_matches
ADD CONSTRAINT fk_startup_investor_matches_user 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
```

## Next Steps

Once the table is created:
1. ✅ Restart your dev server
2. ✅ The "Database table not found" error should be gone
3. ⚠️ You'll see "No matches available" until matches are generated
4. 🔄 Run the queue processor to generate matches
