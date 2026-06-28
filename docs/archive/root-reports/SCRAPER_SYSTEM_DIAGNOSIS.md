# 🔍 Scraper System Diagnosis

## The Problem

You have **too many overlapping systems** trying to do the same thing, and **missing scripts** that are being called but don't exist.

## Current Architecture (The Mess)

```
┌─────────────────────────────────────────────────────────────┐
│                    MULTIPLE ORCHESTRATORS                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ❌ automation-engine.js                                     │
│     └─ Calls 15+ scripts (many don't exist)                 │
│                                                               │
│  ❌ scripts/hot-match-autopilot.js                           │
│     └─ Another orchestrator (different approach)              │
│                                                               │
│  ❌ system-guardian.js                                       │
│     └─ Monitors but doesn't orchestrate                      │
│                                                               │
│  ❌ launch-scrapers.sh                                        │
│     └─ Yet another way to start things                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SCRAPER COMPONENTS                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ simple-rss-scraper.js        (WORKS)                     │
│  ✅ intelligent-scraper.js        (WORKS)                    │
│  ✅ speedrun-full.mjs             (WORKS)                    │
│  ⚠️  speedrun-yc-scraper.mjs     (BROKEN - 0 results)        │
│  ✅ mega-scraper.js               (EXISTS)                   │
│  ✅ investor-mega-scraper.js      (EXISTS)                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    MISSING SCRIPTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ❌ run-rss-scraper.js           (called by automation)      │
│  ❌ discover-startups-from-rss.js (called by automation)    │
│  ❌ generate-matches.js            (called by automation)     │
│  ❌ auto-import-pipeline.js       (called by automation)     │
│  ❌ system-health-check.js        (called by automation)     │
│  ❌ validate-scraper-data.js      (called by automation)     │
│  ❌ run-all-enrichment.js         (called by automation)     │
│  ❌ calculate-investor-scores-v2.js (called by automation)   │
│  ❌ update-scores-from-news.js    (called by automation)     │
│  ❌ ... (10+ more missing scripts)                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    INFERENCE & ENRICHMENT                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ startup-inference-engine.js   (EXISTS)                   │
│  ✅ investor-inference-engine.js  (EXISTS)                   │
│  ✅ lib/dynamic-parser.js         (EXISTS - Parse.bot style) │
│  ⚠️  stagehand-enrichment.mjs     (HAS ISSUES)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Root Causes

### 1. **Script Name Mismatches**
- `automation-engine.js` calls `run-rss-scraper.js` but you have `simple-rss-scraper.js`
- `automation-engine.js` calls `discover-startups-from-rss.js` but it doesn't exist
- `automation-engine.js` calls `generate-matches.js` but you have `queue-processor-v16.js`

### 2. **No Single Source of Truth**
- Three different orchestrators (automation-engine, autopilot, guardian)
- Each has different schedules and approaches
- No clear hierarchy

### 3. **Missing Error Handling**
- Scripts fail silently
- No retry logic
- No fallback mechanisms

### 4. **Incomplete Integration**
- Parse.bot dynamic parser exists but not used by scrapers
- Inference engine exists but not called automatically
- Stagehand tried but abandoned (switched to Playwright + Claude)

## The Solution

### Phase 1: Create Unified Orchestrator ✅
- **File**: `unified-scraper-orchestrator.js`
- **Purpose**: Single source of truth for all scraping
- **Features**:
  - Calls only scripts that exist
  - Proper error handling
  - Retry logic
  - Clear logging
  - Integrates all components

### Phase 2: Fix Missing Scripts ✅
- Create wrapper scripts that map old names to new names
- Or update automation-engine.js to use correct script names

### Phase 3: Integrate All Components ✅
- Use `lib/dynamic-parser.js` in scrapers
- Call inference engine automatically
- Use working scrapers (RSS, intelligent, speedrun)

### Phase 4: Add Monitoring ✅
- Integrate with system-guardian.js
- Add health checks
- Add alerting

## Next Steps

1. **Create unified orchestrator** (replaces automation-engine.js)
2. **Fix script name mappings** (create aliases or update calls)
3. **Test end-to-end** (run full pipeline)
4. **Add monitoring** (integrate with guardian)


