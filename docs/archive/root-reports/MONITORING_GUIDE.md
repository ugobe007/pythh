# Hot Match Monitoring & Prevention Guide

## 🚨 What Happened
The scrapers stopped running on Dec 14 (7 days ago) and no one was alerted because:
1. **System Guardian was stopped** (crashed after 70 restarts)
2. **No external alerting** - alerts only went to console logs
3. **No daily health digest** - no one checked system status

## ✅ Prevention Measures Implemented

### 1. Daily Health Email/Slack Alert
**File:** `scripts/daily-health-email.js`

This runs **independently** of PM2 processes and sends alerts for:
- 🔴 Scrapers not running
- 🔴 System Guardian down
- ⚠️ No discoveries in 24h
- ⚠️ GOD scores below threshold
- ⚠️ Low inference coverage

**Email alerts going to:** ugobe07@gmail.com

**Setup Slack Alerts:**
```bash
# Add to .env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. Cron Job (Backup to PM2)
Daily health check runs at 9 AM via system cron (independent of PM2).

### 3. User-Facing Trust Features
**New components added to build user confidence:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `DataQualityBadge` | Header area | Shows "Data Fresh" with last update time |
| `MatchConfidenceBadge` | Match score | Shows confidence level (High/Good/Low) |
| Data banner | Top of page | Alerts users if data is updating |

These show users:
- ✅ When data was last updated
- ✅ How confident we are in each match
- ✅ Transparent reasons for match scores

### 2. Cron Job (Backup to PM2)
Add to your Mac's crontab (runs even if PM2 is down):
```bash
crontab -e
```

Add these lines:
```cron
# Daily health check at 9 AM
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && /usr/local/bin/node scripts/daily-health-email.js >> /tmp/hot-match-health.log 2>&1

# Restart scrapers if down (every 4 hours)
0 */4 * * * cd /Users/leguplabs/Desktop/hot-honey && pm2 restart rss-scraper scraper --silent 2>/dev/null || true
```

### 3. Quick Health Check Command
Run anytime to check system status:
```bash
node scripts/daily-health-email.js
```

### 4. PM2 Auto-Restart on Reboot
```bash
pm2 startup
pm2 save
```

## 🔧 Manual Recovery Commands

### When scrapers stop:
```bash
pm2 restart rss-scraper scraper
pm2 logs rss-scraper --lines 20
```

### When GOD scores are low:
```bash
# First backfill inference data
node scripts/backfill-inference-data.js

# Then recalculate scores
npx tsx scripts/recalculate-scores.ts
```

### When System Guardian crashes:
```bash
pm2 restart system-guardian
pm2 logs system-guardian --lines 20
```

### Full system restart:
```bash
pm2 restart all
pm2 save
```

## 📊 Health Dashboard
Visit: `http://localhost:5173/admin/health`

## 🎯 Key Metrics to Watch

| Metric | Healthy Range | Alert Threshold |
|--------|---------------|-----------------|
| Discoveries/day | 10+ | < 5 |
| GOD Score avg | 55-75 | < 45 |
| Inference coverage | 50%+ | < 10% |
| Match count | 100k+ | < 5000 |
| Scraper restarts | < 10 | > 50 |

## 📱 Slack Channel Setup (Recommended)

1. Create a Slack channel: `#hot-match-alerts`
2. Add a webhook: Slack > Apps > Incoming Webhooks > Add
3. Copy webhook URL to `.env`:
   ```
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ```

This ensures you get alerts on your phone even when not at your computer.

---

*Created: December 21, 2025*
