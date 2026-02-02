# Database Migrations - Execution Order

Run these SQL files in order in the Supabase SQL Editor.

## Phase 3: Signal Architecture Tables

### Step 1: Create URL Normalization Function
```bash
File: 01_create_normalize_url_function.sql
```
**What it does**: Creates the `normalize_url()` function used by startup_jobs table

**Run in**: Supabase SQL Editor → SQL Query → Paste contents → Run

**Expected output**: `Function created successfully`

---

### Step 2: Create Startup Jobs Table
```bash
File: 02_create_startup_jobs_table.sql
```
**What it does**: 
- Creates `startup_jobs` table with URL normalization
- Adds unique constraint to prevent duplicate jobs
- Creates indexes for fast lookups
- Adds update trigger for `updated_at` column

**Depends on**: Step 1 must complete first

**Expected output**: `Table created successfully`

---

### Step 3: Create Signal Snapshots Table
```bash
File: 03_create_startup_signal_snapshots_table.sql
```
**What it does**:
- Creates `startup_signal_snapshots` table for signal history
- Stores Phase, Band, Matches over time
- One snapshot per hour per startup (enforced by unique index)

**Expected output**: `Table created successfully`

---

### Step 4: Create Signal Deltas Table
```bash
File: 04_create_startup_signal_deltas_table.sql
```
**What it does**:
- Creates `startup_signal_deltas` table for computed changes
- Stores differences between snapshots
- Used for "Signal Evolution" section (Phase 5)

**Depends on**: Step 3 must complete first

**Expected output**: `Table created successfully`

---

## Quick Run (All at Once)

If you prefer to run all migrations in one go:

```bash
File: run_all_signal_tables.sql
```

This file contains all 4 migrations in order. Run in Supabase SQL Editor.

---

## Verification

After running all migrations, verify tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'startup_jobs',
    'startup_signal_snapshots', 
    'startup_signal_deltas'
  )
ORDER BY table_name;
```

Expected result: 3 rows

---

## Testing

Test URL normalization works:

```bash
File: test_url_normalization.sql
```

Run this after all migrations complete to verify functionality.

---

## Rollback (if needed)

To remove all tables:

```sql
DROP TABLE IF EXISTS startup_signal_deltas CASCADE;
DROP TABLE IF EXISTS startup_signal_snapshots CASCADE;
DROP TABLE IF EXISTS startup_jobs CASCADE;
DROP FUNCTION IF EXISTS normalize_url(TEXT);
```

⚠️ **Warning**: This will delete all data in these tables!

---

## Next Steps After Migration

1. ✅ Migrations complete
2. [ ] Wire up `/api/discovery/submit` endpoint (see `server/routes/discoverySubmit.js`)
3. [ ] Create `/api/discovery/results` endpoint
4. [ ] Update frontend to use new endpoints
5. [ ] Start capturing signal snapshots on each match

See `SIGNAL_ARCHITECTURE.md` for full implementation plan.
