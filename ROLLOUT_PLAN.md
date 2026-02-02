# Bulletproof Matching Engine V1 - Safe Rollout Plan

## Overview

This is a **high-value, zero-downtime migration** strategy. We protect the 4.1M match corpus while proving the new system works before exposing it to users.

---

## Phase 1: Shadow Mode (Week 1)

**Goal:** Deploy infrastructure, verify core mechanics work

### Deploy

```bash
# 1. Apply migrations (already split into 4 parts)
# migrations/001a-enums-and-table.sql
# migrations/001b-utility-functions.sql
# migrations/001c-core-rpcs.sql
# migrations/001d-worker-rpcs.sql

# 2. Start worker
pm2 start server/matchRunWorker.js \
  --name match-worker \
  --cron "*/10 * * * * *" \
  --no-autorestart

# 3. DO NOT deploy frontend changes yet
```

### Shadow Testing

**Method:** Manually trigger runs for URLs already in production

```bash
# Pick 100 URLs from your existing startup_uploads
psql $DATABASE_URL -c "
  SELECT url FROM startup_uploads 
  WHERE url IS NOT NULL 
  LIMIT 100;
" > test-urls.txt

# Trigger runs for each
while read url; do
  curl -X POST http://localhost:3002/api/match/run \
    -H 'Content-Type: application/json' \
    -d "{\"url\":\"$url\"}"
  sleep 1
done < test-urls.txt
```

### Verify

```sql
-- Check idempotency (same canonical_url → same run_id)
SELECT canonical_url, COUNT(*) as run_count
FROM match_runs
WHERE status IN ('created', 'queued', 'processing')
GROUP BY canonical_url
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check lease recovery
SELECT * FROM match_runs
WHERE status = 'processing'
  AND lock_expires_at < now();
-- Should be 0 after release_expired_leases() runs

-- Compare match counts
SELECT 
  mr.run_id,
  mr.startup_id,
  mr.match_count as new_count,
  (SELECT COUNT(*) FROM startup_investor_matches sim 
   WHERE sim.startup_id = mr.startup_id) as old_count,
  (mr.match_count - (SELECT COUNT(*) FROM startup_investor_matches sim 
   WHERE sim.startup_id = mr.startup_id)) as diff
FROM match_runs mr
WHERE mr.status = 'ready'
ORDER BY ABS(mr.match_count - (SELECT COUNT(*) FROM startup_investor_matches sim 
   WHERE sim.startup_id = mr.startup_id)) DESC
LIMIT 20;
-- Differences should be minimal (< 5%)
```

### Success Criteria

- ✅ 100 runs created successfully
- ✅ No duplicate active runs per canonical URL
- ✅ Worker claims and completes runs (status='ready')
- ✅ Match counts within 5% of existing data
- ✅ Lease recovery works (manually kill worker, check recovery)
- ✅ Debug RPC returns useful info

### Red Flags (Stop rollout if seen)

- ❌ Duplicate active runs for same canonical_url
- ❌ Runs stuck in 'processing' after lease expiry + cron
- ❌ Match counts differ by >10% from existing data
- ❌ Worker crashes/restarts frequently

---

## Phase 2: Dual Path (Week 2)

**Goal:** A/B test new vs old flow with internal users

### Feature Flag Setup

```typescript
// src/lib/featureFlags.ts
export const MATCH_ENGINE_V1_ENABLED = 
  import.meta.env.VITE_MATCH_ENGINE_V1 === 'true' ||
  localStorage.getItem('match_engine_v1') === 'true';

// Enable for specific users
export function isMatchEngineV1Enabled(userId?: string) {
  // Internal team users
  const BETA_USERS = ['andy@hotmatch.com', 'internal@hotmatch.com'];
  
  if (userId && BETA_USERS.includes(userId)) {
    return true;
  }
  
  return MATCH_ENGINE_V1_ENABLED;
}
```

### Frontend Wrapper

```typescript
// src/components/MatchingEngineWrapper.tsx
import { MATCH_ENGINE_V1_ENABLED } from '../lib/featureFlags';
import { MatchingEngineV1 } from './MatchingEngineV1'; // New
import { MatchingEngineLegacy } from './MatchingEngineLegacy'; // Old

export function MatchingEngine() {
  if (MATCH_ENGINE_V1_ENABLED) {
    return <MatchingEngineV1 />;
  }
  return <MatchingEngineLegacy />;
}
```

### Enable for Internal Team

```bash
# In browser console (for each internal tester)
localStorage.setItem('match_engine_v1', 'true');
location.reload();
```

### Monitor Comparison

```sql
-- Compare timing: V1 vs Legacy
-- (Add timing logs to both flows)

-- V1 timing
SELECT 
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds,
  MAX(EXTRACT(EPOCH FROM (updated_at - created_at))) as max_seconds,
  COUNT(*) as total_runs
FROM match_runs
WHERE status = 'ready'
  AND created_at > now() - interval '24 hours';

-- Check error rates
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percent
FROM match_runs
WHERE created_at > now() - interval '24 hours'
GROUP BY status;
```

### Success Criteria

- ✅ Internal users prefer V1 UX (no pulsating, clear status)
- ✅ V1 avg timing ≤ legacy timing
- ✅ V1 error rate ≤ legacy error rate
- ✅ Match results identical between V1 and legacy

### Red Flags

- ❌ V1 consistently slower than legacy
- ❌ Users report confusing states or false errors
- ❌ Match results differ significantly

---

## Phase 3: Cutover (Week 3)

**Goal:** Flip all traffic to V1, keep legacy code as backup

### Deploy Frontend

```bash
# 1. Set global feature flag
# .env.production
VITE_MATCH_ENGINE_V1=true

# 2. Build and deploy
npm run build
# Deploy to production

# 3. Monitor error rates in real-time
pm2 logs api-server | grep -i "match-run"
```

### Fallback Plan

If issues arise within first 24h:

```bash
# Emergency rollback (30 seconds)
# 1. Flip flag back
VITE_MATCH_ENGINE_V1=false

# 2. Rebuild
npm run build

# 3. Deploy

# V1 infrastructure keeps running (no data loss)
# All match_runs remain for analysis
```

### Monitor for 7 Days

**Dashboards to watch:**

```sql
-- Daily health check
WITH daily_stats AS (
  SELECT 
    DATE(created_at) as day,
    COUNT(*) as total_runs,
    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as success,
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
    AVG(match_count) as avg_matches
  FROM match_runs
  WHERE created_at > now() - interval '7 days'
  GROUP BY DATE(created_at)
)
SELECT 
  day,
  total_runs,
  success,
  errors,
  ROUND(errors * 100.0 / total_runs, 2) as error_rate_pct,
  avg_matches
FROM daily_stats
ORDER BY day DESC;
```

### Success Criteria

- ✅ 7 days of stable operation
- ✅ Error rate < 2%
- ✅ No user complaints about matching engine
- ✅ Average match time < 5 seconds
- ✅ Zero database corruption issues

---

## Phase 4: Decommission (Week 4+)

**Goal:** Clean up legacy code safely

### DO NOT DELETE

Keep these **forever** (audit trail):
- `match_runs` table (becomes permanent audit log)
- All RPC functions
- Worker code

### Safe to Remove (After 30 days of stability)

1. **Frontend:**
   ```typescript
   // Remove MatchingEngineLegacy.tsx
   // Remove old polling logic in store.ts
   // Remove feature flag checks
   ```

2. **Backend:**
   ```javascript
   // Remove old /api/matches/scan endpoint (if it duplicates functionality)
   // Keep all RPC wrappers
   ```

3. **Database:**
   ```sql
   -- DO NOT drop match_runs table
   -- DO NOT drop RPCs
   -- Only archive old runs if needed for space:
   
   -- Move runs older than 90 days to archive table
   CREATE TABLE match_runs_archive (LIKE match_runs INCLUDING ALL);
   
   INSERT INTO match_runs_archive
   SELECT * FROM match_runs
   WHERE created_at < now() - interval '90 days';
   
   DELETE FROM match_runs
   WHERE created_at < now() - interval '90 days';
   ```

### Final Verification

```bash
# Run full system health check
node system-guardian.js

# Should show:
# ✅ Scraper Health: OK
# ✅ GOD Score Health: OK
# ✅ Database Integrity: OK
# ✅ Match Quality: OK (using match_runs data)
# ✅ ML Pipeline: OK
# ✅ Data Freshness: OK
```

---

## Rollback Procedures

### During Phase 2 (Internal Beta)

**Time to rollback: 30 seconds**

```bash
# Disable flag
localStorage.removeItem('match_engine_v1');
location.reload();
```

### During Phase 3 (Production)

**Time to rollback: 5 minutes**

```bash
# 1. Flip environment variable
VITE_MATCH_ENGINE_V1=false

# 2. Rebuild frontend
npm run build

# 3. Deploy
# (Your deployment process)

# 4. Verify legacy flow works
curl http://localhost:3002/api/matches/generate \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://anthropic.com"}'
```

**V1 infrastructure keeps running** - no data loss, can investigate offline.

### During Phase 4 (Post-decommission)

**No rollback available** - this is intentional. By Phase 4, you've had 30+ days of stability.

---

## Monitoring & Alerts

### Key Metrics to Track

```sql
-- Hourly health dashboard
CREATE OR REPLACE VIEW match_runs_health_hourly AS
SELECT 
  date_trunc('hour', created_at) as hour,
  COUNT(*) as total_runs,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_sec,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at))) as p95_duration_sec,
  SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
  ROUND(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as error_rate_pct,
  AVG(match_count) as avg_matches_per_run
FROM match_runs
WHERE created_at > now() - interval '7 days'
GROUP BY date_trunc('hour', created_at)
ORDER BY hour DESC;
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error rate | > 5% | > 10% | Check logs, run debug RPC |
| Avg duration | > 10s | > 30s | Check worker health, DB load |
| Stuck runs | > 5 | > 20 | Run `release_expired_leases()` |
| Zero runs/hour | - | Yes | Worker down, restart PM2 |

### Slack Alerts (Optional)

```javascript
// Add to system-guardian.js
async function checkMatchRunsHealth() {
  const { data } = await supabase.rpc('match_runs_health_check');
  
  if (data.error_rate_pct > 10) {
    await sendSlackAlert({
      channel: '#engineering-alerts',
      text: `🚨 Match Engine V1 Error Rate: ${data.error_rate_pct}%`,
      details: data
    });
  }
}
```

---

## Decision Matrix

| Issue | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|-------|---------|---------|---------|---------|
| High error rate | Fix offline | Disable for beta users | Rollback to legacy | Fix live (no rollback) |
| Slow performance | Optimize worker | Disable for beta users | Rollback to legacy | Optimize live |
| Data corruption | Stop rollout | Stop rollout | Rollback immediately | Fix immediately |
| UX confusion | Fix documentation | Iterate design | Improve messaging | Iterate design |

---

## Success Definition

**System is production-ready when:**

1. ✅ 30 days of continuous operation
2. ✅ Error rate < 2% (measured over 7-day rolling window)
3. ✅ 99.9% of runs complete in < 10 seconds
4. ✅ Zero database corruption incidents
5. ✅ Zero user-reported "pulsating UI" bugs
6. ✅ Match results identical to legacy system (within 1% variance)
7. ✅ Worker recovery from failures < 5 minutes (via lease expiry)

**At that point:**
- V1 becomes "boring infrastructure"
- Legacy code can be safely removed
- Team confidence = 100%

---

## Timeline Summary

| Phase | Duration | Risk Level | User Impact |
|-------|----------|------------|-------------|
| 1. Shadow | 7 days | None | Zero (invisible) |
| 2. Dual Path | 7 days | Low | Internal only |
| 3. Cutover | 7 days | Medium | All users (monitored) |
| 4. Decommission | 30+ days | Low | None (cleanup) |

**Total: 50+ days from migration to full decommission**

**Philosophy:** Slow is smooth, smooth is fast. Protecting 4.1M match corpus is worth the patience.
