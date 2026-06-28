# 🚀 Phase 3 Quick Start Guide

## ✅ COMPLETED
1. Database migration created (`supabase/migrations/20260212_psychological_signals.sql`)
2. GOD scoring service updated with psychological multipliers
3. Recalculation script enhanced to compute enhanced_god_score
4. Backfill script created to extract signals from existing data
5. Test scripts ready for validation

## 🎯 NEXT STEPS (5 minutes to deploy)

### Step 1: Apply Database Migration
```bash
# Open: https://app.supabase.com
# Navigate to: SQL Editor → New Query
# Copy/paste entire file: supabase/migrations/20260212_psychological_signals.sql
# Click: Run (bottom right)
# Verify: "Success. No rows returned" message
```

**What this does:**
- Creates `psychological_signals` table
- Creates `investor_behavior_patterns` table
- Creates `sector_momentum` table  
- Adds 12 new columns to `startup_uploads`
- Creates auto-calculation functions & triggers

### Step 2: Backfill Psychological Signals
```bash
node scripts/backfill-psychological-signals.js
```

**Expected output:**
- Processes ~9,400 approved startups
- Finds ~20-50 with psychological signals (0.2-0.5%)
- Shows breakdown: oversubscribed, follow-on, competitive, bridge

**Takes:** ~3-5 minutes

### Step 3: Recalculate GOD Scores
```bash
npx tsx scripts/recalculate-scores.ts
```

**Expected output:**
- Recalculates all startup scores
- Applies psychological multipliers
- Shows: `StartupName: 72 → 72 (+1.18x psych) → enhanced: 85`

**Takes:** ~5-10 minutes

### Step 4: Validate Results
```bash
# Check enhanced scores in Supabase SQL Editor
SELECT 
  name,
  total_god_score,
  enhanced_god_score,
  psychological_multiplier,
  is_oversubscribed,
  has_followon
FROM startup_uploads
WHERE enhanced_god_score > total_god_score
ORDER BY enhanced_god_score DESC
LIMIT 10;
```

**Expected:** 20-50 startups with `enhanced_god_score > total_god_score`

## 📊 What You'll See

### Before:
```
Startup A: GOD Score 72
Startup B: GOD Score 75
Startup C: GOD Score 78
```

### After:
```
Startup A: GOD 72 → Enhanced 85 (3x oversubscribed) 🚀
Startup C: GOD 78 → Enhanced 91 (Sequoia follow-on) 💎
Startup B: GOD 75 → Enhanced 75 (no signals)
```

**Key Insight:** Startup A now ranks higher than C due to FOMO signal!

## 🛠️ Optional: Test on Real Data

```bash
# Run the live data test
node scripts/test-signals-on-real-data.js
```

This tests psychological signal extraction on recently discovered startups.

## 🔗 Full Documentation

- **Phase 3 Complete:** [PHASE3_GOD_SCORE_INTEGRATION_COMPLETE.md](PHASE3_GOD_SCORE_INTEGRATION_COMPLETE.md)
- **Phase 1 Signals:** [PSYCHOLOGICAL_SIGNALS_PHASE1_COMPLETE.md](PSYCHOLOGICAL_SIGNALS_PHASE1_COMPLETE.md)
- **Behavioral Audit:** [BEHAVIORAL_SIGNAL_AUDIT.md](BEHAVIORAL_SIGNAL_AUDIT.md)

## ⚠️ Troubleshooting

### "Column does not exist" error
→ Migration not applied. Go to Step 1.

### "Function calculate_psychological_multiplier does not exist"
→ Migration partially applied. Drop and re-run migration SQL.

### No signals detected in backfill
→ Expected! Only 0.2-0.5% of startups have psychological signals (rare/valuable).

### Enhanced score same as base score
→ Normal if no psychological signals detected for that startup.

## 🚀 After Deployment

1. **RSS Scraper Integration** - Update scraper to populate psychological signals on discovery
2. **Convergence UI** - Add badges for oversubscribed/follow-on/competitive rounds
3. **Phase 2 Signals** - Sector momentum, social proof cascades, founder context

---

**Time to Complete:** 10-15 minutes  
**Impact:** pythh now predicts WHEN investors act, not just IF they're interested  
**Status:** ✅ Ready to deploy
