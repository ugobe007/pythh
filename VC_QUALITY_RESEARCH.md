# VC Quality Distribution Research

## Executive Summary

**Current Problem:** Our GOD score distribution shows 67.6% rated "Strong" (60-69), which is unrealistic given real VC selection rates.

**Research Findings:** Real-world VC acceptance rates show only 1-10% of startups get quality funding, meaning 90%+ should score below 60.

---

## Real-World VC Acceptance Rates

### By Investor Tier (from codebase: `investor-tier-matching.js`)

| Tier | Description | Acceptance Rate | Check Size |
|------|-------------|-----------------|------------|
| **Tier 1** | Elite (Sequoia, a16z, Founders Fund) | **1-2%** | $10M+ |
| **Tier 2** | Strong (First Round, Initialized, Felicis) | **3-5%** | $2-10M |
| **Tier 3** | Emerging/Specialist | **5-10%** | $500K-2M |
| **Tier 4** | Angels/Scouts | **10-20%** | $25K-500K |

### YC Acceptance Rate
- **Applications per batch:** ~15,000-20,000
- **Accepted per batch:** ~250-400 companies
- **Acceptance rate:** **~1.5-2.5%**
- **Of accepted, funded beyond YC:** <50%

### Overall Market Reality
- **Seed-stage funding rate:** ~3-5% of applicants
- **Series A graduation rate:** ~20-30% of seed-funded companies
- **Reach unicorn status:** <0.1% of all startups

---

## What This Means for GOD Scores

### Current Distribution (UNREALISTIC)
```
Elite (80-100):     5.4%   ← Top performers
Excellent (70-79):  16.6%  ← Strong unicorn potential
Strong (60-69):     67.6%  ← ❌ WAY TOO HIGH
Good (50-59):       10.4%  ← Should be the majority
Fair (40-49):       0%     ← Where are the weak startups?
```

### Target Distribution (REALISTIC)
```
Elite (80-100):     3-5%   ← Top 1-2% + some accelerator grads
Excellent (70-79):  10-15% ← Strong traction, good team
Strong (60-69):     20-25% ← Solid potential, worth a meeting
Good (50-59):       35-40% ← Typical seed-stage, needs work
Fair (40-49):       20-25% ← Early-stage, major gaps
Weak (<40):         <5%    ← Should pivot or shut down
```

### Rationale

**If only 1-5% of startups get Tier 1-2 funding:**
- They should score 75+ (top 15-20%)
- Everyone else (95%) should be distributed 40-74

**If 80-90% of startups never raise institutional capital:**
- They should score 40-59 (needs improvement)
- Only top 10-20% should score 60+

**Current avg of 65.3 suggests:**
- Average startup is "Strong" (60-69)
- Would get a meeting with First Round
- Reality: Most don't even get angel interest

---

## Component Scoring Research

### YC Selection Criteria (from `startupScoringService.ts`)
```typescript
// YC-STYLE METRICS (Fund founders, not ideas)
- Team reputation/credentials
- Founder age (younger = more coachable)
- Traction velocity
- User passion
- Market size
```

### Elite VC Requirements (from `eliteScoringService.ts`)
```typescript
ELITE_VC_CRITERIA = {
  sequoia: {
    requires: ['technical_cofounder', 'traction', 'clear_sector'],
    min_god_score: 70,
    min_traction_score: 6,
    min_team_score: 2
  },
  a16z: {
    requires: ['technical_cofounder', 'venture_scale_market'],
    min_god_score: 70
  }
}
```

### AP (Above Potential) Scoring Thresholds
- **Freshman (40-44):** Needs 3+ dimensions to get "Promising" bonus
- **Bachelor (45-59):** Needs 2+ dimensions to get "AP" bonus
- **Masters (60-74):** Elite boost only if excellence score >2.5

---

## Recommended Calibration

### Option 1: Conservative (Target avg 50-52)
- **normalizationDivisor:** 27.0
- **Distribution:** 20% Strong, 38% Good, 22% Fair
- **Philosophy:** Most startups need work

### Option 2: Moderate (Target avg 51-53)
- **normalizationDivisor:** 26.0
- **Distribution:** 22% Strong, 37% Good, 20% Fair
- **Philosophy:** Slightly generous but realistic

### Option 3: Current Proposal (Target avg 52-55)
- **normalizationDivisor:** 25.0
- **Distribution:** 25% Strong, 35% Good, 18% Fair
- **Philosophy:** Balanced view of market

---

## Signal Bonuses Adjustment

Currently, startups can get:
- **Bootstrap bonus:** +2-4 pts (sparse data)
- **Signals bonus:** +3-10 pts (timing)
- **Momentum:** +0-8 pts (velocity)
- **AP/Promising:** +2-6 pts (premium qualities)
- **Elite boost:** +0-5 pts (excellence)
- **Spiky/Hot:** +0-2.5 pts (heat)

**Total possible bonus:** ~30 pts

This means even a weak base score (40) + max bonuses (30) = 70 (Excellent)

### Questions:
1. **Are we double-counting quality?** (Elite boost + AP + Signals all reward similar things)
2. **Should bonuses be multiplicative, not additive?** (So weak startups can't reach "Excellent")
3. **Should there be diminishing returns?** (First 3 signals = +5, next 3 = +3, next 3 = +2)

---

## Recommendations

### Immediate Action (Admin Approved)
✅ **Increase `normalizationDivisor` from 21.0 → 26.0**
- This creates a more realistic bell curve
- Target: avg 51-53, with 22% Strong, 37% Good, 20% Fair

### Future Calibration (Needs Research)
1. **Audit signal bonuses for overlap** - Are we rewarding the same thing 3x?
2. **Consider multiplicative bonuses** - Weak startups shouldn't reach "Excellent"
3. **Implement diminishing returns** - Cap total bonuses at +15-20 pts
4. **Validate against real outcomes** - Do our 80+ scores actually raise Series A?

---

## References

- `server/services/startupScoringService.ts` - Core scoring logic
- `server/services/eliteScoringService.ts` - Elite VC criteria
- `server/services/apScoringService.ts` - Above Potential detection
- `scripts/archive/utilities/investor-tier-matching.js` - VC acceptance rates
- `YC_SMELL_TESTS.md` - YC heuristics
