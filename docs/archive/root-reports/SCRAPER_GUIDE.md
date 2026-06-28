# 🕷️ Hot Honey Scraper & Agent Guide

*Last updated: December 21, 2025*

---

## ✅ ACTIVE SCRAPERS (Running in PM2)

| Script | PM2 Process | Schedule | Purpose |
|--------|-------------|----------|---------|
| `continuous-scraper.js` | `rss-scraper` | Always on (30 min cycles) | Fetches RSS feeds |
| `scripts/scraper-manager.js` | `scraper` | Always on | Orchestrates RSS source scraping |
| `discover-startups-from-rss.js` | `rss-discovery` | Every 4h | Extracts startups from articles |

---

## 🔧 MANUAL SCRAPERS (Run when needed)

| Script | Command | Purpose |
|--------|---------|---------|
| `mega-scraper.js` | `node mega-scraper.js` | Bulk scrape startups |
| `investor-mega-scraper.js` | `node investor-mega-scraper.js` | Bulk scrape investors |
| `intelligent-scraper.js` | `node intelligent-scraper.js <url>` | AI-powered deep scraping (needs Anthropic credits) |
| `auto-scrape-all.js` | `node auto-scrape-all.js` | Orchestrator for web page scraping |

---

## 🛡️ MONITORS & AGENTS

| Process | Script | Schedule | Purpose |
|---------|--------|----------|---------|
| `system-guardian` | `system-guardian.js` | Every 10 min | Master health check, auto-healing |
| `watchdog` | `scripts/watchdog.ts` | Every 5 min | Secondary monitor |
| `match-regen` | `match-regenerator.js` | Every 4h | Rebuilds matches if count drops |
| `score-recalc` | `scripts/recalculate-scores.ts` | Every hour | Updates GOD scores |
| `ai-agent` | `scripts/ai-agent.ts` | Every 15 min | AI monitoring (needs Anthropic) |
| `daily-report` | `scripts/daily-report.ts` | Daily 9 AM | Summary report |

---

## 📊 PM2 COMMANDS

```bash
# Check status
pm2 status

# View logs
pm2 logs rss-scraper --lines 50
pm2 logs scraper --lines 50
pm2 logs system-guardian --lines 20

# Restart scrapers
pm2 restart rss-scraper scraper

# Restart all
pm2 restart all

# Run health check manually
node system-guardian.js
```

---

## 🗃️ RSS SOURCES

RSS sources are stored in the `rss_sources` table in Supabase.

**Active sources:** 63  
**Total sources:** 87

---

## ⚠️ TROUBLESHOOTING

### Scrapers not finding new content
- Check `pm2 logs scraper` for errors
- Many 403/404 = RSS URLs need updating
- "Skipped" articles = already in database (normal)

### GOD scores too low
```bash
npx tsx scripts/recalculate-scores.ts
```

### Matches missing
```bash
node match-regenerator.js
```

### Full health check
```bash
node system-guardian.js
```

---

## 🗑️ DEPRECATED FILES (safe to delete)

These are old versions or test files:
- `super-scraper.js`
- `ai-enhanced-scraper.js`  
- `automated-scraper.js`
- `run-rss-scraper.js`
- `run-rss-scraper-enhanced.js`
- `continuous-batch-scraper.js`
- `fresh-investor-scraper.js`
- `fresh-startup-scraper.js`
- `test-rss-scraper.js`
- `test-investor-scraper.js`
- `puppeteer-scraper.js`
- `multimodal-scraper.js`
- `sql-scraper.js`
