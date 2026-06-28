# Funding Velocity Research & Framework 🚀

## Hypothesis
**Funding velocity (time between funding rounds) is a key indicator of startup success, but varies significantly by:**
- Company type (software vs hardware vs medtech)
- Company stage (pre-seed → Series C+)
- Market conditions (2021 vs 2025)

## Research Findings

### Market Reality (2025)
- **Seed rounds:** Median 142 days (up from 68 days in 2021) - **2.1x slower**
- **Series A/B:** Several months of monitoring before term sheets
- **Factors:** Increased due diligence, competition, VC pressure for returns

### Sector-Specific Funding Velocity Benchmarks

#### Software/Services (Fast Velocity)
- **Pre-seed → Seed:** 6-12 months
- **Seed → Series A:** 12-24 months
- **Series A → Series B:** 12-24 months
- **Series B → Series C:** 18-36 months
- **Rationale:** Low CapEx, fast iteration, quick product-market fit validation

#### Hardware/Robotics (Slower Velocity)
- **Pre-seed → Seed:** 12-18 months
- **Seed → Series A:** 18-36 months
- **Series A → Series B:** 24-48 months
- **Rationale:** High CapEx, R&D cycles, manufacturing complexity

#### MedTech/Pharma (Slowest Velocity)
- **Pre-seed → Seed:** 18-24 months
- **Seed → Series A:** 24-48 months
- **Series A → Series B:** 36-60 months
- **Rationale:** Clinical trials, regulatory approval, long R&D cycles

#### DeepTech/Space Tech (Very Slow)
- **Pre-seed → Seed:** 18-36 months
- **Seed → Series A:** 36-60 months
- **Rationale:** Extreme R&D, regulatory hurdles, long development cycles

#### IoT/Electronics (Moderate)
- **Pre-seed → Seed:** 12-18 months
- **Seed → Series A:** 18-36 months
- **Rationale:** Hardware + software, moderate CapEx

### Stage-Specific Considerations

#### Pre-seed → Seed
- **Fastest stage** - Founders are proving concept
- **Software:** 6-12 months typical
- **Hardware:** 12-18 months typical
- **MedTech:** 18-24 months typical

#### Seed → Series A
- **Critical stage** - Proving product-market fit
- **Software:** 12-24 months (need traction metrics)
- **Hardware:** 18-36 months (need working prototype)
- **MedTech:** 24-48 months (need early trial data)

#### Series A → Series B
- **Growth stage** - Scaling proven model
- **Software:** 12-24 months (need revenue growth)
- **Hardware:** 24-48 months (need manufacturing scale)
- **MedTech:** 36-60 months (need advanced trial data)

#### Series B+ (EBITDA Positive)
- **Mature stage** - Larger rounds, tier 1 VCs, PE firms
- **All sectors:** 12-24 months typical
- **Rationale:** Proven model, predictable growth, larger check sizes

## Critical Analysis

### ✅ When Funding Velocity IS a Good Indicator

1. **Within same sector & stage** - Comparing software startups at Series A
2. **Relative to benchmarks** - Faster than sector average = positive signal
3. **Consistent velocity** - Multiple rounds at similar pace = execution strength
4. **Accelerating velocity** - Getting faster = strong traction signal

### ❌ When Funding Velocity is NOT a Good Indicator

1. **Cross-sector comparison** - Can't compare software to medtech
2. **Single data point** - One round doesn't tell the story
3. **Market timing** - 2021 vs 2025 very different (2x slower now)
4. **Bridge rounds** - Extensions don't count as new rounds
5. **Strategic vs VC rounds** - Corporate rounds have different timelines
6. **Down rounds** - Slower velocity might indicate struggles
7. **Pre-revenue stages** - Velocity less meaningful before traction

### ⚠️ Red Flags

- **Too fast (< 3 months between rounds):** Might indicate desperation, not success
- **Too slow (> 5 years for software):** Likely struggling or pivoting
- **Inconsistent:** Fast then slow = execution issues or market problems

## Proposed Framework

### 1. Calculate Funding Velocity

```javascript
function calculateFundingVelocity(fundingRounds, sector, currentStage) {
  if (!fundingRounds || fundingRounds.length < 2) {
    return null; // Need at least 2 rounds
  }
  
  // Sort rounds by date
  const sortedRounds = fundingRounds.sort((a, b) => 
    new Date(a.date) - new Date(b.date)
  );
  
  // Calculate time between consecutive rounds
  const intervals = [];
  for (let i = 1; i < sortedRounds.length; i++) {
    const days = (new Date(sortedRounds[i].date) - new Date(sortedRounds[i-1].date)) / (1000 * 60 * 60 * 24);
    intervals.push({
      from: sortedRounds[i-1].round_type,
      to: sortedRounds[i].round_type,
      days: days,
      months: days / 30
    });
  }
  
  // Get sector-specific benchmarks
  const benchmarks = getSectorBenchmarks(sector);
  
  // Compare to benchmarks
  const velocityScore = intervals.map(interval => {
    const expectedMonths = benchmarks[`${interval.from}_to_${interval.to}`] || 24;
    const ratio = expectedMonths / interval.months; // > 1 = faster than expected
    return {
      ...interval,
      expectedMonths,
      ratio,
      score: Math.min(ratio * 10, 20) // Cap at 20 points
    };
  });
  
  return {
    intervals,
    averageVelocity: intervals.reduce((sum, i) => sum + i.months, 0) / intervals.length,
    velocityScore: velocityScore.reduce((sum, v) => sum + v.score, 0) / velocityScore.length,
    trend: getVelocityTrend(intervals) // 'accelerating', 'consistent', 'decelerating'
  };
}
```

### 2. Sector Benchmarks

```javascript
const SECTOR_BENCHMARKS = {
  'Software': {
    'pre-seed_to_seed': 9,      // 9 months
    'seed_to_series_a': 18,     // 18 months
    'series_a_to_series_b': 18,  // 18 months
    'series_b_to_series_c': 24,  // 24 months
  },
  'Hardware': {
    'pre-seed_to_seed': 15,      // 15 months
    'seed_to_series_a': 27,      // 27 months
    'series_a_to_series_b': 36,  // 36 months
  },
  'MedTech': {
    'pre-seed_to_seed': 21,      // 21 months
    'seed_to_series_a': 36,       // 36 months
    'series_a_to_series_b': 48,   // 48 months
  },
  'DeepTech': {
    'pre-seed_to_seed': 27,      // 27 months
    'seed_to_series_a': 48,      // 48 months
  },
  'IoT': {
    'pre-seed_to_seed': 15,      // 15 months
    'seed_to_series_a': 27,      // 27 months
  }
};
```

### 3. Integration into GOD Scoring

**Proposed Weight: 5-10 points (out of 100)**

- **Only apply if:** Startup has 2+ funding rounds
- **Sector-adjusted:** Compare to sector benchmarks, not absolute
- **Stage-adjusted:** Different expectations for different stages
- **Trend bonus:** Accelerating velocity gets bonus points
- **Red flag penalty:** Too slow relative to sector = penalty

### 4. Data Requirements

**Need to track:**
- Funding round dates (array of rounds with dates)
- Round types (pre-seed, seed, Series A, etc.)
- Sector classification (for benchmark selection)
- Current stage

**Current database status:**
- ❌ No `funding_rounds` table (proposed in STARTUP_DATA_FLOW_MAPPING.md)
- ✅ Have `latest_funding_amount` and `latest_funding_round` in some places
- ✅ Have `extracted_data` JSONB that could store funding history
- ⚠️ Need to extract funding history from news/articles

## Implementation Plan

### Phase 1: Data Collection
1. Create `funding_rounds` table
2. Extract funding history from existing data
3. Enrich from news articles and Crunchbase
4. Track funding dates and round types

### Phase 2: Benchmarking
1. Research sector-specific benchmarks
2. Create benchmark lookup function
3. Validate benchmarks against real data

### Phase 3: Scoring Integration
1. Calculate velocity score (sector-adjusted)
2. Add to GOD scoring algorithm (5-10 points)
3. Test on existing startups
4. Validate correlation with success

### Phase 4: Validation
1. Compare velocity scores to actual outcomes
2. Adjust benchmarks based on results
3. Refine scoring weights

## Critical Questions to Answer

1. **Do we have enough funding round data?** (Need 2+ rounds per startup)
2. **Can we accurately classify sectors?** (For benchmark selection)
3. **Is velocity predictive or just correlative?** (Causation vs correlation)
4. **How do we handle outliers?** (Bridge rounds, strategic rounds, down rounds)
5. **Market timing adjustment?** (2021 vs 2025 benchmarks different)

## Recommendation

**✅ PROCEED with caution:**

1. **Start with data collection** - Build funding_rounds table and extract history
2. **Research sector benchmarks** - Validate with real market data
3. **Test hypothesis** - Calculate velocity for existing startups and see if it correlates with success
4. **Pilot integration** - Add as optional bonus (5 points) to GOD scoring
5. **Validate and refine** - Monitor if it improves prediction accuracy

**⚠️ Don't:**
- Add without sector/stage adjustment
- Use absolute velocity (must be relative)
- Apply to startups with < 2 rounds
- Ignore market timing (2021 vs 2025)

---

**Next Steps:**
1. Check if we have funding round data in database
2. Create funding_rounds table if needed
3. Extract funding history from existing data
4. Build velocity calculation function
5. Test on sample startups





