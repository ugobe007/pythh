# Architecture Research - Live Matching System

**Investigation Date:** January 28, 2026  
**Goal:** Understand current state, fix broken components, plan forward

---

## 🔍 CURRENT STATE ANALYSIS

### 1. **Two Parallel Matching Systems** (PROBLEM IDENTIFIED)

#### System A: Working (Landing Page)
- **Location:** `/` route → `MatchingEngine.tsx`
- **Match Source:** `server/services/investorMatching.ts` 
- **Status Field:** ✅ Sets `status: 'suggested'`
- **Query:** `.eq('status', 'suggested').gte('match_score', 20)`
- **Result:** WORKS on landing page

####System B: Broken (Batch Regeneration)
- **Location:** `match-regenerator.js` (root directory)
- **Match Source:** Direct calculation (sector + stage + quality scores)
- **Status Field:** ❌ Was NOT setting status (NOW FIXED)
- **Created:** 250,934 matches with `status=NULL`
- **Result:** MatchingEngine couldn't find them

---

## 📊 DATABASE STRUCTURE

### `startup_investor_matches` Table

**Required Columns:**
```sql
- id (uuid, PK)
- startup_id (uuid, FK → startup_uploads.id)
- investor_id (uuid, FK → investors.id)
- match_score (numeric) -- 0-100 scale
- status (text) -- 'suggested', 'viewed', 'contacted', 'passed', etc.
- confidence_level (text) -- 'high', 'medium', 'low'
- reasoning (jsonb or text[]) -- Why they match
- fit_analysis (jsonb) -- Breakdown of scores
- created_at (timestamp)
- updated_at (timestamp)
```

**Current Issue:**
- match-regenerator was creating rows WITHOUT `status` field
- MatchingEngine queries `.eq('status', 'suggested')` 
- Result: 0 matches found (NULL ≠ 'suggested')

**Fix Applied:**
```javascript
// match-regenerator.js line ~147
allMatches.push({
  startup_id: startup.id,
  investor_id: investor.id,
  match_score: totalScore,
  status: 'suggested',  // ← ADDED THIS
  confidence_level: totalScore >= 70 ? 'high' : 'medium',
  fit_analysis: { sector, stage, quality }
});
```

---

## 🎯 GOD SCORE INTEGRATION

### GOD Score System
- **Location:** `server/services/startupScoringService.ts`, `scripts/recalculate-scores.ts`
- **Stored In:** `startup_uploads.total_god_score` (0-100)
- **Components:** team_score, traction_score, market_score, product_score, vision_score

### How Matching Uses GOD Scores

**match-regenerator.js:**
```javascript
const startupQuality = calculateStartupQuality(startup.total_god_score);
// Contributes to final match_score
```

**MatchingEngine.tsx:**
```typescript
// Displays GOD score in UI, uses it for match context
startup.total_god_score // From database
```

**Relationship:**
```
GOD Score (startup) + Investor Quality + Sector Match + Stage Match
  ↓
Final Match Score (0-100)
  ↓
Stored in startup_investor_matches.match_score
```

---

## 🎨 UI COMPONENTS STATUS

### Working Components
1. **MatchingEngine.tsx** (`/` route)
   - Full matching UI with card swiping
   - Queries: `status='suggested'`, `score >= 20`
   - Shows GOD score breakdown
   - Save/share/view investor features

2. **SignalRadarPage.tsx** (`/signals-radar`)
   - Has MatchEngineStrip (subset of matches)
   - URL input for startup signal injection
   - 3-column layout: Signal Guide | Tape | Odds Rail

### Broken/Incomplete Components
1. **LiveMatchingStrip.tsx** (NEW - just created)
   - Auto-rotating proof of live matching
   - ❌ Was querying `status='suggested'` with no matches
   - ✅ FIXED: Removed status filter, uses `score >= 60`
   - Location: Placed on SignalRadarPage below URL input

2. **PythhMatchingEngine.tsx** (`/discover`)
   - Doesn't use `startup_investor_matches` table
   - Uses own matching logic (not batch-generated)
   - Needs investigation if should be unified

---

## 🔧 SERVICES THAT CREATE MATCHES

### 1. `server/services/investorMatching.ts`
- ✅ Sets `status: 'suggested'`
- Used by API endpoints
- Real-time matching when startup submits

### 2. `server/services/autoMatchService.ts`  
- ✅ Sets `status: 'suggested'`
- Automatic batch processing

### 3. `match-regenerator.js` (root)
- ❌ Was NOT setting status
- ✅ FIXED: Now sets `status: 'suggested'`
- Run with: `node match-regenerator.js`

### 4. `scripts/matching/generate-matches.js`
- ✅ Sets `status: 'suggested'`
- Alternative batch generator

---

## 🚨 KEY PROBLEMS IDENTIFIED

### Problem 1: Inconsistent Match Generation
**Issue:** Multiple scripts generate matches with different schemas  
**Impact:** Some have status, some don't → query failures  
**Solution:** Standardize ALL match generation to include status

### Problem 2: LiveMatchingStrip Empty
**Root Cause:** Querying `status='suggested'` but matches have `status=NULL`  
**Fix:** Either:
  - A) Remove status filter (done)
  - B) Re-run match-regenerator with updated code (better)

### Problem 3: Two Matching Engines
**Issue:** MatchingEngine vs PythhMatchingEngine serve similar purposes  
**Question:** Should we unify them or keep separate?  
**Decision Needed:** Andy's call

---

## 🎯 RECOMMENDED PLAN

### Phase 1: Fix Current Broken State (URGENT)
- [x] Add `status: 'suggested'` to match-regenerator.js
- [ ] Re-run match-regenerator to update all 250k matches
- [ ] Verify LiveMatchingStrip shows data
- [ ] Test MatchingEngine still works on `/`

### Phase 2: Standardize Match Generation
- [ ] Audit ALL match generation scripts
- [ ] Create shared `createMatch()` utility with required fields
- [ ] Update all scripts to use standard utility
- [ ] Document in ARCHITECTURE.md

### Phase 3: Replicate to Pythh Pages (IF DESIRED)
**Question for Andy:** Should LiveMatchingStrip appear on:
- [x] `/signals-radar` - Already added
- [ ] `/discover` (PythhMatchingEngine page)?
- [ ] Other pythh pages?

### Phase 4: Unify or Separate?
**Decision Needed:**
- Keep MatchingEngine + PythhMatchingEngine separate?
- Or unify into single matching system?
- Pros/cons of each approach

---

## 📝 NEXT STEPS

1. **Run this command:**
   ```bash
   node match-regenerator.js
   ```
   This will add `status: 'suggested'` to all matches.

2. **Verify it worked:**
   - Go to `/` - MatchingEngine should show matches
   - Go to `/signals-radar` - LiveMatchingStrip should auto-rotate
   - Check browser console for match counts

3. **Discuss with Andy:**
   - Where else should live matching appear?
   - Should we unify the two matching engines?
   - Any other pages need this feature?

---

## 🔗 KEY FILES REFERENCE

**Matching Logic:**
- `/src/components/MatchingEngine.tsx` - Main matching UI
- `/src/components/LiveMatchingStrip.tsx` - Auto-rotating proof
- `/src/components/PythhMatchingEngine.tsx` - Alternative engine

**Match Generation:**
- `/match-regenerator.js` - Batch regeneration (FIXED)
- `/server/services/investorMatching.ts` - Real-time API
- `/scripts/matching/generate-matches.js` - Alternative batch

**GOD Scoring:**
- `/server/services/startupScoringService.ts` - Scoring logic
- `/scripts/recalculate-scores.ts` - Batch recalculation

**Database:**
- Table: `startup_investor_matches`
- Columns: startup_id, investor_id, match_score, status, confidence_level, reasoning

---

*Research compiled by AI Assistant - January 28, 2026*
