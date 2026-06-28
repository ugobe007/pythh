# ✅ Quick Start Checklist

## Step-by-Step Setup (5 minutes)

### 1. Apply Database Migration
- [ ] Go to [Supabase Dashboard](https://supabase.com/dashboard)
- [ ] Navigate to: SQL Editor
- [ ] Open file: `migrations/add-last-scraped-at.sql`
- [ ] Copy contents, paste in SQL Editor
- [ ] Click "Run"
- [ ] ✅ Should see: "Success. No rows returned"

### 2. Test Systems
```bash
# Test health report
npm run health:report

# Expected: See system status with sections:
# - Database Health
# - GOD Score Distribution
# - Data Quality
# - Scraper Health
# - Match Quality
# - System Errors

# Test data refresh
npm run data:refresh

# Expected: See refresh targets summary
```

### 3. Schedule Automation
```bash
# Open crontab editor
crontab -e

# Press 'i' to enter insert mode, paste these 3 lines:
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && npm run health:report >> logs/health-report.log 2>&1
0 2 * * * cd /Users/leguplabs/Desktop/hot-honey && npm run data:refresh >> logs/data-refresh.log 2>&1
0 3 * * 0 cd /Users/leguplabs/Desktop/hot-honey && npm run data:refresh:full >> logs/data-refresh.log 2>&1

# Press ESC, then type :wq and press ENTER to save
```

### 4. Start Scrapers (if not running)
```bash
pm2 start ecosystem.config.js
pm2 status
pm2 logs
```

### 5. Verify Everything Works
- [ ] Check reports directory exists: `ls -lh reports/`
- [ ] Check logs directory exists: `ls -lh logs/`
- [ ] View latest health report: `cat reports/daily-health-report-*.json | jq`
- [ ] Verify cron jobs scheduled: `crontab -l`

---

## Expected First Health Report

```
📊 DAILY SYSTEM HEALTH REPORT

✅ WORKING:
  ✅ Database: Healthy startup count (7,003)
  ✅ Data Quality: Good website coverage (99%)
  ✅ Matches: Good average quality (70.76)
  ✅ System: No errors

⚠️ NEEDS ADJUSTMENT:
  ⚠️ Scores: Avg 68.59 outside target range
  ⚠️ Data Quality: Low traction data (<10%)

❌ NEEDS FIXING:
  ❌ Scrapers: No activity in 24h
```

**If you see this → Everything is working! ✅**

---

## Troubleshooting

**Issue:** "npm run health:report" shows errors
```bash
# Solution: Check Supabase credentials
cat .env | grep SUPABASE
# Should see: VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY
```

**Issue:** "npm run data:refresh" says "0 targets"
```bash
# Solution: Database migration not applied
# Go back to Step 1 and apply migration
```

**Issue:** Cron jobs not running
```bash
# Check cron is working
crontab -l

# Check logs
tail -f logs/health-report.log
tail -f logs/data-refresh.log
```

---

## Daily Workflow

### Morning (9 AM - automatic)
1. Health report runs automatically
2. Check your email/Slack (if configured)
3. Review `reports/daily-health-report-YYYY-MM-DD.json`

### Look For:
- ✅ "WORKING" items (good!)
- ⚠️ "NEEDS ADJUSTMENT" items (monitor)
- ❌ "NEEDS FIXING" items (take action)

### Common Actions:
- **Score average out of range?** → Run recalculation: `npx tsx scripts/recalculate-scores.ts`
- **Scrapers inactive?** → Restart PM2: `pm2 restart all`
- **Low data quality?** → Run full refresh: `npm run data:refresh:full`

---

## Files to Monitor

```bash
# Health reports (daily)
reports/daily-health-report-*.json

# Automation logs (daily)
logs/health-report.log
logs/data-refresh.log

# Database logs (check for issues)
# Query: SELECT * FROM ai_logs WHERE log_type IN ('daily_health_report', 'data_refresh') ORDER BY created_at DESC;
```

---

## Success Metrics

### Week 1
- [ ] 7 daily health reports generated
- [ ] 350+ startups refreshed (50/day)
- [ ] No critical alerts
- [ ] Score average trending toward 45-65

### Month 1
- [ ] 30 daily health reports
- [ ] All sparse-data startups refreshed
- [ ] Traction data coverage > 10%
- [ ] Score distribution stabilized
- [ ] System running autonomously

---

## Quick Commands

```bash
# View latest health report
npm run health:report

# Refresh data
npm run data:refresh

# Check score distribution
npm run guards:check

# View logs
tail -f logs/health-report.log
tail -f logs/data-refresh.log

# View reports
ls -lh reports/
cat reports/daily-health-report-*.json | jq .summary
```

---

**Complete this checklist and you're done! ✅**

**Next:** Check back tomorrow at 9 AM for your first automated health report.
