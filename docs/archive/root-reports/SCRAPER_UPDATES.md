# ✅ Scraper Updates Complete

## 1. RSS Feed Testing ✅

### Sequoia Capital - Medium
- **Status**: ✅ Working
- **URL**: https://sequoia.medium.com/feed
- **Items**: 10 items found
- **Action**: Will be automatically processed by `simple-rss-scraper.js`

### a16z - News Content
- **Status**: ❌ 404 Error
- **Tried URLs**:
  - https://a16z.com/feed/ (404)
  - https://a16z.com/rss/ (needs testing)
  - https://a16z.com/feed.xml (needs testing)
  - https://www.a16z.com/feed/ (needs testing)
- **Action**: Need to find correct RSS feed URL or use web scraping

## 2. New Scrapers Created ✅

### YC Company Directory Scraper (`yc-companies-scraper.js`)
- **Purpose**: Scrapes Y Combinator company directory pages
- **URLs**:
  - All companies: https://www.ycombinator.com/companies
  - Summer 2025 batch: https://www.ycombinator.com/companies?batch=Summer%202025
  - Collaboration industry: https://www.ycombinator.com/companies/industry/collaboration
- **Features**:
  - Uses Playwright for dynamic content
  - Claude AI for extraction
  - Saves to `discovered_startups` table
  - Deduplication built-in

### Sequoia Capital Scraper (`sequoia-scraper.js`)
- **Purpose**: Scrapes Sequoia Capital stories and news pages
- **URLs**:
  - Stories: https://sequoiacap.com/stories/
  - News: https://sequoiacap.com/stories/?_story-category=news
- **Features**:
  - Extracts portfolio companies
  - Captures funding information
  - Saves to `discovered_startups` table

### HAX Accelerator Scraper (`hax-scraper.js`)
- **Purpose**: Scrapes HAX accelerator portfolio
- **URL**: https://hax.co/startups/
- **Features**:
  - Hardware-focused startup extraction
  - Saves to `discovered_startups` table

## 3. Unified Orchestrator Updated ✅

The `unified-scraper-orchestrator.js` now includes:
- `yc-companies-scraper.js` in discovery phase
- `sequoia-scraper.js` in discovery phase
- `hax-scraper.js` in discovery phase

All new scrapers will run automatically when you execute:
```bash
node unified-scraper-orchestrator.js
```

## 4. Usage

### Run Individual Scrapers
```bash
# YC Companies
node yc-companies-scraper.js

# Sequoia Capital
node sequoia-scraper.js

# HAX Accelerator
node hax-scraper.js
```

### Run All Scrapers (via Orchestrator)
```bash
node unified-scraper-orchestrator.js
```

### Run in Daemon Mode
```bash
pm2 start unified-scraper-orchestrator.js --name scraper-orchestrator -- --daemon
```

## 5. Data Flow

All scrapers save to `discovered_startups` table:
- `name`: Company name
- `description`: Company description
- `website`: Company website URL
- `sectors`: Array of sectors/industries
- `rss_source`: Source identifier (e.g., "Y Combinator Directory")
- `article_url`: Source page URL
- `article_title`: Title for the discovery
- `discovered_at`: Timestamp

From there, the data flows through:
1. **Inference Engine** → Enriches missing data
2. **GOD Scoring** → Calculates quality scores
3. **Auto-Import Pipeline** → Promotes quality startups to `startup_uploads`
4. **Matching Engine** → Generates investor matches

## 6. Next Steps

1. **Test the scrapers**:
   ```bash
   node yc-companies-scraper.js
   node sequoia-scraper.js
   node hax-scraper.js
   ```

2. **Find correct a16z RSS feed** or create web scraper for a16z.com/news-content/

3. **Monitor results** in `discovered_startups` table

4. **Run full pipeline**:
   ```bash
   node unified-scraper-orchestrator.js
   ```

## 7. Notes

- All scrapers use Claude AI (claude-sonnet-4-20250514) for extraction
- Rate limiting: 3-second delays between pages
- Error handling: Graceful failures, continues with other sources
- Deduplication: Prevents duplicate entries


