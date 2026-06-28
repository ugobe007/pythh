# Market Saturation Algorithm

## Overview
Automatically detects and penalizes over-invested sectors where deal velocity is declining, indicating market saturation.

## How It Works

### 1. Investment Velocity Tracking
- Analyzes deal flow by sector over 12-month rolling window
- Compares current quarter vs previous quarter
- Calculates velocity change percentage

### 2. Saturation Levels

| Level | Velocity Decline | GOD Score Penalty | Example |
|-------|------------------|-------------------|---------|
| 🟢 **LOW** | 0% or positive | No penalty (1.0x) | Healthy growth |
| 🟡 **MODERATE** | -15% to -1% | -7% (0.93x) | Slowing |
| 🟠 **HIGH** | -30% to -16% | -15% (0.85x) | Declining |
| 🔴 **CRITICAL** | -50% or worse | -30% (0.70x) | Saturated |

### 3. Automatic Penalty Application
When saturation is detected:
- **Market Score**: Reduced by penalty multiplier
- **Total GOD Score**: Reduced proportionally
- **Affects**: All startups in saturated sectors
- **Updates**: Score history table tracks changes

## Usage

### Run Analysis
```bash
node calculate-market-saturation.js
```

### Schedule Regular Updates
Add to crontab or PM2:
```bash
# Run weekly on Sundays at 2am
pm2 start calculate-market-saturation.js --cron "0 2 * * 0"
```

### Integration with GOD Algorithm
The saturation penalty is applied AFTER base GOD scoring:

```javascript
// 1. Calculate base GOD score (100 points max)
const baseScore = calculateGODScore(startup);

// 2. Check for sector saturation
const saturationPenalty = getSectorPenalty(startup.sectors);

// 3. Apply penalty
const finalScore = Math.round(baseScore * saturationPenalty);
```

## Real-World Example

**Scenario**: AI/ML sector becomes oversaturated

1. **January**: 50 AI deals closed (healthy)
2. **February**: 45 AI deals (-10% decline)
3. **March**: 30 AI deals (-33% decline → HIGH saturation)

**Result**:
- Algorithm detects -33% velocity decline
- Applies 🟠 HIGH penalty (0.85x multiplier)
- All AI startups get 15% score reduction:
  - Startup A: 90 → 77
  - Startup B: 85 → 72

## Benefits

### For Investors
- **Risk Mitigation**: Avoid crowded markets
- **Alpha Generation**: Find underserved sectors
- **Portfolio Balance**: Diversify automatically

### For Startups
- **Fair Scoring**: Market dynamics reflected
- **Timing Advantage**: Early movers rewarded
- **Category Creation**: Unique sectors valued

## Configuration

Edit `SATURATION_LEVELS` in `calculate-market-saturation.js`:

```javascript
const SATURATION_LEVELS = {
  CRITICAL: { threshold: -50, penalty: 0.70 },
  HIGH: { threshold: -30, penalty: 0.85 },
  MODERATE: { threshold: -15, penalty: 0.93 },
  LOW: { threshold: 0, penalty: 1.00 }
};
```

## Data Requirements

Minimum data needed:
- **3+ deals** per sector (statistical significance)
- **3+ months** of history (velocity calculation)
- **Sector tags** on startups (accurate categorization)

## Future Enhancements

1. **Geographic Saturation**: Regional market analysis
2. **Stage-Specific**: Seed vs Series A trends
3. **Competitive Density**: Number of similar companies
4. **Exit Velocity**: IPO/acquisition trends
5. **Capital Efficiency**: Burn rate vs sector average

## Monitoring

View saturation status in:
- **Admin Dashboard** → GOD Algorithm tab
- **Command Center** → Market Intelligence
- **Analytics** → Sector Trends

## Technical Details

### Database Schema
```sql
-- Tracks saturation over time
CREATE TABLE sector_saturation (
  id UUID PRIMARY KEY,
  sectors TEXT[],
  velocity_change DECIMAL,
  saturation_level TEXT,
  penalty_multiplier DECIMAL,
  created_at TIMESTAMPTZ
);
```

### Performance
- Query time: ~100-300ms
- Updates: Batch processed
- Impact: Runs in background
- Rollback: Previous scores stored in history

## Notes

- Penalties are **reversible** - scores recover if market improves
- Updates are **logged** - full audit trail maintained
- Algorithm is **transparent** - logic visible to all users
- Thresholds are **tunable** - adjust based on your market

---

**Last Updated**: December 11, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
