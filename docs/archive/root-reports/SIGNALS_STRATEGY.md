# SIGNALS → GOD STRATEGY (CANONICAL)

## Overview

**Signals represent MARKET PSYCHOLOGY — not fundamentals.**

They capture:
- Founder language + positioning shifts
- Investor revelations/opinions/receptivity  
- News + external momentum indicators

**Signals MUST inform GOD, but cannot dominate it.**

---

## HARD RULE

Signals contribute a bounded additive bonus in the range **[0..10] points TOTAL**.

- `0` = no signal lift
- `10` = elite signal strength

This prevents any rule set, model drift, or copilot edits from inflating scores by 40–50 points.

---

## Implementation Contract

### 1. Compute Base GOD Score (Fundamentals Only)

```typescript
const baseGodScore = computeBaseGOD({
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score
});
// Result: 0-100 based on fundamentals, no signals
```

### 2. Compute Signals Bonus (Any Internal Scale)

```typescript
const signalsRaw = computeSignalsIndex({
  founder_language_shift: 0.20,
  investor_receptivity: 0.25,
  news_momentum: 0.20,
  capital_convergence: 0.20,
  execution_velocity: 0.15
});
// Result: internal scale (could be 0-1, 0-100, anything)
```

### 3. Normalize → Clamp to [0..10]

```typescript
const signalsBonus = Math.max(0, Math.min(10, normalize(signalsRaw)));

// Runtime invariant (COPILOT-PROOF)
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error('SIGNALS_BONUS_OUT_OF_RANGE');
}
```

### 4. Final GOD

```typescript
const godTotal = Math.max(0, Math.min(100, baseGodScore + signalsBonus));
```

---

## Signals Dimensions (Logical, Not Arbitrary)

Each dimension produces a bounded score (0-1). Then:

```typescript
const signalsIndex = weightedSum({
  founder_language_shift: dim1 * 0.20,
  investor_receptivity: dim2 * 0.25,
  news_momentum: dim3 * 0.20,
  capital_convergence: dim4 * 0.20,
  execution_velocity: dim5 * 0.15
}); // Result: 0-1

const signalsBonus = Math.round(10 * signalsIndex * 10) / 10; // 0-10 with 1 decimal
```

### Recency + Relevance Gating

Signals must be **recent** and **relevant**:

```typescript
const recencyMultiplier = calculateRecencyDecay(signalAge);
const confidenceMultiplier = calculateConfidence(evidenceStrength);

signalsIndex *= recencyMultiplier * confidenceMultiplier;
// Still clamped to [0, 10] after
```

---

## Explanation Payload (Auditable)

Store in `god_score_explanations` table:

```typescript
{
  startup_id: uuid,
  weights_version: "god_v1_initial",
  total_score: 78.5,
  base_god_score: 72.0,     // Fundamentals only
  signals_bonus: 6.5,        // MUST be in [0, 10]
  component_scores: {
    team: 18.0,
    traction: 16.5,
    market: 15.2,
    product: 11.8,
    vision: 10.5
  },
  top_signal_contributions: [
    {
      key: "investor_receptivity",
      raw: 0.82,
      norm: 0.82,
      contrib: 2.05,
      confidence: 0.95,
      recency_days: 7
    },
    {
      key: "news_momentum",
      raw: 0.71,
      norm: 0.71,
      contrib: 1.42,
      confidence: 0.85,
      recency_days: 14
    }
    // ... top 5-10 signals
  ],
  debug: {
    signals_raw: 0.65,
    recency_multiplier: 1.0,
    confidence_multiplier: 1.0
  }
}
```

---

## Guardrails

### 1. Database CHECK Constraint

```sql
CREATE TABLE god_score_explanations (
  ...
  signals_bonus numeric NOT NULL DEFAULT 0 
    CHECK (signals_bonus >= 0 AND signals_bonus <= 10),
  ...
);
```

**Effect:** Database rejects any INSERT/UPDATE with signals_bonus outside [0, 10].

### 2. Runtime Invariant (in Scorer)

```typescript
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signalsBonus}`);
}
```

**Effect:** Scorer fails loudly if normalization produces invalid value.

### 3. Golden Test Assertions

```javascript
// In scripts/test-god-golden.js
if (signalsBonus < 0 || signalsBonus > 10.0001) {
  console.error(`❌ signals_bonus ${signalsBonus} violates [0, 10] cap`);
  process.exit(1);
}

// Regression check
if (Math.abs(totalScore - baseScore) > 10.0001) {
  console.error(`❌ signal contribution ${Math.abs(totalScore - baseScore)} exceeds max of 10`);
  process.exit(1);
}
```

**Effect:** CI blocks PRs if signals contribute > 10 points.

---

## Deployment Checklist

### ✅ Database Migration
- [x] `god_score_explanations.signals_bonus` column with CHECK constraint
- [x] `god_score_explanations.base_god_score` column
- [x] Weights JSON includes `signalWeights` and `maxSignalContribution` invariant

### ✅ Scorer Integration
Add to `scripts/recalculate-scores.ts`:

```typescript
/**
 * SIGNALS → GOD STRATEGY (CANONICAL)
 * Paste this comment at top of scorer
 */

// 1. Compute base GOD (fundamentals only)
const baseGodScore = computeBaseGOD(startup);

// 2. Compute signals bonus (0-10 cap enforced)
const signalsBonus = computeSignalsBonus(startup, weights.signalWeights);

// Runtime invariant
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signalsBonus}`);
}

// 3. Final GOD
const godTotal = Math.max(0, Math.min(100, baseGodScore + signalsBonus));

// 4. Store explanation
await supabase.from('god_score_explanations').upsert({
  startup_id: startup.id,
  weights_version: effectiveVersion,
  total_score: godTotal,
  base_god_score: baseGodScore,
  signals_bonus: signalsBonus,
  component_scores: { /* ... */ },
  top_signal_contributions: getTopSignals(startup),
  debug: { /* ... */ }
});
```

### ✅ Testing
- [x] Golden test enforces signals_bonus <= 10
- [x] Golden test enforces total = base + signals
- [x] CI blocks PRs violating invariants

---

## Philosophy

**Fundamentals still win; signals only tilt the ranking within a safe ceiling.**

Signals provide "timing + market pull" awareness without corrupting the core scoring model.

---

## Troubleshooting

### "signals_bonus violates check constraint"
**Cause:** Normalization producing values > 10  
**Fix:** Check signal dimension calculations, ensure final clamp to [0, 10]

### "SIGNALS_BONUS_OUT_OF_RANGE" runtime error
**Cause:** Scorer trying to write invalid signals_bonus  
**Fix:** Add clamp before database write:
```typescript
signalsBonus = Math.max(0, Math.min(10, signalsBonus));
```

### Golden tests failing with signal contribution > 10
**Cause:** Base score not being calculated correctly  
**Fix:** Ensure `base_god_score` is computed WITHOUT signals, then add signals_bonus separately

---

*Last updated: January 29, 2026*
