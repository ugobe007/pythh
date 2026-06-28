# Migration Timeout Fix

## The Problem

The v2 migration timed out because the `DO $$ ... END $$;` block with multiple checks was taking too long to execute in Supabase.

## Solution: Two-Step Approach

I've split the migration into **two parts**:

### Step 1: Create Table (FAST - No DO Blocks)
**File**: `migrations/create_startup_investor_matches_fast.sql`

This creates the table **without** foreign key constraints, avoiding complex logic that causes timeouts.

✅ **Run this first** - it should complete in seconds

### Step 2: Add Foreign Keys (Optional - Run Later)
**File**: `migrations/add_foreign_keys_separately.sql`

Only run this if you need foreign key constraints. You can run it later, or skip it entirely - the table will work fine without foreign keys.

## How to Run

### Step 1: Run the Fast Migration

1. Open: `migrations/create_startup_investor_matches_fast.sql`
2. Copy **all** contents
3. Go to Supabase Dashboard → SQL Editor
4. Paste and click **Run**
5. ✅ Should complete in < 5 seconds

### Step 2: Add Foreign Keys (Optional)

**Only if you want foreign keys:**

1. Wait for Step 1 to complete successfully
2. Open: `migrations/add_foreign_keys_separately.sql`
3. Copy **all** contents
4. Run in Supabase SQL Editor
5. ✅ This should also be fast (separate DO blocks)

## Why This Works

The timeout was caused by:
- Complex `DO $$ ... END $$;` block checking multiple tables
- Multiple conditional checks in a single transaction
- Supabase SQL Editor has a timeout limit

**The fix:**
- ✅ Simple CREATE TABLE (fast)
- ✅ Simple CREATE INDEX (fast)
- ✅ Simple CREATE POLICY (fast)
- ✅ Foreign keys added separately (optional, can run later)

## Alternative: Use Simple Version

If you want even simpler (no foreign keys at all):

Use: `migrations/create_startup_investor_matches_simple.sql`

This is identical to the fast version but doesn't have a separate file for foreign keys. Both will work the same.

## Verify It Worked

After Step 1:

```sql
-- Check table exists
SELECT COUNT(*) FROM startup_investor_matches;

-- Check structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'startup_investor_matches'
ORDER BY ordinal_position;
```

Should return 0 rows (empty table) and show all columns.

## Next Steps

Once the table is created:
1. ✅ Restart your dev server
2. ✅ The "Database table not found" error should be gone
3. ⚠️ You'll see "No matches available" until matches are generated
4. 🔄 Run the queue processor to generate matches
