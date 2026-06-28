# Postgres Timeout Fix Guide

## Problem

**Error Signature**: `canceling statement due to statement timeout`  
**Postgres Error Code**: `57014` (query_canceled)  
**Root Cause**: Query too slow + statement_timeout too low

## Two-Layer Timeout Issue

```
User Request → Server (timeout wrapper: 2.5s) → Postgres (statement_timeout: 2-3s?)
                                                      ↑
                                                FIRES FIRST
                                           Kills query at DB level
                                    Server timeout never reached
```

**Problem**: Postgres timeout fires before server timeout wrapper can catch it.

---

## Diagnosis Steps

### 1. Check Current statement_timeout

```sql
-- Check default
SHOW statement_timeout;

-- Check per-role settings
SELECT rolname, rolconfig 
FROM pg_roles 
WHERE rolname IN ('authenticated', 'anon', 'service_role', 'postgres');
```

Expected output:
- If `statement_timeout` shows `2s` or `3s` → **TOO LOW**
- If no per-role config → Uses default (often 0 = unlimited, but may be overridden)

### 2. Identify Slow Query

**Check Server Logs** (look for these patterns):

```bash
pm2 logs api-server --lines 100 | grep -E "(statement timeout|57014|query_failed)"
```

**Look for**:
- `is_postgres_timeout: true` in structured logs
- X-Request-ID of failing request
- Table name: `startup_investor_matches`

**Example Log**:
```json
{
  "ts": "2025-01-21T02:30:45.123Z",
  "level": "error",
  "msg": "matches.query_failed",
  "requestId": "abc123",
  "startupId": "11cd88ad...",
  "error": "canceling statement due to statement timeout",
  "code": "57014",
  "is_postgres_timeout": true
}
```

### 3. Verify Missing Index

**Current Query** (from `/api/matches`):
```javascript
await supabase
  .from('startup_investor_matches')
  .select('investor_id, match_score, ...')
  .eq('startup_id', startupId)
  .gte('match_score', 20)
  .order('match_score', { ascending: false })
  .limit(100);
```

**Check Existing Indexes**:
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'startup_investor_matches'
  AND indexdef LIKE '%startup_id%';
```

**If No Index Found** → Root cause confirmed (full table scan on every match query)

---

## Fix Options

### Option A: Raise statement_timeout (Immediate - 5 Minutes)

**Pros**: Quick fix, deploys instantly  
**Cons**: Band-aid, doesn't fix slow query  
**Use When**: Need immediate mitigation while preparing proper fix

**SQL** (run in Supabase SQL Editor):
```sql
-- Check current values
SHOW statement_timeout;

-- Raise timeouts for all roles
ALTER ROLE authenticated SET statement_timeout = '10s';
ALTER ROLE anon SET statement_timeout = '10s';
ALTER ROLE service_role SET statement_timeout = '10s';

-- Verify
SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('authenticated', 'anon', 'service_role');
```

**After Deploy**:
- Reconnect all clients (or restart PM2: `pm2 restart api-server`)
- Test: `BASE=http://localhost:3002 scripts/smoke-api.sh`
- Monitor: `pm2 logs api-server | grep is_postgres_timeout`

---

### Option B: Add Index (Proper Fix - 10-30 Minutes)

**Pros**: Fixes root cause, makes query fast  
**Cons**: Takes time to build (CONCURRENTLY won't block reads/writes)  
**Use When**: Have a few minutes to let index build

**SQL** (run in Supabase SQL Editor):
```sql
-- Create index on hot path
CREATE INDEX CONCURRENTLY IF NOT EXISTS sim_startup_score_idx
ON public.startup_investor_matches (startup_id, match_score DESC);

-- Monitor progress
SELECT 
  phase,
  blocks_done,
  blocks_total,
  round(100.0 * blocks_done / NULLIF(blocks_total, 0), 2) AS pct_complete
FROM pg_stat_progress_create_index
WHERE relid = 'public.startup_investor_matches'::regclass;

-- After completion, verify usage
EXPLAIN ANALYZE
SELECT investor_id, match_score
FROM startup_investor_matches
WHERE startup_id = '11cd88ad-d464-4f5c-9e65-82da8ffe7e8a'
  AND match_score >= 20
ORDER BY match_score DESC
LIMIT 100;
```

**Expected EXPLAIN output** (after index):
```
Index Scan using sim_startup_score_idx on startup_investor_matches
  Index Cond: ((startup_id = '...') AND (match_score >= 20))
  Rows Removed by Filter: 0
  Execution Time: 12.456 ms  <-- Should be < 100ms now
```

**After Index Created**:
- No need to restart server (Postgres picks up index automatically)
- Test: `BASE=http://localhost:3002 scripts/smoke-api.sh`
- Should see no more `is_postgres_timeout: true` in logs

---

### Option C: Both (Recommended - Belt + Suspenders)

**Why Both**:
1. Raise timeout → Immediate relief while index builds
2. Add index → Long-term fix (query becomes fast enough timeout doesn't matter)

**Deploy Order**:
```bash
# Step 1: Immediate mitigation
ALTER ROLE authenticated SET statement_timeout = '10s';
ALTER ROLE anon SET statement_timeout = '10s';
ALTER ROLE service_role SET statement_timeout = '10s';
pm2 restart api-server

# Step 2: Proper fix (can run while system is live)
CREATE INDEX CONCURRENTLY IF NOT EXISTS sim_startup_score_idx
ON public.startup_investor_matches (startup_id, match_score DESC);

# Step 3: Monitor
pm2 logs api-server | grep -E "(is_postgres_timeout|duration_ms)"
```

---

## Verification

### 1. Backend Smoke Test
```bash
chmod +x scripts/smoke-api.sh
BASE=http://localhost:3002 scripts/smoke-api.sh https://example.com
```

**Pass Criteria**:
- ✅ No `504 Gateway Timeout` errors
- ✅ Cache working (X-Cache: HIT on second request)
- ✅ Rate limiting triggering (429 after burst)
- ✅ No `is_postgres_timeout: true` in logs

### 2. Check Logs for Errors
```bash
pm2 logs api-server --lines 100 --nostream | grep -E "(is_postgres_timeout|57014|statement timeout)"
```

**Expected**: Zero matches (no more Postgres timeouts)

### 3. Check Query Performance
```bash
# Watch structured logs for duration_ms
pm2 logs api-server --nostream | grep "matches.success" | tail -20
```

**Expected**:
- Before fix: Queries timing out (no log entry, or duration_ms > 2500)
- After Option A: Queries completing (duration_ms: 3000-9000)
- After Option B: Queries fast (duration_ms: 50-500)

---

## UI Fallback (Optional Enhancement)

**Frontend Change** (if you want friendly message instead of generic error):

```typescript
// In MatchingEngine.tsx or wherever /api/matches is called

const response = await fetch(`/api/matches?startup_id=${id}`);
const data = await response.json();

if (data.degraded && data.degradation_reasons?.includes('database query timeout')) {
  // Show friendly message
  return (
    <div className="degraded-state">
      <StartupCard {...data.startup} />
      <FundraisingWindow {...data.fundraising_window} />
      <Alert type="warning">
        <p>Top targets unavailable — retry in 30s</p>
        <Button onClick={() => window.location.reload()}>Retry Now</Button>
      </Alert>
    </div>
  );
}
```

**Benefit**: No white screen, no raw error → Better UX

---

## Troubleshooting

### Issue: Timeout still occurring after raising statement_timeout

**Check**:
1. Did you reconnect? → `pm2 restart api-server`
2. Is timeout actually raised? → `SHOW statement_timeout;` in Supabase SQL Editor
3. Is it a different query? → Check `requestId` in logs, verify it's `/api/matches`

### Issue: Index not being used

**Check**:
1. Did index finish building? → Check `pg_stat_progress_create_index`
2. Is query using correct columns? → Run `EXPLAIN ANALYZE` on actual query
3. Is Postgres caching old plan? → Restart Postgres (or wait for plan cache expiry)

### Issue: Index creation failed

**Check**:
1. Do you have `CONCURRENTLY` in statement? → Required for zero-downtime
2. Are there locks on table? → Check `pg_locks` for conflicts
3. Disk space? → Check Supabase dashboard for storage usage

---

## Related Files

| File | Purpose |
|------|---------|
| [server/index.js](server/index.js) | `/api/matches` endpoint with timeout detection |
| [server/utils/withTimeout.js](server/utils/withTimeout.js) | Server-side timeout wrapper (2.5s) |
| [scripts/smoke-api.sh](scripts/smoke-api.sh) | Backend smoke test (run after fix) |
| [GUARDRAILS_COMPLETE.md](GUARDRAILS_COMPLETE.md) | Guardrails implementation summary |

---

## Next Steps

1. ✅ Run diagnosis: `SHOW statement_timeout;` + check indexes
2. ⏳ Choose fix: Option A (quick), Option B (proper), or Option C (both)
3. ⏳ Deploy fix to Supabase
4. ⏳ Verify: `scripts/smoke-api.sh`
5. ⏳ Monitor: `pm2 logs | grep is_postgres_timeout` (should be zero)
6. ⏳ Optional: Add UI fallback for better UX

---

*Last updated: January 21, 2025*
