# Startup Discovery - Quick Reference

## Currently Running Scrapers

### ✅ Working
- **startup-scraper** (PM2 #4): Scraping sample-startups.txt (30 AI/SaaS companies)
- **batch-scraper** (PM2 #3): Scraping 107 VC/investor websites

### ❌ Broken
- **rss-scraper** (PM2 #2): RSS feeds are malformed/broken
  - TechCrunch, VentureBeat, etc. have invalid XML
  - 0 startups discovered
  - 0 articles found

## What's Working

**Startup Discovery:**
- ✅ Direct URL scraping with intelligent-scraper.js
- ✅ OpenAI GPT-4 extraction of company info
- ✅ Automatic duplicate detection

**Current Progress:**
- 30 AI/SaaS startups being scraped from sample-startups.txt
- Expected completion: 15 minutes
- Expected additions: 25-30 new startups

## What's NOT Working

**RSS Discovery:**
- ❌ RSS feeds broken (malformed XML, 403 errors, etc.)
- ❌ 0 discovered_startups found via RSS
- ❌ 0 active RSS sources

## Recommendations

### Option 1: Add More Startup URL Lists (RECOMMENDED)
Create files like sample-startups.txt with direct company URLs:
- Y Combinator portfolio (https://ycombinator.com/companies)
- Techstars portfolio
- Product Hunt top products
- Crunchbase trending startups

### Option 2: Fix RSS Sources
Replace broken RSS feeds with working ones:
- TechCrunch API instead of RSS
- Crunchbase API (requires key)
- Product Hunt API

### Option 3: Scrape Startup Databases
Use intelligent-scraper.js on:
- https://www.ycombinator.com/companies
- https://www.producthunt.com/
- https://wellfound.com/discover

## Commands

### Check Progress
```bash
pm2 logs startup-scraper --lines 20
pm2 logs batch-scraper --lines 20
```

### Add More Startups
```bash
# Create new-startups.txt with URLs
pm2 start bulk-scrape-startups.js --name "startup-scraper-2" -- new-startups.txt
```

### Check Database
```bash
node -e "const {createClient} = require('@supabase/supabase-js'); const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); supabase.from('startup_uploads').select('name, status').then(r => console.log('Total:', r.data.length, 'Approved:', r.data.filter(s => s.status === 'approved').length))"
```
