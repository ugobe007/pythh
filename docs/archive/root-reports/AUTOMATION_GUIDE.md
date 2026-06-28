# 🤖 AUTOMATION GUIDE

Complete automation setup for Hot Match systems.

## Quick Start

```bash
# Option 1: Simple background process
node automation-engine.js &

# Option 2: With PM2 (recommended for production)
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on system reboot
```

## What Gets Automated

| Process | Interval | Script |
|---------|----------|--------|
| RSS Scraping | 30 min | `check-rss-articles.js` |
| Startup Discovery | 2 hours | `discover-startups-from-rss.js` |
| Investor Scoring | 6 hours | `calculate-investor-scores-v2.js` |
| News Score Updates | 1 hour | `update-scores-from-news.js` |
| Match Generation | 4 hours | `generate-matches-advanced.js` |
| Health Checks | 15 min | `system-health-check.js` |
| Embedding Generation | 3 hours | `generate-embeddings.ts` |

## Monitoring

```bash
# Check health
node system-health-check.js

# View PM2 status
pm2 status

# View logs
pm2 logs automation-engine
tail -f logs/automation.log

# Monitor dashboard
pm2 monit
```

## Adjusting Intervals

Edit `automation-engine.js` and change the `intervalMinutes` values:

```javascript
const JOBS = {
  rss_scrape: {
    intervalMinutes: 30,  // Change to 15 for more frequent
    // ...
  },
  // ...
};
```

## Manual Override

Run any process manually:

```bash
# Score investors
node calculate-investor-scores-v2.js

# Update from news
node update-scores-from-news.js

# Scrape RSS
node check-rss-articles.js

# Generate matches
node generate-matches-advanced.js
```

## Current System Stats

- **633 investors** (33 elite, 18 strong, 16 solid, 566 emerging)
- **120 startups** in main table
- **589 discovered** startups pending review
- **143 articles** scraped
- **29,286 matches** generated

## Troubleshooting

### Process not running?
```bash
pm2 restart automation-engine
```

### Logs filling up?
```bash
# Clear old logs
pm2 flush
```

### Need to stop?
```bash
pm2 stop automation-engine
# or
pm2 stop all
```
