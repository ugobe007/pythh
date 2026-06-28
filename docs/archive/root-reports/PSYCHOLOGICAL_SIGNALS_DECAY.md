# Psychological Signals - Time Decay Implementation

## Current Status: ❌ NO DECAY (Awaiting Implementation)

The psychological signals system currently **does not decay over time**. A "3x oversubscribed" signal from 6 months ago has the same weight as one from yesterday.

## Why Decay Matters

**Investor Psychology is Time-Sensitive:**
- FOMO windows close fast (days/weeks, not months)
- Market timing changes constantly
- Old news doesn't drive decisions

**Example Problem Without Decay:**
```
Startup A: Oversubscribed 180 days ago (6 months)
Startup B: Oversubscribed 7 days ago (last week)

Current: Both get +3 bonus points ❌
Should be: A gets ~0 points, B gets +3 points ✅
```

## Proposed Decay Rates (Exponential)

Based on investor behavior patterns:

| Signal Type | Half-Life | Rationale |
|-------------|-----------|-----------|
| **🚀 FOMO** (oversubscribed) | 30 days | News cycles fast, FOMO window closes quickly |
| **💎 Conviction** (follow-on) | 90 days | Insider info stays relevant longer, board members have long view |
| **⚡ Urgency** (competitive) | 14 days | Competitive dynamics shift very quickly |
| **🌉 Risk** (bridge) | 45 days | Bridge concerns fade if startup shows recovery |

### Decay Formula
```
decayed_strength = raw_strength × 0.5^(age_days / half_life_days)
```

### Example Decay Curves

**FOMO Signal (strength = 1.0):**
- Day 0: 100% (full strength)
- Day 30: 50% (half strength)
- Day 60: 25%
- Day 90: 12.5%
- Day 180: 1.6% (nearly expired)

**Conviction Signal (strength = 1.0):**
- Day 0: 100%
- Day 30: 81%
- Day 90: 50%
- Day 180: 25%
- Day 270: 12.5%

## Implementation

### Option 1: Database-Side (Recommended)

**Migration File:** [supabase/migrations/20260212_add_signal_decay.sql](supabase/migrations/20260212_add_signal_decay.sql)

**Apply:**
```bash
# Copy contents of migration file
# Paste into Supabase SQL Editor
# Execute
```

**What it does:**
- Updates `calculate_psychological_multiplier()` function
- Adds age calculation using `detected_at` timestamp
- Applies exponential decay before combining signals
- Trigger auto-recalculates on updates

**After applying:**
```bash
# Recalculate all scores with decay
npx tsx scripts/recalculate-scores.ts
```

### Option 2: Application-Side (Complementary)

Update `calculatePsychologicalBonus()` in TypeScript to match database logic.

**Needs:**
- Access to `detected_at` timestamps from `psychological_signals` table
- Same decay formula as database function

## Expected Impact

### Before Decay
```
Oxide Computer Company (signal from 90 days ago):
  Base: 84
  Bonus: +3 points (no decay)
  Enhanced: 87
```

### After Decay (90 days old, FOMO signal)
```
Oxide Computer Company:
  Base: 84
  Raw bonus: +3 pts
  Decayed bonus: +0.4 pts (12.5% of original)
  Enhanced: 84 (effectively unchanged)
```

### Fresh Signal (7 days old)
```
Recent Startup (signal from last week):
  Base: 75
  Raw bonus: +3 pts
  Decayed bonus: +2.7 pts (88% of original)
  Enhanced: 78
```

## Benefits

1. **Recency Bias** - Rewards acting on fresh signals
2. **Fair Ranking** - Old hot deals don't crowd out new opportunities  
3. **Market Reality** - Reflects actual investor behavior (timing windows close)
4. **Dynamic Scores** - Scores naturally decay without manual intervention

## Maintenance

**Automatic decay via trigger:**
- Every time `total_god_score` updates
- Every time signal flags change
- No manual action needed

**Periodic recalculation (optional):**
```bash
# Weekly cron job to refresh all enhanced scores
npx tsx scripts/recalculate-scores.ts
```

## Testing Decay

```sql
-- Check signal ages
SELECT 
  s.name,
  ps.signal_type,
  ps.signal_strength,
  EXTRACT(DAY FROM NOW() - ps.detected_at) AS age_days,
  ps.signal_strength * POWER(0.5, EXTRACT(DAY FROM NOW() - ps.detected_at) / 30.0) AS decayed_strength_fomo,
  ps.signal_strength * POWER(0.5, EXTRACT(DAY FROM NOW() - ps.detected_at) / 90.0) AS decayed_strength_conviction
FROM startup_uploads s
JOIN psychological_signals ps ON ps.startup_id = s.id
WHERE ps.signal_type IN ('oversubscription', 'followon')
ORDER BY age_days DESC
LIMIT 10;
```

## Configuration

Half-life values are tunable in the migration file. Adjust based on:
- Platform data (how fast do hot deals cool off?)
- User feedback (are stale signals confusing?)
- Market conditions (bull markets = longer windows, bear = shorter)

## Next Steps

1. ✅ Migration file created
2. ⏳ Review decay rates (30/90/14/45 days - reasonable?)
3. ⏳ Apply migration to database
4. ⏳ Run full recalculation
5. ⏳ Monitor impact on rankings
6. ⏳ Update TypeScript code to match (optional, for symmetry)

---

**Status:** Ready to implement
**Impact:** High (affects 19 startups with existing signals)
**Risk:** Low (can revert by dropping function and re-running original migration)
