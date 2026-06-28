# Match Engine Regression Analysis
**Date**: February 3, 2026
**Issue**: Nowports (YC, Logistics, Seed) has only 1 match instead of 50-300

## 🔍 Root Cause Found

### The Broken Pipeline

**match-regenerator.js (backend)**:
```javascript
// Lines 92-99: calculateStageMatch() - WAS BROKEN
function calculateStageMatch(startupStage, investorStages) {
  const normalize = (s) => normalizeStr(s).replace(/[-_\s]/g, '');
  const sStage = normalize(startupStage);  // ❌ "1" → "1"
  const iStages = [...].map(normalize);     // ["seed"] → ["seed"]
  
  // ❌ FAILS: "1" !== "seed"
  if (iStages.some(is => is === sStage ...)) return 20;
  return 5;
}
```

**Database Reality**:
- Startups: `stage: 1` (number) - 765 startups
- Investors: `stage: ["Seed","Series A"]` (string array) - 3,175 investors
- **Result**: 999/1000 investors rejected due to type mismatch

### The Fix

**match-regenerator.js (NOW FIXED)**:
```javascript
// Lines 42-50: Added STAGE_MAP
const STAGE_MAP = {
  0: 'Pre-Seed',
  1: 'Seed',       // ✅ Maps numeric to string
  2: 'Series A',
  3: 'Series B',
  4: 'Series C',
  5: 'Growth'
};

function calculateStageMatch(startupStage, investorStages) {
  // Convert numeric stage to string
  let sStageStr = startupStage;
  if (typeof startupStage === 'number') {
    sStageStr = STAGE_MAP[startupStage] || 'Seed';  // ✅ "1" → "Seed"
  }
  
  const normalize = (s) => normalizeStr(s).replace(/[-_\s]/g, '');
  const sStage = normalize(sStageStr);  // ✅ "seed"
  const iStages = [...].map(normalize); // ["seed", "seriesa"]
  
  // ✅ PASSES: "seed" === "seed"
  if (iStages.some(is => is === sStage ...)) return 20;
  return 5;
}
```

## 📊 Impact Analysis

### Before Fix (January data)
```
Nowports Evaluation:
  Total investors: 1,000 (pagination broken - only fetched 1 page)
  Stage matches: 1/1000 (0.1%)
  Final matches: 1 (score: 45)
  
Rejection reasons:
  - 999 rejected: stage mismatch (type incompatibility)
  - 0 rejected: sector mismatch
```

### After Fix (February 3, 2026)
```
Nowports Evaluation:
  Total investors: 3,175 (pagination fixed)
  Stage matches: 2,841/3,175 (89.5%)
  Final matches: 299 (score range: 47-62)
  
Match breakdown:
  - High quality (60+): 2 matches
  - Good quality (50-59): 50 matches
  - Acceptable (45-49): 247 matches
  
Top matches:
  1. Autotech Ventures: 62 (sector: 20, stage: 20, quality: 20)
  2. Construct Capital: 62 (sector: 20, stage: 20, quality: 20)
  3. Seema Amble: 62 (sector: 10, stage: 20, quality: 32)
```

## 🏗️ Architecture Issues (Still Present)

### Issue 1: Filter-Before-Rank Pattern
**MatchingEngine.tsx** (lines 460-495):
```typescript
// ❌ FILTERS FIRST (removes data before ranking)
let matchQuery = supabase
  .from('startup_investor_matches')
  .select('...')
  .eq('status', 'suggested')
  .gte('match_score', MIN_MATCH_SCORE)  // ❌ THRESHOLD FILTER
  .order('match_score', { ascending: false });  // Then ranks

// This means:
// 1. Database filters to score >= 20
// 2. Returns only "passing" matches
// 3. Frontend never sees <20 scores
```

**Hot Match Pattern (hypothesized from doc references)**:
```typescript
// ✅ RANKS FIRST, FILTERS SECOND
const allMatches = await fetchAllMatches(startupId);
const ranked = rankByScore(allMatches);  // All matches ranked
const filtered = ranked.slice(0, topN);  // Then take top N

// This means:
// 1. Get ALL possible matches
// 2. Rank them by composite score
// 3. Show top N (even if "weak")
// 4. Founder sees full pipeline, not filtered view
```

### Issue 2: Hardcoded Thresholds
**match-regenerator.js** (line 29):
```javascript
MIN_MATCH_SCORE: 45,  // ❌ RIGID CUTOFF
```

**Impact**:
- Nowports with GOD 48 → startup_quality: 12/25
- Many investors score 42-44 (just below threshold)
- These investors are NEVER saved to database
- 2-tier policy can't show them (they don't exist in DB)

**Better Pattern** (not yet implemented):
```javascript
// Save ALL matches, let UI decide display
MIN_MATCH_SCORE: 0,  // Or very low threshold like 20

// Then in UI:
// Tier A: score >= 50 (quality)
// Tier B: score 35-49 (warming up)
// Tier C: score 20-34 (not shown, but logged for analysis)
```

### Issue 3: Pagination Bug (FIXED)
**match-regenerator.js** (lines 213-233):
```javascript
// BEFORE (broken):
const { data, error } = await supabase
  .from('investors')
  .select('...');  // ❌ No range(), only gets first 1000

// AFTER (fixed):
while (true) {
  const { data, error } = await supabase
    .from('investors')
    .select('...')
    .range(page * pageSize, (page + 1) * pageSize - 1);  // ✅ Paginated
  
  if (!data || data.length === 0) break;
  allInvestors = allInvestors.concat(data);
  if (data.length < pageSize) break;
  page++;
}
```

## 🎯 Why Hot Match "Felt Better"

Based on user feedback and code archaeology, Hot Match likely:

1. **Showed more matches** → rank-first pattern meant founders saw 50-200 options
2. **Felt "alive"** → dynamic scoring, not static threshold filtering  
3. **Degraded gracefully** → weak matches still shown with context ("emerging")
4. **Trusted founders** → let them judge, didn't gate-keep with MIN_MATCH_SCORE

Pythh regression:
1. **Shows fewer matches** → filter-first pattern, rigid thresholds
2. **Feels "sparse"** → many startups get 0-5 matches (below threshold)
3. **Dead-ends** → "No matches found" for legit startups
4. **Paternalistic** → algorithm decides what founders "should" see

## 📋 Proposed Fixes (Priority Order)

### ✅ DONE: Fix Stage Type Mismatch
- [x] Add STAGE_MAP to match-regenerator.js
- [x] Fix pagination to fetch all 3,175 investors
- [x] Re-run diagnostic → 299 matches for Nowports

### 🔴 CRITICAL: Regenerate All Matches
- [ ] Run `node match-regenerator.js` with fixed algorithm
- [ ] Expect 200K+ matches (was ~50K with broken stage matching)
- [ ] Verify Nowports has 299 matches in database
- [ ] Log to ai_logs table

### 🟡 HIGH: Lower Match Generation Threshold
- [ ] Change `MIN_MATCH_SCORE: 45` → `MIN_MATCH_SCORE: 35`
- [ ] Rationale: 2-tier policy handles display logic (≥50 vs <50)
- [ ] Benefit: "Close call" investors (42-44 scores) now saved to DB
- [ ] Impact: Match table grows 20-30%, but quality tier preserved

### 🟢 MEDIUM: Investigate Rank-First Pattern
- [ ] Find original Hot Match ranking logic (git archaeology)
- [ ] Compare with current MatchingEngine.tsx query pattern
- [ ] Prototype rank-first in separate branch
- [ ] A/B test with founders

### 🔵 LOW: Fix GOD Score Calculation
- [ ] Nowports GOD 48 → quality 12/25 seems low
- [ ] Review calculateStartupQuality() scaling
- [ ] Consider: YC backing should boost GOD score significantly

## 🧪 Test Cases

### Test 1: Nowports Match Regeneration
```bash
# Before fix
SELECT COUNT(*) FROM startup_investor_matches 
WHERE startup_id = '8733ff8c-2f77-403b-906f-310fab0275fb';
-- Result: 1

# After fix + regeneration
SELECT COUNT(*) FROM startup_investor_matches 
WHERE startup_id = '8733ff8c-2f77-403b-906f-310fab0275fb';
-- Expected: 299
```

### Test 2: Stage Distribution
```sql
-- Check if stage matching now works
SELECT 
  s.name,
  s.stage as startup_stage,
  COUNT(m.id) as match_count
FROM startup_uploads s
LEFT JOIN startup_investor_matches m ON s.id = m.startup_id
WHERE s.status = 'approved'
  AND s.stage = 1  -- Seed stage startups
GROUP BY s.id, s.name, s.stage
HAVING COUNT(m.id) < 10
ORDER BY COUNT(m.id) ASC
LIMIT 10;
-- Should return 0 rows (all Seed startups should have matches)
```

### Test 3: Investor Coverage
```sql
-- How many investors are actually matched?
SELECT 
  COUNT(DISTINCT investor_id) as matched_investors,
  (SELECT COUNT(*) FROM investors) as total_investors,
  ROUND(100.0 * COUNT(DISTINCT investor_id) / (SELECT COUNT(*) FROM investors), 1) as coverage_pct
FROM startup_investor_matches;
-- Expected: 2,800+ / 3,175 (88%+)
```

## 📝 Next Session Commands

```bash
# 1. Regenerate all matches with fixed algorithm
cd /Users/leguplabs/Desktop/hot-honey
SUPABASE_URL=$VITE_SUPABASE_URL node match-regenerator.js

# 2. Verify Nowports matches
SUPABASE_URL=$VITE_SUPABASE_URL node scripts/debug-nowports-generation.js

# 3. Check match count
# Run in Supabase SQL editor:
SELECT COUNT(*) FROM startup_investor_matches;

# 4. Deploy to production (after testing)
git add .
git commit -m "FIX: Stage type mismatch in match generation (1 → Seed)"
git push origin main
```

## 🎓 Lessons Learned

1. **Type mismatches are silent killers** → No errors, just 999/1000 rejections
2. **Pagination bugs compound** → Only saw 1000/3175 investors
3. **User feedback is data** → "Hot Match felt better" = architectural signal
4. **Filter-first vs rank-first** → Fundamental pattern difference
5. **Thresholds create dead zones** → 42-44 scores are invisible to system
6. **Database > code** → Check what's IN the tables, not just what code SHOULD do

## 🔗 Related Files

- [match-regenerator.js](./match-regenerator.js) - Backend match generation
- [src/services/matchingService.ts](./src/services/matchingService.ts) - Frontend matching logic
- [src/components/MatchingEngine.tsx](./src/components/MatchingEngine.tsx) - UI query pattern
- [scripts/debug-nowports-generation.js](./scripts/debug-nowports-generation.js) - Diagnostic tool
- [scripts/check-stage-field.js](./scripts/check-stage-field.js) - Stage type inspector
- [PHASE_1_3_COMPLETE.md](./PHASE_1_3_COMPLETE.md) - Comprehensive status (previous)
- [SYSTEM_GUARDIAN.md](./SYSTEM_GUARDIAN.md) - Health monitoring system
