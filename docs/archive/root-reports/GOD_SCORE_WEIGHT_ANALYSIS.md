# GOD Score Weight Analysis

> Current distribution (Mar 2026) vs targets, and recommended adjustments.

---

## Current Distribution (8,426 startups)

| Metric | Value |
|--------|-------|
| **Average** | 50.5 |
| **Median** | 48 |
| **Range** | 27 – 93 |

### Tier Breakdown

| Tier | Score | Count | % |
|------|-------|-------|---|
| Elite | 80+ | 199 | 2.4% |
| Excellent | 70–79 | 788 | 9.4% |
| Good | 60–69 | 1,510 | 17.9% |
| Average | 50–59 | 1,495 | 17.7% |
| Below Avg | 40–49 | 1,905 | 22.6% |
| Below 40 | <40 | 2,529 | 30.0% |

---

## Target vs Actual

| Setting | Target | Current | Status |
|---------|--------|---------|--------|
| **Average score** | 55–65 (target 60) | 50.5 | Below target |
| **Median** | ~55–60 | 48 | Below target |
| **Below 40** | 0% (floor enforced) | 30% | High |

The system is slightly too strict: average and median are below target, and 30% of startups fall below 40.

---

## Current Config (`startupScoringService.ts`)

```ts
GOD_SCORE_CONFIG = {
  normalizationDivisor: 19.0,   // Min of allowed range [19, 23]
  baseBoostMinimum: 2.0,        // Floor for sparse-data startups
  vibeBonusCap: 0.5,            // Min of allowed range [0.5, 1.5]
}
```

**Component weights** (from recommendationService.ts):
- team: 3.0, traction: 3.0, market: 2.0, product: 2.0, vision: 2.0
- ecosystem: 1.5, grit: 1.5, problemValidation: 2.0

---

## Adjustment Options

### Option A: Raise the floor (baseBoostMinimum)
- **Current:** 2.0  
- **Suggested:** 2.5 (range 0.5–3.0)  
- **Effect:** Higher baseline for sparse-data startups; lifts the low tail.
- **Risk:** Very low; 2.5 is still conservative.

### Option B: Increase vibe bonus
- **Current:** 0.5 (min)  
- **Suggested:** 1.0 (middle of 0.5–1.5)  
- **Effect:** More qualitative bonus; shifts average up.
- **Risk:** Low; adds a bit more subjectivity.

### Option C: normalizationDivisor
- **Current:** 19.0 (minimum allowed)  
- **Constraint:** Validation range is 19–23; going lower would require changing the validation.
- **Note:** Divisor is already at the most lenient allowed value.

### Option D: Component weights
- **Current:** team 3.0, traction 3.0, market 2.0, product 2.0, vision 2.0  
- **Possible tweak:** Slightly favor traction (e.g. 3.0 → 3.2) or team if you want to reward execution.
- **Risk:** Medium; affects relative ranking; should be done via ML recommendations or admin approval.

---

## Recommended Changes (Low Risk)

1. **baseBoostMinimum: 2.0 → 2.5**  
   - Raises the floor for startups with limited data.  
   - Expected: average ~52–54, fewer below 40.

2. **vibeBonusCap: 0.5 → 0.8**  
   - Moderate increase in qualitative bonus.  
   - Expected: average ~53–56.

**Combined effect:** Average likely moves from ~50.5 into the 54–58 range, closer to the 55–65 band.

---

## How to Apply

### Manual (GOD Settings UI)
1. Open `/admin/god-settings`
2. Adjust the relevant parameters (if exposed in the UI)

### Code (requires deploy)
Edit `server/services/startupScoringService.ts`:

```ts
// In GOD_SCORE_CONFIG:
baseBoostMinimum: 2.5,   // was 2.0
vibeBonusCap: 0.8,       // was 0.5
```

Then run a full score recalc:
```bash
npx tsx scripts/recalculate-scores.ts
```

### Via ML recommendations
If `ml-auto-apply` or the ML pipeline suggests weight changes, review them in `/admin/ml-recommendations` before applying.

---

## Post-Adjustment Check

After changing config and rerunning recalc:
```bash
node scripts/god-score-monitor.js
```

Aim for:
- Average: 55–62
- Median: 52–58
- Below 40: &lt;15%
