# System Guard Rails & Automation

## 1. Scoring System Guard Rails ✅

**File:** `server/services/scoringGuards.js`

### Protection Mechanisms:
- ✅ **Score bounds validation** (40-100)
- ✅ **Suspicious jump detection** (>20pts change alert)
- ✅ **Authorization checks** (admin + ML agent only)
- ✅ **Audit trail logging** (all changes to `score_history`)
- ✅ **Mass change detection** (>100 scores/minute alert)
- ✅ **Distribution health monitoring** (avg 45-65 expected)

### Usage:
```javascript
const { validateScore, checkDistributionHealth } = require('./server/services/scoringGuards');

// Before updating score
const validation = validateScore(startup_id, new_score, old_score, modifier);
if (!validation.valid) {
  console.error('Score update blocked:', validation.errors);
  return;
}

// Daily health check
const health = await checkDistributionHealth(supabase);
console.log(`Score health: ${health.status} (avg: ${health.average})`);
```

---

## 2. Data Refresh Pipeline ✅

**File:** `scripts/data-refresh-pipeline.js`

### Refresh Schedule:
- **New startups** (< 7 days): Daily refresh
- **Sparse data** (< 50% complete): Weekly refresh
- **Standard quality**: Monthly refresh (30 days)

### Priority System:
1. 🔥 **High Priority** = New + Sparse (refreshed daily)
2. 📉 **Sparse Data** = < 50% completeness
3. ⏰ **Stale Data** = Not refreshed in 30+ days

### Usage:
```bash
# Daily batch (50 startups)
node scripts/data-refresh-pipeline.js daily

# Full refresh (all sparse startups)
node scripts/data-refresh-pipeline.js full
```

### What It Does:
1. Identifies startups needing refresh
2. Calculates data completeness (10 fields)
3. Prioritizes: New + Sparse > Sparse > Stale
4. Runs scrapers (website + inference)
5. Updates `last_scraped_at` timestamp
6. Logs to `ai_logs` table

---

## 3. Daily System Health Report ✅

**File:** `scripts/daily-health-report.js`

### Monitors:
- 📦 **Database Health** (startup count, matches, investors)
- 🎯 **GOD Score Distribution** (avg, range, anomalies)
- 📊 **Data Quality** (website %, traction %, pitch %)
- 🤖 **Scraper Activity** (last run, recent logs)
- 🎯 **Match Quality** (avg score, high-quality %)
- ❌ **System Errors** (last 24h)

### Output:
```
📊 DAILY SYSTEM HEALTH REPORT

✅ WORKING:
  ✅ Database: Healthy startup count
  ✅ Scores: Distribution healthy
  ✅ Scrapers: Active in last 24h

⚠️ NEEDS ADJUSTMENT:
  ⚠️ Scores: Avg 68.59 outside target range
  ⚠️ Data Quality: Low traction data (<10%)

❌ NEEDS FIXING:
  ❌ Matches: Below 5,000 threshold

🚨 ALERTS:
  ⚠️ Match count low - run match-regenerator.js
  ⚠️ Score average out of range: 68.59
```

### Usage:
```bash
# Run manually
node scripts/daily-health-report.js

# Schedule with cron (daily at 9 AM)
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && node scripts/daily-health-report.js >> logs/daily-report.log 2>&1
```

---

## 4. Automation Setup

### Add to package.json:
```json
{
  "scripts": {
    "health:report": "node scripts/daily-health-report.js",
    "data:refresh": "node scripts/data-refresh-pipeline.js daily",
    "data:refresh:full": "node scripts/data-refresh-pipeline.js full",
    "guards:check": "node -e \"require('./server/services/scoringGuards').checkDistributionHealth(require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)).then(console.log)\""
  }
}
```

### Schedule with cron:
```bash
# Edit crontab
crontab -e

# Add these lines:
# Daily health report (9 AM)
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && npm run health:report

# Daily data refresh (2 AM)
0 2 * * * cd /Users/leguplabs/Desktop/hot-honey && npm run data:refresh

# Weekly full refresh (Sunday 3 AM)
0 3 * * 0 cd /Users/leguplabs/Desktop/hot-honey && npm run data:refresh:full
```

---

## 5. Quick Reference

### Check System Health:
```bash
npm run health:report
```

### Refresh Data:
```bash
# Daily batch (50 startups)
npm run data:refresh

# All sparse startups
npm run data:refresh:full
```

### Validate Scores:
```javascript
const guards = require('./server/services/scoringGuards');

// Check distribution
const health = await guards.checkDistributionHealth(supabase);

// Detect mass changes
const massChange = await guards.detectMassChanges(supabase, 60);
if (massChange.alert) console.log(massChange.message);
```

### View Logs:
```sql
-- Score changes (last 24h)
SELECT * FROM score_history 
WHERE timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Daily reports
SELECT * FROM ai_logs 
WHERE log_type = 'daily_health_report'
ORDER BY created_at DESC
LIMIT 7;

-- Data refresh logs
SELECT * FROM ai_logs 
WHERE log_type = 'data_refresh'
ORDER BY created_at DESC;
```

---

## 6. Database Schema Updates Needed

```sql
-- Add last_scraped_at to startup_uploads (if not exists)
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

-- Create index for refresh queries
CREATE INDEX IF NOT EXISTS idx_startup_last_scraped 
ON startup_uploads(last_scraped_at) 
WHERE status = 'approved';

-- Create index for score history queries
CREATE INDEX IF NOT EXISTS idx_score_history_timestamp 
ON score_history(timestamp DESC);
```

---

## 7. Next Steps

1. ✅ **Run initial health report:**
   ```bash
   node scripts/daily-health-report.js
   ```

2. ✅ **Test data refresh:**
   ```bash
   node scripts/data-refresh-pipeline.js daily
   ```

3. ✅ **Set up cron jobs** (see section 4 above)

4. ✅ **Integrate scoring guards in recalculate-scores.ts:**
   ```typescript
   import { validateScore, logScoreChange } from './server/services/scoringGuards';
   
   // Before updating scores
   const validation = validateScore(startup.id, newScore, oldScore, 'recalculation');
   if (validation.valid) {
     // Update score
     await logScoreChange(supabase, { ... });
   }
   ```

5. ✅ **Monitor daily reports** for issues

---

**Status:** ✅ All systems implemented and ready for deployment
**Owner:** Andy (@ugobe007)
**Date:** February 14, 2026
