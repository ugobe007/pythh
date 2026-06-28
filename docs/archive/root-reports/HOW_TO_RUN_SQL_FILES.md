# How to Run SQL Files in Supabase

## ⚠️ Important: You Cannot Run File Paths Directly!

**❌ WRONG:**
```
migrations/verify_rls_and_safety_fixes.sql
```

**✅ CORRECT:**
1. Open the `.sql` file
2. Copy ALL the SQL content
3. Paste into Supabase SQL Editor
4. Click "Run"

## Step-by-Step Instructions

### Method 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/sql/new
   - Or click "SQL Editor" in left sidebar → "New Query"

2. **Open the SQL file:**
   - In your code editor (VS Code, etc.), open the `.sql` file
   - Example: `migrations/find_all_startups_and_investors.sql`

3. **Copy the SQL content:**
   - Select ALL text in the file (Cmd+A / Ctrl+A)
   - Copy (Cmd+C / Ctrl+C)
   - **Do NOT copy the file path, just the SQL code inside!**

4. **Paste into Supabase:**
   - Click in the SQL Editor text area
   - Paste (Cmd+V / Ctrl+V)
   - You should see the SQL code, not a file path

5. **Run the query:**
   - Click "Run" button (or press Cmd+Enter / Ctrl+Enter)
   - Results will appear below

### Method 2: Using psql Command Line

```bash
# Connect to Supabase
psql "postgresql://postgres:[YOUR-PASSWORD]@db.unkpogyhhjbvxxjvmxlt.supabase.co:5432/postgres"

# Run SQL file
\i migrations/find_all_startups_and_investors.sql

# Or pipe the file
cat migrations/find_all_startups_and_investors.sql | psql [connection-string]
```

## Files You Need to Run

### To Find All Startups and Investors:
**File:** `migrations/find_all_startups_and_investors.sql`
- Copy entire file content
- Paste into Supabase SQL Editor
- Run

### To Verify RLS and Safety Checks:
**File:** `migrations/verify_rls_and_safety_fixes_DIRECT.sql`
- Copy entire file content  
- Paste into Supabase SQL Editor
- Run

### To Fix RLS Issues:
**File:** `migrations/fix_all_rls_issues_comprehensive.sql`
- Copy entire file content
- Paste into Supabase SQL Editor
- Run

## Common Errors

### Error: "syntax error at or near 'migrations'"
**Cause:** You're trying to run the file path instead of the SQL content  
**Fix:** Open the file, copy the SQL code inside, paste into SQL Editor

### Error: "relation does not exist"
**Cause:** Table name is wrong or table doesn't exist  
**Fix:** Check table name spelling, verify table exists

### Error: "permission denied"
**Cause:** RLS policies blocking access  
**Fix:** Use service role key, or check RLS policies

## Quick Test

To verify you're doing it correctly, try this simple query:

```sql
-- Paste this into Supabase SQL Editor:
SELECT COUNT(*) as total_startups FROM startup_uploads;
```

If this works, you're set up correctly!
