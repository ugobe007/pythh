# 🤖 Automation Status Guide

## ❓ **Does the Scraper Run Automatically?**

**Answer**: **It CAN, but it needs to be started first!**

---

## 📊 **Current Status**

The RSS scraper **does NOT** currently run automatically. You need to:

1. **Start the autopilot daemon** (recommended)
2. **Or run manually** when you want to scrape

---

## 🚀 **How to Set Up Automatic Daily Runs**

### **Option 1: Autopilot Daemon (Recommended)**

This runs the RSS scraper **every 30 minutes** automatically:

```bash
# Start autopilot in daemon mode
npm run pipeline:daemon
```

**What it does:**
- ✅ RSS scraping: **Every 30 minutes**
- ✅ Data enrichment: Every 1 hour
- ✅ GOD scoring: Every 2 hours
- ✅ Match generation: Every 4 hours
- ✅ Social signals: Weekly (Sunday 2-3 AM)
- ✅ Full recalculation: Weekly (Sunday 3-4 AM)

**Keep it running:**
- Runs continuously while your computer is on
- Checks every 5 minutes for scheduled tasks
- Runs full pipeline on startup

---

### **Option 2: PM2 (Best for Production)**

PM2 keeps it running even after restart:

```bash
# Install PM2 (if not installed)
npm install -g pm2

# Start autopilot with PM2
pm2 start npm --name "hot-match-autopilot" -- run pipeline:daemon

# Save PM2 config (so it persists)
pm2 save

# Auto-start on reboot
pm2 startup
```

**Benefits:**
- ✅ Runs in background
- ✅ Auto-restarts if it crashes
- ✅ Survives computer restart
- ✅ Can view logs: `pm2 logs hot-match-autopilot`

---

### **Option 3: Cron Job (Simple Daily Run)**

Run the RSS scraper once per day at a specific time:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 9 AM)
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && node scripts/core/simple-rss-scraper.js >> logs/rss-scraper.log 2>&1
```

**Or for full pipeline daily:**
```bash
# Runs full pipeline daily at 9 AM
0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && npm run pipeline >> logs/pipeline.log 2>&1
```

---

## 📅 **Current Schedule (if Daemon is Running)**

| Task | Frequency | Interval |
|------|-----------|----------|
| **RSS Scraping** | **Every 30 min** | 30 minutes |
| Data Enrichment | Every 1 hour | 60 minutes |
| GOD Scoring | Every 2 hours | 120 minutes |
| Match Generation | Every 4 hours | 240 minutes |
| Social Signals | Weekly | Sunday 2-3 AM |
| Full Recalculation | Weekly | Sunday 3-4 AM |
| Daily Health Report | Daily | 9:00 AM (if cron set up) |

---

## ✅ **Check if Automation is Running**

### **Check for Autopilot Process:**
```bash
ps aux | grep -i "autopilot\|hot-match\|pipeline" | grep -v grep
```

### **Check PM2 Status:**
```bash
pm2 list
```

### **Check Recent Activity:**
```bash
# Check when RSS sources were last scraped
node scripts/check-rss-sources.js

# Check recent discovered startups
# (Query Supabase for startups discovered in last 24h)
```

---

## 🔧 **Quick Start (Recommended)**

### **Start Autopilot Now:**
```bash
# Option 1: Direct run (runs in foreground)
npm run pipeline:daemon

# Option 2: Background with PM2 (keeps running)
pm2 start npm --name "hot-match-autopilot" -- run pipeline:daemon
pm2 save
```

---

## 📊 **What Happens When Running**

### **Every 30 Minutes:**
- ✅ Scrapes all active RSS sources (84 sources)
- ✅ Extracts company names from articles
- ✅ Saves to `discovered_startups` table
- ✅ Auto-imports high-confidence discoveries

### **Expected Results:**
- **Per Run**: 10-50 new startups discovered
- **Daily**: 480-2,400 startups discovered
- **Weekly**: 3,360-16,800 startups discovered

---

## ⚠️ **Current Situation**

**The scraper is NOT running automatically right now.**

To enable automatic daily runs, you need to:

1. **Start the daemon**:
   ```bash
   npm run pipeline:daemon
   ```

2. **Or set up PM2** (recommended for always-on):
   ```bash
   pm2 start npm --name "hot-match-autopilot" -- run pipeline:daemon
   pm2 save
   ```

3. **Or set up cron** (for once-daily runs):
   ```bash
   crontab -e
   # Add: 0 9 * * * cd /Users/leguplabs/Desktop/hot-honey && npm run scrape
   ```

---

## 🎯 **Recommendation**

**Use PM2** for best results:
- Keeps running in background
- Auto-restarts if it crashes
- Survives computer restart
- Easy to monitor with `pm2 logs`

**Quick setup:**
```bash
pm2 start npm --name "hot-match-autopilot" -- run pipeline:daemon
pm2 save
pm2 startup
```

**Then check it's working:**
```bash
pm2 logs hot-match-autopilot
# Should see: "Starting autopilot in daemon mode..."
# And periodic runs every 30 minutes
```

---

**Ready to automate?** Run the PM2 command above! 🚀

