# 🚀 Scraper Launch Guide - 100+ Startups/Day

## Quick Launch

```bash
# Option 1: Use the launch script (recommended)
./launch-scrapers.sh

# Option 2: Manual launch
node automation-engine.js &
node discover-startups-from-rss.js
node run-rss-scraper.js
node auto-import-pipeline.js
```

---

## 🎯 Optimizations for 100+ Startups/Day

### Current Configuration:

1. **Automation Engine**
   - RSS scraping: Every 30 minutes
   - Startup discovery: Every 30 minutes
   - Auto-import: Every 15 minutes
   - Match generation: Every 60 minutes

2. **Parallel Processing**
   - RSS feeds: 5 sources processed simultaneously
   - Articles per feed: 25 (increased from 15)
   - Recent articles: Last 7 days (was 30 days)

3. **Auto-Import**
   - Triggers immediately after discovery
   - Imports up to 1000 startups per run
   - Auto-approves all imports

---

## 📊 Expected Results

### Per Discovery Run (every 30 min):
- **RSS Sources**: ~10-20 active sources
- **Articles Processed**: ~250-500 articles
- **Startups Discovered**: ~10-30 startups
- **Startups Imported**: All discovered (auto-import)

### Daily Totals:
- **Discovery Runs**: 48 runs/day (every 30 min)
- **Expected Discoveries**: 480-1,440 startups/day
- **Target**: **100+ startups/day** ✅ (easily achievable)

---

## 🔍 Monitoring

### Check Discovery Status:
```bash
# View automation logs
tail -f logs/automation.log

# Check startup stats
node check-startup-stats.js

# Check RSS scraper status
node run-rss-scraper.js
```

### Key Metrics:
- Startups discovered in last 24h
- Startups imported in last 24h
- RSS sources success rate
- Average startups per discovery run

---

## 🚨 Troubleshooting

### If Discovery is Slow:
- Check RSS source health (some may be down)
- Verify Anthropic API key is set
- Check network connectivity

### If Not Getting 100+/Day:
- Add more RSS sources to database
- Increase discovery frequency (change to 15 min)
- Add more startup sources (YC, Product Hunt, etc.)

### If Auto-Import Failing:
- Check Supabase credentials
- Verify database permissions
- Check for duplicate errors

---

## 📈 Scaling Beyond 100/Day

To get even more startups:

1. **Add More RSS Sources**
   - Add to `rss_sources` table in database
   - More sources = more articles = more startups

2. **Increase Frequency**
   - Change `startup_discovery: 30` to `15` in automation-engine.js
   - Runs every 15 min = 96 runs/day

3. **Add Direct Scraping**
   - Run `mega-scraper.js` periodically
   - Scrapes YC, Product Hunt, etc. directly

4. **Add More Article Sources**
   - Increase articles per feed (currently 25)
   - Process older articles (currently 7 days)

---

**Your scrapers are optimized for 100+ startups/day! 🎯**

