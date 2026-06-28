# GOD Score Bonus System Review

## Current Bonus Structure

### 1. **Signals Bonus** (Market Intelligence Layer)
- **Max**: +10 points
- **Source**: `startup_signal_scores.signals_bonus`
- **Capped at**: 10 points
- **Average**: ~2.03 points (from sample)

### 2. **Momentum Bonus** (Forward Movement Recognition)
- **Max**: +5 points (reduced from +8 on Feb 20, 2026)
- **Source**: `momentumScoringService.js`
- **Applied to**: Phase 1-2 (Data Rich) startups only
- **Components**:
  - Revenue Trajectory: +2.0 max
  - Customer Trajectory: +2.0 max
  - Product Maturity: +1.5 max
  - Team Strength: +1.0 max
  - Data Completeness: +1.0 max
  - Score Trajectory: +0.5 max

### 3. **AP/Promising Bonus** (Premium Startup Detection)
- **AP Bonus Max**: +6 points (for GOD 45-59)
- **Promising Bonus Max**: +4 points (for GOD 40-44)
- **Source**: `apScoringService.ts`
- **Applied to**: Phase 1-2 (Data Rich) startups only

### 4. **Elite Boost** (Multiplicative Quality Reward)
- **Max**: Multiplicative (1.00x to 1.18x depending on tier)
- **Source**: `eliteScoringService.ts`
- **Applied to**: Phase 1-2 (Data Rich) startups only
- **Tiers**:
  - Junior (60-69): 1.05x
  - Senior (70-79): 1.10x
  - Dean's (80-89): 1.15x
  - PhD (90-100): 1.18x
- **Note**: This is MULTIPLICATIVE, not additive, so it can significantly inflate scores

### 5. **Spiky/Hot Bonus** (Organic Quality Spikes)
- **Spiky Bonus Max**: +4 points (for Bachelors 45-59)
- **Hot Bonus Max**: +3 points (any tier)
- **Combined Max**: +7 points
- **Source**: `spikyBachelorService.ts`
- **Applied to**: Phase 1-2 (Data Rich) startups only

### 6. **Psychological Bonus** (Behavioral Intelligence)
- **Range**: -5 to +7 points
- **Source**: `startupScoringService.ts` → `calculatePsychologicalBonus()`
- **Average**: ~0.01 points (very low impact currently)
- **Formula**: `psychBonus * 10` clamped to [-5, +7]

### 7. **Investor Pedigree Bonus** (Smart Money Validation)
- **Max**: +8 points
- **Source**: `investorPedigreeScoringService.ts`
- **Applied to**: ALL startups (not gated on data richness)
- **Tiers**:
  - Tier 1 (2+): +8 points
  - Tier 1 (1): +6 points
  - Tier 2 (2+): +5 points
  - Tier 2 (1): +4 points
  - Tier 3 (2+): +3 points
  - Tier 3 (1): +2 points
  - Advisors (3+): +2 points
  - Advisors (1+): +1 point

## Total Bonus Cap

**Current Cap**: +15 points (raised from +10 on Feb 28, 2026)

**Comment in code**: 
> "avg uncapped bonus was 13.4 pts, max 25.2 pts, which was inflating 60–70 range artificially."

**Formula**:
```typescript
rawBonuses = signalsBonus + momentumBonus + apPromisingBonus + eliteSpikyBonus + psychBonusGOD + pedigreeBonus;
cappedBonuses = Math.min(rawBonuses, 15);
finalScore = Math.min(baseGODScore + cappedBonuses, 100);
```

## Issues Identified

1. **Elite Boost is MULTIPLICATIVE** - This can significantly inflate scores:
   - A startup with base 70 + 10 bonuses = 80
   - Elite boost (1.10x) = 80 * 1.10 = 88
   - This is applied AFTER other bonuses, so it multiplies the inflated score

2. **Bonus Cap is Too High** - +15 points is a significant boost:
   - If average base is ~60, +15 = 75 (above target)
   - The cap was raised from +10 to +15, which may be contributing to inflation

3. **Investor Pedigree Applied to ALL** - This bonus is applied to all startups, not just data-rich ones, which may be inflating scores across the board

4. **Multiple Bonuses Stack** - A data-rich startup can get:
   - Signals: +10
   - Momentum: +5
   - AP: +6
   - Elite: 1.10x multiplier
   - Spiky/Hot: +7
   - Pedigree: +8
   - Total before cap: +36 points (capped at +15)
   - Then multiplied by 1.10x = significant inflation

## Recommendations

1. **Reduce Total Bonus Cap** from +15 to +10 (revert Feb 28 change)
2. **Make Elite Boost Additive** instead of multiplicative, or reduce multiplier
3. **Reduce Individual Bonus Maximums**:
   - Signals: Keep at +10 (core system)
   - Momentum: Reduce from +5 to +3
   - AP/Promising: Reduce from +6/+4 to +4/+2
   - Spiky/Hot: Reduce from +7 to +4
   - Pedigree: Reduce from +8 to +5
4. **Gate More Bonuses** - Only apply momentum, AP, elite, spiky to truly data-rich startups
