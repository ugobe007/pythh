# Matching Workflow Performance Analysis

**Date:** March 8, 2026  
**Issue:** Matching process taking too long  
**Goal:** Identify bottlenecks and optimization opportunities

---

## Current Workflow

### Phase 1: Fast Matches (3-5 seconds)
```
1. Load all investors from cache (or DB if cache miss)
2. Loop through ALL investors sequentially:
   - Calculate match score for each investor
   - Yield event loop every 100 investors
   - Filter matches above threshold
3. Sort and take top N matches
4. Batch insert matches to database
```

**Bottleneck:** Sequential processing of 3,700+ investors (one at a time)

### Phase 2: Enrichment (5-15 seconds)
```
1. Fetch website content (3s timeout)
2. Run inference engine (instant)
3. If sparse data:
   - News enrichment (3s timeout)
   - AI scraper (5s timeout)
   - DynamicParser (5s timeout)
4. Calculate GOD score
5. Update startup record
6. Seed signal scores
7. Create signal events (with deduplication)
```

**Bottlenecks:**
- Sequential enrichment steps (each waits for previous)
- Multiple timeout windows (3s + 3s + 5s + 5s = 16s worst case)
- Database updates happen sequentially

### Phase 3: Re-match with Enriched Data (3-5 seconds)
```
1. Check if sectors/GOD score changed
2. If changed:
   - Get relevant investors (filtered by sector)
   - Loop through investors sequentially again
   - Calculate match scores with enriched data
   - Sort and take top N
   - Delete old matches
   - Batch insert new matches
```

**Bottleneck:** Another full sequential loop through investors

---

## Performance Metrics

**Current Total Time:**
- Phase 1: 3-5s (fast matches with placeholder)
- Phase 2: 5-15s (enrichment)
- Phase 3: 3-5s (re-match with enriched data)
- **Total: 11-25 seconds**

**User Experience:**
- User sees results in 3-5s (Phase 1)
- Results improve after 11-25s (Phase 3 completes)

---

## Identified Bottlenecks

### 1. Sequential Investor Processing ⚠️ CRITICAL
**Location:** `server/routes/instantSubmit.js:581-600` and `933-952`

**Problem:**
```javascript
for (let idx = 0; idx < investors.length; idx++) {
  const investor = investors[idx];
  if (idx > 0 && idx % 100 === 0) await new Promise(r => setImmediate(r));
  const result = calculateMatchScore(...);
  // Process one investor at a time
}
```

**Impact:** Processing 3,700 investors sequentially = ~3-5 seconds

**Solution:** Parallel batch processing
- Process investors in batches of 50-100 in parallel
- Use `Promise.all()` for concurrent calculations
- Keep event loop yielding for responsiveness

### 2. Sequential Enrichment Steps ⚠️ HIGH
**Location:** `server/routes/instantSubmit.js:628-727`

**Problem:**
```javascript
// Step 1: Fetch website (3s)
const websiteContent = await fetch(...);

// Step 2: Inference (instant)
const inferenceData = extractInferenceData(...);

// Step 3: News enrichment (3s) - only if sparse
if (sparse) await quickEnrich(...);

// Step 4: AI scraper (5s) - only if still Tier C
if (tierC) await scrapeAndScoreStartup(...);

// Step 5: DynamicParser (5s) - only if still Tier C
if (tierC) await parser.parse(...);
```

**Impact:** Worst case = 3s + 3s + 5s + 5s = 16 seconds (sequential)

**Solution:** Parallel enrichment where possible
- Fetch website + start inference in parallel
- Run news enrichment + AI scraper in parallel (race condition)
- Use `Promise.race()` to take first successful result

### 3. Two Full Match Generation Passes ⚠️ MEDIUM
**Problem:** 
- Phase 1: Generate matches with placeholder data
- Phase 3: Delete Phase 1 matches, regenerate with enriched data

**Impact:** Duplicate work, unnecessary database operations

**Solution:** 
- Skip Phase 1 if enrichment is fast (< 2s)
- Or: Only regenerate matches if sectors/GOD score changed significantly

### 4. Database Query Optimization ⚠️ MEDIUM
**Problems:**
- Multiple sequential queries for investor data
- Batch inserts in chunks of 500 (could be larger)
- Delete + insert pattern (could use upsert)

**Solution:**
- Larger batch sizes (1000-2000)
- Use `upsert` instead of delete + insert
- Cache investor data more aggressively

### 5. Match Score Calculation ⚠️ LOW
**Location:** `server/routes/instantSubmit.js:445-443`

**Current:** Complex calculation with multiple checks per investor

**Optimization Opportunities:**
- Early exit conditions (skip investors below threshold faster)
- Cache sector/stage matching logic
- Simplify calculation for Phase 1 (placeholder data)

---

## Recommended Optimizations

### Priority 1: Parallelize Investor Processing (CRITICAL)

**Before:**
```javascript
for (let idx = 0; idx < investors.length; idx++) {
  const result = calculateMatchScore(...);
  matches.push(result);
}
```

**After:**
```javascript
const BATCH_SIZE = 100;
const CONCURRENT_BATCHES = 5; // Process 5 batches in parallel

for (let i = 0; i < investors.length; i += BATCH_SIZE) {
  const batch = investors.slice(i, i + BATCH_SIZE);
  const batchPromises = [];
  
  for (let j = 0; j < batch.length; j += CONCURRENT_BATCHES) {
    const concurrentBatch = batch.slice(j, j + CONCURRENT_BATCHES);
    batchPromises.push(
      Promise.all(concurrentBatch.map(investor => 
        calculateMatchScore(startup, investor, signalScore, investor.signals)
      ))
    );
  }
  
  const batchResults = await Promise.all(batchPromises);
  matches.push(...batchResults.flat());
}
```

**Expected Improvement:** 3-5s → 0.5-1s (5x faster)

### Priority 2: Parallelize Enrichment Steps (HIGH)

**Before:**
```javascript
const websiteContent = await fetch(...); // 3s
const inferenceData = extractInferenceData(...); // instant
if (sparse) await quickEnrich(...); // 3s
if (tierC) await scrapeAndScoreStartup(...); // 5s
```

**After:**
```javascript
// Fetch + inference in parallel
const [websiteResponse, inferenceData] = await Promise.all([
  fetch(...).catch(() => null),
  extractInferenceData(websiteContent || '')
]);

// If sparse, try both enrichment methods in parallel (race)
if (sparse || tierC) {
  const enrichmentResults = await Promise.race([
    quickEnrich(...).then(r => ({ type: 'news', data: r })),
    scrapeAndScoreStartup(...).then(r => ({ type: 'ai', data: r }))
  ]).catch(() => null);
}
```

**Expected Improvement:** 11-16s → 5-8s (2x faster)

### Priority 3: Skip Phase 1 if Enrichment is Fast (MEDIUM)

**Logic:**
```javascript
// Start enrichment immediately
const enrichmentPromise = startEnrichment(...);

// If enrichment completes in < 2s, skip Phase 1
const enrichmentResult = await Promise.race([
  enrichmentPromise,
  new Promise(r => setTimeout(() => r('timeout'), 2000))
]);

if (enrichmentResult !== 'timeout') {
  // Skip Phase 1, go straight to Phase 3 with enriched data
} else {
  // Run Phase 1 for immediate results
}
```

**Expected Improvement:** Eliminates duplicate work, saves 3-5s

### Priority 4: Optimize Database Operations (MEDIUM)

**Changes:**
1. Increase batch size from 500 to 1000-2000
2. Use `upsert` with conflict resolution instead of delete + insert
3. Combine multiple updates into single query where possible

**Expected Improvement:** 0.5-1s faster

### Priority 5: Early Exit in Match Calculation (LOW)

**Add early exit conditions:**
```javascript
function calculateMatchScore(startup, investor, signalScore, investorSignals) {
  // Quick sector check - if no overlap, return early
  const sectorOverlap = checkSectorOverlap(startup.sectors, investor.sectors);
  if (sectorOverlap === 0 && startup.total_god_score < 40) {
    return { score: 0, fitAnalysis: null, confidence: 'low' };
  }
  
  // Continue with full calculation...
}
```

**Expected Improvement:** Skip ~30% of investors faster

---

## Implementation Plan

### Phase 1: Quick Wins (1-2 hours)
1. ✅ Parallelize investor processing (Priority 1)
2. ✅ Increase batch sizes (Priority 4)
3. ✅ Use upsert instead of delete + insert (Priority 4)

**Expected Result:** 11-25s → 6-12s (50% faster)

### Phase 2: Enrichment Optimization (2-3 hours)
1. ✅ Parallelize enrichment steps (Priority 2)
2. ✅ Add early exit conditions (Priority 5)

**Expected Result:** 6-12s → 4-8s (33% faster)

### Phase 3: Smart Phase Skipping (3-4 hours)
1. ✅ Implement fast-path detection (Priority 3)
2. ✅ Skip Phase 1 when enrichment is fast

**Expected Result:** 4-8s → 3-6s (25% faster)

---

## Target Performance

**Current:** 11-25 seconds total  
**After Phase 1:** 6-12 seconds (50% improvement)  
**After Phase 2:** 4-8 seconds (67% improvement)  
**After Phase 3:** 3-6 seconds (75% improvement)

**User Experience:**
- Results appear in 1-2 seconds (Phase 1 or fast-path)
- Results refine in 3-6 seconds (enriched matches)

---

## Monitoring

Add performance logging:
```javascript
const timings = {
  phase1: 0,
  enrichment: 0,
  phase3: 0,
  total: 0
};

// Log at each phase
console.log(`[PERF] Phase 1: ${timings.phase1}ms`);
console.log(`[PERF] Enrichment: ${timings.enrichment}ms`);
console.log(`[PERF] Phase 3: ${timings.phase3}ms`);
console.log(`[PERF] Total: ${timings.total}ms`);
```

Track in `match_gen_logs` table for analysis.
