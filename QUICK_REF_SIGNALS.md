# 🛡️ GOD Guardrails + Signals Strategy - Quick Reference

## 🚨 The Problem You Reported

**Error:**
```
relation "public.god_weight_versions" does not exist
```

**Cause:** Tried to run seed SQL before main migration.

---

## ✅ The Fix (Simple 3-Step Deploy)

### 1️⃣ Run Main Migration
Open Supabase SQL Editor, paste **entire** contents of:
```
server/migrations/20260129_god_guardrails.sql
```
Click **RUN**.

### 2️⃣ Run Seed Data  
Same SQL Editor, paste **entire** contents of:
```
server/migrations/20260129_god_guardrails_seed.sql
```
Click **RUN**.

### 3️⃣ Restart Server
```bash
pm2 restart server
```

**Done!** Guardrails are now active.

---

## 🎯 Signals Strategy (Your Requirements)

### Core Rule
> **Signals can move GOD by +10 points MAXIMUM (0-10 range)**

### Signal Dimensions (Composite)
1. **founder_language_shift** (20%)
2. **investor_receptivity** (25%)  
3. **news_momentum** (20%)
4. **capital_convergence** (20%)
5. **execution_velocity** (15%)

### Properties
- ✅ **Recent** - Recency decay multiplier
- ✅ **Relevant** - Confidence gating
- ✅ **Explainable** - `top_signal_contributions` shows which signals fired
- ✅ **Bounded** - Triple guardrails enforce [0, 10] cap

---

## 🔒 Triple Guardrails (Prevents 40-50 Point Jumps)

### Level 1: Database CHECK Constraint
```sql
signals_bonus CHECK (signals_bonus >= 0 AND signals_bonus <= 10)
```
❌ Rejects any INSERT/UPDATE outside [0, 10]

### Level 2: Runtime Invariant (in Scorer)
```typescript
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error('SIGNALS_BONUS_OUT_OF_RANGE');
}
```
❌ Scorer crashes before writing invalid data

### Level 3: CI Golden Tests
```javascript
if (Math.abs(totalScore - baseScore) > 10.0001) {
  process.exit(1); // Block PR
}
```
❌ GitHub Actions fails if signals contribute > 10

---

## 📊 New Database Schema

### god_score_explanations (Updated)
```sql
total_score       numeric   -- Final GOD (0-100)
base_god_score    numeric   -- Fundamentals only (0-100)
signals_bonus     numeric   -- Market psychology (0-10) ⚠️ CAPPED
component_scores  jsonb     -- {team, traction, market, product, vision}
top_signal_contributions jsonb -- Top 5-10 signals with details
```

### god_weight_versions (Updated)
```json
{
  "componentWeights": { /* ... */ },
  "signalWeights": {
    "founder_language_shift": 0.20,
    "investor_receptivity": 0.25,
    "news_momentum": 0.20,
    "capital_convergence": 0.20,
    "execution_velocity": 0.15
  },
  "invariants": {
    "maxSignalContribution": 10,
    "signalBonusBounds": [0, 10]
  }
}
```

---

## 🧪 Testing

### Run Golden Tests
```bash
node scripts/test-god-golden.js
```

**Checks:**
1. ✅ `signals_bonus` in [0, 10]
2. ✅ `total = base + signals_bonus`
3. ✅ Signal contribution ≤ 10

### Test Rollback
```bash
node scripts/god-rollback.js god_v1_initial
```

### Test Freeze
```bash
node scripts/god-freeze.js true   # Freeze scorer
node scripts/god-freeze.js false  # Unfreeze
```

---

## 📝 Scorer Integration

See **[SCORER_INTEGRATION_CODE.ts](SCORER_INTEGRATION_CODE.ts)** for complete code.

**Key changes:**
1. Load weights from DB (not hardcoded)
2. Compute `baseGodScore` (fundamentals only)
3. Compute `signalsBonus` (clamped to [0, 10])
4. Runtime invariant check
5. Store explanation with signals breakdown

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| [GOD_GUARDRAILS_DEPLOY_SIMPLE.md](GOD_GUARDRAILS_DEPLOY_SIMPLE.md) | ⭐ **START HERE** - Step-by-step deployment |
| [SIGNALS_STRATEGY.md](SIGNALS_STRATEGY.md) | Complete signals implementation guide |
| [SIGNALS_FIX_SUMMARY.md](SIGNALS_FIX_SUMMARY.md) | What was fixed, what's ready |
| [SCORER_INTEGRATION_CODE.ts](SCORER_INTEGRATION_CODE.ts) | Copy-paste scorer code |

---

## ⚡ Quick Commands

```bash
# Deploy migrations (paste SQL in Supabase SQL Editor - see deploy guide)
# Then:
pm2 restart server

# Test deployment
curl http://localhost:3002/api/god/runtime

# Rollback to safe version
node scripts/god-rollback.js god_v1_initial

# Freeze scorer (emergency kill switch)
node scripts/god-freeze.js true

# Run regression tests
node scripts/test-god-golden.js

# Recalculate scores (after integrating scorer)
npx tsx scripts/recalculate-scores.ts
```

---

## 🎯 What This Prevents

### ❌ Before (Broken)
```
Base GOD: 50
Signals (uncapped): +42
Final: 92  ← CORRUPTED
```

### ✅ After (Protected)
```
Base GOD: 50
Signals (capped): +10
Final: 60  ← SAFE

✅ Database CHECK blocks > 10
✅ Runtime invariant throws error
✅ Golden tests fail CI
```

**No more mystery 40-50 point jumps. Ever.**

---

## 🚀 Next Steps

1. ✅ **Deploy migrations** (see GOD_GUARDRAILS_DEPLOY_SIMPLE.md)
2. ⚠️ **Integrate scorer** (see SCORER_INTEGRATION_CODE.ts)
3. ✅ **Test everything** (golden tests, rollback, freeze)

---

*Questions? See full docs above or ask in chat.*
