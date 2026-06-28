# SSOT RSS Scraper - Current Status & Next Steps

**Date:** January 25, 2026  
**Status:** 🟡 Parser Integration Complete, Entity Extraction Needs Tuning  

---

## ✅ Completed

1. **Added SSOT fields to CapitalEvent**
   - `extraction.decision` (ACCEPT/REJECT)
   - `extraction.graph_safe` (true/false)
   - `extraction.reject_reason` (optional)

2. **Created SSOT-compliant scraper**
   - [scripts/core/ssot-rss-scraper.js](scripts/core/ssot-rss-scraper.js)
   - 2-phase persistence: always store events, conditionally create graph joins
   - Metrics tracking: rss_items_total, events_inserted, graph_edges_inserted

3. **Created database schema**
   - [migrations/ssot-event-storage.sql](migrations/ssot-event-storage.sql)
   - `startup_events` table for 100% event coverage
   - `startup_uploads.discovery_event_id` for graph joins

4. **Created documentation**
   - [SSOT_RSS_SCRAPER_GUIDE.md](SSOT_RSS_SCRAPER_GUIDE.md) - Complete implementation guide
   - [scripts/test-ssot-parser.js](scripts/test-ssot-parser.js) - Validation tests

---

## 🔴 Issues Found

### Test Results (14 Failing Headlines)
All 14 headlines that were failing with "No company name extracted" are still being filtered:

```
✅ Produced events: 14/14 (100%)
❌ All marked as FILTERED with decision=REJECT
❌ Reason: low_quality_entities
```

**Examples:**
- "The Rippling/Deel corporate spying scandal..." → FILTERED (Rippling/Deel are valid companies!)
- "Capital One To Buy Fintech Startup Brex..." → FILTERED (Capital One/Brex are valid!)
- "Inside Apple's AI Shake-Up..." → FILTERED (Apple is valid!)

### Root Cause
The parser's `validateEntityQuality()` function is rejecting many valid company names because:

1. Stop-words ("The", "Inside", "How") at the start of the headline
2. Entity extraction not finding companies in complex sentence structures
3. `isTopicHeadline()` filter being too aggressive

---

## 🎯 Next Steps (Priority Order)

### Step 1: Fix Entity Extraction (CRITICAL)
**File:** `src/services/rss/frameParser.ts`

**Current Issue:** Parser patterns don't match:
- Headlines starting with "The X/Y..." ("The Rippling/Deel...")
- Headlines with prefixes ("Inside Apple's...", "How [Company]...")
- M&A headlines ("X To Buy Y...")

**Fix:** Add patterns for these cases (already implemented in Phase-Change patches but need to verify coverage)

### Step 2: Relax `validateEntityQuality()` Filter
**File:** `src/services/rss/frameParser.ts` (line ~224)

**Current:** Rejects entities with stop-words, short names, etc.  
**Fix:** Move this logic to `graph_safe` determination, not `decision` gate.

**Principle:** `decision="ACCEPT"` should be lenient (store for observability), `graph_safe=false` should be strict (don't create bad graph joins).

### Step 3: Update `decision` Logic
**Current:**
```typescript
decision: finalEventType === "FILTERED" && entities.length === 0 ? "REJECT" : "ACCEPT"
```

**Should be:**
```typescript
decision: isTopicHeadline(title) && entities.length === 0 ? "REJECT" : "ACCEPT"
// Only REJECT if truly junk (predictions, roundups) AND no entities found
```

### Step 4: Move Entity Quality to `graph_safe`
```typescript
graph_safe: (
  finalEventType !== "FILTERED" &&
  finalConfidence >= 0.8 &&
  entities.length > 0 &&
  entities.some(e => validateEntityQuality(e.name)) // Move quality check HERE
)
```

---

## 📊 Expected Impact

### Before Fixes
- 14/14 headlines → FILTERED + decision=REJECT
- 0% would be stored in `startup_events`
- 0% would create graph joins

### After Fixes
- 14/14 headlines → 10-12 as OTHER/events, 2-4 as FILTERED
- ~85% would be stored in `startup_events` (decision=ACCEPT)
- ~40% would create graph joins (graph_safe=true for clear cases like "Brex", "Apple")

---

## 🔧 Implementation Plan

1. **Read current entity extraction logic**
   ```bash
   grep -A 50 "validateEntityQuality" src/services/rss/frameParser.ts
   grep -A 50 "isTopicHeadline" src/services/rss/frameParser.ts
   ```

2. **Move `validateEntityQuality` from decision gate to graph_safe gate**

3. **Relax topic headline filter** - only reject newsletters/predictions, not all "How X..." articles

4. **Add more frame patterns** for:
   - "The X/Y..." structures
   - "Inside X's..." structures
   - "X To Buy Y" structures (already added in Patch 3, verify)

5. **Re-run validation test**
   ```bash
   npx tsx scripts/test-ssot-parser.js
   ```

6. **Deploy when test shows:**
   - decision=ACCEPT for 10-12/14 headlines
   - graph_safe=true for 5-8/14 headlines (clear company names)

---

## 📁 Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/services/rss/frameParser.ts` | ~224-240 | Move `validateEntityQuality` usage |
| `src/services/rss/frameParser.ts` | ~250-270 | Relax `isTopicHeadline` filter |
| `src/services/rss/frameParser.ts` | ~1050-1075 | Update `decision` and `graph_safe` logic |
| `scripts/test-ssot-parser.js` | N/A | Already created, use for validation |

---

## 🚦 Deployment Gates

- [ ] Validation test shows 10+/14 with decision=ACCEPT
- [ ] Validation test shows 5+/14 with graph_safe=true
- [ ] Database migration applied (`ssot-event-storage.sql`)
- [ ] SSOT scraper tested on 1 RSS feed (manual run)
- [ ] Metrics show expected ratios (events_inserted > 90% of rss_items)

---

*Status: Ready for entity extraction tuning*  
*Next: Fix validateEntityQuality and decision logic in frameParser.ts*  
