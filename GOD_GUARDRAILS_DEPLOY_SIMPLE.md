# GOD Guardrails - Deployment Guide

## Quick Start

The seed SQL was failing because **the main migration hasn't been run yet**. Here's the correct sequence:

---

## ✅ Step 1: Run Main Migration

**File:** [server/migrations/20260129_god_guardrails.sql](server/migrations/20260129_god_guardrails.sql)

1. Open Supabase SQL Editor: `https://supabase.com/dashboard/project/YOUR_PROJECT/sql`
2. Copy **entire contents** of `server/migrations/20260129_god_guardrails.sql`
3. Paste into SQL Editor
4. Click **RUN**

**What this creates:**
- ✅ `god_weight_versions` table (immutable, auto-SHA256)
- ✅ `god_runtime_config` table (single-row, freeze flag)
- ✅ `god_score_explanations` table (with `signals_bonus` CHECK constraint)
- ✅ Triggers (immutability, auto-hash, updated_at)
- ✅ RPC functions (`get_god_runtime`, `get_god_explain`)

**Verify:**
```sql
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'god_%';
```

Expected output:
```
 table_name
----------------------------
 god_weight_versions
 god_runtime_config
 god_score_explanations
```

---

## ✅ Step 2: Run Seed Data

**File:** [server/migrations/20260129_god_guardrails_seed.sql](server/migrations/20260129_god_guardrails_seed.sql)

1. Open same Supabase SQL Editor
2. Copy **entire contents** of `server/migrations/20260129_god_guardrails_seed.sql`
3. Paste into SQL Editor
4. Click **RUN**

**What this creates:**
- ✅ `god_v1_initial` weights version
- ✅ Sets as active version in runtime config

**Verify:**
```sql
SELECT * FROM get_god_runtime();
```

Expected output:
```json
{
  "active_weights_version": "god_v1_initial",
  "override_weights_version": null,
  "effective_weights_version": "god_v1_initial",
  "freeze": false,
  "updated_at": "2026-01-29T..."
}
```

---

## ✅ Step 3: Restart Server

Routes are already mounted in `server/index.js`. Just restart:

```bash
pm2 restart server
```

**Verify API works:**
```bash
# Check runtime config
curl http://localhost:3002/api/god/runtime

# Check weights version exists
curl http://localhost:3002/api/god/runtime | jq '.effective_weights_version'
# Should output: "god_v1_initial"
```

---

## ✅ Step 4: Integrate Signals Strategy (REQUIRED)

See **[SIGNALS_STRATEGY.md](SIGNALS_STRATEGY.md)** for complete implementation guide.

### Key Changes to `scripts/recalculate-scores.ts`:

```typescript
// 1. Add canonical comment at top
/**
 * SIGNALS → GOD STRATEGY (CANONICAL)
 * Signals contribute [0..10] points max. See SIGNALS_STRATEGY.md
 */

// 2. Compute base GOD (fundamentals only, no signals)
const baseGodScore = computeBaseGOD(startup);

// 3. Compute signals bonus (clamped to [0, 10])
const signalsBonus = Math.max(0, Math.min(10, computeSignalsBonus(startup)));

// 4. Runtime invariant (copilot-proof)
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signalsBonus}`);
}

// 5. Final GOD
const godTotal = Math.max(0, Math.min(100, baseGodScore + signalsBonus));

// 6. Store explanation with signals breakdown
await supabase.from('god_score_explanations').upsert({
  startup_id: startup.id,
  weights_version: effectiveVersion,
  total_score: godTotal,
  base_god_score: baseGodScore,  // NEW: fundamentals only
  signals_bonus: signalsBonus,    // NEW: capped at 10
  component_scores: { team, traction, market, product, vision },
  top_signal_contributions: getTopSignals(startup), // NEW: top 5-10 signals
  debug: { /* ... */ }
});
```

---

## ✅ Step 5: Update Golden Set

Replace placeholder UUIDs in [golden/god_golden_set.json](golden/god_golden_set.json):

```bash
# Get real startup IDs
psql "$SUPABASE_DB_URL" -c "
  SELECT id, name, total_god_score 
  FROM startup_uploads 
  WHERE status='approved' 
  ORDER BY total_god_score DESC 
  LIMIT 10;
"
```

Replace:
- `00000000-0000-0000-0000-000000000001` → high-scoring startup UUID
- `00000000-0000-0000-0000-000000000002` → mid-scoring startup UUID  
- `00000000-0000-0000-0000-000000000003` → low-scoring startup UUID

---

## ✅ Step 6: Test Everything

### Test Rollback Script
```bash
node scripts/god-rollback.js god_v1_initial
# Should print current runtime config
```

### Test Freeze Script
```bash
node scripts/god-freeze.js true
# Should freeze scorer

node scripts/god-freeze.js false
# Should unfreeze
```

### Run Golden Tests
```bash
node scripts/test-god-golden.js
# Should pass all invariant checks:
# - signals_bonus in [0, 10]
# - total = base + signals_bonus
# - signal contribution <= 10
```

---

## Key Invariants Enforced

### 1️⃣ Database Level (CHECK Constraint)
```sql
signals_bonus CHECK (signals_bonus >= 0 AND signals_bonus <= 10)
```
**Effect:** Database rejects any value outside [0, 10]

### 2️⃣ Runtime Level (Scorer)
```typescript
if (signalsBonus < 0 || signalsBonus > 10) {
  throw new Error('SIGNALS_BONUS_OUT_OF_RANGE');
}
```
**Effect:** Scorer fails loudly before writing to DB

### 3️⃣ CI Level (Golden Tests)
```javascript
if (Math.abs(totalScore - baseScore) > 10.0001) {
  console.error('❌ signal contribution exceeds max of 10');
  process.exit(1);
}
```
**Effect:** CI blocks PRs violating signals cap

---

## Troubleshooting

### "relation public.god_weight_versions does not exist"
**Cause:** Main migration not run  
**Fix:** Run Step 1 above (main migration SQL)

### "signals_bonus violates check constraint"
**Cause:** Scorer trying to write signals_bonus > 10  
**Fix:** Check normalization logic, ensure clamp to [0, 10]

### "SIGNALS_BONUS_OUT_OF_RANGE" error
**Cause:** Runtime invariant triggered  
**Fix:** Add clamp before database write:
```typescript
signalsBonus = Math.max(0, Math.min(10, signalsBonus));
```

### Golden tests failing
**Cause:** base_god_score not calculated correctly  
**Fix:** Ensure base score computed WITHOUT signals, then add signals separately

---

## What Changed

### 🆕 New Columns
- `god_score_explanations.base_god_score` - GOD from fundamentals only (no signals)
- `god_score_explanations.signals_bonus` - Market psychology lift (0-10 cap)

### 🆕 New Invariants
- `maxSignalContribution: 10` in weights JSON
- `signalBonusBounds: [0, 10]` in invariants
- `signalWeights` object for composite signal dimensions

### 🆕 New Guardrails
- Database CHECK constraint on signals_bonus
- Runtime invariant in scorer (throws if out of range)
- Golden test assertions (CI blocks invalid scores)

---

## Next Actions

1. ✅ **Run migrations** (Steps 1-2 above)
2. ✅ **Restart server** (Step 3)
3. ⚠️ **Integrate scorer** (Step 4) - See [SIGNALS_STRATEGY.md](SIGNALS_STRATEGY.md)
4. ⚠️ **Update golden set** (Step 5) - Replace placeholder UUIDs
5. ✅ **Test deployment** (Step 6)

---

*Last updated: January 29, 2026*
