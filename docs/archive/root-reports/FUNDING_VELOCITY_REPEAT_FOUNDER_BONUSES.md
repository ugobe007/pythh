# Funding Velocity & Repeat Founder Bonuses

## ✅ Implementation Complete

Added two new bonus factors to the matching algorithm to emphasize high-quality startups:

---

## 🚀 Funding Velocity Bonus

**Purpose**: Reward startups that raise funding rounds quickly (strong investor interest signal)

**Scoring**:
- **Very Fast** (velocity score ≥ 8): **+6 points**
  - Average < 180 days between rounds
- **Fast** (velocity score ≥ 6): **+4 points**
  - Average < 365 days between rounds
- **Moderate** (velocity score ≥ 4): **+2 points**
  - Average < 730 days between rounds
- **Fallback** (if no velocity score):
  - 3+ rounds: **+3 points** (proven ability to raise)
  - 2 rounds: **+1 point** (some velocity)

**Data Sources**:
- `startup.funding_velocity_score` (0-10 scale, pre-calculated)
- `startup.funding_rounds_count` (fallback if velocity score not available)

**Calculation**: Based on `funding_rounds` table data, calculating average days between rounds.

---

## 🏆 Repeat Founder with Exit Bonus

**Purpose**: Reward founders with previous successful exits (proven track record)

**Scoring**:
- **Serial Entrepreneur** (2+ exits): **+8 points**
- **Proven Exit** (1 exit): **+5 points**
- **Fallback** (boolean flag): **+5 points** (assumed 1 exit)

**Data Sources**:
- `startup.founder_previous_exits` (count of previous exits)
- `startup.has_repeat_founder_with_exit` (boolean flag, fallback)

**Calculation**: Based on `startup_exits` table, matching founder names to previous exits.

---

## 📊 Impact on Match Scores

### Example 1: High-Velocity Startup
- Base GOD score: 70
- Funding velocity (very fast): +6
- Repeat founder (1 exit): +5
- Stage match: +5
- Sector match: +6
- **Total: 92/100** (was 76 without bonuses)

### Example 2: Serial Entrepreneur
- Base GOD score: 65
- Repeat founder (2+ exits): +8
- Funding velocity (fast): +4
- Stage match: +5
- **Total: 82/100** (was 70 without bonuses)

---

## 🔄 Next Steps

1. **Populate Data**:
   - Calculate `funding_velocity_score` for all startups with 2+ funding rounds
   - Match founders to previous exits in `startup_exits` table
   - Store `founder_previous_exits` count on startup records

2. **Automation**:
   - Add velocity calculation to `calculate-market-intelligence.js`
   - Add founder-exit matching to exit detection script
   - Update startup records when new funding rounds or exits are detected

3. **Testing**:
   - Verify bonuses are applied correctly
   - Check match score distribution
   - Ensure high-velocity and repeat-founder startups rank higher

---

## 📝 Files Modified

- `src/services/matchingService.ts`
  - Added `calculateFundingVelocityBonus()` function
  - Added `calculateRepeatFounderBonus()` function
  - Integrated bonuses into `calculateAdvancedMatchScore()` (both paths)
  - Added verbose logging for new bonuses

---

## 🎯 Expected Results

- **High-velocity startups** will rank higher in match results
- **Repeat founders** will get significant boost (up to +8 points)
- **Combined effect**: Startups with both factors can get up to **+14 points** bonus
- More selective matching while rewarding proven quality signals





