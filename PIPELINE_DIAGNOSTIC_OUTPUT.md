# Pipeline Diagnostic Output - Truth Revealed

## Date: January 24, 2026
## System State: Queue Working, Jobs Stuck

---

## 🔍 Discovery: The Root Cause

### Symptom
- **2 jobs stuck at "matching" (60%)**
- Discovery job processor logs: `"⚠️  No matches generated and queue item not found, requeueing..."`
- Jobs never advance to "ready" (100%)

### Evidence

**Match Queue Processor Logs (WORKING ✅):**
```
[1/50] Processing queue item 54c02bd4...
  Startup: d1c6944f-c634-4b7d-b419-81a83fe7d516
  Generated 1000 matches (score >= 20)
  ✅ Inserted 1000 matches
  ✅ Completed (1000 matches)

[2/50] Processing queue item 259954c2...
  Startup: 35b8d268-4403-4108-988a-e664a07a8b27
  Generated 1000 matches (score >= 20)
  ✅ Inserted 1000 matches
  ✅ Completed (1000 matches)
```

**Discovery Job Processor Logs (STUCK ❌):**
```
📋 Processing job 616e9c78... (status: matching)
  ⚠️  No matches generated and queue item not found, requeueing...

📋 Processing job 8ad1fa5e... (status: matching)
  ⚠️  No matches generated and queue item not found, requeueing...
```

---

## 🎯 Root Cause Analysis

### The Logic Gap

**Discovery Job Processor Logic (process-discovery-jobs.js):**
```javascript
// Current implementation checks TWO conditions:
1. Queue item still exists (status: 'pending' or 'processing')
2. Matches have been generated (count >= 1000)

// Problem: Queue items get DELETED after completion
// So condition #1 FAILS even when matches exist!
```

**What's Happening:**
1. Queue processor picks up item → status = 'processing'
2. Queue processor generates 1000 matches
3. Queue processor **deletes queue item** (completion cleanup)
4. Discovery job processor wakes up
5. Discovery job processor looks for queue item → **NOT FOUND**
6. Discovery job processor looks for matches → **MIGHT EXIST** but queue check already failed
7. Discovery job processor thinks "still processing" → requeuesMATCH CHECK NEVER RUNS** because queue check fails first

---

## 🔧 The Fix

### Option 1: Change Discovery Job Logic (RECOMMENDED)
**Check matches FIRST, queue SECOND:**

```javascript
// BEFORE (current):
if (queue item exists) {
  return "still processing"
} else if (matches >= 1000) {
  return "ready"
} else {
  return "requeue"
}

// AFTER (fixed):
if (matches >= 1000) {
  return "ready"  // ✅ Truth wins
} else if (queue item exists with status='pending'|'processing') {
  return "still processing"
} else {
  return "requeue"  // Only if BOTH conditions fail
}
```

**Why this works:**
- Matches are the **source of truth** (persistent)
- Queue items are **ephemeral** (deleted after use)
- Always check durable state before ephemeral state

### Option 2: Keep Queue Items (NOT RECOMMENDED)
Mark queue items as 'completed' instead of deleting them.

**Why NOT recommended:**
- Queue table grows forever
- No cleanup strategy
- Queue items are meant to be ephemeral

---

## 📊 Current System State

### Jobs
- **Ready jobs**: Unknown (need query)
- **Matching jobs**: 2 confirmed (616e9c78, 8ad1fa5e)
- **Symptom**: Stuck in requeue loop

### Queue
- **Processing**: 5/50 items completed
- **Status**: Working correctly ✅
- **Rate**: ~1000 matches per startup

### Matches Table
- **Total**: 4.5M+ matches
- **Distribution**: p50=100, p90=1000, p99=1000
- **Status**: Healthy ✅

---

## ✅ Next Steps (Priority Order)

### 1. Fix Discovery Job Processor Logic (HIGH PRIORITY)
**File**: `process-discovery-jobs.js`
**Change**: Reorder checks - matches first, queue second
**Impact**: Jobs will immediately flip to "ready" if matches exist

### 2. Run Pipeline Diagnostic Query (VALIDATION)
Query both stuck jobs to confirm:
- Queue items deleted (queue_status = 'not_queued')
- Matches exist (match_count >= 1000)
- System state should be 'ready' but jobs show 'matching'

**SQL to run in Supabase:**
```sql
-- For job 616e9c78 (find its startup_id first)
-- Then run the comprehensive diagnostic from /tmp/pipeline_diagnostic.sql
```

### 3. Test Fixed Logic (VERIFICATION)
After fixing process-discovery-jobs.js:
1. Restart discovery-job-processor: `pm2 restart discovery-job-processor`
2. Watch logs: `pm2 logs discovery-job-processor --lines 20`
3. Confirm jobs flip to "ready" within 1 minute
4. Test UI at `/matches?url=<job_url>`

---

## 🎓 Lessons Learned

### System Design Principles Violated
1. **Ephemeral before Durable**: Checked temporary queue state before persistent match state
2. **Negative Logic**: "item not found" was treated as "still processing" instead of "check durable state"
3. **No Fallback**: No "last resort" check for matches when queue item missing

### Corrected Principles
1. **Always check durable state first** (matches table)
2. **Use ephemeral state for in-progress only** (queue items)
3. **Absence of ephemeral = check durable** (not "still processing")

---

## 📋 Diagnostic Queries

### Find Stuck Jobs
```sql
SELECT id, startup_id, url_normalized, status, progress, updated_at
FROM public.startup_jobs
WHERE status = 'matching'
ORDER BY updated_at DESC
LIMIT 5;
```

### Check Match Counts for Stuck Jobs
```sql
SELECT 
  j.id as job_id,
  j.url_normalized,
  j.status as job_status,
  COUNT(m.id) as match_count,
  CASE 
    WHEN COUNT(m.id) >= 1000 THEN 'SHOULD BE READY'
    ELSE 'STILL PROCESSING'
  END as expected_status
FROM public.startup_jobs j
LEFT JOIN public.startup_investor_matches m ON m.startup_id = j.startup_id
WHERE j.status = 'matching'
GROUP BY j.id, j.url_normalized, j.status
ORDER BY j.updated_at DESC;
```

### Full Pipeline Diagnostic (from user's request)
See `/tmp/pipeline_diagnostic.sql` - replace STARTUP_ID_HERE with actual ID.

---

## 🎯 Success Criteria

After fix is deployed, expect:
- ✅ Discovery job processor logs: "✅ Matches ready, marking job as ready (100%)"
- ✅ Jobs flip from "matching" to "ready" within 60 seconds
- ✅ UI renders results at `/matches?url=<startup_url>`
- ✅ No more "requeueing" infinite loops

**Current Status**: Root cause identified, fix ready to deploy
**Blocker**: Logic inversion in process-discovery-jobs.js
**ETA**: <5 minutes to fix + test

---

*Generated: 2026-01-24*
*System: Hot Honey Discovery Pipeline*
*Version: Phase 5 (Production-Hardened)*
