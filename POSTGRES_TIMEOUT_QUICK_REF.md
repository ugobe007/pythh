# Postgres Timeout Resolution - Quick Reference

## Problem Confirmed

**Error**: "canceling statement due to statement timeout" (Postgres error 57014)  
**Location**: `/api/matches` endpoint  
**Root Cause**: Query on `startup_investor_matches` table timing out

---

## Quick Diagnosis (30 seconds)

Run in **Supabase SQL Editor**:

```sql
-- Check current timeout
SHOW statement_timeout;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'startup_investor_matches';
```

**If you see**:
- `statement_timeout = 2s` or `3s` → **TOO LOW** (need Option A)
- No index with `(startup_id, match_score)` → **MISSING INDEX** (need Option B)

---

## Quick Fixes

### Option A: Raise Timeout (5 minutes)

**Supabase SQL Editor**:
```sql
ALTER ROLE authenticated SET statement_timeout = '10s';
ALTER ROLE anon SET statement_timeout = '10s';
ALTER ROLE service_role SET statement_timeout = '10s';
```

**Then**:
```bash
pm2 restart api-server
BASE=http://localhost:3002 scripts/smoke-api.sh
```

### Option B: Add Index (10-30 minutes)

**Supabase SQL Editor**:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS sim_startup_score_idx
ON public.startup_investor_matches (startup_id, match_score DESC);
```

**Monitor**:
```sql
SELECT phase, blocks_done, blocks_total
FROM pg_stat_progress_create_index
WHERE relid = 'public.startup_investor_matches'::regclass;
```

**After completion**:
```bash
BASE=http://localhost:3002 scripts/smoke-api.sh
```

---

## Verification

### Backend Test
```bash
./scripts/smoke-api.sh
```

**Pass criteria**:
- ✅ No 504 errors
- ✅ Cache working (X-Cache: HIT)
- ✅ Rate limiting (429 after burst)

### Check Logs
```bash
pm2 logs api-server | grep is_postgres_timeout
```

**Expected**: Zero matches (no timeouts)

---

## Files

| File | Purpose |
|------|---------|
| [POSTGRES_TIMEOUT_FIX.md](POSTGRES_TIMEOUT_FIX.md) | Complete guide with troubleshooting |
| [scripts/smoke-api.sh](scripts/smoke-api.sh) | Automated backend testing |
| [scripts/diagnose-postgres.sql](scripts/diagnose-postgres.sql) | Run in Supabase to diagnose |
| [scripts/fix-postgres-timeout.sql](scripts/fix-postgres-timeout.sql) | SQL fixes (uncomment to apply) |

---

## Current Status

✅ **Detection**: Added `is_postgres_timeout: true` logging  
✅ **Testing**: Smoke test script created  
✅ **Documentation**: Complete fix guide written  
⏳ **Diagnosis**: Need to run `diagnose-postgres.sql` in Supabase  
⏳ **Fix**: Need to apply Option A or B (or both)

---

## Next Steps

1. **Run diagnosis**: Copy `scripts/diagnose-postgres.sql` into Supabase SQL Editor
2. **Choose fix**: 
   - Quick → Option A (raise timeout)
   - Proper → Option B (add index)
   - Best → Both (A for immediate, B for long-term)
3. **Verify**: `./scripts/smoke-api.sh`
4. **Monitor**: `pm2 logs api-server --lines 100`

---

*Commit: 69f5550e - Postgres timeout detection + smoke tests*
