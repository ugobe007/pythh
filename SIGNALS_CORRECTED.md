# SIGNALS → GOD: CORRECTED IMPLEMENTATION

## What Changed

Your feedback identified that my signal composition was **incorrect**. Fixed:

### ❌ Before (WRONG)
```json
{
  "signalWeights": {
    "founder_language_shift": 0.20,  // 20% weight
    "investor_receptivity": 0.25,    // 25% weight
    "news_momentum": 0.20,            // 20% weight
    "capital_convergence": 0.20,      // 20% weight
    "execution_velocity": 0.15        // 15% weight
  }
}
```

**Wrong computation:**
```
signalsIndex = weighted_sum_of_dimensions  // 0-1
signalsBonus = 10 * signalsIndex
```

### ✅ After (CORRECT)
```json
{
  "signalMaxPoints": {
    "founder_language_shift": 2.0,  // max 2.0 points
    "investor_receptivity": 2.5,    // max 2.5 points
    "news_momentum": 1.5,            // max 1.5 points
    "capital_convergence": 2.0,      // max 2.0 points
    "execution_velocity": 2.0        // max 2.0 points
  }
}
```

**Correct computation:**
```typescript
signals_bonus =
  2.0 * founder_language_shift_0to1 +
  2.5 * investor_receptivity_0to1 +
  1.5 * news_momentum_0to1 +
  2.0 * capital_convergence_0to1 +
  2.0 * execution_velocity_0to1;

signals_bonus = clamp(round1(signals_bonus), 0, 10);

// Runtime invariant
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signalsBonus}`);
}
```

---

## Database Constraints (4 CHECK Constraints)

```sql
-- 1. signals_bonus must be in [0, 10]
constraint chk_signals_bonus_range 
  check (signals_bonus >= 0 and signals_bonus <= 10),

-- 2. total_score must be in [0, 100]
constraint chk_total_score_range 
  check (total_score is null or (total_score >= 0 and total_score <= 100)),

-- 3. base_total_score must be in [0, 100]
constraint chk_base_total_range 
  check (base_total_score is null or (base_total_score >= 0 and base_total_score <= 100)),

-- 4. CRITICAL: signals can never add more than 10 points
constraint chk_signal_delta check (
  base_total_score is null
  or signals_bonus is null
  or (total_score - base_total_score) <= 10.0001
)
```

**Effect:** Database rejects any write violating these constraints.

---

## CI Regression Tests (Tripwire)

```javascript
// In scripts/test-god-golden.js

// Check 1: signals_bonus <= 10
const signals = Number(explain.signals_bonus ?? NaN);
if (Number.isFinite(signals) && signals > 10.0001) {
  failed++;
  console.error(`[FAIL] ${c.name}: signals_bonus ${signals} > 10`);
}

// Check 2: signal delta (total - base) <= 10
const base = Number(explain.base_total_score ?? NaN);
if (Number.isFinite(base)) {
  const delta = total - base;
  if (delta > 10.0001) {
    failed++;
    console.error(`[FAIL] ${c.name}: signal delta ${delta} > 10`);
  }
}
```

**Effect:** CI blocks PRs if signals contribute > 10 points.

---

## Canonical Comment (Non-Negotiable)

```typescript
/**
 * SIGNALS → GOD (CANONICAL, NON-NEGOTIABLE)
 * ========================================
 *
 * Signals capture MARKET PSYCHOLOGY (not fundamentals):
 *  - Founder language + narrative shifts
 *  - Investor receptivity / revelations / sentiment
 *  - News momentum + attention velocity
 *  - Capital convergence (clustered interest)
 *  - Execution velocity (shipping cadence)
 *
 * Signals MUST influence GOD, but cannot hijack it.
 *
 * HARD CAP:
 * ---------
 * Signals contribute an additive bonus in [0..10] TOTAL points.
 * 10 = elite signal strength; 0 = no signal lift.
 *
 * Final GOD:
 *   base_god_total (0..100, fundamentals only)
 *   signals_bonus  (0..10, psychology only)
 *   total_god      = clamp(base_god_total + signals_bonus, 0, 100)
 *
 * Signals are NOT a fundamental component category.
 * They are stored separately and fully auditable in explanation payload.
 *
 * Guardrails:
 * -----------
 * - signals_bonus must be explicitly present in explanations
 * - signals_bonus must never exceed 10 (DB constraint + runtime invariant + CI)
 * - No copilot/model change may increase scores by 40–50 points via signals again.
 */
```

---

## Explanation Payload (Auditable Psychology)

```typescript
{
  startup_id: uuid,
  weights_version: "god_v1_initial",
  total_score: 78.5,
  base_total_score: 72.0,      // Fundamentals only (NOT base_god_score)
  signals_bonus: 6.5,           // Market psychology
  component_scores: {
    team: 18.0,
    traction: 16.5,
    market: 15.2,
    product: 11.8,
    vision: 10.5
  },
  top_signal_contributions: [
    {
      dimension: "investor_receptivity",
      key: "investor_receptivity",
      confidence: 0.85,
      recency_days: 14,
      contrib_points: 2.1        // NOT contrib/raw/norm
    },
    {
      dimension: "news_momentum",
      key: "news_momentum",
      confidence: 0.75,
      recency_days: 7,
      contrib_points: 1.5
    }
    // ... top 5-10
  ],
  debug: {
    signals_dimensions: {
      founderLanguage: { value: 0.65, confidence: 0.80, recency_days: 30 },
      investorReceptivity: { value: 0.85, confidence: 0.85, recency_days: 14 },
      newsMomentum: { value: 0.75, confidence: 0.75, recency_days: 7 },
      capitalConvergence: { value: 0.45, confidence: 0.60, recency_days: 45 },
      executionVelocity: { value: 0.55, confidence: 0.70, recency_days: 21 }
    },
    recencyMultiplier: 1.0,
    confidenceMultiplier: 1.0
  }
}
```

---

## Files Updated

| File | Change |
|------|--------|
| [server/migrations/20260129_god_guardrails.sql](server/migrations/20260129_god_guardrails.sql) | ✅ Added 4 CHECK constraints, renamed `base_god_score` → `base_total_score` |
| [server/migrations/20260129_god_guardrails_seed.sql](server/migrations/20260129_god_guardrails_seed.sql) | ✅ Changed `signalWeights` → `signalMaxPoints`, updated canonical comment |
| [scripts/test-god-golden.js](scripts/test-god-golden.js) | ✅ Updated to use your exact CI checks |
| [SCORER_INTEGRATION_CODE.ts](SCORER_INTEGRATION_CODE.ts) | ✅ Fixed computation, explanation payload structure |

---

## Migration Is Ready

**Run in Supabase SQL Editor:**
1. [server/migrations/20260129_god_guardrails.sql](server/migrations/20260129_god_guardrails.sql)
2. [server/migrations/20260129_god_guardrails_seed.sql](server/migrations/20260129_god_guardrails_seed.sql)

**Database will now enforce:**
- `signals_bonus` in [0, 10] ✅
- `total_score` in [0, 100] ✅
- `base_total_score` in [0, 100] ✅
- Signal delta `(total - base) <= 10` ✅

**No copilot can violate these constraints without database rejecting the write.**

---

*Corrected: January 29, 2026*  
*Status: Guardrails now enforce correct signal composition*
