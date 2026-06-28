# 🚨 EMERGENCY RECOVERY PLAN - Data Loss Incident

## What Happened
- **Table**: `startup_investor_matches`
- **Status**: 0 rows (data deleted/truncated)
- **Evidence**: 71 MB of orphaned indexes (proves data existed)
- **Impact**: All 4.5M matches lost

## Immediate Actions (Priority Order)

### 1. CHECK SUPABASE BACKUPS (5 minutes)
**Most Important - Do This FIRST:**

1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/settings/database
2. Click "Backups" section
3. Check for automated backups from BEFORE data was deleted
4. If backup exists → **RESTORE IMMEDIATELY**

**OR via CLI:**
```bash
supabase projects list-backups unkpogyhhjbvxxjvmxlt
```

### 2. CHECK SUPABASE LOGS (10 minutes)
**Find out WHEN and HOW data was deleted:**

1. Go to: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/logs/explorer
2. Filter by: `startup_investor_matches`
3. Look for: `DELETE`, `TRUNCATE`, `DROP TABLE`
4. Check timestamp to see when it happened
5. This will tell us if it was:
   - A migration script
   - Manual SQL command
   - Automated cleanup job
   - Foreign key CASCADE deletion

### 3. REGENERATE DATA (2-4 hours)
**If no backup available, regenerate all matches:**

```bash
# Option A: Direct execution (runs until complete)
node scripts/core/queue-processor-v16.js

# Option B: Background with PM2 (monitored)
pm2 start scripts/core/queue-processor-v16.js --name queue-processor --log logs/queue-processor.log

# Option C: Via API (from Matching Engine Admin)
# Click "Trigger Queue Processor" button
```

**Expected Results:**
- ~4,000 startups × 100 matches each = ~400,000 matches
- Processing time: 2-4 hours
- This is NEW data (not the old 4.5M, but fresh matches)

### 4. PREVENT FUTURE DATA LOSS

#### A. Add Safety Checks to Migrations
```sql
-- BEFORE any DROP/TRUNCATE, check row count
DO $$
DECLARE
  row_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO row_count FROM startup_investor_matches;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'SAFETY CHECK: Table has % rows. Aborting to prevent data loss!', row_count;
  END IF;
END $$;
```

#### B. Enable Point-in-Time Recovery (PITR)
1. Go to Supabase Dashboard → Settings → Database
2. Enable "Point-in-Time Recovery"
3. This allows restoration to any timestamp

#### C. Create Automated Backups
```bash
# Add to crontab or GitHub Actions
0 2 * * * pg_dump $POSTGRES_URL > backups/startup_investor_matches_$(date +%Y%m%d).sql
```

#### D. Add Data Protection Policies
- Require confirmation before TRUNCATE/DELETE on production
- Log all destructive operations
- Set up alerts for large row deletions

## Root Cause Analysis Needed

**Check these possibilities:**

1. **Migration Script Bug**
   - Did `create_startup_investor_matches_fast.sql` run and drop/recreate table?
   - Check migration history in Supabase

2. **Foreign Key CASCADE**
   - Did deletion of `startup_uploads` or `investors` cascade?
   - Check: `ON DELETE CASCADE` constraints

3. **Automated Cleanup Job**
   - Check for cron jobs or scheduled tasks
   - Check GitHub Actions workflows

4. **Manual Deletion**
   - Check Supabase audit logs
   - Check who has database access

## Next Steps

1. **IMMEDIATE**: Check Supabase backups (highest priority)
2. **URGENT**: Check logs to understand what happened
3. **IMPORTANT**: Start regeneration if no backup
4. **CRITICAL**: Implement safeguards to prevent recurrence

## Communication Plan

- Notify stakeholders of data loss
- Set expectations: 2-4 hours to regenerate
- Explain: New matches will be generated (not exact restoration of old data)
- Commit to: Implementing safeguards to prevent future incidents
