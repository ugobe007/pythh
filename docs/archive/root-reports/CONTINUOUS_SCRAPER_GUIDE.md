# Continuous Scraper Guide

## Overview
The continuous scraper automatically discovers startups, enriches VCs, and collects news from RSS feeds 24/7.

## Running the Scraper

### Start in Foreground (for testing)
```bash
npm run scrape
```
This runs the scraper with console output. Press Ctrl+C to stop.

### Start in Background (production)
```bash
npm run scrape:bg
```
This starts the scraper as a background process. Logs are written to `scraper.log`.

### View Logs
```bash
tail -f scraper.log
```
Shows real-time logs. Press Ctrl+C to exit.

### Stop Background Scraper
```bash
# Find the process
ps aux | grep continuous-scraper.js

# Kill by PID
kill <PID>

# Or force kill all
pkill -f continuous-scraper.js
```

## Manual Operations

### Discover Startups Once
```bash
npm run discover
```
Runs startup discovery once without the continuous loop.

### Enrich VCs Once
```bash
npm run enrich:vc
```
Runs VC enrichment once without the continuous loop.

## Scraping Schedule
- **RSS Feeds**: Every 30 minutes
- **Startup Discovery**: Every 1 hour
- **VC Enrichment**: Every 2 hours

## What It Does

### 1. RSS Feed Scraping (30 min)
- Fetches articles from TechCrunch, VentureBeat, Crunchbase News
- Extracts startup mentions using AI
- Saves to `discovered_startups` table

### 2. Startup Discovery (1 hour)
- Analyzes RSS articles for startup details
- Uses OpenAI to extract:
  - Company name
  - Website URL
  - Description
  - Industry/stage
- Stores discoveries for admin review

### 3. VC Enrichment (2 hours)
- Enhances investor profiles with:
  - Investment thesis
  - Portfolio companies
  - Geographic focus
  - Ticket sizes

## Monitoring

### Check if Scraper is Running
```bash
ps aux | grep continuous-scraper.js
```

### View Recent Logs
```bash
tail -n 100 scraper.log
```

### View Discovered Startups
Go to: Admin Panel → Live System Monitor → 📡 RSS Feed

## Troubleshooting

### Scraper Not Starting
1. Check environment variables are set:
   - `VITE_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `VITE_OPENAI_API_KEY`

2. Test discovery script manually:
   ```bash
   npm run discover
   ```

### No Startups Being Discovered
1. Check RSS feeds are working:
   ```bash
   node check-rss-articles.js
   ```

2. Review logs for errors:
   ```bash
   grep ERROR scraper.log
   ```

### Database Connection Issues
1. Verify Supabase credentials
2. Check network connectivity
3. Review RLS policies on `discovered_startups` table

## Admin Workflow

1. **Scraper runs automatically** → Discovers startups
2. **Admin reviews** → /admin/discovered-startups
3. **Select & Import** → Enriches with AI, adds to main database
4. **Review queue** → /admin/edit-startups (manual uploads)
5. **Approve/Reject** → Startups go live or get archived

## Files

- `continuous-scraper.js` - Main scraper with interval loops
- `discover-startups-from-rss.js` - Startup discovery logic
- `enrich-investor-data.ts` - VC enrichment logic
- `scraper.log` - Output logs (when running in background)

## Notes

- Scraper uses graceful shutdown (Ctrl+C stops cleanly)
- Each function has error handling and retry logic
- Logs include timestamps for debugging
- Background mode survives terminal closure
- Use `nohup` for persistence across sessions
