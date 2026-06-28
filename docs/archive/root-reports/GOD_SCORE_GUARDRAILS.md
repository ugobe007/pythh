# GOD Score Guardrails - Implementation Summary

## What Was Implemented

Pure **defensive programming** to prevent unauthorized changes to the GOD scoring system. No scoring logic was modified - only safety mechanisms added.

---

## 1. ✅ Weights Versioning + Immutability

**Files Created:**
- `server/config/god-score-weights.json` - Original v1.0.0 weights
- `server/config/weights-versioning-schema.sql` - Database schema

**Key Features:**
- All weights stored as immutable JSON blobs with version numbers
- Every computed score stores the `weights_version` used
- Cannot edit versions, only supersede them
- Instant rollback via `rollback_to_weights_version(target_version)`

**Database Functions:**
```sql
get_active_god_weights()              -- Get current weights
supersede_weights_version(old, new)   -- Create new version
rollback_to_weights_version(version)  -- Instant rollback
```

**Tables:**
- `god_score_weights_versions` - Version history
- `startup_uploads.weights_version` - Tracks version per startup
- `startup_uploads.score_explanation` - Debug payload (JSONB)

---

## 2. ✅ Score Explanation Payload

**File:** `server/services/scoreExplanation.ts`

**What It Does:**
- Generates debug payload for every score
- Tracks component contributions, signal contributions
- Validates all invariants
- Human-readable formatting for logs

**Example Explanation:**
```typescript
{
  totalScore: 87.5,
  weightsVersion: "1.0.0",
  baseScore: 85.0,
  signalAdjustment: +2.5,
  components: [
    { name: "team", rawValue: 0.85, weight: 0.25, contribution: 21.25 },
    { name: "traction", rawValue: 0.90, weight: 0.25, contribution: 22.50 }
  ],
  topSignals: [
    { signalName: "Raised $5M", category: "funding", contribution: 1.5 },
    { signalName: "100% MoM growth", category: "traction", contribution: 1.0 }
  ],
  invariants: {
    componentWeightSum: 1.0,
    allFeaturesNormalized: true,
    scoreBounded: true,
    signalCapRespected: true
  }
}
```

---

## 3. ✅ Invariant Checks

**File:** `server/services/invariants.ts`

**What It Validates:**
1. **Component weights sum to 1.0** (±0.001 tolerance)
2. **All normalized features in [0, 1]** range
3. **Total score in [0, 100]** range
4. **Per-signal contribution ≤ maxContribution** (default 10)

**Functions:**
```typescript
validateWeightSum(weights)           // Weights sum to 1.0?
validateNormalizedFeatures(features) // All 0-1?
validateScoreBounds(score)           // 0-100?
validateSignalCap(signals)           // Each signal < max?
assertInvariants(...)                // Throw error if violated
checkInvariantWarnings(...)          // Log near-violations
```

**Fail-Fast Behavior:**
- If any invariant violated → throw error immediately
- Score calculation stops before persisting bad data

---

## 4. ✅ Golden Set Regression Tests

**Files:**
- `tests/god-score-golden-set.json` - 10 canonical examples
- `tests/god-score-regression.test.ts` - Test runner

**What It Tests:**
- 10 canonical startups (elite, early-stage, weak, etc.)
- Each has expected score range and top components
- CI fails if any example violates expectations

**Examples Included:**
1. Elite funded startup (85-95 expected)
2. Early-stage promising (65-75)
3. Pre-launch strong team (60-70)
4. Low quality no traction (40-50)
5. Hypergrowth late-stage (90-98)
6. Strong team pivoting (55-65)
7. Niche profitable (70-80)
8. Viral no revenue (60-70)
9. Deep tech long runway (65-75)
10. Bootstrapped steady (65-75)

**Usage:**
```bash
npx tsx tests/god-score-regression.test.ts  # Run tests
npm test                                     # (Add to package.json)
```

**CI Integration:**
Add to `.github/workflows/test.yml`:
```yaml
- name: Run GOD Score Regression Tests
  run: npx tsx tests/god-score-regression.test.ts
```

---

## 5. ✅ Emergency Kill Switch

**File:** `server/services/killSwitch.ts`

**Environment Variables:**
```bash
# Force specific weights version
GOD_SCORING_VERSION_OVERRIDE=1.0.0

# Stop all score recalculation
GOD_SCORING_FREEZE=true

# Calculate but don't persist (testing)
GOD_SCORING_DRY_RUN=true
```

**Functions:**
```typescript
getKillSwitchConfig()              // Read env vars
checkFrozen()                      // Throw if frozen
getActiveWeightsVersion(supabase)  // Get version (with override)
persistScore(...)                  // Respects dry-run mode
logKillSwitchStatus()              // Print status on startup
emergencyRollback(version)         // Helper for rollback
```

**Emergency Procedure:**
```bash
# 1. Add to server/.env
GOD_SCORING_FREEZE=true
GOD_SCORING_VERSION_OVERRIDE=1.0.0

# 2. Restart services
pm2 restart all

# 3. Damage stopped in seconds

# 4. When fixed, unfreeze
GOD_SCORING_FREEZE=false
pm2 restart all
```

---

## How to Use

### Adding a New Weights Version

```sql
-- In Supabase SQL editor
SELECT supersede_weights_version(
  '1.0.0',  -- Old version
  '1.1.0',  -- New version
  '{
    "normalizationDivisor": 23,
    "componentWeights": {
      "team": 0.30,
      "traction": 0.30,
      "market": 0.20,
      "product": 0.10,
      "vision": 0.10
    }
  }'::jsonb,
  'Increased team and traction weights per user request'
);
```

### Rolling Back

```sql
-- Instant rollback to previous version
SELECT rollback_to_weights_version('1.0.0');
```

### Checking Current Status

```typescript
import { logKillSwitchStatus } from './server/services/killSwitch';
logKillSwitchStatus();  // Prints current config
```

---

## Integration with Scoring Service

**Next Steps** (requires your approval):

1. Modify `startupScoringService.ts` to:
   - Load weights from database instead of hardcoded config
   - Generate explanation payload for each score
   - Validate invariants before persisting
   - Respect kill switch

2. Modify `recalculate-scores.ts` to:
   - Check `GOD_SCORING_FREEZE` before running
   - Store `weights_version` and `score_explanation` in database
   - Fail fast if invariants violated

3. Add CI workflow for regression tests

---

## What This DOESN'T Do

❌ Change any scoring logic
❌ Modify component weights
❌ Add signal-based adjustments
❌ Touch the existing GOD score algorithm

✅ Only adds guardrails to prevent future unauthorized changes

---

## Files Created

```
server/
  config/
    god-score-weights.json                    # v1.0.0 weights
    weights-versioning-schema.sql             # Database schema
  services/
    scoreExplanation.ts                       # Debug payload generator
    invariants.ts                             # Validation utilities
    killSwitch.ts                             # Emergency controls

tests/
  god-score-golden-set.json                   # 10 canonical examples
  god-score-regression.test.ts                # Test runner
```

---

## Next: Apply to Database

```bash
# Run migration
psql $DATABASE_URL -f server/config/weights-versioning-schema.sql

# Or in Supabase SQL editor, paste contents of:
# server/config/weights-versioning-schema.sql
```

---

**All guardrails implemented. Awaiting your approval to integrate with scoring service.**
