# GOD Score Automated Monitoring

## Overview

Automated monitoring system that checks average GOD scores and alerts if they exceed thresholds. Provides actionable recommendations for calibration adjustments.

## Features

- ✅ **Automatic Monitoring**: Runs every hour via PM2
- ✅ **Threshold Alerts**: Alerts if average exceeds 70 or falls below 50
- ✅ **Statistics**: Provides detailed score distribution and statistics
- ✅ **Recommendations**: Suggests specific calibration adjustments
- ✅ **Database Logging**: Logs all monitoring results to `ai_logs` table

## Configuration

### Thresholds (from `GOD_SCORE_CONFIG`):

```typescript
averageHigh: 70   // Alert if average exceeds this
averageLow: 50    // Alert if average falls below this
targetMin: 55     // Target range minimum
targetMax: 65     // Target range maximum
```

### PM2 Schedule:

- **Runs**: Every hour at :15 (15 minutes after score recalculation)
- **Process**: `god-score-monitor`
- **Script**: `scripts/monitor-god-scores.ts`

## What It Monitors

1. **Average Score**: Checks if within target range (55-65)
2. **Standard Deviation**: Ensures proper differentiation (10-20 is healthy)
3. **Distribution**: Tracks weak/average/solid/strong/elite percentages
4. **Alert Conditions**: Flags if average > 70 or < 50

## Output Example

```
══════════════════════════════════════════════════════════════════════
    📊 GOD SCORE MONITORING
══════════════════════════════════════════════════════════════════════
⏰ 2024-12-20T10:15:00.000Z

📊 Current Statistics:
   Average: 55.4
   Median: 54.0
   Min: 30
   Max: 87
   Std Dev: 8.3
   Count: 1000

📈 Distribution:
   Weak (0-48): 372 (37.2%)
   Average (49-64): 532 (53.2%)
   Solid (65-77): 88 (8.8%)
   Strong (78-88): 8 (0.8%)
   Elite (89-100): 0 (0.0%)

══════════════════════════════════════════════════════════════════════
✅ Status: Scores within acceptable range
══════════════════════════════════════════════════════════════════════

💡 Recommendations:
   ✅ Average score (55.4) is in target range (55-65)
   ⚠️  Low standard deviation (8.3) - scores not differentiating enough
      → Run: npx tsx scripts/analyze-god-components.ts to identify components with low differentiation
      → Consider adjusting component weights or improving data collection
   ✅ Strong/elite distribution (0.8%) is reasonable
```

## Alert Actions

### If Average > 70:

**Recommendations**:
1. Increase `normalizationDivisor` from 22 to 24
2. OR reduce `baseBoostMinimum` from 3.5 to 3.0
3. Run calibration script: `npx tsx scripts/calibrate-god-scores.ts`

**Manual Fix**:
```typescript
// In server/services/startupScoringService.ts
const GOD_SCORE_CONFIG = {
  normalizationDivisor: 24,  // Increase from 22
  // OR
  baseBoostMinimum: 3.0,     // Reduce from 3.5
  // ...
};
```

### If Average < 50:

**Recommendations**:
1. Decrease `normalizationDivisor` from 22 to 20
2. OR increase `baseBoostMinimum` from 3.5 to 4.0

**Manual Fix**:
```typescript
const GOD_SCORE_CONFIG = {
  normalizationDivisor: 20,  // Decrease from 22
  // OR
  baseBoostMinimum: 4.0,     // Increase from 3.5
  // ...
};
```

## Manual Execution

Run manually for immediate check:

```bash
npx tsx scripts/monitor-god-scores.ts
```

## PM2 Management

```bash
# Check status
pm2 status god-score-monitor

# View logs
pm2 logs god-score-monitor

# View recent logs
pm2 logs god-score-monitor --lines 50

# Restart if needed
pm2 restart god-score-monitor
```

## Database Logging

All monitoring results are logged to `ai_logs` table:

```sql
SELECT 
  created_at,
  output->>'stats' as stats,
  output->>'alert' as alert,
  status
FROM ai_logs
WHERE type = 'god_score_monitor'
ORDER BY created_at DESC
LIMIT 10;
```

## Integration with Other Systems

- **Score Recalculation**: Runs 15 minutes after `score-recalc` completes
- **System Guardian**: Can trigger alerts if monitoring fails
- **Daily Reports**: Can include monitoring summary

## Next Steps After Alert

1. **Review Statistics**: Check the detailed output
2. **Run Component Analysis**: `npx tsx scripts/analyze-god-components.ts`
3. **Run Calibration**: `npx tsx scripts/calibrate-god-scores.ts` (if you have outcome data)
4. **Adjust Configuration**: Make recommended changes in `startupScoringService.ts`
5. **Recalculate Scores**: `npx tsx scripts/recalculate-scores.ts`
6. **Verify**: Run monitor again to confirm fix

---

**Status**: ✅ Active
**Schedule**: Every hour at :15
**Alert Threshold**: Average > 70 or < 50



