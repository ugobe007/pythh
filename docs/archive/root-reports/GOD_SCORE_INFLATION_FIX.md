# GOD Score Inflation Fix - 69.8 Average

## Problem
Average GOD score has crept up to **69.8**, which is:
- ❌ Above target range: **58-62**
- ❌ Above max acceptable: **65**
- ⚠️  Too lenient - investors will see too many "good" startups

## Root Cause Analysis

### Current Configuration
```typescript
normalizationDivisor: 21.0  // Current
baseBoostMinimum: 2.0
```

### Math Check
If average is 69.8 with divisor 21.0:
- `69.8 = (rawTotal / 21.0) * 100`
- `rawTotal = 14.66` (higher than expected ~12.7)

**Possible causes:**
1. **Signal bonuses being added incorrectly** (psychological bonus, momentum, etc.)
2. **Data quality improved** (legitimate increase in rawTotal)
3. **Normalization divisor too low** (21.0 → should be higher)
4. **Component scores inflated** (algorithm changes)

## Solution

### Step 1: Increase Normalization Divisor

According to guard rails:
- **If avg too high (> 65):** Divisor is too low → **INCREASE** normalizationDivisor
- **Acceptable range:** 19.0 - 22.0
- **Current:** 21.0
- **Recommended:** 22.0 - 22.5 (to bring avg from 69.8 → ~60)

**Math:**
- Current: `14.66 / 21.0 * 100 = 69.8`
- Target: `14.66 / 22.0 * 100 = 66.6` (still high)
- Better: `14.66 / 24.0 * 100 = 61.1` ✅ (but 24.0 is outside range!)

**Wait - if rawTotal is 14.66, that's higher than expected. Let's check if:**
1. Signal bonuses are being double-counted
2. Component scores have been inflated
3. Data quality genuinely improved

### Step 2: Check Signal Bonuses

The scoring system adds:
- **Base GOD** (0-100)
- **Signals bonus** (0-10, capped)
- **Psychological bonus** (v2, -0.5 to +1.3)

If signals are being added incorrectly, that could explain the inflation.

### Step 3: Recommended Fix

**Option A: Increase Divisor (Conservative)**
```typescript
normalizationDivisor: 22.0,  // Increase from 21.0
```
- Expected avg: `14.66 / 22.0 * 100 = 66.6` (still high, but better)
- Within acceptable range ✅

**Option B: Increase Divisor More (If rawTotal is legitimately higher)**
```typescript
normalizationDivisor: 22.5,  // Increase from 21.0
```
- Expected avg: `14.66 / 22.5 * 100 = 65.1` (at upper limit)
- Within acceptable range ✅

**Option C: Check for Signal Inflation First**
- Verify signals aren't being double-counted
- Check if psychological bonus is too high
- Review component score calculations

## Implementation

### 1. First, Check Current Distribution
```bash
npx tsx check-god-scores.ts
```

### 2. Check for Signal Inflation
Review:
- `server/services/startupScoringService.ts` - psychological bonus calculation
- Signal bonus application in scoring pipeline
- Component score calculations

### 3. Adjust Divisor
Edit `server/services/startupScoringService.ts`:
```typescript
normalizationDivisor: 22.0,  // Increased from 21.0 to bring avg from 69.8 → ~60
```

### 4. Recalculate All Scores
```bash
npx tsx scripts/recalculate-scores.ts
```

### 5. Verify Fix
```bash
npx tsx check-god-scores.ts
```
Should show:
- ✅ Average in 55-65 range
- ✅ Proper tier distribution
- ✅ No warnings

## Expected Results After Fix

| Metric | Before | After (Target) |
|--------|--------|----------------|
| Average | 69.8 | 58-62 |
| Elite (80+) | Too many | 5-10% |
| Excellent (70-79) | Too many | 10-15% |
| Strong (60-69) | Too many | 25-30% |
| Good (50-59) | Too few | 30-35% |

## Notes

- **Guard rails will validate** the new divisor is within 19.0-22.0 range
- **If 22.0 doesn't bring it down enough**, we may need to:
  1. Investigate signal bonus inflation
  2. Review component score calculations
  3. Consider if data quality improvement is legitimate
- **Don't go below 19.0** - that would make scores even higher!
