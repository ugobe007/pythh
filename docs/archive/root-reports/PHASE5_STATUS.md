# Phase 5 Completion Status + Queue Blocker Fix

## ✅ What's Complete

### Frontend (Phase 5 UI - Truth-Sealed)
- ✅ SignalEvolutionSection component (110 lines, 3-column grid)
- ✅ SignalDelta type with 11 fields
- ✅ fetchLatestDelta() client helper
- ✅ Wired into DiscoveryResultsPage after SignalHeroFrame
- ✅ **All 4 truth leaks sealed:**
  - Inline phase5Ready extraction (no intermediate variable)
  - Minimal effect deps `[status, phase5Ready, startupId]`
  - Two-stage render gate `phase5Ready && signalDelta`
  - Delta cleared on submit
- ✅ Build passes: 367KB gzipped

### Backend (URL Normalization - Locked)
- ✅ Created shared `server/lib/urlNormalize.js`
- ✅ Updated discoverySubmit.js to use shared helper
- ✅ Added hard guard to prevent null url_normalized (lines 130-137)
- ✅ Fixed startup lookup to normalize all websites client-side (lines 88-102)
- ✅ Submit endpoint now works: nucleoresearch.com returns job_id successfully

## 🚧 Current Blocker: Match Queue Processor

### Problem
Worker crashes with:
```
❌ Failed to get next queue item: duplicate key value violates unique constraint "match_generation_queue_startup_id_status_key"
```

### Root Cause
- Unique constraint: `UNIQUE(startup_id, status)` in match_generation_queue table
- 92 rows stuck with status='processing' (older than 30 minutes)
- Worker can't claim new work because constraint prevents duplicate (startup_id, 'processing') pairs
- Queue has 321 pending items that can't be processed

### Solution (3 Steps)

#### Step 1: Run SQL Fix in Supabase
Run [fix-queue-blocker.sql](fix-queue-blocker.sql) in Supabase SQL Editor:

```bash
# Preview the fix
cat fix-queue-blocker.sql
```

**What it does:**
1. Releases stuck 'processing' items back to 'pending' (30+ min old)
2. Adds error handling to get_next_from_queue()
3. Creates cleanup_stuck_queue_items() function for future use
4. Shows queue status and duplicate entries

#### Step 2: Restart Worker
```bash
pm2 restart match-queue-processor
pm2 logs match-queue-processor --lines 50
```

**Expected output:**
```
✅ Processed: >0
✅ Succeeded: >0
📋 Queue Status: processing: 0-5 items (actively working)
```

#### Step 3: Verify Job Progresses
```bash
# Wait 30 seconds, then check job status
sleep 30
curl -s "http://localhost:3002/api/discovery/results?job_id=616e9c78-a439-4d9a-bfdd-dc3064f9f5d1" | jq '.status, .progress'
```

**Expected:** Status advances from "building" (5%) → "scoring" (30%) → "matching" (60%) → "ready" (100%)

## 📊 Current System State

### PM2 Processes
| Process | Status | Issue |
|---------|--------|-------|
| api-server | ✅ online | Working (restart #69) |
| match-queue-processor | ❌ stopped | Needs SQL fix + restart |
| match-regenerator | ❌ stopped | Not needed for Phase 5 |
| system-guardian | ❌ stopped | Optional |

### Database State
| Table | Count | Status |
|-------|-------|--------|
| startup_jobs | 1+ | Building (stuck at 5%) |
| match_generation_queue | 321 pending | Blocked by 92 stuck 'processing' |
| startup_investor_matches | ~47K | Phase 4 matches available |
| signal_snapshots | 1+ | Captured on first run |
| signal_deltas | 0 | Waiting for 2nd run |

## 🎯 Next Actions (In Order)

### Immediate (Unblock Testing)
1. **Run fix-queue-blocker.sql** in Supabase SQL Editor
2. **Restart worker:** `pm2 restart match-queue-processor`
3. **Watch logs:** `pm2 logs match-queue-processor --lines 50`
4. **Verify job advances:** Poll /api/discovery/results

### Phase 5 Testing (After Unblock)
1. **First run:** Submit nucleoresearch.com or asidehq.com
   - Verify: job reaches "ready" status
   - Verify: 1 signal_snapshot created
   - Verify: phase5Ready = false (no prior snapshot)
   - Verify: Section 3 doesn't appear (correct gating)

2. **Second run:** Submit SAME URL again
   - Verify: job returns existing job_id (idempotent)
   - Verify: 2nd signal_snapshot created
   - Verify: 1 signal_delta computed
   - Verify: phase5Ready = true
   - Verify: GET /api/discovery/delta returns delta with status='ready'
   - Verify: Section 3 appears with evolution data

3. **UI Validation:**
   - Phase delta shows (e.g., "Phase 5.2 → 5.5 ↑")
   - Band transition displays (e.g., "med → high")
   - Match delta shows gained/lost investors
   - AI narrative renders

### Production Deployment (After Testing)
- [ ] Verify normalize_url() DB function deployed to prod
- [ ] Confirm startup_jobs.url_normalized column type in prod
- [ ] Test idempotent job creation in prod
- [ ] Verify match-queue-processor running in prod PM2
- [ ] Add cleanup_stuck_queue_items() to cron (every 10 minutes)

## 📝 Files Changed (This Session)

### Created
- `server/lib/urlNormalize.js` - Shared URL normalization (single source of truth)
- `src/components/results/SignalEvolutionSection.tsx` - Phase 5 UI component
- `fix-queue-blocker.sql` - SQL fix for queue constraint issue
- `PHASE5_STATUS.md` - This document

### Modified
- `src/lib/discoveryAPI.ts` - Added SignalDelta type, fetchLatestDelta()
- `src/pages/DiscoveryResultsPage.tsx` - 4 surgical truth-sealing edits
- `server/routes/discoverySubmit.js` - Added shared normalizeUrl, hard guard, fixed startup lookup

## 🔍 Debugging Commands

### Check Queue Status
```bash
# Via Supabase SQL Editor
SELECT status, COUNT(*), MIN(updated_at) as oldest_update
FROM match_generation_queue
GROUP BY status;
```

### Check Job Status
```bash
curl -s "http://localhost:3002/api/discovery/results?job_id=<JOB_ID>" | jq '.'
```

### Check Worker Health
```bash
pm2 status
pm2 logs match-queue-processor --lines 100
```

### Check Signal Snapshots
```sql
SELECT startup_id, COUNT(*), MAX(captured_at)
FROM signal_snapshots
GROUP BY startup_id;
```

### Check Signal Deltas
```sql
SELECT startup_id, phase_delta, band_from, band_to, compared_at
FROM signal_deltas
ORDER BY compared_at DESC
LIMIT 10;
```

## 🛡️ Prevention (Post-Deploy)

### Add Automated Cleanup
Add to ecosystem.config.js:
```javascript
{
  name: 'queue-cleanup',
  script: 'node -e "require(\'@supabase/supabase-js\').createClient(...).rpc(\'cleanup_stuck_queue_items\')"',
  cron_restart: '*/10 * * * *', // Every 10 minutes
  autorestart: false
}
```

### Monitor Queue Health
Add to system-guardian.js:
```javascript
async function checkQueueHealth() {
  const { data } = await supabase.from('queue_status').select('*');
  const processing = data.find(s => s.status === 'processing');
  
  if (processing && processing.count > 50) {
    return { status: 'ERROR', issues: ['Too many stuck processing items'] };
  }
  return { status: 'OK', issues: [] };
}
```

---

**Last Updated:** January 24, 2026 8:40 PM
**Status:** Ready for queue unblock → Phase 5 testing
