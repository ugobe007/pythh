# GOD Scoring System - Numbers Guide 📊

## Quick Check

Run this command to see all GOD scoring statistics:

```bash
node check-god-scoring-numbers.js
```

## What It Shows

### 1. **Overall Statistics**
- Total approved startups
- Number scored by GOD
- Number pending scoring
- Scoring coverage percentage

### 2. **GOD Score Distribution**
- Average score
- Median score
- Score range (min-max)
- Distribution breakdown:
  - 🏆 Excellent (80-100)
  - ✅ Good (60-79)
  - 📊 Average (40-59)
  - ⚠️ Below Average (<40)

### 3. **Component Score Averages**
- 👥 Team Score average
- 📈 Traction Score average
- 🎯 Market Score average
- ⚙️ Product Score average
- 🔮 Vision Score average

### 4. **Recent Activity (Last 7 Days)**
- Newly scored startups
- Newly added (unscored) startups

### 5. **Top 10 Scored Startups**
- Shows the highest-scoring startups with their component breakdowns

### 6. **Sample Unscored Startups**
- Shows first 5 startups that haven't been scored yet

## Expected Numbers

### Healthy System:
- **Scoring Coverage:** 80%+ of approved startups should be scored
- **Average GOD Score:** Typically 50-70 (depends on data quality)
- **Score Distribution:** Should have a bell curve, not all high or all low
- **Component Scores:** Should be relatively balanced across all 5 components

### Red Flags:
- ⚠️ Coverage < 50% - Scoring pipeline may not be running
- ⚠️ Average score < 30 - Data quality issues or scoring algorithm problems
- ⚠️ All scores in one range - Algorithm may not be differentiating properly
- ⚠️ Many unscored startups older than 7 days - Scoring pipeline backlog

## Troubleshooting

### If Coverage is Low:
1. Check if `god-score-v2-engine.js` is running
2. Check PM2 status: `pm2 list`
3. Check automation logs: `tail -f logs/automation.log`
4. Manually trigger scoring: `node god-score-v2-engine.js`

### If Scores Seem Off:
1. Check component scores - are they all similar?
2. Review sample startups - do scores match expectations?
3. Check for data quality issues (missing fields, invalid data)
4. Review scoring algorithm weights in `god-score-v2-engine.js`

## Related Scripts

- `check-god-scoring-status.js` - Quick status check
- `check-system-status.js` - Full system status (includes GOD scoring)
- `god-score-v2-engine.js` - The actual scoring engine

---

Run `node check-god-scoring-numbers.js` to see your current numbers! 🚀





