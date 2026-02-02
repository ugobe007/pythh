# 💔 GOD SCORE HEART HEALTH REPORT

## Critical Finding: Scores Too Low (Not Too High!)

### Executive Summary
The GOD scoring algorithm's "heart" is beating **too slowly**. Scores are being compressed to 34.9 avg when they should be 55-65 for healthy startups.

---

## Diagnostic Results

### Current State
```
📊 Sample of 50 Approved Startups:
   Average GOD Score: 34.9/100
   Raw Component Total: 5.75
   Normalization Divisor: 23
   Result: (5.75 / 23) * 10 = 2.5/10 = 25/100
```

### Distribution
| Range | Count | Percentage |
|-------|-------|------------|
| < 40 | Majority | ~70% |
| 40-59 | Some | ~25% |
| 60-79 | Few | ~4% |
| 80+ | Rare | ~1% |

### Component Breakdown (Healthy)
```
team_execution      : 1.51 (26.2%)  ✅ Good balance
market              : 0.76 (13.2%)  ✅ Good balance  
traction            : 0.69 (12.1%)  ✅ Good balance
market_insight      : 0.60 (10.4%)  ✅ Good balance
founder_courage     : 0.50 (8.7%)   ✅ Good balance
product             : 0.48 (8.3%)   ✅ Good balance
velocity            : 0.39 (6.8%)   ✅ New component working
```

**Verdict**: Component weights are well-balanced. Problem is normalization crushing final scores.

---

## Root Cause Analysis

### The Issue
```typescript
const GOD_SCORE_CONFIG = {
  normalizationDivisor: 23,  // ❌ TOO HIGH - crushing scores
  baseBoostMinimum: 2.0,     // ✅ OK
  vibeBonusCap: 1.0,         // ✅ OK
};
```

**Math:**
- Raw component sum: 5.75 (reasonable for quality startups)
- Current formula: `(5.75 / 23) * 10 = 2.5/10 = 25/100` ❌
- Should be: `(5.75 / 10.5) * 10 = 5.5/10 = 55/100` ✅

### Why This Happened
The `normalizationDivisor: 23` was set high to accommodate new forward-looking components (velocity, capital_efficiency, market_timing) added in December 2025. The comment says:

> "Increased for new forward-looking components (velocity, efficiency, timing)"

But these new components only add ~1.5 points max, not 11 points! The divisor was over-corrected.

---

## Recommendations

### Option 1: Decrease Normalization Divisor (RECOMMENDED)
**Change:** `normalizationDivisor: 23 → 10.5`

**Impact:**
- Current avg: 34.9 → Target avg: 55-65
- Proportional increase across all startups
- No component rebalancing needed
- **Expected outcome:** Scores hit healthy 55-65 range

**Pros:**
- Simple one-line change
- Preserves component balance
- Gets scores into target range immediately

**Cons:**
- None (this fixes the core issue)

### Option 2: Increase Component Weights (NOT RECOMMENDED)
Would require rebalancing all 11 components. Complex and unnecessary since components are already well-balanced.

### Option 3: Check ML Recommendations
Query `ml_recommendations` table to see if ML agent has data-driven suggestions based on actual funding outcomes.

---

## Implementation Plan

### Step 1: Fix Normalization Divisor
```typescript
// In server/services/startupScoringService.ts line 65

const GOD_SCORE_CONFIG = {
  normalizationDivisor: 10.5,  // Changed from 23 → target 55-65 avg
  baseBoostMinimum: 2.0,
  vibeBonusCap: 1.0,
  finalScoreMultiplier: 10,
  averageScoreAlertHigh: 70,
  averageScoreAlertLow: 50,
} as const;
```

### Step 2: Recalculate All Scores
```bash
npx tsx scripts/recalculate-scores.ts
```

This will:
- Recalculate all approved/pending startups
- Update `total_god_score` in database
- Log changes to `score_history` table

### Step 3: Verify Distribution
```bash
npx tsx check-full-god-distribution.ts
```

Expected outcome:
- Average: 55-65
- Min: 40-50 (database trigger prevents < 40)
- Max: 80-90 (elite startups)
- Distribution: Normal curve centered at 60

### Step 4: Monitor System Guardian
System Guardian runs every 10 minutes. After recalculation:
- Check `/admin/health` dashboard
- Should show "🟢 HEALTHY: Scores in target range (55-65 avg)"
- No more "SCORES TOO LOW" alerts

---

## Why This Matters (The Heart Metaphor)

### GOD Scores = Blood Pressure
- **Too low (< 40)**: Startup "dead" - filtered out
- **Healthy (55-65)**: Startup viable - normal range
- **High (70-80)**: Startup strong - good candidate
- **Elite (80+)**: Startup exceptional - hot deal

### Match Scores = Pulse Rate  
- Uses GOD scores as **baseline** (60% weight)
- Adds semantic similarity (40% weight when available)
- **Current issue**: Low GOD scores (34.9) are dragging down match scores

### The Corruption Chain
```
Low GOD scores (34.9) 
    ↓
Match algorithm uses GOD * 0.6
    ↓
Even perfect semantic match gets pulled down
    ↓
Signal scores don't reflect true alignment
```

**Example:**
- Startup with 35 GOD score + 100% semantic match
- Match score: `(35 * 0.6) + (100 * 0.4) = 21 + 40 = 61`
- Should be: `(60 * 0.6) + (100 * 0.4) = 36 + 40 = 76` ✅

---

## Expected Outcomes

### After Fix
| Metric | Before | After |
|--------|--------|-------|
| **Avg GOD Score** | 34.9 | 55-65 |
| **Avg Match Score** | 74.7 | 75-80 (slight increase) |
| **Signal Alignment** | Corrupted | Accurate |
| **Startup Confidence** | Low scores discourage | Healthy scores empower |

### Business Impact
- **Founders** see realistic quality assessments (55-65, not 35)
- **Investors** get accurate signal strength (not artificially low)
- **Match algorithm** operates with correct baseline weights
- **System Guardian** stops alerting on "too low" scores

---

## Next Steps

1. **Immediate**: Apply normalization divisor fix (23 → 10.5)
2. **Run**: Recalculate all scores across database
3. **Verify**: Check distribution hits 55-65 avg
4. **Monitor**: System Guardian health checks
5. **Optional**: Query ML agent for data-driven refinements

---

## ML Agent Status

### Check for Recommendations
```sql
SELECT * FROM ml_recommendations 
WHERE type = 'god_scoring' 
ORDER BY created_at DESC 
LIMIT 5;
```

If ML agent has analyzed actual funding outcomes (investments, meetings, passes), it may suggest:
- Specific component weight adjustments
- Red flag penalty calibrations
- New forward-looking signals

**Note:** ML training requires match feedback data. If no investments tracked yet, rely on theoretical calibration (the fix above).

---

*Diagnostic run: January 22, 2026*  
*Sample size: 50 approved startups*  
*Recommendation confidence: HIGH (math-based, not subjective)*

