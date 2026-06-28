# 🔄 Restore from Backup Guide

## Before Starting: Understand the Situation
- **Current state**: `startup_investor_matches` has 0 rows (data deleted)
- **You found**: Multiple backups available
- **Action needed**: Restore the backup with the most recent matches

## Step-by-Step Restoration Process

### Step 1: Identify the Best Backup

**In Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/database
2. Click "Backups" tab
3. List all available backups with dates
4. **Find backup with:**
   - Date closest to when matches were working
   - Contains `startup_investor_matches` table
   - Largest file size (more data = better)

### Step 2: Check Backup Contents (Before Restoring)

**Option A: Download and Inspect Backup**
```bash
# Download backup from Supabase dashboard
# Extract if compressed
# Search for startup_investor_matches
grep -i "startup_investor_matches" backup_file.sql | head -20
```

**Option B: Restore to Temporary Database**
1. Create a new Supabase project (temporary)
2. Restore backup there
3. Check row count:
   ```sql
   SELECT COUNT(*) FROM startup_investor_matches;
   ```
4. If good, proceed to restore on main project

### Step 3: Restore Backup

**⚠️ WARNING: This will overwrite current data!**

**Option A: Full Database Restore (Supabase Dashboard)**
1. Go to: Settings → Database → Backups
2. Click "Restore" on chosen backup
3. Confirm restoration
4. Wait for completion (may take 30+ minutes)

**Option B: Selective Table Restore (Recommended)**
```sql
-- 1. Create backup of current state (safety)
CREATE TABLE startup_investor_matches_backup AS 
SELECT * FROM startup_investor_matches;

-- 2. Download backup SQL file
-- 3. Extract ONLY startup_investor_matches data from backup
-- 4. Restore just that table:

-- Truncate current (empty) table
TRUNCATE TABLE startup_investor_matches;

-- Copy data from backup file (run the INSERT statements from backup)
-- Or use pg_restore if backup is in that format

-- 5. Verify restoration
SELECT COUNT(*) FROM startup_investor_matches;
SELECT MIN(created_at), MAX(created_at) FROM startup_investor_matches;
```

### Step 4: Verify Restoration

```sql
-- Check row count
SELECT COUNT(*) as total_matches FROM startup_investor_matches;

-- Check date range
SELECT 
  MIN(created_at) as oldest_match,
  MAX(created_at) as newest_match,
  COUNT(DISTINCT startup_id) as unique_startups,
  COUNT(DISTINCT investor_id) as unique_investors
FROM startup_investor_matches;

-- Check score distribution
SELECT 
  CASE
    WHEN match_score >= 80 THEN 'Excellent (80-100)'
    WHEN match_score >= 60 THEN 'Good (60-79)'
    WHEN match_score >= 40 THEN 'Fair (40-59)'
    ELSE 'Poor (0-39)'
  END as quality_range,
  COUNT(*) as count
FROM startup_investor_matches
GROUP BY 
  CASE
    WHEN match_score >= 80 THEN 'Excellent (80-100)'
    WHEN match_score >= 60 THEN 'Good (60-79)'
    WHEN match_score >= 40 THEN 'Fair (40-59)'
    ELSE 'Poor (0-39)'
  END
ORDER BY MIN(match_score) DESC;
```

### Step 5: Fix RLS Issues (After Restoration)

**Run the comprehensive RLS fix:**
```sql
-- Execute: migrations/fix_all_rls_issues_comprehensive.sql
-- This will:
-- 1. Enable RLS on all critical tables
-- 2. Create missing policies
-- 3. Verify everything is configured correctly
```

### Step 6: Test Dashboard

1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Check Matching Engine Admin dashboard
3. Verify match count matches database
4. Test loading a few matches

## Alternative: Partial Restore Strategy

If full restore is too risky, restore only matches:

```sql
-- From backup file, extract only:
INSERT INTO startup_investor_matches (
  id, startup_id, investor_id, match_score, 
  confidence_level, reasoning, status, created_at, ...
) VALUES
  (...),
  (...);
-- Repeat for all rows

-- Use COPY for faster bulk insert (if available)
\COPY startup_investor_matches FROM 'backup_data.csv' WITH CSV HEADER;
```

## Rollback Plan

If restoration causes issues:

```sql
-- Restore from safety backup
DROP TABLE IF EXISTS startup_investor_matches CASCADE;
CREATE TABLE startup_investor_matches AS 
SELECT * FROM startup_investor_matches_backup;
```

## Post-Restoration Checklist

- [ ] Backup restored successfully
- [ ] Row count matches expected
- [ ] Date range is correct
- [ ] Score distribution looks good
- [ ] RLS policies applied (`fix_all_rls_issues_comprehensive.sql`)
- [ ] Dashboard shows correct count
- [ ] Matches load correctly
- [ ] Queue processor can still insert new matches
- [ ] Safety checks added (`add_safety_checks_to_matches.sql`)

## Next Steps After Restoration

1. **Add safety checks** to prevent future deletion
2. **Enable automated backups** (daily)
3. **Set up monitoring** to alert on large deletions
4. **Document backup/restore procedures**
