# Answers to Your 3 Questions

## 1. Are we using Dynamic APIs? ❌ **NOT YET**

**Current Status**: 
- ❌ No Parse.bot-style dynamic API parser integrated
- ✅ `intelligent-scraper.js` uses AI extraction (Claude) but not dynamic APIs
- ✅ You mentioned introducing a "dynamic API component" but it's not in the codebase yet

**What Dynamic APIs Would Do**:
- Reverse-engineer page structure using natural language schemas
- Extract data without hardcoded selectors
- Adapt to different page layouts automatically

**Recommendation**: 
- Add `DynamicAPIExtractor` class to `lib/tiered-extractors.js`
- Use it in Tier 1 or Tier 2 when HTML parsing fails
- This would make extraction more robust across different sites

## 2. Playwright or Stagehand for Scraping? ✅ **PLAYWRIGHT**

**Current Status**:
- ✅ **Playwright is actively used** in:
  - `yc-companies-scraper.js`
  - `sequoia-scraper.js`
  - `hax-scraper.js`
  - `speedrun-yc-scraper.mjs`
  - `lib/tiered-extractors.js` (Tier 2 extractor)

- ⚠️ **Stagehand is mostly abandoned**:
  - Still in `package.json` but docs say "switched to Playwright + Claude"
  - Old scripts exist but not actively used
  - Recommendation: Remove Stagehand dependencies

**Your New Tiered Scraper**:
- Uses **Playwright** in `Tier2Extractor` (browser + AI extraction)
- Only runs when Tier 1 (HTML) fails or confidence is low

## 3. How is Inference Engine Integrated? ⚠️ **PARTIALLY**

**Current Integration**:
- ✅ Inference engine exists: `startup-inference-engine.js` and `investor-inference-engine.js`
- ✅ Runs in `unified-scraper-orchestrator.js` as **Step 2** (after discovery)
- ✅ Uses heuristics/rules to fill gaps (NO API calls, FREE)
- ❌ **NOT integrated into `tiered-scraper-pipeline.js`**

**How It Works**:
```javascript
// Takes: name, description, tagline, website, sectors, pitch
// Creates: extracted_data {
//   team, market, funding, product, traction, fivePoints
// }
// Method: Keyword matching, pattern recognition, heuristics
// Cost: $0.00 (no API calls)
```

**Current Workflow**:
```
unified-scraper-orchestrator.js:
  1. Discovery (RSS, scrapers) → startup_uploads
  2. Inference (fill gaps) → updates extracted_data
  3. Scoring (GOD scores)
  4. Matching
```

**What's Missing**:
- `tiered-scraper-pipeline.js` should call inference engine after extraction
- Inference should be part of the "gate" logic (use inference BEFORE expensive LLM)
- This would make the pipeline: Tier 0 → Tier 1 → **Inference** → Tier 2 (only if needed)

**Updated Pipeline Should Be**:
```
1. Tier 0: RSS extraction (free)
2. Tier 1: HTML/JSON extraction (cheap)
3. Inference Engine: Fill gaps (free, no API)
4. Check confidence
5. Tier 2: Browser/AI (only if confidence still low)
```

## Summary

| Component | Status | Integration |
|-----------|--------|-------------|
| **Dynamic APIs** | ❌ Not integrated | Need to add |
| **Playwright** | ✅ Actively used | ✅ Integrated in Tier 2 |
| **Stagehand** | ⚠️ Abandoned | Should remove |
| **Inference Engine** | ✅ Exists | ⚠️ Not in tiered pipeline |

## Next Steps

1. **Add Dynamic API Extractor** to `lib/tiered-extractors.js`
2. **Remove Stagehand** from dependencies
3. **Integrate Inference Engine** into `tiered-scraper-pipeline.js` (after Tier 1, before Tier 2)


