# ⛔ GOD SCORING SYSTEM - LOCKDOWN PROTOCOL

## AUTHORIZATION MATRIX

| Actor | Can Modify Weights? | Can Modify Signals? | Can View Scores? |
|-------|---------------------|---------------------|------------------|
| **Admin (You)** | ✅ YES | ✅ YES | ✅ YES |
| **ML Agent** | ✅ componentWeights ONLY | ❌ NO | ✅ YES |
| **AI Copilot** | ❌ NO | ❌ NO | ✅ YES |
| **Frontend** | ❌ NO | ❌ NO | ✅ YES |
| **Backend Services** | ❌ NO | ⚠️ Calculate only | ✅ YES |

---

## ARCHITECTURE (IMMUTABLE)

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOD SCORE (LOCKED)                           │
│                    23 Weighted Algorithms                       │
│                                                                 │
│  Only Admin + ML Agent can modify weights                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Team (0-3) + Traction (0-3) + Market (0-2) + Product (0-2)    │
│  + Vision (0-2) + Ecosystem (0-1.5) + Grit (0-1.5)             │
│  + Problem Validation (0-2) + baseBoost (3.5)                   │
│                                                                 │
│  → rawTotal (~17.5 max) / 17 * 10 → 0-100 GOD Score            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SIGNALS LAYER (SEPARATE)                     │
│                    Predictive Market Intelligence               │
│                                                                 │
│  50% change threshold - signals only update on significant      │
│  market movements, not noise                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Product Velocity (0-2.0 pts)                                   │
│  Funding Acceleration (0-2.5 pts)                               │
│  Customer Adoption (0-2.0 pts)                                  │
│  Market Momentum (0-1.5 pts)                                    │
│  Competitive Dynamics (0-2.0 pts)                               │
│                                                                 │
│  → Signals Bonus: 0-10 max (typical 1-3, rare 7+)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FINAL SCORE                                  │
│                                                                 │
│  FINAL = GOD base (0-100) + Signals bonus (0-10)               │
│  Capped at 100                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## WHAT SIGNALS ARE (AND ARE NOT)

### Signals ARE:
- ✅ **Predictive intelligence** - reading the market before it changes
- ✅ **Market psychology** - investor sentiment, capital convergence
- ✅ **Layered ON TOP** of GOD scores (additive bonus 0-10)
- ✅ **Stable** - only update on ≥50% change threshold
- ✅ **Separate** - stored independently for auditability

### Signals are NOT:
- ❌ **GOD algorithm components** - they don't modify GOD weights
- ❌ **Reactive** - they don't chase noise
- ❌ **Mixed into GOD** - they're computed and stored separately
- ❌ **Unlimited** - hard cap at 10 points max

---

## 50% CHANGE THRESHOLD

**Why?**
> "Signals are from the market so we need to be careful not to be over reactive to them. They are more for predictive intelligence, to understand if startups are moving towards or away from capital signals."

**How it works:**
1. Signal dimensions are calculated for a startup
2. If ALL dimensions changed by <50% from stored values → use stored signals
3. If ANY dimension changed by ≥50% → recalculate and store new signals
4. This prevents noise from affecting GOD scores

**Expected signal boost distribution:**
| Boost | Description | Frequency |
|-------|-------------|-----------|
| 0-1 pts | Minimal market signals | ~30% |
| 1-3 pts | Normal market activity | ~50% |
| 3-5 pts | Strong market signals | ~15% |
| 5-7 pts | Hot market signals | ~4% |
| 7-10 pts | Exceptional (elite) | ~1% |

---

## FILES IN THIS SYSTEM

### LOCKED (Admin + ML Agent only)
| File | Purpose | Modifications |
|------|---------|---------------|
| `server/services/startupScoringService.ts` | GOD algorithm | ⛔ LOCKED |
| `server/config/god-score-weights.json` | Weight storage | ⛔ LOCKED |
| `GOD_SCORE_CONFIG` object | Core parameters | ⛔ LOCKED |

### SIGNAL LAYER (Separate system)
| File | Purpose |
|------|---------|
| `server/services/signalApplicationService.ts` | Signal calculation & application |
| `server/services/signalClassification.ts` | Signal taxonomy |
| `server/migrations/20260130_signal_state_table.sql` | Signal state storage |

### REMOVED (Unauthorized)
| File | Status | Reason |
|------|--------|--------|
| `server/services/velocityScoring.ts` | ⚠️ EXISTS but not used | Was incorrectly injected into GOD |
| `server/services/capitalEfficiencyScoring.ts` | ⚠️ EXISTS but not used | Was incorrectly injected into GOD |
| `server/services/marketTimingScoring.ts` | ⚠️ EXISTS but not used | Was incorrectly injected into GOD |

These files can be **repurposed** as signal dimension calculators if needed, but they must NOT be imported into `startupScoringService.ts`.

---

## ENFORCEMENT MECHANISMS

### 1. Code Comments
```typescript
// ⛔ LOCKED: Only admin or ML agent can modify
normalizationDivisor: 17,
```

### 2. Database Constraints
```sql
CHECK (signals_bonus >= 0 AND signals_bonus <= 10)
```

### 3. Runtime Invariants
```typescript
if (signals_bonus < 0 || signals_bonus > 10) {
  throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signals_bonus}`);
}
```

### 4. Audit Trail
- All weight changes logged to `god_weight_versions` table
- Signal changes logged to `startup_signals_state` table
- System Guardian monitors score distribution

---

## HOW TO MAKE AUTHORIZED CHANGES

### Admin Manual Adjustment
```bash
# 1. Review current weights
cat server/config/god-score-weights.json

# 2. Make change in file (with version bump)
# 3. Run recalculation
npx tsx scripts/recalculate-scores.ts

# 4. Verify distribution
node system-guardian.js
```

### ML Agent Training Pipeline
The ML agent can ONLY modify `componentWeights` through:
1. `server/services/mlTrainingServiceV2.ts`
2. Requires database constraint validation
3. Cannot modify signals or signal weights
4. All changes logged to `ml_recommendations` table

---

## INCIDENT LOG

| Date | Issue | Resolution |
|------|-------|------------|
| Dec 27, 2025 | AI copilot added velocity/efficiency/timing as GOD components | Jan 30, 2026: Removed from GOD, proper architecture restored |
| Jan 30, 2026 | normalizationDivisor was 23 (crushed scores to 38 avg) | Restored to 17 (proper calibration) |

---

*Document created: January 30, 2026*
*Status: LOCKDOWN ACTIVE*
