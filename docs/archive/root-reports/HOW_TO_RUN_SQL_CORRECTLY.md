# ✅ How to Run SQL Files Correctly

## ❌ WRONG (What You Did):

```
leguplabs@Roberts-MacBook-Air hot-honey % migrations/check_why_only_4_processed.sql
```

**This tries to run the file path, which causes:**
```
ERROR: syntax error at or near "leguplabs"
```

---

## ✅ CORRECT (What You Should Do):

### Method 1: Copy/Paste SQL Content (Recommended)

1. **Open the SQL file** in your code editor:
   - `migrations/check_why_only_4_processed_DIRECT.sql`

2. **Select ALL the SQL code** (Cmd+A / Ctrl+A)

3. **Copy it** (Cmd+C / Ctrl+C)

4. **Go to Supabase SQL Editor**:
   - https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/sql/new

5. **Paste the SQL** into the editor (Cmd+V / Ctrl+V)

6. **Click "Run"** button

**You should see ONLY SQL code in the editor, like this:**
```sql
SELECT 
  'IMPORT STATUS BREAKDOWN' as section,
  ...
```

**NOT file paths or command prompts!**

---

### Method 2: Use psql Command Line (Advanced)

```bash
# Connect to Supabase database
psql "postgresql://postgres:[PASSWORD]@db.unkpogyhhjbvxxjvmxlt.supabase.co:5432/postgres"

# Then run the file
\i migrations/check_why_only_4_processed_DIRECT.sql
```

---

## Quick Test Query (Verify You're Doing It Right)

**Copy this into Supabase SQL Editor:**

```sql
SELECT COUNT(*) as total_discovered FROM discovered_startups;
```

**If this works, you're doing it correctly!** ✅

---

## Common Mistakes to Avoid:

1. ❌ Don't copy the file path
2. ❌ Don't include terminal commands (`leguplabs@Roberts-MacBook-Air...`)
3. ❌ Don't include comments about file paths
4. ✅ DO copy only the SQL code inside the file
5. ✅ DO paste it directly into Supabase SQL Editor

---

## Files Ready to Run:

- ✅ `migrations/check_why_only_4_processed_DIRECT.sql` - Clean version, ready to copy/paste
- ✅ All SQL files with `_DIRECT.sql` suffix are formatted for easy copy/paste
