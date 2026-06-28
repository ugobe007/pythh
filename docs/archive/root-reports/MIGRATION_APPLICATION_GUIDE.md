# MIGRATION APPLICATION GUIDE
## Apply Day 2 Behavioral Physics Infrastructure

**Status**: Migration SQL ready, needs to be applied to Supabase database

**Migration File**: `supabase/migrations/20260119_convergence_engine_v1.sql`

---

## ⚠️ Important Notes

### Why Manual Application Recommended

The Supabase JS client doesn't support executing DDL (Data Definition Language) statements like `CREATE TABLE`, `CREATE VIEW`, etc. through the standard API. The most reliable way is to use the Supabase Dashboard SQL Editor.

### What This Migration Creates

- **3 Tables**: Observer tracking, portfolio adjacency, behavior summary
- **4 Views**: FOMO aggregates, triggers, observers_7d, convergence_candidates
- **1 Social Proof View**: Comparable startups
- **8 Indexes**: Performance optimization for scale
- **2 Helper Functions**: Observer count, FOMO state

---

## Option A: Supabase Dashboard (RECOMMENDED)

### Step 1: Open SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **+ New query**

### Step 2: Copy Migration SQL

```bash
# From your terminal, copy the entire file
cat supabase/migrations/20260119_convergence_engine_v1.sql | pbcopy
```

Or manually:
1. Open `supabase/migrations/20260119_convergence_engine_v1.sql`
2. Select all (Cmd+A)
3. Copy (Cmd+C)

### Step 3: Paste and Run

1. Paste the SQL into the editor (Cmd+V)
2. Click **Run** (or Cmd+Enter)
3. Wait for execution (should take 2-3 seconds)

### Step 4: Verify Success

You should see output like:
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE INDEX
CREATE INDEX
...
CREATE FUNCTION
CREATE FUNCTION
```

If you see errors, check:
- Tables don't already exist (drop them first if needed)
- You have proper permissions (owner/admin)

---

## Option B: psql Command Line

### Prerequisites

- `psql` installed (`brew install postgresql` on Mac)
- Database connection string from Supabase

### Step 1: Get Connection String

1. Supabase Dashboard > **Settings** > **Database**
2. Under "Connection string", copy the **Connection pooling** string
3. Should look like: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

### Step 2: Set Environment Variable

```bash
export DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
```

### Step 3: Apply Migration

```bash
psql $DATABASE_URL -f supabase/migrations/20260119_convergence_engine_v1.sql
```

### Step 4: Verify

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM investor_startup_observers;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM convergence_candidates;"
```

Should both return `0` (tables exist, no data yet).

---

## Option C: Supabase CLI

### Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Logged in (`supabase login`)

### Step 1: Link Project

```bash
supabase link --project-ref [YOUR_PROJECT_REF]
```

Get project ref from Supabase Dashboard URL: `https://supabase.com/dashboard/project/[PROJECT_REF]`

### Step 2: Apply Migration

```bash
supabase db push --include-all
```

Or manually:

```bash
supabase db execute --file supabase/migrations/20260119_convergence_engine_v1.sql
```

### Step 3: Verify

```bash
supabase db execute --query "SELECT COUNT(*) FROM investor_startup_observers;"
```

---

## Verification Checklist

After applying migration, run these checks:

### 1. Tables Exist

```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'investor_startup_observers',
    'investor_portfolio_adjacency',
    'investor_behavior_summary'
  );
```

**Expected**: 3 rows

---

### 2. Views Exist

```sql
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN (
    'investor_startup_fomo',
    'investor_startup_fomo_triggers',
    'startup_observers_7d',
    'convergence_candidates',
    'comparable_startups'
  );
```

**Expected**: 5 rows

---

### 3. Indexes Exist

```sql
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%observers%' 
   OR indexname LIKE 'idx_%convergence%'
   OR indexname LIKE 'idx_%adj%'
   OR indexname LIKE 'idx_%behavior%';
```

**Expected**: 8+ rows

---

### 4. Functions Exist

```sql
SELECT proname 
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN ('get_observers_7d', 'get_startup_fomo_state');
```

**Expected**: 2 rows

---

### 5. Test Query

```sql
-- This should work without errors (may return 0 rows)
SELECT 
  startup_id,
  investors_observing,
  fomo_state,
  signal_7d
FROM convergence_candidates
LIMIT 1;
```

**Expected**: Query executes (returns empty or 1 row)

---

## Troubleshooting

### Error: "relation already exists"

**Cause**: Tables/views already created

**Solution**: Drop existing objects first:

```sql
DROP VIEW IF EXISTS convergence_candidates CASCADE;
DROP VIEW IF EXISTS comparable_startups CASCADE;
DROP VIEW IF EXISTS startup_observers_7d CASCADE;
DROP VIEW IF EXISTS investor_startup_fomo_triggers CASCADE;
DROP VIEW IF EXISTS investor_startup_fomo CASCADE;

DROP TABLE IF EXISTS investor_behavior_summary CASCADE;
DROP TABLE IF EXISTS investor_portfolio_adjacency CASCADE;
DROP TABLE IF EXISTS investor_startup_observers CASCADE;
```

Then re-apply migration.

---

### Error: "permission denied"

**Cause**: Using anon key instead of service role

**Solution**: Use service_role key or owner account

In Supabase Dashboard: Settings > API > Copy `service_role` key (secret)

---

### Error: "function does not exist"

**Cause**: Helper functions not created

**Solution**: Ensure you ran the FULL migration file, including the functions at the end

---

### Query Returns "relation does not exist"

**Cause**: Migration not applied or wrong schema

**Solution**: Verify tables exist:

```sql
\dt investor_*
```

Should show:
- investor_startup_observers
- investor_portfolio_adjacency
- investor_behavior_summary

---

## Next Steps After Migration Applied

1. **Verify tables exist** (checklist above)
2. **Seed observer clusters**:
   ```bash
   node scripts/seed-observer-clusters.js
   ```
3. **Test golden path startup**:
   ```bash
   curl "http://localhost:3002/api/discovery/convergence?url=<startup-url>"
   ```
4. **Check for real data**:
   ```bash
   curl "http://localhost:3002/api/discovery/convergence?url=<url>" | jq '.status.observers_7d'
   # Should return > 0 (not hardcoded 0)
   ```

---

## Quick Start (Recommended Path)

```bash
# 1. Apply migration (Supabase Dashboard method)
#    - Open SQL Editor
#    - Paste migration SQL
#    - Run

# 2. Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM investor_startup_observers;"

# 3. Seed data
node scripts/seed-observer-clusters.js

# 4. Test
curl "http://localhost:3002/api/discovery/convergence?url=<startup-url>" | jq .
```

---

**Status**: 📋 Ready for manual application

**Recommended**: Use Option A (Supabase Dashboard) - most reliable

**Time**: 2-3 minutes

