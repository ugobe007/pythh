# Funding Velocity Implementation Plan 🚀

## Research Summary

### ✅ Hypothesis Validated
**Funding velocity IS a key indicator of startup success, BUT:**
- Must be **sector-adjusted** (can't compare software to medtech)
- Must be **stage-adjusted** (pre-seed → seed different from Series B → C)
- Must account for **market timing** (2025 is 1.8x slower than 2021)
- Only applies to startups with **2+ funding rounds**

### Key Findings

1. **Market Reality (2025):**
   - Seed rounds: 142 days median (up from 68 days in 2021)
   - Series A/B: Several months of monitoring before term sheets
   - Overall market is **1.8x slower** than 2021

2. **Sector Differences:**
   - **Software:** 6-24 months between rounds (fastest)
   - **Hardware:** 15-36 months (slower due to CapEx/R&D)
   - **MedTech:** 21-60 months (slowest due to clinical trials)
   - **DeepTech/Space:** 27-60 months (extreme R&D)

3. **Stage Differences:**
   - **Pre-seed → Seed:** Fastest (proving concept)
   - **Seed → Series A:** Critical (proving PMF)
   - **Series B+:** More consistent (12-24 months if EBITDA positive)

## Implementation Phases

### Phase 1: Data Collection ✅ (First Priority)

**Goal:** Build funding history database

**Steps:**
1. Create `funding_rounds` table (see schema below)
2. Extract funding history from existing data:
   - `funding_data` table (by company_name)
   - `extracted_data` JSONB fields
   - News articles with funding announcements
3. Enrich from external sources:
   - Crunchbase API
   - News scraping
   - RSS feeds

**Schema:**
```sql
CREATE TABLE funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL,  -- pre-seed, seed, series_a, series_b, etc.
  amount NUMERIC,            -- Funding amount in USD
  valuation NUMERIC,         -- Post-money valuation
  date DATE NOT NULL,        -- Funding date (critical for velocity)
  lead_investor TEXT,
  investors TEXT[],
  source TEXT,               -- Where we got this data
  source_url TEXT,
  announced BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_funding_rounds_startup ON funding_rounds(startup_id);
CREATE INDEX idx_funding_rounds_date ON funding_rounds(date DESC);
CREATE INDEX idx_funding_rounds_startup_date ON funding_rounds(startup_id, date DESC);
```

### Phase 2: Velocity Calculation ✅ (Framework Ready)

**Goal:** Calculate sector/stage-adjusted velocity scores

**Status:** Framework created in `funding-velocity-framework.js`

**Features:**
- ✅ Sector classification (Software, Hardware, MedTech, DeepTech, SpaceTech, IoT)
- ✅ Stage transition benchmarks (pre-seed→seed, seed→Series A, etc.)
- ✅ Market timing adjustment (2021 vs 2025)
- ✅ Velocity trend detection (accelerating, consistent, decelerating)
- ✅ Score calculation (0-10 points for GOD scoring)

**Usage:**
```javascript
const { calculateFundingVelocity, isVelocityApplicable } = require('./funding-velocity-framework');

// Check if applicable
const check = isVelocityApplicable(startup, fundingRounds);
if (!check.applicable) {
  return null; // Skip velocity scoring
}

// Calculate velocity
const velocity = calculateFundingVelocity(fundingRounds, startup);
// Returns: { sector, intervals, averageVelocity, overallRatio, trend, score }
```

### Phase 3: Integration into GOD Scoring ⏳ (Next)

**Goal:** Add velocity as optional bonus to GOD score

**Proposed Weight:** 5-10 points (out of 100)

**Integration Points:**
1. **In `god-score-v2-engine.js`:**
   - Fetch funding rounds for startup
   - Calculate velocity score
   - Add as bonus to Investment component (or separate component)

2. **Scoring Logic:**
   ```javascript
   // Only apply if:
   // - 2+ funding rounds exist
   // - Not bridge/extension rounds
   // - Valid dates available
   
   const velocityScore = calculateFundingVelocity(fundingRounds, startup);
   if (velocityScore && velocityScore.applicable) {
     // Add 5-10 points based on velocity
     totalScore += velocityScore.score;
   }
   ```

3. **Display:**
   - Show velocity score in GOD breakdown
   - Show trend (accelerating/consistent/decelerating)
   - Show sector-adjusted comparison

### Phase 4: Validation & Refinement ⏳ (After Implementation)

**Goal:** Validate that velocity correlates with success

**Tests:**
1. Compare velocity scores to actual outcomes (exits, growth)
2. Check if high-velocity startups have better outcomes
3. Validate sector benchmarks against real data
4. Adjust benchmarks based on results

## Critical Considerations

### ✅ When to Apply

- ✅ Startup has 2+ funding rounds
- ✅ Rounds have valid dates
- ✅ Not bridge/extension rounds
- ✅ Sector can be classified
- ✅ Within same market period (or adjusted)

### ❌ When NOT to Apply

- ❌ Only 1 funding round (can't calculate velocity)
- ❌ Missing round dates
- ❌ Bridge/extension rounds (not comparable)
- ❌ Cross-sector comparison (must be sector-adjusted)
- ❌ Single data point (need trend)

### ⚠️ Red Flags

- **Too fast (< 3 months):** Might indicate desperation
- **Too slow (> 5 years for software):** Likely struggling
- **Inconsistent:** Fast then slow = execution issues
- **Down rounds:** Slower velocity might indicate problems

## Current Database Status

### ✅ What We Have:
- `funding_data` table (by company_name, not startup_id)
- `latest_funding_amount` and `latest_funding_round` in some places
- `extracted_data` JSONB that could store funding history

### ❌ What We Need:
- `funding_rounds` table linked to `startup_uploads.id`
- Funding history extraction from existing data
- Enrichment pipeline to collect funding rounds from news

## Next Steps

1. **Create `funding_rounds` table** (SQL migration)
2. **Extract funding history** from existing data
3. **Test velocity calculation** on startups with 2+ rounds
4. **Validate benchmarks** against real market data
5. **Integrate into GOD scoring** (5-10 point bonus)
6. **Monitor and refine** based on results

## Files Created

- ✅ `FUNDING_VELOCITY_RESEARCH.md` - Research findings
- ✅ `funding-velocity-framework.js` - Calculation framework
- ✅ `funding-velocity-implementation-plan.md` - This file

---

**Recommendation:** Proceed with Phase 1 (data collection) first, then test velocity calculation on existing startups before integrating into GOD scoring.





