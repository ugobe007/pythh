# Base Boost Analysis - After Inference Integration

## Current State

**Average GOD Score**: 55.4 (within target range of 55-65) ✅
**Distribution**:
- Weak (31-48): 37.2%
- Average (49-64): 53.2%
- Solid (65-77): 8.8%
- Strong (78-88): 0.8%

**Standard Deviation**: 8.3 (low - indicates need for better differentiation)

## Base Boost Calculation

### Current Configuration:
```typescript
baseBoostMinimum: 3.5  // Minimum baseline
vibeBonusCap: 0.8      // Max qualitative bonus
normalizationDivisor: 22  // Overall scaling
```

### How Base Boost Works:
1. **Starts at 0**
2. **Adds VIBE bonus** (capped at 0.8):
   - Problem/value prop: 0-0.6
   - Solution clarity: 0-0.6
   - Market understanding: 0-0.5
   - Team pedigree: 0-0.8
   - Pitch quality: 0-0.5
   - Investment clarity: 0-0.3
   - Technical cofounder: 0-0.7
3. **Adds basic content bonuses**:
   - Team data: +1.0
   - Launched/demo: +1.0
   - Industries/sectors: +0.5
   - Problem/solution: +0.5
   - Tagline/pitch: +0.5
   - Founded date: +0.5
   - **Total possible**: ~4.5 points
4. **Clamped to minimum**: `Math.max(baseBoost, 3.5)`

### Expected Impact of Inference Integration:

**Before** (sparse data):
- Most startups: baseBoost = 3.5 (minimum)
- Few had problem/solution → +0.5
- Few had tagline/pitch → +0.5
- Few had team data → +1.0
- **Typical baseBoost**: 3.5-4.5

**After** (with inference extractor):
- Most startups will have problem/solution → +0.5
- Most startups will have tagline/pitch → +0.5
- More startups will have sectors → +0.5
- More startups will have team data → +1.0
- More startups will have is_launched/has_demo → +1.0
- **Typical baseBoost**: 5.0-6.5

**Impact**: Base boost will increase by ~1.5-2.0 points on average

## Score Impact Calculation

### Current Math:
```
rawTotal = baseBoost (3.5-6.5) + components (0-17.5) = 3.5-24.0
total (0-10) = (rawTotal / 22) * 10
final (0-100) = total * 10
```

### With Higher Base Boost:
- **Before**: rawTotal = 3.5 + 12 = 15.5 → score = (15.5/22)*10 = 7.05 → **70.5/100**
- **After**: rawTotal = 5.5 + 12 = 17.5 → score = (17.5/22)*10 = 7.95 → **79.5/100**

**Increase**: ~9 points on average (if components stay the same)

## Recommendation

### Option 1: Keep Current Settings (Recommended)
**Rationale**:
- Average is already in target range (55.4)
- Better data SHOULD result in higher scores (this is correct behavior)
- The increase reflects actual data quality improvement
- We can monitor and adjust if average goes above 70

**Action**: No change needed, monitor average score

### Option 2: Slight Adjustment (If Average Goes Too High)
If average exceeds 70 after inference integration:

```typescript
baseBoostMinimum: 3.0  // Reduce from 3.5 to 3.0
// OR
normalizationDivisor: 24  // Increase from 22 to 24
```

**But**: Only adjust if average exceeds 70 AND we have data showing it's too high

### Option 3: Reduce Content Bonuses (If Needed)
If base boost is too high, reduce content bonuses:

```typescript
// Current:
if (startup.team && startup.team.length > 0) baseBoost += 1;
if (startup.launched || startup.demo_available) baseBoost += 1;
if (startup.industries && startup.industries.length > 0) baseBoost += 0.5;
if (startup.problem || startup.solution) baseBoost += 0.5;
if (startup.tagline || startup.pitch) baseBoost += 0.5;
if (startup.founded_date) baseBoost += 0.5;

// Could reduce to:
if (startup.team && startup.team.length > 0) baseBoost += 0.5;  // 1 → 0.5
if (startup.launched || startup.demo_available) baseBoost += 0.5;  // 1 → 0.5
// Keep others the same
```

## Monitoring Plan

1. **After inference integration runs**:
   - Check average score: `npx tsx scripts/analyze-god-score-distribution.ts`
   - If average > 70: Consider adjustment
   - If average stays 55-65: No change needed ✅

2. **Track component scores**:
   - Run: `npx tsx scripts/analyze-god-components.ts`
   - Check if differentiation improved (std dev should increase)

3. **Recalibrate based on outcomes**:
   - Once you have investment outcomes, run: `npx tsx scripts/calibrate-god-scores.ts`
   - Adjust based on REAL data, not arbitrary targets

## Conclusion

**Current Recommendation**: **NO ADJUSTMENT NEEDED**

- Average is in target range (55.4)
- Better data should naturally increase scores (this is correct)
- Monitor after inference integration completes
- Only adjust if average exceeds 70 or falls below 50

The base boost increase from better data is a **feature, not a bug** - it reflects that startups with more complete profiles should score higher.



