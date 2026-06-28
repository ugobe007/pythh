# 🚀 Scripts to Run Guide

## Quick Start - Essential Scripts

### 1. **Test the Fixed Social Signals Scraper** (Just Fixed!)
```bash
# Test with a specific startup (like Corli)
node scripts/enrichment/social-signals-scraper.js 1

# Run for all approved startups (limit to 10 for testing)
node scripts/enrichment/social-signals-scraper.js 10
```
**What it does**: Scrapes social media (Reddit, Hacker News, Twitter) for startup mentions with improved false positive filtering.

---

## Core Automation Scripts (Main Pipeline)

### 2. **Main Autopilot** (Orchestrates Everything)
```bash
# Start the full automation pipeline
npm run pipeline

# Run as background daemon
npm run pipeline:daemon
```
**What it does**: Runs RSS scraping, startup discovery, enrichment, GOD scoring, and matching automatically.

### 3. **Individual Core Scripts**

```bash
# 1. Scrape new startups from RSS feeds
npm run scrape
# or: node scripts/core/simple-rss-scraper.js

# 2. Calculate GOD scores for startups
npm run score
# or: node scripts/core/god-score-formula.js

# 3. Generate matches (after startups are scored)
npm run match
# or: node scripts/core/queue-processor-v16.js

# 4. Run enrichment (infer missing data)
npm run enrich
# or: node scripts/core/enrichment-orchestrator.js
```

---

## Weekly/Monthly Maintenance Scripts

### 4. **Recalculate Scores** (If scores seem off)
```bash
# Recalculate all GOD scores
node scripts/core/god-score-formula.js

# Or with limit (safer for testing)
node scripts/core/god-score-formula.js --limit 100
```

### 5. **Database Cleanup** (Keep data fresh)
```bash
# Audit what would be cleaned
npm run db:cleanup:audit

# Execute cleanup (removes old/invalid data)
npm run db:cleanup:execute
```

### 6. **Social Signals Collection** (Weekly)
```bash
# Collect social signals for all startups
node scripts/enrichment/social-signals-scraper.js

# Test with a few startups first
node scripts/enrichment/social-signals-scraper.js 5
```

---

## Testing & Debugging Scripts

### 7. **Test Database Connection**
```bash
node scripts/test-db-connection.ts
```

### 8. **Check System Health**
```bash
# Check matching queue status
node scripts/archive/check-queue-status.js

# Check GOD score progress
node scripts/archive/check-god-progress.js
```

---

## Recommended Daily Workflow

```bash
# Morning: Check what's been automated
npm run pipeline:daemon

# Check status
pm2 status

# Manual override if needed:
npm run scrape   # Find new startups
npm run enrich   # Enrich existing startups
npm run score    # Score startups
npm run match    # Generate matches
```

---

## Recommended Weekly Workflow

```bash
# 1. Clean up old data
npm run db:cleanup:audit
npm run db:cleanup:execute

# 2. Collect social signals
node scripts/enrichment/social-signals-scraper.js

# 3. Recalculate scores if needed
node scripts/core/god-score-formula.js --limit 100
```

---

## Production Setup (PM2 - Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start main pipeline as daemon
pm2 start npm --name "hot-match-pipeline" -- run pipeline:daemon

# Save PM2 config
pm2 save

# Auto-start on reboot
pm2 startup

# Monitor
pm2 monit
pm2 logs hot-match-pipeline
```

---

## Quick Reference: NPM Scripts

| Command | What It Does |
|---------|-------------|
| `npm run pipeline` | Full automation pipeline |
| `npm run scrape` | RSS scraping for new startups |
| `npm run score` | Calculate GOD scores |
| `npm run match` | Generate matches |
| `npm run enrich` | Run enrichment |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |

---

## Important Notes

1. **Always test with limits first**: Most scripts accept `--limit N` to test with a small batch
2. **Check logs**: Scripts output progress and errors to console
3. **Rate limiting**: Social signals scraper includes delays to avoid rate limits
4. **Database backups**: Consider backing up before running cleanup scripts

---

## Need Help?

- Check script help: `node script-name.js --help`
- Review logs: Scripts output detailed progress
- Test first: Always test with `--limit` before full runs

