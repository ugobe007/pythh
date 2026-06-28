# Current Scraper Architecture Status

## 1. Dynamic APIs ❌ NOT INTEGRATED

**Status**: You mentioned introducing a "dynamic API component that parse.bot uses", but it's **not currently integrated** into the codebase.

**What exists**:
- `intelligent-scraper.js` uses AI extraction (Claude) but not dynamic APIs
- No Parse.bot-style dynamic parser found

**What's needed**:
- Integrate dynamic API parser for reverse-engineering page structure
- Use natural language schemas instead of hardcoded selectors

## 2. Playwright ✅ ACTIVELY USED

**Status**: **Playwright is the primary browser automation tool**

**Currently using Playwright in**:
- ✅ `yc-companies-scraper.js`
- ✅ `sequoia-scraper.js`
- ✅ `hax-scraper.js`
- ✅ `speedrun-yc-scraper.mjs`
- ✅ `lib/tiered-extractors.js` (new Tier 2 extractor)

**Stagehand Status**: 
- ⚠️ Still in `package.json` but **mostly abandoned**
- Old scripts exist (`stagehand-enrichment.mjs`) but docs say "switched to Playwright + Claude"
- **Recommendation**: Remove Stagehand dependencies, use Playwright only

## 3. Inference Engine ✅ EXISTS BUT NOT INTEGRATED INTO TIERED SCRAPER

**Status**: **Inference engine exists and runs, but NOT integrated into new tiered pipeline**

**What exists**:
- ✅ `startup-inference-engine.js` - Fills gaps using heuristics (no API calls)
- ✅ `investor-inference-engine.js` - Same for investors
- ✅ Integrated into `unified-scraper-orchestrator.js` as **Step 2** (after discovery)

**How it works**:
```javascript
// Takes: name, description, tagline, website, sectors, pitch
// Creates: extracted_data { team, market, funding, product, traction, fivePoints }
// Uses: Keyword matching, pattern recognition, heuristics
// Cost: FREE (no API calls)
```

**Current Integration**:
```
unified-scraper-orchestrator.js:
  1. Discovery (RSS, scrapers)
  2. Inference (fill gaps) ← HERE
  3. Scoring (GOD scores)
  4. Matching
```

**Missing Integration**:
- ❌ `tiered-scraper-pipeline.js` does NOT call inference engine
- ❌ Inference should run after Tier 0/1/2 extraction to fill gaps
- ❌ Should be part of the "gate" logic (use inference before expensive LLM)

## Recommendations

### 1. Integrate Dynamic APIs
```javascript
// Add to tiered-extractors.js
class DynamicAPIExtractor {
  static async extract(url, schema) {
    // Use Parse.bot-style dynamic parser
    // Reverse-engineer page structure
    // Extract using natural language schemas
  }
}
```

### 2. Remove Stagehand
- Remove from `package.json`
- Delete old Stagehand scripts
- Update docs to say "Playwright only"

### 3. Integrate Inference Engine into Tiered Pipeline
```javascript
// tiered-scraper-pipeline.js should:
1. Extract (Tier 0/1/2)
2. Run inference engine (fill gaps, FREE)
3. Check confidence
4. Only then use LLM if needed
```

This would make the pipeline:
- **Tier 0**: RSS (free)
- **Tier 1**: HTML/JSON (cheap)
- **Inference**: Fill gaps (free)
- **Tier 2**: Browser/AI (only if confidence still low)


