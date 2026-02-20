# GOD Score Configuration Guard Rails

## ⛔ CRITICAL: READ THIS BEFORE CHANGING GOD_SCORE_CONFIG ⛔

The GOD scoring system is the **crown jewels** of Hot Honey. It ranks 8,888+ startups using 23 algorithms based on real VC criteria (YC, Sequoia, a16z, First Round). Arbitrary changes **will break** investor matching for 866K+ matches.

---

## 🛡️ HARDENED GUARD RAILS (v8 - Feb 19, 2026)

### Validation Ranges (ENFORCED AT RUNTIME)

```typescript
normalizationDivisor: {
  min: 19.0,   // Below 19: scores too high (avg > 65), unrealistic
  max: 22.0,   // Above 22: scores too low (avg < 50), crushes quality
  target: 20.5 // Optimal: avg ~58-62
}

baseBoostMinimum: {
  min: 2.0,    // Below 2: floor too low (< 10 pts), terrible startups get through
  max: 3.5,    // Above 3.5: floor too high (> 17 pts), inflates bad startups
  target: 2.8  // Optimal: floor ~27 pts for borderline cases
}

averageScoreTarget: {
  min: 55,     // Below 55: too harsh
  max: 65,     // Above 65: too lenient
  target: 60   // Optimal: realistic VC selection distribution
}
```

**If you try to set values outside these ranges, the system will THROW AN ERROR at startup.**

---

## 📊 Expected Distribution (v8)

| Tier | Score Range | Expected % | Description |
|------|-------------|------------|-------------|
| 🌟 Elite | 80+ | 5-10% | Category-defining, VC bidding war |
| ⭐ Excellent | 70-79 | 10-15% | Strong traction + team, top-tier match |
| 💪 Strong | 60-69 | 25-30% | Solid fundamentals, good fit for right VCs |
| ✅ Good | 50-59 | 30-35% | Promising, needs validation |
| ⚠️ Fair | 40-49 | 15-20% | Borderline quality, early-stage |
| ❌ Weak | <40 | <5% | Should be rejected or need more data |

**Average Score Target:** 58-62

---

## 🔧 PROPER CALIBRATION PROCEDURE

### NEVER do this:
```typescript
// ❌ Arbitrary change without analysis
normalizationDivisor: 18.0  // "Scores seem low, let's lower this"
```

### ALWAYS do this:

#### 1. **Validate Current State**
```bash
npx tsx scripts/validate-god-config.ts
```

This will show:
- Current config values
- Actual database score distribution
- Errors if config is misconfigured
- Warnings if distribution is suboptimal

#### 2. **Identify the Problem**

If **avg too low** (< 55):
- Divisor is too high
- DECREASE normalizationDivisor (stay within 19-22 range)
- Example: 21.5 → 20.5

If **avg too high** (> 65):
- Divisor is too low
- INCREASE normalizationDivisor (stay within 19-22 range)
- Example: 19.5 → 20.5

If **too many below floor** (>10% under 40):
- baseBoostMinimum too low
- INCREASE baseBoostMinimum (stay within 2.0-3.5 range)
- Example: 2.5 → 2.8

#### 3. **Make the Change**

Edit `server/services/startupScoringService.ts`:

```typescript
const GOD_SCORE_CONFIG = {
  normalizationDivisor: 20.5,  // Update with clear reason
  baseBoostMinimum: 2.8,       // Document the change
  // ...rest
}
```

**The validation function will throw an error if you go outside acceptable ranges.**

#### 4. **Recalculate Scores**
```bash
npx tsx scripts/recalculate-scores.ts
```

This processes all 8,888+ startups (takes 2-3 minutes). It applies:
- Base GOD score (23 algorithms)
- Bootstrap bonuses (sparse-data handling)
- Momentum scoring (growth signals)
- AP scoring (market timing)
- Elite/Spiky bonuses (outlier detection)

#### 5. **Verify the Fix**
```bash
npx tsx scripts/validate-god-config.ts
```

Should show:
- ✅ Config validation passed
- Average in 55-65 range
- Less than 5-10% below floor
- Proper tier distribution

#### 6. **Commit & Deploy**
```bash
git add server/services/startupScoringService.ts
git commit -m "fix: Adjust GOD config normalizationDivisor [X] → [Y] (avg [old] → [new])"
git push
```

---

## 📖 Math Explanation

### How Scoring Works

1. **Raw Total Calculation**
   ```
   rawTotal = baseBoost + (23 algorithm scores)
   Range: ~6 (sparse data) to ~17 (exceptional)
   Average: ~12 (typical approved startup)
   ```

2. **Normalization (0-10 scale)**
   ```
   score_0_10 = (rawTotal / normalizationDivisor) * 10
   ```

3. **Final Score (0-100 scale)**
   ```
   finalScore = score_0_10 * 10
   ```

### Example Calculations (divisor = 20.5):

| Startup Type | rawTotal | Calculation | Final Score |
|--------------|----------|-------------|-------------|
| Sparse data | 6 | (6/20.5)*100 | 29 |
| Average | 12 | (12/20.5)*100 | 58 ✅ |
| Good | 14 | (14/20.5)*100 | 68 |
| Exceptional | 17 | (17/20.5)*100 | 83 |

**Why 20.5?**
- Production data shows avg rawTotal ≈ 12
- Target avg score = 58-62
- Math: 12 / divisor * 100 = 60 → divisor = 20

---

## ⚠️ HISTORICAL CORRUPTION EVENTS

### v6 (Feb 18, 2026) - CATASTROPHIC FAILURE
```typescript
normalizationDivisor: 30.0  // ❌ Admin approved 19.5, but code had 30.0
baseBoostMinimum: 2.5       // ❌ Too low
```

**Result:**
- Average score: 36.7 (target: 60) ❌
- 85.9% of startups below quality floor (40) ❌
- 0% Elite, 0% Excellent, 0% Strong ❌
- Investor feed showed only "terrible" startups

**Root Cause:** Copilot made change without understanding impact

---

### v7 (Feb 19, 2026) - OVERCORRECTION ATTEMPT
```typescript
normalizationDivisor: 18.5  // ❌ Too low, would inflate scores
baseBoostMinimum: 3.5       // ❌ Too high
```

**Projected Result:**
- Average score: 68+ (target: 60) ❌
- 60%+ Strong/Excellent (should be 35-40%) ❌
- Inflated ratings lose investor trust

**Root Cause:** Copilot tried to fix v6 but overcompensated

---

### v8 (Feb 19, 2026) - HARDENED FIX ✅

```typescript
// GUARD RAILS ADDED
normalizationDivisor: 20.5,  // Middle of acceptable range (19-22)
baseBoostMinimum: 2.8,       // Conservative floor (2-3.5)
// Runtime validation throws errors if violated
```

**Result:**
- ✅ Config validates at startup
- ✅ Average score: 58-62 (target range)
- ✅ Proper tier distribution
- ✅ Future changes bounded by validation

---

## 🚨 Emergency Procedures

### If Scores Are Broken (Check These First)

1. **Run diagnostic:**
   ```bash
   npx tsx check-god-scores.ts
   ```

2. **Check config validation:**
   ```bash
   npx tsx scripts/validate-god-config.ts
   ```

3. **If validation fails:**
   - DO NOT randomly change divisor
   - Follow calibration procedure above
   - Document reason for change in commit

4. **If emergency revert needed:**
   ```bash
   git log --oneline -10  # Find last working commit
   git checkout <commit-hash> -- server/services/startupScoringService.ts
   npx tsx scripts/recalculate-scores.ts
   ```

### If System Guardian Alerts

System Guardian runs health checks every 6 hours. If it detects GOD score issues:

1. Check `ai_logs` table for alert details
2. Run `npx tsx scripts/validate-god-config.ts`
3. If avg score drift > 10 points from target:
   - Follow calibration procedure
   - Root cause: likely unauthorized config change or data quality issue

---

## 📞 Who Can Change This?

**ONLY these roles:**

1. **Admin (Manual Approval Required)**
   - Must document reason
   - Must run validation before/after
   - Must verify distribution

2. **ML Agent (Component Weights Only)**
   - Can adjust algorithm weights via approved training pipeline
   - CANNOT change normalization or boost values
   - Changes logged to `ai_logs`

**FORBIDDEN:**
- ❌ AI Copilot modifications without admin review
- ❌ Arbitrary "let's try this" changes
- ❌ Changes without validation
- ❌ Changes without testing on production data

---

## 🔗 Related Files

- `server/services/startupScoringService.ts` - Main config (SSOT)
- `scripts/validate-god-config.ts` - Validation tool
- `scripts/recalculate-scores.ts` - Score recalculation
- `check-god-scores.ts` - Quick health check
- `system-guardian.js` - Automated monitoring
- `.github/copilot-instructions.md` - AI agent rules

---

## ✅ Quick Reference

```bash
# Check current health
npx tsx check-god-scores.ts

# Full validation with recommendations
npx tsx scripts/validate-god-config.ts

# Recalculate all scores (after config change)
npx tsx scripts/recalculate-scores.ts

# Emergency: Revert to last working config
git log --grep="GOD" --oneline -5
git checkout <hash> -- server/services/startupScoringService.ts
```

---

**Last Updated:** Feb 19, 2026 (v8)  
**Current Config:** divisor=20.5, baseBoost=2.8  
**Target Avg:** 58-62  
**Status:** ✅ Validated with guard rails active
