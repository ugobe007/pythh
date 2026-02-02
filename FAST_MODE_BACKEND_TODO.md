# Fast Mode Backend Implementation Guide

## What We Just Fixed (Client-Side) ✅

1. **Added fast mode to convergenceAPI.ts:**
   - `timeoutMs: 1800` - Aborts after 1.8s (feels instant)
   - `allowDbFallback: false` - No browser DB waterfall by default
   - `fastMode: true` - Sends `&mode=fast` query parameter
   - Timeout control with AbortController

2. **Updated DiscoveryResultsPage.tsx:**
   - Uses fast mode convergence call
   - Polls for matches if not ready (10 max polls, 800-1200ms intervals)
   - Shows "Reading signals..." during polling
   - Renders context panel immediately even if matches empty

## What Needs Backend Implementation 🔧

### 1. Add `mode=fast` Support in `/api/discovery/convergence`

**Location:** `server/routes/discovery.js` (or wherever convergence endpoint is)

**Changes needed:**
```javascript
// Check for fast mode
const fastMode = req.query.mode === 'fast';

if (fastMode) {
  // ✅ SKIP heavy computations:
  // - comparable_startups (heavy joins)
  // - improve_actions (complex analysis)
  // - strategic selection logic
  
  // ✅ ONLY return what /matches page needs:
  return {
    startup: { id, url, name, stage_hint, sector_hint, created_at },
    status: { 
      velocity_class, 
      signal_strength_0_10, 
      fomo_state, 
      phase_change_score_0_1, 
      confidence, 
      observers_7d, 
      comparable_tier 
    },
    visible_investors: matches.slice(0, 5), // Top 5 only
    hidden_investors_preview: [], // Optional, can skip in fast mode
    hidden_investors_total: totalCount - 5,
    comparable_startups: [], // Empty in fast mode
    improve_actions: [], // Empty in fast mode
    alignment: basicAlignment, // Minimal computation
    debug: { query_time_ms, mode: 'fast', state: matchCount < 5 ? 'building' : 'ready' }
  };
}
```

### 2. Return HTTP 202 When Matches Not Ready

**When to use:**
- Startup exists
- But `match_count < 5`

**Response:**
```javascript
if (matchCount < 5) {
  res.status(202).json({
    startup: startupInfo,
    status: statusMetrics,
    visible_investors: [],
    hidden_investors_preview: [],
    hidden_investors_total: 0,
    comparable_startups: [],
    improve_actions: [],
    alignment: {},
    debug: { 
      state: 'building', 
      match_count: matchCount,
      message: 'Matches generating in background'
    }
  });
  return;
}
```

**Client behavior:**
- Will poll every 800-1200ms
- Max 10 polls (~12 seconds)
- Shows "Reading signals..." indicator

### 3. Add Database Index (If Not Exists)

**Critical for fast match queries:**
```sql
-- For fast "top N matches by score" queries
CREATE INDEX IF NOT EXISTS idx_matches_startup_score 
ON startup_investor_matches (startup_id, match_score DESC);

-- If filtering by status often:
CREATE INDEX IF NOT EXISTS idx_matches_startup_status_score 
ON startup_investor_matches (startup_id, status, match_score DESC);
```

**Check existing indexes:**
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'startup_investor_matches';
```

### 4. Skip Dynamic Import Selection in Fast Mode

**Current bottleneck:**
```javascript
const mod = await import('./investorSelection');
return mod.selectStrategicInvestors(...); // Adds chunk load time
```

**Fast mode fix:**
```javascript
if (fastMode) {
  // Just return top matches by score - no selection algorithm
  return matches
    .filter(m => m.match_score >= 50)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5);
}
```

### 5. Cache Status Metrics (Optional Optimization)

**Problem:** Recalculating `velocity_class`, `fomo_state`, etc. on every request

**Solution:**
```javascript
// Cache status in Redis with 5-minute TTL
const cacheKey = `startup:status:${startupId}`;
let status = await redis.get(cacheKey);

if (!status) {
  status = await calculateStatusMetrics(startup);
  await redis.setex(cacheKey, 300, JSON.stringify(status));
}
```

## Performance Targets 🎯

| Metric | Current | Target | Fix |
|--------|---------|--------|-----|
| Backend response | ~8.5s | <500ms | Skip heavy builders in fast mode |
| Client waterfall | ~2s | 0ms | No DB fallback (done ✅) |
| Context panel load | ~10s | ~300ms | Fast mode + parallel fetch (done ✅) |
| Matches display | ~10s | ~500ms | Fast mode + index |
| **Total page ready** | **~10s** | **<1s** | All fixes combined |

## Expected Behavior After Backend Changes

### Normal Flow (Matches Ready)
```
1. User submits URL → /matches page loads
2. Convergence API (fast mode) → ~300ms
3. Context panel appears → Instant
4. Top 5 matches display → ~500ms
5. Total: <1 second ✅
```

### Building Flow (Matches Not Ready)
```
1. User submits URL → /matches page loads
2. Convergence API returns 202 → ~200ms
3. Context panel appears → Instant (shows startup info)
4. "Reading signals..." indicator → Visible
5. Poll #1 (800ms later) → Still building
6. Poll #2 (800ms later) → Still building
7. Poll #3 (800ms later) → 5 matches ready!
8. Matches display → Smooth transition
9. Total: ~3-5 seconds (perceived as "live building")
```

## Testing Commands

### Test Fast Mode (After Backend Implementation)
```bash
# Should return <500ms with minimal data
time curl "http://localhost:3002/api/discovery/convergence?url=stripe.com&mode=fast"

# Should see debug.mode = 'fast' in response
curl -s "http://localhost:3002/api/discovery/convergence?url=stripe.com&mode=fast" | jq '.debug'
```

### Test 202 Response (Matches Building)
```bash
# For a brand new startup
time curl "http://localhost:3002/api/discovery/convergence?url=newstartup123456.com&mode=fast"

# Should return HTTP 202 with debug.state = 'building'
curl -i "http://localhost:3002/api/discovery/convergence?url=newstartup123456.com&mode=fast"
```

### Check Database Index
```sql
-- Verify index exists
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename = 'startup_investor_matches'
  AND indexname LIKE '%score%';
```

## Why This Works

**Before (10+ seconds):**
```
Backend: 8.5s (heavy computations)
  ↓
Browser gets response
  ↓
Browser does DB fallback queries: 2s
  ↓
Sequential state updates
  ↓
Total: 10+ seconds ❌
```

**After (<1 second):**
```
Backend fast mode: 300ms (skip heavy stuff)
  ↓
Browser gets response (no fallback)
  ↓
Parallel: Context panel + Matches
  ↓
Total: <1 second ✅
```

## Priority Order

1. **CRITICAL:** Implement `mode=fast` in backend (skip heavy builders)
2. **CRITICAL:** Add database index for match queries
3. **HIGH:** Return 202 for building state
4. **MEDIUM:** Skip dynamic import in fast mode
5. **NICE:** Cache status metrics in Redis

---

**Client-side changes are DONE ✅**
**Backend implementation needed for full performance fix 🔧**
