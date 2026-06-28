# 🛡️ System Guardian - AI Copilot Reference

## Overview

The **System Guardian** is Hot Match's master health monitoring and auto-healing system. It runs every 10 minutes via PM2 and monitors all critical system components.

**File:** `system-guardian.js`  
**Dashboard:** `/admin/health` ([SystemHealthDashboard.tsx](src/pages/SystemHealthDashboard.tsx))  
**PM2 Process:** `system-guardian`  
**Schedule:** Every 10 minutes (`*/10 * * * *`)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM GUARDIAN                          │
│                  (runs every 10 min)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Scraper    │  │  GOD Score  │  │  Database   │         │
│  │  Health     │  │  Health     │  │  Integrity  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Match     │  │     ML      │  │    Data     │         │
│  │  Quality    │  │  Pipeline   │  │  Freshness  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│                         ↓                                   │
│              ┌─────────────────────┐                       │
│              │   AUTO-HEALING      │                       │
│              │   • Restart scrapers│                       │
│              │   • Regen matches   │                       │
│              │   • Log to ai_logs  │                       │
│              └─────────────────────┘                       │
│                         ↓                                   │
│              ┌─────────────────────┐                       │
│              │  HEALTH DASHBOARD   │                       │
│              │  /admin/health      │                       │
│              └─────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Thresholds Reference

### 🔧 Scraper Health

| Metric | Threshold | Alert Level | Description |
|--------|-----------|-------------|-------------|
| Error Rate | > 30% | ERROR | Scraper failing too often |
| Stuck Time | > 60 min | WARN | No scraping activity |
| Restart Count | > 50 | WARN | Process unstable |

**What triggers alerts:**
- PM2 process showing high restart count
- No new `discovered_startups` entries for 60+ minutes
- RSS source error rate exceeds 30%

**Auto-healing actions:**
- Restarts stuck scraper processes via `pm2 restart`

---

### 📊 GOD Score Health

| Metric | Threshold | Alert Level | Description |
|--------|-----------|-------------|-------------|
| Average Score | < 45 or > 75 | WARN | Distribution bias |
| Low Score % | > 30% below 50 | ERROR | Too many poor scores |
| Elite % | < 0.5% at 85+ | WARN | Elite drought |

**What triggers alerts:**
- Average GOD score drifts outside healthy range (45-75)
- More than 30% of startups scoring below 50
- Zero startups reaching "elite" status (85+)

**Resolution:**
- Run `npx tsx scripts/recalculate-scores.ts` to recalculate using single source of truth
- Check if scoring service is applying proper weights
- Verify startup data quality (team, traction, market fields)
- NOTE: Database trigger now prevents scores below 40

---

### 🗄️ Database Integrity

| Check | Alert Level | Description |
|-------|-------------|-------------|
| Required Columns | ERROR | Core columns missing |
| Orphaned Data | WARN | FKs pointing to deleted records |
| Table Existence | ERROR | Critical tables missing |

**Required columns checked:**
- `startup_uploads`: id, name, status, total_god_score, sectors
- `investors`: id, name, sectors, stage
- `startup_investor_matches`: startup_id, investor_id, match_score

**What triggers alerts:**
- Schema migration broke required columns
- Foreign key references to deleted records
- Missing core tables

---

### 🎯 Match Quality

| Metric | Threshold | Alert Level | Description |
|--------|-----------|-------------|-------------|
| Total Matches | < 5,000 | ERROR | Match pool too small |
| High Quality % | < 0.2% at 70+ | ERROR | No good matches |
| Low Quality % | > 95% below 50 | ERROR | Flooded with junk |

**What triggers alerts:**
- Matches table emptied (foreign key issues, accidental deletion)
- Match scoring broken (all scores cluster at extremes)
- Sector vocabulary mismatch (startups/investors don't align)

**Auto-healing actions:**
- Triggers `node match-regenerator.js` when match count < 5000
- Logs regeneration results to `ai_logs`

---

### 🧠 ML Pipeline

| Metric | Threshold | Alert Level | Description |
|--------|-----------|-------------|-------------|
| Investor Embeddings | < 10% | WARN | Low embedding coverage |
| Startup Embeddings | < 10% | WARN | Low embedding coverage |

**What triggers alerts:**
- OpenAI API key expired/invalid
- Embedding generation script crashed
- New data not being embedded

**Resolution:**
- Check `OPENAI_API_KEY` in .env
- Run embedding generation manually
- Check `ai_logs` for embedding errors

---

### ⏰ Data Freshness

| Metric | Threshold | Alert Level | Description |
|--------|-----------|-------------|-------------|
| Startup Age | > 48 hours | ERROR | No new startups |
| Investor Age | > 48 hours | WARN | Stale investor data |
| Match Age | > 6 hours | WARN | Matches need refresh |

**What triggers alerts:**
- RSS scrapers stopped discovering startups
- Investor enrichment pipeline stalled
- Match regeneration not running

**Resolution:**
- Check PM2 status: `pm2 status`
- View scraper logs: `pm2 logs mega-scraper`
- Manually trigger: `node match-regenerator.js`

---

## Health Status Levels

| Status | Color | Meaning |
|--------|-------|---------|
| ✅ OK | Green | All checks pass |
| ⚠️ WARN | Yellow | Non-critical issues |
| ❌ ERROR | Red | Requires attention |

**Overall status** is determined by the worst individual check:
- Any ERROR → Overall ERROR
- Any WARN (no ERROR) → Overall WARN
- All OK → Overall OK

---

## Commands

### Run Guardian Manually
```bash
node system-guardian.js
```

### Check PM2 Status
```bash
pm2 status
pm2 logs system-guardian --lines 50
```

### Restart Guardian
```bash
pm2 restart system-guardian
```

### View Health Dashboard
Navigate to: `/admin/health`

---

## Database Logging

Guardian logs each run to the `ai_logs` table:

```sql
SELECT * FROM ai_logs 
WHERE type = 'guardian' 
ORDER BY created_at DESC 
LIMIT 10;
```

**Log schema:**
```json
{
  "type": "guardian",
  "action": "health_check",
  "status": "success|warning|error",
  "output": {
    "overall": "OK|WARN|ERROR",
    "checks": [
      { "name": "Scraper Health", "status": "OK", "issues": [] },
      { "name": "GOD Score Health", "status": "WARN", "issues": ["ELITE DROUGHT"] }
    ],
    "actions": ["Triggered match regeneration"]
  }
}
```

---

## Modifying Thresholds

Thresholds are defined at the top of `system-guardian.js`:

```javascript
const THRESHOLDS = {
  // Scraper
  SCRAPER_ERROR_RATE_MAX: 0.3,        // 30% error rate triggers alert
  SCRAPER_STUCK_MINUTES: 60,          // No activity for 1 hour
  
  // GOD Scores
  GOD_SCORE_MIN_AVG: 45,              // Average should be above this
  GOD_SCORE_MAX_AVG: 75,              // Average should be below this
  GOD_SCORE_LOW_PERCENT_MAX: 0.3,     // Max 30% can be below 50
  
  // Matches
  MATCH_MIN_COUNT: 5000,              // Minimum matches required
  MATCH_HIGH_QUALITY_MIN: 0.002,      // At least 0.2% should be 70+
  MATCH_LOW_QUALITY_MAX: 0.95,        // Max 95% can be below 50
  
  // Data freshness
  STALE_HOURS: 48,                    // Data older than 48h is stale
  
  // ML
  ML_EMBEDDING_MIN_PERCENT: 0.1,      // 10% of entities should have embeddings
};
```

### When to Adjust Thresholds

| Scenario | Adjustment |
|----------|------------|
| Just launched, small dataset | Lower `MATCH_MIN_COUNT` |
| High-quality data sources | Raise `GOD_SCORE_MIN_AVG` |
| Rapid growth phase | Lower `STALE_HOURS` |
| ML fully deployed | Raise `ML_EMBEDDING_MIN_PERCENT` |

---

## Related Files

| File | Purpose |
|------|---------||
| [system-guardian.js](system-guardian.js) | Main guardian script |
| [match-regenerator.js](match-regenerator.js) | Match regeneration (triggered by guardian) |
| [scripts/recalculate-scores.ts](scripts/recalculate-scores.ts) | GOD score recalculation (SINGLE SOURCE OF TRUTH) |
| [server/services/startupScoringService.ts](server/services/startupScoringService.ts) | Core scoring algorithm |
| [src/pages/SystemHealthDashboard.tsx](src/pages/SystemHealthDashboard.tsx) | Admin health UI |
| [ecosystem.config.js](ecosystem.config.js) | PM2 process configuration |
| [scripts/watchdog.ts](scripts/watchdog.ts) | Secondary health monitor |

---

## Troubleshooting

### Guardian Not Running
```bash
pm2 status                    # Check if process exists
pm2 restart system-guardian   # Restart it
pm2 logs system-guardian      # View errors
```

### False Positives
If Guardian reports errors that aren't real issues:
1. Check if thresholds match current data scale
2. Verify database connectivity
3. Check PM2 process names match expectations

### Auto-Healing Not Working
1. Verify `match-regenerator.js` exists and works standalone
2. Check PM2 permissions for spawning child processes
3. Review `ai_logs` for error messages

---

## For AI Copilots

### Quick Health Check
```bash
node system-guardian.js
```

### Key Questions to Ask
1. "What's the current match count?" → Check `startup_investor_matches`
2. "Is the scraper working?" → `pm2 logs mega-scraper`
3. "Are GOD scores balanced?" → Run guardian or check `/admin/health`

### Common Fixes
| Symptom | Fix |
|---------|-----|
| Matches empty | `node match-regenerator.js` |
| Low GOD scores | `npx tsx scripts/recalculate-scores.ts` |
| Scraper stuck | `pm2 restart mega-scraper` |
| Stale data | Check PM2 processes, restart as needed |

### Adding New Health Checks

To add a new check to the Guardian:

1. Add threshold constants to `THRESHOLDS` object
2. Create a `check*()` async function that returns `{ status, issues }`
3. Add to the `checks` array in `runAllChecks()`
4. Optionally add auto-healing logic in `performAutoHealing()`

Example:
```javascript
async function checkNewMetric() {
  const issues = [];
  let status = 'OK';
  
  // Your check logic here
  const { count } = await supabase.from('some_table').select('*', { count: 'exact', head: true });
  
  if (count < THRESHOLDS.NEW_METRIC_MIN) {
    status = 'ERROR';
    issues.push(`Metric too low: ${count}`);
  }
  
  return { name: 'New Metric', status, issues };
}
```

---

*Last updated: December 18, 2025*
