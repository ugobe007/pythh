# Database Diagnosis Guide

## Step 1: Run Complete Diagnosis

Open **`migrations/complete_database_check.sql`** in Supabase SQL Editor and run it.

This will show you:
- ✅ If the table exists
- ✅ All tables in your database (to find conflicts)
- ✅ Table structure
- ✅ RLS settings
- ✅ Row counts
- ✅ Any errors

## Step 2: Look for These Issues

### Issue 1: Table Doesn't Exist
**Symptom**: Status shows "❌ DOES NOT EXIST"

**Solution**: Run `migrations/fix_table_if_missing.sql` to recreate it

### Issue 2: Conflicting Table Names
**Symptom**: You see tables like:
- `matches` (old name?)
- `startup_matches`
- `investor_matches`

**Solution**: These might be interfering. Check if they're being used instead of `startup_investor_matches`

### Issue 3: RLS Blocking Access
**Symptom**: Table exists but "RLS POLICIES" shows "❌ NO POLICIES"

**Solution**: The policies weren't created. Re-run `migrations/create_startup_investor_matches_fast.sql`

### Issue 4: Table in Wrong Schema
**Symptom**: Table exists but queries fail

**Solution**: Make sure it's in the `public` schema, not another schema

### Issue 5: Missing Required Columns
**Symptom**: "REQUIRED COLUMNS CHECK" shows missing columns

**Solution**: Table structure is incomplete. Run `migrations/fix_table_if_missing.sql`

## Step 3: Quick Fixes

### If Table Doesn't Exist
```sql
-- Run this
\i migrations/create_startup_investor_matches_fast.sql
```

### If RLS Policies Missing
```sql
ALTER TABLE startup_investor_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to matches"
  ON startup_investor_matches FOR SELECT USING (true);

CREATE POLICY "Allow public insert on matches"
  ON startup_investor_matches FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on matches"
  ON startup_investor_matches FOR UPDATE USING (true) WITH CHECK (true);
```

### If There Are Conflicting Tables
First, check if they're being used:
```sql
SELECT COUNT(*) FROM matches;  -- Old table?
SELECT COUNT(*) FROM startup_matches;  -- Conflict?
```

If they're empty/old, you can drop them:
```sql
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS startup_matches CASCADE;
DROP TABLE IF EXISTS investor_matches CASCADE;
```

## Step 4: Verify After Fix

Run this to confirm everything works:

```sql
-- Should return 0 (empty table is OK)
SELECT COUNT(*) FROM startup_investor_matches;

-- Should work without errors
SELECT * FROM startup_investor_matches LIMIT 1;

-- Should show the policy
SELECT policyname FROM pg_policies WHERE tablename = 'startup_investor_matches';
```

## Step 5: Check Frontend Connection

After fixing the database, verify your frontend can connect:

1. Check `.env` file has:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

2. Restart dev server:
   ```bash
   npm run dev
   ```

3. Check browser console for errors

## Common Errors and Solutions

### "relation does not exist"
- **Cause**: Table doesn't exist
- **Fix**: Run `migrations/create_startup_investor_matches_fast.sql`

### "permission denied"
- **Cause**: RLS policies missing or incorrect
- **Fix**: Re-run policy creation (see Step 3)

### "No matches available"
- **Cause**: Table exists but is empty
- **Fix**: This is normal! You need to run the queue processor to generate matches

### "JWT expired" or "JWT invalid"
- **Cause**: Wrong Supabase credentials in `.env`
- **Fix**: Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## Next Steps After Fix

1. ✅ Table exists and is accessible
2. ✅ Restart dev server
3. ✅ Check frontend - should see "No matches available" (not an error)
4. 🔄 Run queue processor to generate matches
