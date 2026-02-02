# Bulletproof Matching Engine V1 - Deployment Guide

## 🚀 Quick Deployment (5 minutes)

### Step 1: Apply Migration (via Supabase Dashboard)

1. Go to your Supabase project: https://supabase.com/dashboard/project/unkpogyhhjbvxxjvmxlt
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy the entire contents of `migrations/001-match-runs-orchestration.sql`
5. Paste into the SQL editor
6. Click **Run** button (bottom right)
7. Verify success: You should see "Success. No rows returned"

### Step 2: Restart Server

```bash
pm2 restart server
```

### Step 3: Add Worker to PM2 (optional - for auto-processing)

```bash
pm2 start server/matchRunWorker.js \
  --name match-worker \
  --cron "*/10 * * * * *" \
  --no-autorestart
```

### Step 4: Test API

```bash
# Start a match run
curl -X POST http://localhost:3002/api/match/run \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://anthropic.com"}'

# You'll get back a run_id:
# {"run_id":"123e4567-e89b-12d3-a456-426614174000","status":"queued",...}

# Poll for results (run every 2 seconds until status='ready')
curl http://localhost:3002/api/match/run/123e4567-e89b-12d3-a456-426614174000
```

---

## 🏗️ What Was Built

### Database (Supabase)

1. **Enums**
   - `match_run_status`: created, queued, processing, ready, error
   - `match_run_step`: resolve, extract, parse, match, rank, finalize

2. **Table: `match_runs`**
   - Orchestration SSOT (Single Source of Truth)
   - Lease-based worker coordination
   - Never touches existing 4.1M matches

3. **RPC Functions**
   - `start_match_run(url)` → Creates/reuses run (idempotent)
   - `get_match_run(run_id)` → Returns status + matches
   - `claim_next_match_run(worker_id)` → Worker pickup (lease)
   - `complete_match_run(...)` → Worker completion
   - `release_expired_leases()` → Cron cleanup

4. **Utilities**
   - `canonicalize_url(text)` → URL normalization

### API Routes (Express)

- **POST /api/match/run** → Start/reuse match run
- **GET /api/match/run/:runId** → Poll status

File: `server/routes/matchRun.js`

### Worker (Node.js)

- **server/matchRunWorker.js** → Processes queued runs
- Pattern A (Read-only): Just counts matches, doesn't generate
- Runs every 10 seconds via PM2 cron

### Frontend Hook (React)

- **src/hooks/useMatchRun.ts** → Bulletproof state machine
- Can't pulse incorrectly (deterministic status flow)
- Polls every 2s until ready/error

---

## 🧪 Testing

### Test 1: Idempotency

Click "Get Matches" button 20 times rapidly → Should return same `run_id`

```bash
for i in {1..20}; do
  curl -X POST http://localhost:3002/api/match/run \
    -H 'Content-Type: application/json' \
    -d '{"url":"https://anthropic.com"}' | jq .run_id
done
```

All run_ids should be identical.

### Test 2: Worker Processing

```bash
# 1. Start a run
RUN_ID=$(curl -s -X POST http://localhost:3002/api/match/run \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://anthropic.com"}' | jq -r .run_id)

echo "Run ID: $RUN_ID"

# 2. Run worker once
node server/matchRunWorker.js

# 3. Check status (should be 'ready')
curl http://localhost:3002/api/match/run/$RUN_ID | jq .status
```

### Test 3: Frontend (manual)

1. Open browser to your app
2. Enter URL in matching engine
3. Click "Get Matches"
4. Should show: Loading → Polling → Ready (no pulsating!)

---

## 🐛 Troubleshooting

### Migration fails: "type already exists"

**Solution:** Migration is idempotent. Ignore these warnings or drop the types first:

```sql
DROP TYPE IF EXISTS match_run_status CASCADE;
DROP TYPE IF EXISTS match_run_step CASCADE;
DROP TABLE IF EXISTS match_runs CASCADE;
```

Then re-run the migration.

### API returns 500: "resolve_startup_by_url does not exist"

**Solution:** This RPC already exists in your DB. Verify:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%resolve%';
```

If missing, you'll need to create it first (check existing migrations).

### Worker doesn't process runs

**Solution:** Check PM2 logs:

```bash
pm2 logs match-worker
```

Common issues:
- Worker not running: `pm2 start server/matchRunWorker.js --name match-worker --cron "*/10 * * * * *"`
- Supabase credentials missing: Check `.env` file

### Frontend still pulsates

**Solution:** Make sure you're using the new `useMatchRun` hook:

```typescript
import { useMatchRun } from './hooks/useMatchRun';

function MatchingEngine() {
  const { startMatch, matches, status, isLoading } = useMatchRun();
  
  return (
    <button onClick={() => startMatch(url)} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Get Matches'}
    </button>
  );
}
```

---

## 📊 Monitoring

### Check recent runs

```sql
SELECT run_id, input_url, status, step, match_count, created_at
FROM match_runs
ORDER BY created_at DESC
LIMIT 20;
```

### Check queue depth

```sql
SELECT status, COUNT(*) as count
FROM match_runs
GROUP BY status;
```

### Check expired leases

```sql
SELECT COUNT(*) as stuck_runs
FROM match_runs
WHERE status = 'processing'
  AND lock_expires_at < now();
```

To fix: `SELECT release_expired_leases();`

---

## ✅ Success Criteria

- [ ] Migration applied without errors
- [ ] Server restarted successfully
- [ ] POST /api/match/run returns `run_id`
- [ ] GET /api/match/run/:runId returns status
- [ ] Worker processes queued runs (check PM2 logs)
- [ ] Clicking "Get Matches" 20 times returns same `run_id`
- [ ] Frontend shows matches without pulsating
- [ ] Zero writes to `startup_investor_matches` table (Pattern A confirmed)

---

**Files Created:**

- ✅ `migrations/001-match-runs-orchestration.sql` (460 lines)
- ✅ `server/routes/matchRun.js` (162 lines)
- ✅ `server/matchRunWorker.js` (120 lines)
- ✅ `src/hooks/useMatchRun.ts` (180 lines)
- ✅ `MATCH_RUNS_DEPLOYMENT.md` (this file)

**Pattern:** Supabase RPC-first, read-only (Pattern A), add-only migrations
