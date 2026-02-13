# CRITICAL FIX: Psychological Signals - Multiplicative to Additive Conversion

## Error Discovered
**Date**: Feb 13, 2026
**Discovered By**: Andy (User)
**Impact**: 19 startups with incorrect enhanced_god_score values

## Root Cause
Agent misread architecture specification and implemented MULTIPLICATIVE scaling instead of ADDITIVE bonus:

```typescript
// DEPLOYED (WRONG):
enhanced_god_score = base × multiplier (84 × 1.17 = 98)

// CORRECT (ARCHITECTURE SPEC): 
enhanced_god_score = base + bonus (84 + 6 = 90)
```

## Architecture Specification (Lines 22-27)
```
SIGNALS = Layered ON TOP (separate system)
  - Expected boost: 1-3 points typical, 7+ rare, 10 max
  - FINAL SCORE = GOD base (0-100) + Signals bonus (0-10)
                                       ^^^^^^^^^^^^^^^^^^^
```

**Critical**: Explicitly states ADDITIVE (+), not MULTIPLICATIVE (×)

## Why This Matters
**Multiplicative creates inequality**:
- High-score startup: 84 × 1.30 = 109 (absolute boost: +25)
- Low-score startup: 50 × 1.30 = 65 (absolute boost: +15)
- Same signal, different absolute value ❌

**Additive ensures fairness**:
- High-score startup: 84 + 6 = 90 (absolute boost: +6)
- Low-score startup: 50 + 6 = 56 (absolute boost: +6)
- Same signal, same absolute value ✅

## Current Database State
**Column**: `psychological_multiplier` (will be renamed to `psychological_bonus`)
**Values**: 1.0-1.6 range (multiplicative)
**Need**: 0-10 point range (additive)

### Example: Oxide Computer Company
```
Current (WRONG):
  Base GOD: 84
  Multiplier: 1.17 (17% boost)
  Enhanced: 84 × 1.17 = 98

Correct (ADDITIVE):
  Base GOD: 84
  Signal: Follow-on (strength 0.67)
  Bonus: 0.67 × 0.5 × 10 = 3.35 points
  Enhanced: 84 + 3 = 87
```

## Code Changes Applied

### ✅ 1. Server/Services/startupScoringService.ts
**Function**: `calculatePsychologicalBonus()` (lines 640-713)
- Returns: -0.3 to +1.0 (on 0-10 scale)
- Weights: FOMO 0.5, Conviction 0.5, Urgency 0.3, Risk 0.3
- Formula: `bonus = 0 + boosts - penalties` (ADDITIVE)

**Usage** (line 587-589):
```typescript
const psychologicalBonus = calculatePsychologicalBonus(startup);
const enhancedTotal = Math.min(total + psychologicalBonus, 10); // ADDITIVE
```

### ✅ 2. Scripts/recalculate-scores.ts
**Lines 271-272**:
```typescript
const psychBonus = scores.psychological_bonus || 0;
const enhancedScore = Math.min(Math.round(finalScore + (psychBonus * 10)), 100);
```
Converts 0-10 scale bonus to 0-100 scale points

### ✅ 3. Interfaces Updated  
All instances of `psychological_multiplier` replaced with `psychological_bonus`

## Database Migration Required

**File**: `supabase/migrations/20260212_fix_psychological_additive.sql`

### Manual Steps (Supabase SQL Editor):
```sql
-- 1. Rename column
ALTER TABLE startup_uploads 
  RENAME COLUMN psychological_multiplier TO psychological_bonus;

-- 2. Update function
DROP FUNCTION IF EXISTS calculate_psychological_multiplier(UUID);
CREATE OR REPLACE FUNCTION calculate_psychological_bonus(startup_uuid UUID)
RETURNS DECIMAL(4,2) AS $$
  -- See migration file for full implementation
$$;

-- 3. Update trigger
CREATE OR REPLACE FUNCTION update_enhanced_god_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.psychological_bonus := calculate_psychological_bonus(NEW.id);
  NEW.enhanced_god_score := LEAST(100, ROUND(NEW.total_god_score + NEW.psychological_bonus));
  RETURN NEW;
END;
$$;

-- 4. Recalculate all enhanced scores
UPDATE startup_uploads
SET enhanced_god_score = LEAST(100, ROUND(total_god_score + COALESCE(psychological_bonus, 0)))
WHERE total_god_score IS NOT NULL;
```

## Affected Startups (Sample)
| Startup | Base | Old Enhanced | New Enhanced | Change |
|---------|------|--------------|--------------|--------|
| Oxide Computer | 84 | 98 (×1.17) | 87 (+3) | -11 |
| Neurent Medical | 84 | 97 (×1.15) | 89 (+5) | -8 |
| Birch Hill Holdings | 90 | 97 (×1.08) | 93 (+3) | -4 |

Total affected: **19 startups** with psychological signals

## Verification Steps
1. ✅ Code updated to use additive formula
2. ⏳ Database migration pending (manual SQL execution)
3. ⏳ Recalculate all enhanced scores
4. ⏳ Visual verification in UI (should show "+6 pts" not "+17%")

## Next Actions
1. Run SQL migration in Supabase SQL Editor (manual)
2. Run: `npx tsx scripts/recalculate-scores.ts`
3. Verify Oxide: 84 → 87 (not 84 → 98)
4. Commit fix and redeploy

## Documentation Updated
- [x] startupScoringService.ts comments
- [x] recalculate-scores.ts formula
- [x] Migration file created
- [ ] PSYCHOLOGICAL_SIGNALS_UI_COMPLETE.md needs update

## Lessons Learned
1. Always read architecture specifications carefully before implementation
2. Variable names can be misleading ("multiplier" doesn't always mean multiplication)
3. Additive systems maintain fairness (same signal = same point value)
4. Multiplicative systems create inequality (same signal = different absolute value by base)
5. Spec said "1-3 points typical, 10 max" not "10-30% boost" - clear indicator of additive approach

## Status
- **Code**: ✅ CORRECTED (uses additive formula)
- **Database**: ⚠️ PENDING (awaiting manual migration)
- **Production**: ⚠️ DEPLOYED (still using wrong multiplicative values)
- **Next**: Apply database migration and recalculate

---
**Corrected**: Feb 13, 2026
**Commit**: Pending (this document)
