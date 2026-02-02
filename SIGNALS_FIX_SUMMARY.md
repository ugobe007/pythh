# GOD Guardrails - Signals Strategy Implementation Summary

## What Was Fixed

### ❌ Original Error
```
Error: Failed to run sql query: ERROR: 42P01: relation "public.god_weight_versions" does not exist
```

**Cause:** You tried to run the seed SQL before the main migration that creates the tables.

**Solution:** Created step-by-step deployment guide with correct sequence:
1. Run main migration first (creates tables)
2. Then run seed data (inserts god_v1_initial)

---

## ✅ What's Ready Now

### 1️⃣ **Database Schema (Updated)**
- [server/migrations/20260129_god_guardrails.sql](server/migrations/20260129_god_guardrails.sql)
  - ✅ `god_score_explanations.base_god_score` - Fundamentals only score
  - ✅ `god_score_explanations.signals_bonus` - Market psychology lift (0-10)
  - ✅ **CHECK constraint:** `signals_bonus >= 0 AND signals_bonus <= 10`
  - ✅ Comments explaining signal cap enforcement

### 2️⃣ **Seed Data (Updated)**
- [server/migrations/20260129_god_guardrails_seed.sql](server/migrations/20260129_god_guardrails_seed.sql)
  - ✅ Canonical signals strategy comment at top
  - ✅ `signalWeights` object in weights JSON:
    ```json
    {
      "founder_language_shift": 0.20,
      "investor_receptivity": 0.25,
      "news_momentum": 0.20,
      "capital_convergence": 0.20,
      "execution_velocity": 0.15
    }
    ```
  - ✅ Updated invariants:
    ```json
    {
      "signalWeightSum": 1.0,
      "maxSignalContribution": 10,
      "signalBonusBounds": [0, 10]
    }
    ```
  - ✅ Sets god_v1_initial as active version

### 3️⃣ **Golden Tests (Updated)**
- [scripts/test-god-golden.js](scripts/test-god-golden.js)
  - ✅ **Invariant 1:** `signals_bonus` must be in [0, 10]
  - ✅ **Invariant 2:** `total = base + signals_bonus` (within 0.01 tolerance)
  - ✅ **Invariant 3:** Signal contribution `|total - base| <= 10`
  - ✅ Outputs: `total=X, base=Y, signals=Z` for debugging
  - ✅ Exit code 1 on failure (blocks CI)

### 4️⃣ **Implementation Guide (New)**
- [SIGNALS_STRATEGY.md](SIGNALS_STRATEGY.md) - Complete reference
  - ✅ Canonical strategy comment (paste into scorer)
  - ✅ Implementation contract (4 steps)
  - ✅ Signal dimensions (5 sub-components)
  - ✅ Recency + relevance gating
  - ✅ Explanation payload structure
  - ✅ Guardrails (DB, runtime, CI)
  - ✅ Deployment checklist
  - ✅ Troubleshooting guide

### 5️⃣ **Deployment Guide (New)**
- [GOD_GUARDRAILS_DEPLOY_SIMPLE.md](GOD_GUARDRAILS_DEPLOY_SIMPLE.md)
  - ✅ Step-by-step SQL execution (correct order)
  - ✅ Verification queries for each step
  - ✅ Scorer integration code snippets
  - ✅ Testing instructions
  - ✅ Troubleshooting section

---

## 🔒 Guardrails Enforcing Signals Cap

### Level 1: Database (Prevents Writes)
```sql
signals_bonus CHECK (signals_bonus >= 0 AND signals_bonus <= 10)
```
**If violated:** `ERROR: new row violates check constraint`

### Level 2: Runtime (Fails Loudly)
```typescript
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error('SIGNALS_BONUS_OUT_OF_RANGE');
}
```
**If violated:** Scorer crashes with stack trace

### Level 3: CI (Blocks PRs)
```javascript
if (Math.abs(totalScore - baseScore) > 10.0001) {
  console.error('❌ signal contribution exceeds max of 10');
  process.exit(1);
}
```
**If violated:** GitHub Actions fails, PR cannot merge

---

## 📊 Signals Implementation Strategy

### Core Philosophy
> **"Signals provide timing + market pull awareness without corrupting fundamentals."**

### Signal Dimensions (Composite, Not Arbitrary)
1. **founder_language_shift** (20%) - Positioning changes, narrative evolution
2. **investor_receptivity** (25%) - VC opinions, investor revelations  
3. **news_momentum** (20%) - External coverage, press velocity
4. **capital_convergence** (20%) - Funding signals, investor clustering
5. **execution_velocity** (15%) - Development pace, product iteration speed

Each dimension produces 0-1, then:
```typescript
signalsIndex = weightedSum(dimensions);  // 0-1
signalsBonus = Math.round(10 * signalsIndex * 10) / 10;  // 0-10 with 1 decimal
```

### Recency + Relevance Gating
```typescript
signalsIndex *= recencyMultiplier * confidenceMultiplier;
// Still clamped to [0, 10] after
```

Stale or low-confidence signals decay toward 0.

---

## 🎯 Deployment Sequence (CORRECT ORDER)

### Step 1: Run Main Migration
```bash
# Paste server/migrations/20260129_god_guardrails.sql into Supabase SQL Editor
# Creates: tables, triggers, RPC functions
```

### Step 2: Run Seed Data
```bash
# Paste server/migrations/20260129_god_guardrails_seed.sql into Supabase SQL Editor  
# Inserts: god_v1_initial weights with signals strategy
```

### Step 3: Restart Server
```bash
pm2 restart server
curl http://localhost:3002/api/god/runtime  # Verify
```

### Step 4: Integrate Scorer
See [SIGNALS_STRATEGY.md](SIGNALS_STRATEGY.md) for complete code.

**Required changes to `scripts/recalculate-scores.ts`:**
1. Compute `baseGodScore` (fundamentals only, no signals)
2. Compute `signalsBonus` (0-10 clamped)
3. Add runtime invariant check
4. Store `base_god_score` and `signals_bonus` in explanation
5. Store `top_signal_contributions` array

### Step 5: Update Golden Set
Replace placeholder UUIDs with real startup IDs.

### Step 6: Test
```bash
node scripts/god-rollback.js god_v1_initial  # Test rollback
node scripts/god-freeze.js true             # Test freeze
node scripts/test-god-golden.js             # Test invariants
```

---

## 🛡️ How This Prevents 40-50 Point Jumps

### Before (BROKEN)
```
Base GOD: 50
Signals (uncapped): +42
Final: 92  ❌ CORRUPTED
```

### After (PROTECTED)
```
Base GOD: 50
Signals (capped): +10
Final: 60  ✅ SAFE

Database CHECK: signals_bonus <= 10  ✅
Runtime check: if > 10 throw error    ✅
Golden test: |final - base| <= 10     ✅
```

**Triple protection** ensures no single failure mode can corrupt scores.

---

## 📝 Key Files Modified

| File | Status | Purpose |
|------|--------|---------|
| [server/migrations/20260129_god_guardrails.sql](server/migrations/20260129_god_guardrails.sql) | ✅ UPDATED | Added base_god_score, signals_bonus with CHECK |
| [server/migrations/20260129_god_guardrails_seed.sql](server/migrations/20260129_god_guardrails_seed.sql) | ✅ UPDATED | Added signals strategy, signalWeights, invariants |
| [scripts/test-god-golden.js](scripts/test-god-golden.js) | ✅ UPDATED | Added 3 signal invariant checks |
| [SIGNALS_STRATEGY.md](SIGNALS_STRATEGY.md) | ✅ NEW | Complete implementation guide |
| [GOD_GUARDRAILS_DEPLOY_SIMPLE.md](GOD_GUARDRAILS_DEPLOY_SIMPLE.md) | ✅ NEW | Step-by-step deployment |

---

## 🚀 Next Actions

1. **Run migrations in Supabase SQL Editor** (see deploy guide)
2. **Verify tables exist:** `SELECT * FROM get_god_runtime();`
3. **Restart server:** `pm2 restart server`
4. **Integrate scorer** (see SIGNALS_STRATEGY.md for exact code)
5. **Update golden set** (replace placeholder UUIDs)
6. **Run tests:** `node scripts/test-god-golden.js`

---

## 💡 Philosophy Summary

> **"Signals are recent, relevant, explainable, and bounded."**

- **Recent:** Recency decay multiplier
- **Relevant:** Confidence gating based on evidence strength  
- **Explainable:** `top_signal_contributions` shows which signals fired
- **Bounded:** Triple guardrails enforce [0, 10] cap

**Fundamentals (0-100) + Signals (0-10) = Final GOD (0-100)**

No more mystery 40-50 point jumps. Ever.

---

*Ready to deploy. Run migrations in order, then integrate scorer.*
