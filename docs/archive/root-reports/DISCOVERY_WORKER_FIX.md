# 🎯 Root Cause Found: Missing Discovery Job Worker

## The Real Problem

**Discovery jobs were stuck at "building (5%)" because NO WORKER was processing them.**

### What We Discovered

1. **`discoverySubmit.js`** writes to `startup_jobs` table:
   - Creates job with status: `queued`
   - Immediately updates to status: `building` (5%)
   - **Then nothing happens** - job stuck forever

2. **`discoveryResults.js`** only READS job status:
   - Polls `startup_jobs` table
   - Returns current status
   - **Does NOT advance status** - it's read-only

3. **TWO separate queue systems exist:**
   - `startup_jobs` - Discovery job pipeline (queued → building → scoring → matching → ready)
   - `match_generation_queue` - Match generation queue (pending → processing → completed)

4. **Workers:**
   - `process-match-queue.js` - Processes `match_generation_queue` (generates matches)
   - **MISSING:** No worker to advance `startup_jobs` status transitions

## The Fix (Implemented)

### Created `process-discovery-jobs.js`

**Purpose:** Continuous worker that advances discovery jobs through lifecycle.

**Pipeline stages:**
1. **queued → building (5%)**: Job submitted
2. **building → scoring (30%)**: Verify startup exists, check GOD score
3. **scoring → matching (60%)**: Queue startup for match generation
4. **matching → ready (100%)**: Wait for matches, then mark complete

**Key features:**
- Continuous polling (5-second interval)
- Coordinates with `match_generation_queue` via `manually_queue_startup()` RPC
- Waits for match generation to complete before marking ready
- Handles errors gracefully (marks jobs as failed with error messages)
- Processes up to 10 jobs per cycle

### Added to PM2 Ecosystem

```javascript
{
  name: 'discovery-job-processor',
  script: 'node',
  args: 'process-discovery-jobs.js',
  autorestart: true,  // Keep alive - continuous polling
  max_memory_restart: '500M'
}
```

## Current Status

### ✅ Working
- Discovery job processor running and advancing jobs
- Jobs now reach scoring (30%) and matching (60%)
- Integration with match generation queue via RPC

### 🚧 Blocked
- Match queue processor still crashing with constraint violation
- Jobs stuck at matching (60%) waiting for matches
- Need SQL fix from `fix-queue-blocker.sql`

### Error Pattern
```
❌ Failed to get next queue item: duplicate key value violates unique constraint 
"match_generation_queue_startup_id_status_key"
```

**Root cause:** 92 stuck 'processing' rows in `match_generation_queue` prevent new claims.

## Next Steps (You Must Do)

### 1. Run SQL Fix in Supabase

Open [fix-queue-blocker.sql](fix-queue-blocker.sql) in Supabase SQL Editor and run it.

**What it does:**
- Releases stuck 'processing' items (30+ min old) back to 'pending'
- Updates `get_next_from_queue()` function with error handling
- Creates `cleanup_stuck_queue_items()` function for future automation

### 2. Restart Match Queue Processor

```bash
pm2 restart match-queue-processor
```

Expected: Worker processes queue items without errors.

### 3. Verify Jobs Reach Ready

```bash
# Wait 30 seconds, then check
curl -s "http://localhost:3002/api/discovery/results?job_id=616e9c78-a439-4d9a-bfdd-dc3064f9f5d1" | jq '.status, .progress, .match_count'
```

Expected: `"ready"`, `100`, `>0`

## Test Phase 5 End-to-End

Once jobs reach ready:

### First Scan (No Prior Snapshot)
```bash
curl -X POST "http://localhost:3002/api/discovery/submit" \
  -H "Content-Type: application/json" \
  -d '{"url":"nucleoresearch.com"}'

# Get job_id, then poll until ready
curl -s "http://localhost:3002/api/discovery/results?job_id=<JOB_ID>" | jq '.'
```

**Expected:**
- Job reaches "ready" status
- 1 signal_snapshot created
- `phase5Ready: false` (no prior snapshot to compare)
- UI: Section 3 (SignalEvolutionSection) does NOT appear ✅

### Second Scan (Has Prior Snapshot)

Submit SAME URL again:

```bash
curl -X POST "http://localhost:3002/api/discovery/submit" \
  -H "Content-Type: application/json" \
  -d '{"url":"nucleoresearch.com"}'
```

**Expected:**
- Returns existing job_id (idempotent)
- 2nd signal_snapshot created
- 1 signal_delta computed (comparing snapshots)
- `phase5Ready: true`
- GET `/api/discovery/delta?startup_id=...` returns delta with status='ready'
- UI: Section 3 appears with evolution data ✅

## Files Changed

### Created
- `process-discovery-jobs.js` - Discovery job worker (199 lines)
- `fix-queue-blocker.sql` - SQL fix for queue constraint
- `DISCOVERY_WORKER_FIX.md` - This document

### Modified
- `ecosystem.config.js` - Added discovery-job-processor to PM2 config

### Already Fixed (Previous Session)
- `server/lib/urlNormalize.js` - Shared URL normalization
- `server/routes/discoverySubmit.js` - Hard guard for url_normalized, fixed startup lookup
- `src/components/results/SignalEvolutionSection.tsx` - Phase 5 UI component
- `src/pages/DiscoveryResultsPage.tsx` - 4 truth-sealing edits
- `src/lib/discoveryAPI.ts` - SignalDelta type, fetchLatestDelta()

## PM2 Process Status

```
✅ api-server              - online (serves API endpoints)
✅ discovery-job-processor - online (advances discovery jobs) ← NEW
🚧 match-queue-processor  - online but crashing (needs SQL fix)
❌ match-regenerator       - stopped (not needed for discovery pipeline)
```

## Architecture Diagram

```
User submits URL
       ↓
discoverySubmit.js
       ↓
INSERT INTO startup_jobs (status: 'queued')
       ↓
discovery-job-processor ← Continuously polls
       ↓
queued → building (5%)
       ↓
building → scoring (30%) [verify startup, check GOD score]
       ↓
scoring → matching (60%) [call manually_queue_startup RPC]
       ↓
       ├→ match_generation_queue (pending)
       │        ↓
       │  match-queue-processor ← Polls queue
       │        ↓
       │  Generate matches → startup_investor_matches
       │        ↓
       └← Wait for matches
       ↓
matching → ready (100%) [set match_count, finished_at]
       ↓
discoveryResults.js returns matches
       ↓
Frontend displays results + Section 3 (if phase5Ready)
```

## Why This Matters

**Before:** Jobs stuck at 5% forever, users saw "Reading signals…" indefinitely.

**After:** Jobs advance through pipeline automatically:
- 5% → 30% → 60% → 100%
- Real-time progress updates
- Matches generated on-demand
- Phase 5 evolution tracking works

**User experience:**
- Submit URL → See progress bar advance
- 30-60 seconds → Results appear
- Second submission → See signal evolution

---

**Status:** Worker created and running. Waiting for SQL fix to unblock match generation.

**Last updated:** January 24, 2026 9:05 PM
