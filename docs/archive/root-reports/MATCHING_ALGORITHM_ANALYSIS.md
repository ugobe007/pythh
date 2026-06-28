# Matching Algorithm Analysis & Recommendations

## Current Algorithm Overview

The matching algorithm uses a **hybrid approach** combining:

1. **GOD Score (Startup Quality)** - Pre-calculated 0-100 score from database
2. **Match Bonuses** - Additional points for fit:
   - Stage Match: +10 points
   - Sector Match: +5 per match, max +10 points
   - Check Size Fit: +5 points
   - Geography Match: +2 points (reduced importance)

3. **Bidirectional Matching** (Optional):
   - 40% Startup Quality (GOD score)
   - 20% Investor Quality (VC GOD score)
   - 40% Fit Score

## Current Issues Identified

### 1. **GOD Score Weight May Be Too Low**
- Current: Base GOD score + bonuses (max +27 bonus points)
- Issue: High-quality startups (80+ GOD) might not get proportional match scores
- Example: A startup with 85 GOD score + 20 bonus = 105 → capped at 99
- **Recommendation**: Increase GOD score contribution or adjust bonus caps

### 2. **Match Bonus Distribution**
- Stage Match: +10 (good)
- Sector Match: +5 per match, max +10 (could be improved)
- Check Size: +5 (reasonable)
- Geography: +2 (appropriate - modern VCs invest globally)

### 3. **Score Capping**
- Final score capped at 99
- This prevents distinguishing between truly exceptional matches
- **Recommendation**: Consider allowing scores up to 100, or use tier system

### 4. **Sector Matching Logic**
Current logic:
```typescript
const commonSectors = startupIndustries.filter((ind: string) =>
  investorSectors.some((sec: string) => 
    String(sec).toLowerCase().includes(String(ind).toLowerCase()) ||
    String(ind).toLowerCase().includes(String(sec).toLowerCase())
  )
);
matchBonus += Math.min(commonSectors.length * 5, 10);
```

**Issues**:
- Simple substring matching may miss semantic matches
- Max bonus of +10 might be too low for perfect sector alignment
- No partial credit for related sectors (e.g., "AI" vs "Machine Learning")

### 5. **Stage Matching**
Current logic handles numeric stages (0-5) and string stages, but:
- May miss variations like "Series A" vs "series_a" vs "SeriesA"
- No partial credit for adjacent stages (e.g., Seed investor matching Pre-seed startup)

## Recommendations

### Priority 1: Increase GOD Score Impact

**Option A: Increase Base Weight**
```typescript
// Current: baseScore = startup.total_god_score
// Proposed: Add multiplier for high-quality startups
let baseScore = startup.total_god_score;
if (startup.total_god_score >= 80) {
  baseScore = startup.total_god_score * 1.1; // 10% boost for elite startups
} else if (startup.total_god_score >= 70) {
  baseScore = startup.total_god_score * 1.05; // 5% boost for quality startups
}
```

**Option B: Adjust Bonus Caps**
```typescript
// Increase max bonus from +27 to +35
// This allows high GOD startups to reach 100+ before capping
```

### Priority 2: Improve Sector Matching

```typescript
// Enhanced sector matching with semantic understanding
function calculateSectorFit(startupSectors: string[], investorSectors: string[]): number {
  let score = 0;
  
  // Exact matches: +8 points each
  const exactMatches = startupSectors.filter(s => 
    investorSectors.some(is => 
      normalizeSector(s) === normalizeSector(is)
    )
  );
  score += exactMatches.length * 8;
  
  // Partial matches: +5 points each
  const partialMatches = startupSectors.filter(s => 
    !exactMatches.includes(s) &&
    investorSectors.some(is => 
      normalizeSector(s).includes(normalizeSector(is)) ||
      normalizeSector(is).includes(normalizeSector(s))
    )
  );
  score += partialMatches.length * 5;
  
  // Related sectors (AI/ML, SaaS/Cloud, etc.): +3 points each
  const relatedMatches = findRelatedSectors(startupSectors, investorSectors);
  score += relatedMatches.length * 3;
  
  return Math.min(score, 20); // Increased max from 10 to 20
}
```

### Priority 3: Better Stage Matching

```typescript
function calculateStageFit(startupStage: number, investorStages: string[]): number {
  const stageNames = ['idea', 'pre-seed', 'seed', 'series_a', 'series_b', 'series_c'];
  const startupStageName = stageNames[startupStage] || 'seed';
  
  // Exact match: +10
  if (investorStages.some(s => normalizeStage(s) === normalizeStage(startupStageName))) {
    return 10;
  }
  
  // Adjacent stages: +7 (e.g., Pre-seed ↔ Seed)
  const adjacentStages = getAdjacentStages(startupStage);
  if (investorStages.some(s => adjacentStages.includes(normalizeStage(s)))) {
    return 7;
  }
  
  // Flexible investors: +5
  if (investorStages.some(s => 
    ['any', 'all', 'early', 'early-stage'].includes(normalizeStage(s))
  )) {
    return 5;
  }
  
  return 0;
}
```

### Priority 4: Add Quality Tiers

Instead of capping at 99, use tier system:
- **Platinum (95-100)**: Elite startup + Elite investor + Perfect fit
- **Gold (85-94)**: High-quality startup + Quality investor + Good fit
- **Silver (75-84)**: Quality startup + Decent investor + Good fit
- **Bronze (60-74)**: Decent startup + Any investor + Some fit

### Priority 5: Add Investor Quality Factor

Currently, investor quality (investor_score, investor_tier) is only used in bidirectional matching. Consider adding it to standard matching:

```typescript
// Add investor quality bonus
let investorBonus = 0;
if (investor.investor_tier === 'elite') investorBonus += 5;
else if (investor.investor_tier === 'strong') investorBonus += 3;
else if (investor.investor_tier === 'emerging') investorBonus += 1;

// Add to final score
finalScore = Math.min(baseScore + matchBonus + investorBonus, 100);
```

## Testing Recommendations

1. **Run Analysis Script**: `node analyze-match-algorithm.js`
   - Check if high GOD startups (75+) are getting proportional match scores
   - Verify match score distribution
   - Identify startups with no high-quality matches

2. **Check Match Quality**:
   ```sql
   -- Find startups with high GOD scores but low match scores
   SELECT 
     s.name,
     s.total_god_score,
     AVG(m.match_score) as avg_match_score,
     MAX(m.match_score) as max_match_score,
     COUNT(m.id) as match_count
   FROM startup_uploads s
   LEFT JOIN startup_investor_matches m ON s.id = m.startup_id
   WHERE s.total_god_score >= 75
   GROUP BY s.id, s.name, s.total_god_score
   HAVING AVG(m.match_score) < 60 OR COUNT(m.id) = 0
   ORDER BY s.total_god_score DESC;
   ```

3. **Test Algorithm Changes**:
   - Create test cases with known startups and investors
   - Verify scores make sense
   - Check that high-quality startups get better matches

## Implementation Priority

1. **Quick Wins** (1-2 hours):
   - Increase sector match bonus cap from 10 to 15
   - Add investor quality bonus (+1 to +5)
   - Adjust score cap to 100

2. **Medium Effort** (3-4 hours):
   - Improve sector matching with better normalization
   - Add adjacent stage matching
   - Add quality tier system

3. **Long-term** (1-2 days):
   - Implement semantic sector matching
   - Add ML-based fit scoring
   - Create A/B testing framework

## Questions to Answer

1. **What's the target average match score?** (Currently might be too low)
2. **Should we prioritize startup quality or fit?** (Current: balanced)
3. **How important is investor quality?** (Currently only in bidirectional mode)
4. **Should we filter out low-quality matches?** (Currently showing all, with smart filtering in UI)





