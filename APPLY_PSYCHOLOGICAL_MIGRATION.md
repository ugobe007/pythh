# Applying Psychological Signals Migration - Quick Guide

## ✅ Problem Solved
The migration now uses the **correct additive formula** from the start. No renaming conflicts.

## 🚀 Quick Steps (2 minutes)

### Step 1: Clean Up (Copy & Paste in Supabase SQL Editor)
```sql
DROP VIEW IF EXISTS hot_startups_with_signals CASCADE;
DROP VIEW IF EXISTS sector_momentum_trend CASCADE;
DROP FUNCTION IF EXISTS calculate_psychological_multiplier(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_enhanced_god_score() CASCADE;
DROP TRIGGER IF EXISTS trigger_update_enhanced_god_score ON startup_uploads;
```
**Result:** `DROP VIEW (x5)` messages

---

### Step 2: Apply Migration (Copy & Paste from File)
Open: `supabase/migrations/20260212_psychological_signals.sql`

Copy the **entire file** → Paste in Supabase SQL Editor → Run

**Expected Output:**
```
Psychological signals schema created successfully!
Column named psychological_multiplier but stores ADDITIVE bonus
Formula: enhanced_god_score = total_god_score + (multiplier × 10) ← ADDITION
```

---

## ✅ Verify It Worked
```bash
node query-signals.js
```

**Should see:**
```
Oxide Computer Company:
  Base GOD: 84
  Enhanced: 87 (+3 points)   ← ADDITIVE (correct)
  💎 Follow-on (0.67)
```

**NOT:**
```
  Enhanced: 98 (+17%)   ← MULTIPLICATIVE (wrong)
```

---

## 📊 What Got Created

### Tables
- `psychological_signals` - Individual signal events
- `investor_behavior_patterns` - Investor personality types  
- `sector_momentum` - Hot sector tracking

### Columns on `startup_uploads`
- `psychological_multiplier` - Stores additive bonus (-0.3 to +1.0)
- `enhanced_god_score` - Base + bonus (capped at 100)
- `is_oversubscribed`, `has_followon`, `is_competitive`, `is_bridge_round`
- Signal strengths for each type

### Functions & Triggers
- `calculate_psychological_multiplier()` - Returns additive bonus
- `update_enhanced_god_score()` - Auto-updates when signals change
- Trigger on INSERT/UPDATE to maintain enhanced scores

---

## 🎯 The Formula (ADDITIVE - Correct)
```
enhanced_god_score = total_god_score + (psychological_multiplier × 10)
```

**Example:**
- Base: 84
- Bonus: 0.3 (on 0-10 scale) 
- Enhanced: 84 + 3 = **87** ✅

**Why additive?**
Same signal = same boost for everyone (fair)
- High score (84): +3 points
- Low score (50): +3 points  

**Not multiplicative** (unfair):
- High score (84): 84 × 1.1 = 92 (+8)
- Low score (50): 50 × 1.1 = 55 (+5)

---

## 🔧 If It Still Fails

Check if columns already exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'startup_uploads' 
AND column_name LIKE '%psychological%';
```

If they're already there, you're done! The utility script already populated the data.
