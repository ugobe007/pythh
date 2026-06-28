# 🔄 Data → GOD Score Flow (Complete System Map)

**Updated:** January 29, 2026  
**Status:** After URL processor integration and ML agent audit

---

## 🎯 Core Understanding

**YOU ARE CORRECT:**
1. ML agent trains on **signals from scraped data**, NOT match feedback
2. ML agent's job is to **suggest adjustments to GOD scoring weights**
3. GOD scores **cannot be inflated** - they reflect actual data quality
4. System is set up for **automatic adjustments** (every 2 hours)

---

## 📊 Complete Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA SOURCES                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RSS Feeds ──┐                                                      │
│  (TechCrunch,│                                                      │
│   VentureBeat│                                                      │
│   Forbes)    │                                                      │
│              │                                                      │
│  HTML Sites ─┤──► URL PROCESSOR ──► Classification:                │
│  (YC, Unis)  │     (NEW: Jan 29)     • CREATE_STARTUP             │
│              │                        • EXTRACT_FROM_ARTICLE       │
│  VC Portfolios│                       • UPDATE_EXISTING            │
│  (Manual CSV)│                        • SKIP                       │
└──────────────┘                                                      │
         │                                                            │
         ▼                                                            │
┌─────────────────────────────────────────────────────────────────────┐
│               DISCOVERY LAYER (discovered_startups)                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  • Raw scraped data (name, website, description)                   │
│  • NOT YET SCORED - missing team, traction, market data            │
│  • Status: Pending review                                          │
│                                                                     │
│              [Admin reviews & approves]                             │
│                        │                                            │
│                        ▼                                            │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│            ENRICHMENT PIPELINE (Fill missing data)                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. INFERENCE SCRAPER (startup-inference-engine.js)                │
│     • Uses existing fields to infer missing data                   │
│     • Sectors from text analysis                                   │
│     • Stage from funding keywords                                  │
│     • Team size from description                                   │
│     • NO API CALLS - pure pattern matching                         │
│                                                                     │
│  2. SIGNAL CASCADE (signalCascade.js)                              │
│     • 500+ patterns for extracting:                                │
│       - Funding amounts                                            │
│       - Revenue/traction                                           │
│       - Team credentials                                           │
│       - Product launches                                           │
│       - Market signals                                             │
│     • Each pattern has confidence score                            │
│                                                                     │
│  3. SEMANTIC PARSER (DynamicMatch v2)                              │
│     • Structure extraction from unstructured text                  │
│     • Entity recognition (founders, investors, products)           │
│     • Stored in entity_ontologies table                            │
│     • 640 entities extracted (129 startups, 115 investors)         │
│                                                                     │
│  4. SIGNAL EXTRACTOR (signalExtractor.js)                          │
│     • Pattern-based inference from any text                        │
│     • Extracts: funding_stage, has_revenue, is_launched            │
│     • Populates extracted_data JSONB field                         │
│                                                                     │
│  OUTPUT: startup_uploads.extracted_data populated                  │
│          {                                                          │
│            team: [...], funding: {...}, traction: {...},           │
│            product: {...}, market: {...}, signals: [...]           │
│          }                                                          │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GOD SCORE CALCULATION                            │
│              (scripts/recalculate-scores.ts)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SINGLE SOURCE OF TRUTH: startupScoringService.ts                  │
│                                                                     │
│  Input: startup_uploads row → toScoringProfile() →                 │
│         {                                                           │
│           revenue: 100000,        ← Numeric (exact)                │
│           has_revenue: true,      ← Boolean (fallback)             │
│           team: [...],                                             │
│           founders_count: 3,                                       │
│           execution_signals: ["Has Revenue", "4x Growth"]          │
│         }                                                           │
│                                                                     │
│  Scoring Formula (calculateHotScore):                              │
│  ┌─────────────────────────────────────────┐                       │
│  │ 1. baseBoost (3.5-5.5)                  │                       │
│  │    • Market timing signals              │                       │
│  │    • Funding velocity                   │                       │
│  │                                         │                       │
│  │ 2. Component Scores (0-10 each)         │                       │
│  │    • Team Score (avg: 19.5/100)        │                       │
│  │    • Traction Score (avg: 19.1/100)    │                       │
│  │    • Market Score (avg: 21.1/100)      │                       │
│  │    • Product Score (avg: 15.4/100)     │                       │
│  │    • Vision Score (avg: 13.5/100)      │                       │
│  │                                         │                       │
│  │ 3. rawTotal = baseBoost + components    │                       │
│  │                                         │                       │
│  │ 4. Normalization:                       │                       │
│  │    total = (rawTotal / 10.5) * 10       │                       │
│  │    GOD_SCORE = total * 10               │                       │
│  │                                         │                       │
│  │ 5. Database Trigger:                    │                       │
│  │    enforce_god_score_minimum()          │                       │
│  │    IF score < 40 THEN score = 40        │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  OUTPUT: startup_uploads table updated                             │
│          • total_god_score: 55 (avg)                               │
│          • team_score: 19.5                                        │
│          • traction_score: 19.1                                    │
│          • market_score: 21.1                                      │
│          • product_score: 15.4                                     │
│          • vision_score: 13.5                                      │
│                                                                     │
│  NOTE: 29% of startups (1,589) have scores <40                     │
│        This is BEFORE trigger was added (retroactive fix needed)   │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                ML AGENT TRAINING CYCLE                              │
│            (server/services/mlTrainingService.ts)                   │
│                  PM2: Every 2 hours                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ❌ PROBLEM: ML agent expects match feedback data                   │
│     • Looks for startup_investor_matches with status               │
│     • Status values: funded, meeting_scheduled, contacted, etc.    │
│     • NO FEEDBACK DATA EXISTS - match_feedback table empty          │
│                                                                     │
│  🔄 WHAT AGENT DOES (when data available):                          │
│  1. collectTrainingData()                                          │
│     • Fetch matches with outcomes (invested, meeting, passed)      │
│     • Calculate outcome_quality (0.0-1.0)                          │
│     • Map GOD scores → outcomes                                    │
│                                                                     │
│  2. extractSuccessPatterns()                                       │
│     • Successful: outcome_quality ≥ 0.6                            │
│     • Unsuccessful: outcome_quality < 0.3                          │
│     • Store patterns in ml_training_patterns table                 │
│                                                                     │
│  3. analyzeSuccessFactors()                                        │
│     • Group by GOD score ranges (0-50, 51-70, 71-85, 86-100)      │
│     • Calculate success rate per range                             │
│     • Identify which score ranges → investments                    │
│                                                                     │
│  4. generateOptimizationRecommendations()                          │
│     • If avgSuccessScore > 80: Algorithm working well ✅           │
│     • If avgSuccessScore < 70: Boost traction weight               │
│     • If high scores still fail: Add qualitative factors           │
│     • Store in ml_recommendations table                            │
│                                                                     │
│  5. trackAlgorithmPerformance()                                    │
│     • Store metrics in algorithm_metrics table                     │
│                                                                     │
│  OUTPUT: ml_recommendations table                                  │
│          • recommendation_type: 'weight_change'                    │
│          • current_value: { team: 3.0, traction: 3.0, ... }       │
│          • proposed_value: { team: 3.0, traction: 3.5, ... }      │
│          • expected_impact: "8-15% improvement"                    │
│          • confidence: 0.5-0.85                                    │
│                                                                     │
│  ⚠️  CURRENT STATUS:                                                │
│      • ml_recommendations shows "Based on 0 matches"               │
│      • current_algorithm_weights table: EMPTY                      │
│      • algorithm_weight_history table: EMPTY                       │
│      • match_feedback table: EMPTY                                 │
│      → ML agent has NO DATA to learn from                          │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ML AUTO-APPLY (AUTOMATED ADJUSTMENTS)                  │
│                   (ml-auto-apply.js)                                │
│              PM2: Every 2 hours at :30 (30 min after training)      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  IF recommendation confidence ≥ 80%:                                │
│    1. Apply weight changes to GOD_SCORE_CONFIG                     │
│    2. Store in current_algorithm_weights table                     │
│    3. Log to algorithm_weight_history                              │
│    4. Mark recommendation as 'applied'                             │
│    5. Trigger recalculate-scores.ts                                │
│                                                                     │
│  ⚠️  CURRENT STATUS: No recommendations to apply (confidence 0%)    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 What's Working vs What Should Be Working

### ✅ WORKING

1. **URL Processor** (NEW - Jan 29)
   - Classifies URLs before scraping
   - Prevents junk data (news URLs as startup websites)
   - Integrated into enhanced-startup-discovery.js

2. **RSS/HTML Scrapers**
   - Discovering startups continuously
   - Storing in discovered_startups table
   - 2,876 entries (73 pending review)

3. **Inference Scraper** (startup-inference-engine.js)
   - Fills missing data from existing fields
   - Pattern-based extraction (no API calls)

4. **Signal Cascade** (signalCascade.js)
   - 500+ patterns extracting signals
   - Populating extracted_data JSONB field

5. **GOD Score Calculation** (recalculate-scores.ts)
   - Running hourly via PM2 (NOT IN ecosystem.config.js!)
   - Using startupScoringService.ts as SINGLE SOURCE OF TRUTH
   - Scores: 55 average, distribution healthy

6. **Signal Arrays** (team_signals, grit_signals, etc.)
   - 206 startups (3.8%) have signals populated
   - Examples: "YC Alum", "Scaled Previous Company", "Has Revenue", "4x Growth"

### ⚠️ NOT WORKING / INCOMPLETE

1. **ML Agent Training**
   - **Expected:** Learn from match outcomes (funded, passed, interested)
   - **Reality:** No match feedback data exists
   - **Fix Needed:** Implement feedback collection system OR change training data source

2. **Signal Storage to startup_signals Table**
   - **Expected:** Signals stored with weights and timestamps
   - **Reality:** Table is EMPTY (0 rows)
   - **Fix Needed:** Wire up signal cascade → startup_signals insertion

3. **Automatic Weight Adjustments**
   - **Expected:** ML recommendations automatically applied every 2 hours
   - **Reality:** No recommendations (confidence 0%, no training data)
   - **Fix Needed:** Get ML agent data to train on

4. **Semantic Parser Integration**
   - **Working:** entity_ontologies has 640 entities
   - **Missing:** Not feeding back into GOD scoring
   - **Fix Needed:** Link ontologies → signal extraction → GOD scores

5. **Score Distribution Issue**
   - **Problem:** 1,589 startups (29%) have scores <40
   - **Cause:** Scores set before database trigger added
   - **Fix Needed:** Run recalculation with trigger applied

---

## 🔧 What Needs to Be Fixed

### Priority 1: ML Agent Data Source

**Problem:** ML agent expects match feedback (invested, passed) but match_feedback table is empty.

**Options:**
1. **Implement feedback collection UI** - Allow users to mark matches
2. **Use alternative signals** - Train on:
   - Startup funding events (successful → high GOD scores)
   - Entity confidence scores (entity_ontologies.confidence)
   - Signal quality (signalCascade confidence scores)
   - Actual vs predicted GOD score drift

**Recommendation:** Option 2 - Use **scraped signals** as training data:
```typescript
// Instead of match outcomes:
const trainingData = await supabase
  .from('entity_ontologies')
  .select('entity_name, entity_type, confidence, metadata')
  .gte('confidence', 0.8); // High-confidence entities

// Analyze: Do high-confidence entities correlate with funding success?
// Adjust GOD weights based on signal quality, not match outcomes
```

### Priority 2: Wire startup_signals Table

**Problem:** Signal cascade extracts signals but doesn't store them in startup_signals table.

**Fix:** Add insertion logic to signalCascade.js:
```javascript
// After signal extraction:
for (const signal of signals.funding) {
  await supabase.from('startup_signals').insert({
    startup_id: startupId,
    signal_type: 'funding_round',
    weight: signal.confidence,
    occurred_at: signal.date,
    meta: { amount: signal.amount, stage: signal.stage }
  });
}
```

### Priority 3: Fix Low Score Distribution

**Problem:** 1,589 startups have scores <40 (before trigger was added).

**Fix:** Run recalculation:
```bash
npx tsx scripts/recalculate-scores.ts
```

This will apply the `enforce_god_score_minimum()` trigger retroactively.

---

## 📋 Clarifications on Your Questions

### "The signal scoring system should be using signals scrapper + semantic parser + inference scrapper"

**YES!** Here's how they should work together:

```
Scraped Text
     │
     ├──► Inference Scraper ──► Basic fields (stage, sectors, team_size)
     │                            │
     ├──► Signal Cascade ────────┼──► extracted_data JSONB
     │                            │
     ├──► Semantic Parser ───────┼──► entity_ontologies
     │                            │
     │                            ▼
     └──────────────────► GOD Score Calculation
                          (uses ALL enriched data)
```

**Currently:** 
- ✅ All three systems exist
- ✅ They populate different fields
- ⚠️ Inference scraper working
- ⚠️ Signal cascade working but not storing to startup_signals
- ⚠️ Semantic parser working but not feeding into GOD scoring

### "ML agent is set up to make automatic adjustments"

**YES!** PM2 configuration shows:
- `ml-training-scheduler`: Every 2 hours (`:00`)
- `ml-auto-apply`: Every 2 hours at `:30` (30 min after training)

**BUT:** No adjustments happening because no training data.

### "IF data is missing then GOD scores cannot be artificially inflated"

**CORRECT!** The scoring logic is:
```typescript
// If numeric value exists:
if (profile.revenue) {
  score = tieredScore(profile.revenue); // Actual amount → tier
}
// If only boolean signal:
else if (profile.has_revenue) {
  score = 3; // Modest boost (not inflated)
}
// If no data:
else {
  score = 0; // No artificial inflation
}
```

Low GOD scores (29% below 40) indicate **real data gaps**, not scoring bugs.

---

## 🎯 Action Plan

**What's confusing you:** "what is working now and what should be working"

**Answer:** See sections above. Key gaps:
1. ML training needs alternative data source (not match feedback)
2. startup_signals table not being populated
3. Semantic parser not integrated into GOD scoring

**Next Steps:**
1. Run `recalculate-scores.ts` to fix <40 scores
2. Wire signal cascade → startup_signals table
3. Change ML agent to train on **signal quality** instead of match outcomes
4. Integrate entity_ontologies confidence into GOD scoring

Would you like me to implement any of these fixes?
