# Hot Honey - Data Quality Fix (Feb 14, 2026)

## Problem Identified
**Root Cause:** RSS scrapers were treating **news headlines as startup names**, pulling in 4,056 junk entries (37% of database).

### Examples of Junk Entries:
- ❌ "Nvidia's Huang" (18 pts) - News about Jensen Huang, not a startup
- ❌ "Jeff Bezos" (18 pts) - Blue Origin news article
- ❌ "Winter Continues" (18 pts) - Funding news article  
- ❌ "Escalating Valuations" (18 pts) - Industry news

### The "Baby with Bathwater" Problem:
While these entries are junk, they **contain real startup names** buried in the article text:
- 📰 News about "Nvidia's Huang" mentions **5 real AI startups**
- 📰 Funding roundup articles mention **Carrum** ($7M Series A), **Raana Semiconductors** ($3M seed)
- 📰 Acquisition articles mention **PatientCare EMS**, **Horizon3.ai**, **Presto Phoenix**

**We were archiving the junk but losing the valuable startup data inside.**

---

## Actions Taken

### 1. ✅ Archived Junk Entries
```
Before: 11,059 approved startups
After:  7,003 approved startups  
Archived: 4,056 junk entries (37%)
```

### 2. ✅ Adjusted Normalization Divisor
**Problem:** Divisor (17.5) was calibrated for dataset WITH 21% junk (scoring 10-20 pts). After cleanup, scores inflated.

```typescript
// server/services/startupScoringService.ts
normalizationDivisor: 17.5 → 25.0

Result:
  Before cleanup: Avg 45.18 (with junk)
  After cleanup:  Avg 73.65 (clean data, wrong divisor)
  After adjustment: Avg ~52 (target: 47-58) ✅
```

### 3. ✅ Built Startup Extraction Filters
**New Script:** `scripts/recover-startups-from-archived.js`

**Filters:**
- **News Subject Detection:** Identifies possessives ("Nvidia's Huang"), personal names, generic terms
- **Startup Name Extraction:** Finds companies with tech suffixes (AI, Labs, Tech), funding mentions, launches
- **Deduplication:** Checks if startup already exists before recovery

**Patterns Detected:**
```javascript
// Real startups in news articles:
- "raised $X" → Extract company name
- "acquired by Y" → Extract Y as startup
- "TechCo launched" → Extract TechCo
- Company suffixes: AI, Labs, Tech, Systems, Solutions
```

### 4. 🔄 Recovery Pipeline (In Progress)
```
Archived News Articles (4,267)
         ↓
   Extract Startup Names
         ↓
   Add to discovered_startups
         ↓
   Run Inference Scraper
         ↓
   Admin Review & Approve
         ↓
   Score & Match
```

**Current Status:**
- Processing all 4,267 archived entries
- Extracting real startup names
- Saving to `discovered_startups` table
- Next: Inference scraper will fill missing data

---

## Expected Outcomes

### Database Quality
- **Clean dataset:** 7,003 real startups (no news headlines)  
- **Target average:** 47-58 range (currently ~52)
- **Score distribution:** Proper bell curve

### Recovered Startups
- **Estimated recovery:** 50-100 real startups from archived news
- **Data source:** News mentions, funding articles, acquisition announcements
- **Quality:** High (mentioned in reputable tech news)

### Parsing Improvements Needed
**Next Steps:** Build filters on **backend scrapers** to:
1. Distinguish news headlines from startup names
2. Extract mentioned companies from article text
3. Separate subject from content
4. Run inference on recovered names

---

## Files Modified

### Core Scoring System
**`server/services/startupScoringService.ts`** (Lines 96-115)
```typescript
// CHANGE LOG updated:
// Feb 14, 2026: Admin junk cleanup - 17.5 → 25.0
// Reason: Removed 4,056 junk entries (news articles, spam)
// Dataset: 11,059 → 7,003 startups (clean data only)
normalizationDivisor: 25.0  // Calibrated for clean dataset
```

### Cleanup Scripts
- **`scripts/archive-junk-entries-feb14.js`** - Archives entries with no website, no traction, no pitch
- **`scripts/bulk-archive-junk.js`** - Batch processing for large datasets

### Recovery System  
- **`scripts/recover-startups-from-archived.js`** - Extracts real startup names from news articles

---

## Validation

### Before Cleanup:
```
Total: 11,059 approved
Average: 45.18 / 100 ❌ (below target)
Junk: 4,056 entries (37%)

Bottom performers:
  "Nvidia's Huang" (18 pts) - news
  "Jeff Bezos" (18 pts) - news  
  "Escalating Valuations" (18 pts) - news
```

### After Cleanup + Divisor Adjustment:
```
Total: 7,003 approved
Average: ~52 / 100 ✅ (target: 47-58)
Junk: 0 entries

Bottom performers:
  Real startups with sparse data (legitimate low scores)
  No more news headlines
```

### Recovered Data:
```
Startups found in archived news: [In Progress]
Ready for inference scraping: [In Progress]
Expected to approve: ~50-100 high-quality startups
```

---

## Admin Dashboard Updates

**Discover new startups:**
👉 http://localhost:5173/admin/discovered-startups

**Review recovered startups:**
- Filter by: `discovered_via = 'archived_news_extraction'`
- Metadata shows: Source article, extraction date
- Approve for scoring after inference scraper fills data

---

## Lessons Learned

1. **Data quality > Algorithm tuning**
   - 37% junk data caused 10-point average drop
   - Removing junk more effective than adjusting weights

2. **Calibration depends on dataset composition**
   - Divisor tuned for "dirty" data fails on clean data
   - Must recalibrate after major data changes

3. **Don't throw baby with bathwater**
   - Junk entries contain valuable embedded data
   - Smart extraction > blind deletion

4. **Parser needs context awareness**
   - News subject ≠ Startup name  
   - Need filters to distinguish entities
   - Extract mentions, not just headlines

---

## Next Actions

### Immediate (Automated):
- ✅ Junk archived
- ✅ Scores recalculated  
- 🔄 Startup recovery in progress

### Short-term (Next 24h):
- [ ] Complete recovery (all 4,267 entries)
- [ ] Run inference scraper on recovered names
- [ ] Admin review extracted startups

### Long-term (Parser Fixes):
- [ ] Add filters to RSS scraper (backend)
- [ ] Distinguish headlines from company names
- [ ] Extract mentioned companies from articles
- [ ] Prevent future junk entries

**Owner:** Andy (@ugobe007)
**Date:** February 14, 2026
**Status:** ✅ Core fix complete | 🔄 Recovery in progress
