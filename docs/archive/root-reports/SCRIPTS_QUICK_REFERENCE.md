# ⚡ Quick Reference: Hot Match Scripts & Commands

One-page cheat sheet for daily operations.

---

## 🌅 **MORNING ROUTINE** (5 minutes)

```bash
# 1. Full health check
./daily-health-check.sh

# 2. Check automation status
pm2 status

# 3. View recent logs (if needed)
pm2 logs autopilot --lines 30
```

---

## 📊 **HEALTH CHECK COMMANDS**

| **Check** | **Command** |
|-----------|-------------|
| GOD Scores | `node scripts/check-god-scores.js` |
| Data Quality | `node scripts/check-startup-data-quality.js` |
| Recent Deletions | `node scripts/check-recent-deletions.js` |
| Cleanup Preview | `npm run db:cleanup:audit` |
| All Sectors | `node scripts/list-all-sectors.js` |

---

## 🔄 **PIPELINE COMMANDS**

| **Action** | **Command** |
|------------|-------------|
| **Start Automation** | `npm run pipeline:daemon` |
| **Run Full Pipeline** | `npm run pipeline` |
| **Manual Scrape** | `npm run scrape` |
| **Manual Enrich** | `npm run enrich` |
| **Manual Score** | `npm run score` |
| **Manual Match** | `npm run match` |

---

## 🎯 **SCORING COMMANDS**

| **Action** | **Command** |
|------------|-------------|
| Recalculate (All) | `node scripts/core/god-score-formula.js` |
| Recalculate (100) | `node scripts/core/god-score-formula.js --limit 100` |
| Check Scores | `node scripts/check-god-scores.js` |

---

## 🧹 **MAINTENANCE COMMANDS**

| **Action** | **Command** | **Risk** |
|------------|-------------|----------|
| Cleanup Audit | `npm run db:cleanup:audit` | ✅ Safe |
| Cleanup Execute | `npm run db:cleanup:execute` | ⚠️ Deletes |
| Social Signals (5) | `node scripts/enrichment/social-signals-scraper.js 5` | ✅ Safe |
| Social Signals (All) | `node scripts/enrichment/social-signals-scraper.js` | ✅ Safe |

---

## 📈 **PM2 COMMANDS**

| **Action** | **Command** |
|------------|-------------|
| Start Autopilot | `pm2 start npm --name autopilot -- run pipeline:daemon` |
| Status | `pm2 status` |
| Logs | `pm2 logs autopilot` |
| Restart | `pm2 restart autopilot` |
| Stop | `pm2 stop autopilot` |
| Monitor | `pm2 monit` |

---

## 🔍 **TROUBLESHOOTING**

| **Issue** | **Command** |
|-----------|-------------|
| Script not found | `cd /Users/leguplabs/Desktop/hot-honey` |
| Check env vars | `cat .env \| grep SUPABASE` |
| Kill stuck process | `pkill -f "node scripts"` |
| Find process | `ps aux \| grep "god-score-formula"` |

---

## 📋 **DAILY WORKFLOW**

```bash
# Morning (9 AM)
./daily-health-check.sh
pm2 status

# Midday (if needed)
npm run scrape  # Manual scrape

# Evening (6 PM)
node scripts/check-god-scores.js | grep "Distribution"
```

---

## 🚀 **WEEKLY WORKFLOW** (Sundays)

```bash
# 1. Review cleanup
npm run db:cleanup:audit

# 2. Collect social signals
node scripts/enrichment/social-signals-scraper.js

# 3. Full recalculation (optional)
node scripts/core/god-score-formula.js
```

---

## ⚠️ **DANGER ZONE**

| **Command** | **What It Does** | **Use With Caution** |
|-------------|------------------|----------------------|
| `npm run db:cleanup:execute` | Deletes low-quality data | ⚠️ Review audit first |
| `node scripts/core/god-score-formula.js` | Recalculates ALL scores | ⚠️ Takes 30+ minutes |

---

**Tip**: Always run audit commands (`:audit`) before execute commands (`:execute`)!

