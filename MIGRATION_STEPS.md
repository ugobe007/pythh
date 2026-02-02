# Migration Deployment - Step by Step

The migration has been split into 4 parts to avoid connection timeouts.

## Run in Supabase SQL Editor (in order):

### 1. Enums and Table (30 seconds)
**File:** `migrations/001a-enums-and-table.sql`
- Creates enums: `match_run_status`, `match_run_step`
- Creates table: `match_runs`
- Creates indexes

**Run this first**, wait for success.

---

### 2. Utility Functions (15 seconds)
**File:** `migrations/001b-utility-functions.sql`
- Creates `canonicalize_url()` function
- Creates `touch_updated_at()` trigger function
- Creates trigger on `match_runs`
- Creates `release_expired_leases()` function

**Run after Part 1 succeeds.**

---

### 3. Core RPC (30 seconds)
**File:** `migrations/001c-core-rpcs.sql`
- Creates `start_match_run()` function (main entry point)

**Run after Part 2 succeeds.**

---

### 4. Worker RPCs (30 seconds)
**File:** `migrations/001d-worker-rpcs.sql`
- Creates `get_match_run()` function
- Creates `claim_next_match_run()` function
- Creates `complete_match_run()` function

**Run after Part 3 succeeds.**

---

## Quick Deploy Script

```bash
# Or copy/paste each file into Supabase SQL Editor one at a time:
# 1. https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt/sql
# 2. New query
# 3. Paste contents of 001a, click Run
# 4. Wait for success
# 5. Repeat for 001b, 001c, 001d
```

---

## Verification

After all 4 parts are deployed, test:

```sql
-- Check table exists
SELECT COUNT(*) FROM match_runs;

-- Check enums exist
SELECT enum_range(NULL::match_run_status);

-- Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%match_run%';
```

Should return:
- `start_match_run`
- `get_match_run`
- `claim_next_match_run`
- `complete_match_run`

---

## Then test the API:

```bash
curl -X POST http://localhost:3002/api/match/run \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://anthropic.com"}'
```

Should return: `{"run_id":"...","status":"queued",...}`
