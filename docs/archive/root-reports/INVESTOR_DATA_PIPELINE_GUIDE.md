# Investor Data Pipeline Guide

## Overview

This guide explains how to populate 65 investors and integrate news feeds for enriched profiles.

## Architecture

```
Your Scraper → Transform Script → Supabase Database → Matching Engine
                                        ↓
                                  News Service
                                        ↓
                              Enriched Profiles
```

## Step 1: Prepare Your Scraper Output

Your scraper should collect investor data from sources like:
- **Crunchbase** - Basic info, portfolio, funding rounds
- **PitchBook** - Investment thesis, check sizes
- **LinkedIn** - Bios, team members
- **Twitter** - Social presence, recent updates
- **Company websites** - Official news, blog posts
- **TechCrunch/VentureBeat** - News articles

### Expected Scraper Output Format

```json
{
  "name": "Benchmark",
  "type": "vc_firm",
  "tagline": "Early-stage venture capital",
  "description": "Full description here...",
  "website": "https://www.benchmark.com",
  "linkedin": "https://linkedin.com/company/benchmark",
  "twitter": "@benchmark",
  "check_size_min": 1000000,
  "check_size_max": 50000000,
  "stage_focus": ["seed", "series_a"],
  "sector_focus": ["Software", "Consumer", "Marketplace"],
  "geography": "North America",
  "portfolio_count": 400,
  "exits": 80,
  "unicorns": 15,
  "notable_investments": ["Uber", "Twitter", "Snapchat"],
  "news_feed_url": "https://www.benchmark.com/news",
  "blog_url": "https://www.benchmark.com/blog",
  "recent_news": [
    {
      "title": "Benchmark announces $1B Fund X",
      "url": "https://www.benchmark.com/fund-x",
      "published_date": "2025-01-15",
      "source": "Benchmark Blog",
      "summary": "New fund focused on..."
    }
  ]
}
```

## Step 2: Run Database Migration

Add news and enrichment capabilities to your database:

```bash
# In Supabase SQL Editor, run:
cat supabase-investor-news-schema.sql
```

This creates:
- ✅ `investor_news` table - Stores scraped news articles
- ✅ `investor_activity` table - Tracks investments, exits, announcements
- ✅ News-related columns in `investors` table
- ✅ `investor_profile_enriched` view - Pre-joined data for fast reads
- ✅ Auto-update triggers for `last_news_update` timestamp

## Step 3: Bulk Import Investors

### Option A: Using the TypeScript Script

```bash
# 1. Export your scraper data to JSON
node your-scraper.js > scraper-output/investors.json

# 2. Update the script to load your data
# Edit scripts/bulk-import-investors.ts line 145:
# const scrapedData = JSON.parse(fs.readFileSync('./scraper-output/investors.json'));

# 3. Run the import
npx tsx scripts/bulk-import-investors.ts
```

### Option B: Using CSV Import (Supabase Dashboard)

```bash
# 1. Convert your scraper output to CSV
# Use the template: investors-bulk-template.csv

# 2. In Supabase Dashboard:
# - Go to Table Editor → investors
# - Click "Insert" → "Import data from CSV"
# - Upload your CSV file
# - Map columns
# - Click "Import"
```

### Option C: Manual SQL Insert (Small Batches)

```sql
-- Run in Supabase SQL Editor
INSERT INTO investors (name, type, tagline, description, website, check_size, stage, sectors, geography, portfolio_count, exits, unicorns, notable_investments) VALUES
('Benchmark', 'vc_firm', 'Early-stage venture capital', 'Full description...', 'https://www.benchmark.com', '$1M - $50M', '["seed", "series_a"]'::jsonb, '["Software", "Consumer"]'::jsonb, 'North America', 400, 80, 15, '["Uber", "Twitter", "Snapchat"]'::jsonb),
('Lightspeed', 'vc_firm', '...', '...', '...', '...', '...'::jsonb, '...'::jsonb, '...', ..., ..., ..., '...'::jsonb);
-- Repeat for all 65 investors
```

## Step 4: Integrate News Scraping

### A. Connect Your Scraper to the News Service

Edit `src/lib/investorNewsService.ts` line 87:

```typescript
async function fetchArticlesFromSources(investorName: string, sources: string[]): Promise<NewsArticle[]> {
  // REPLACE THIS with your actual scraper
  return await yourScraper.fetchNews({
    query: investorName,
    sources: ['techcrunch', 'axios', 'venturebe at'],
    limit: 10,
    since: '7d' // Last 7 days
  });
}
```

### B. Run News Scraping Manually

```typescript
// In your code or Node REPL:
import { scrapeInvestorNews } from './src/lib/investorNewsService';

// Scrape news for one investor
await scrapeInvestorNews('investor-uuid-here', 'Benchmark');

// Or scrape for all investors
import { bulkScrapeAllInvestorNews } from './src/lib/investorNewsService';
await bulkScrapeAllInvestorNews();
```

### C. Automate with Cron Job

```bash
# Option 1: Node-cron (in your app)
npm install node-cron

# In your server code:
import cron from 'node-cron';
import { bulkScrapeAllInvestorNews } from './src/lib/investorNewsService';

// Run daily at 3 AM
cron.schedule('0 3 * * *', async () => {
  console.log('🕐 Running daily news scrape...');
  await bulkScrapeAllInvestorNews();
});
```

```bash
# Option 2: Supabase Edge Function (recommended)
# Create a scheduled function that runs daily
supabase functions new scrape-investor-news

# Deploy it
supabase functions deploy scrape-investor-news

# Schedule it in Supabase Dashboard → Database → Cron Jobs
```

## Step 5: Update Matching Engine to Show News

The matching engine will automatically pull news when displaying investor profiles:

```typescript
// In MatchingEngine.tsx, investor data now includes:
const investor = {
  ...baseInvestorData,
  recent_news: [
    {
      title: "Benchmark leads $50M Series B",
      url: "https://techcrunch.com/...",
      published_date: "2025-01-15",
      source: "TechCrunch"
    }
  ],
  recent_activity: [
    {
      type: "investment",
      title: "Invested in AI startup",
      date: "2025-01-10",
      amount: "$10M"
    }
  ]
};
```

## Step 6: Enrich Investor Profile Pages

Investor profile pages will show:
- ✅ Latest news articles (last 10)
- ✅ Recent investments (last 5)
- ✅ Portfolio updates
- ✅ Team announcements
- ✅ Fund raises

All data is automatically pulled from the `investor_profile_enriched` view!

## Data Flow Diagram

```
┌─────────────────┐
│  Your Scraper   │
│  (Crunchbase,   │
│   PitchBook,    │
│   News APIs)    │
└────────┬────────┘
         │
         │ Extracts investor data
         │ + news articles
         ↓
┌─────────────────┐
│ Transform Script│
│  bulk-import-   │
│  investors.ts   │
└────────┬────────┘
         │
         │ Formats data for Supabase
         ↓
┌─────────────────┐
│   Supabase DB   │
│  ├─investors    │
│  ├─investor_news│
│  └─investor_    │
│    activity     │
└────────┬────────┘
         │
         │ Queries enriched view
         ↓
┌─────────────────┐
│ Matching Engine │
│  Shows:         │
│  • Investor     │
│  • Latest news  │
│  • Activity     │
└─────────────────┘
```

## Example Workflow

1. **Run your scraper** (1x setup):
   ```bash
   node scraper.js --source crunchbase --limit 65 > investors.json
   ```

2. **Import to database** (1x setup):
   ```bash
   npx tsx scripts/bulk-import-investors.ts
   ```

3. **Add news schema** (1x setup):
   ```sql
   -- Run supabase-investor-news-schema.sql in Supabase SQL Editor
   ```

4. **Scrape initial news** (1x setup):
   ```bash
   npx tsx -e "import('./src/lib/investorNewsService').then(m => m.bulkScrapeAllInvestorNews())"
   ```

5. **Set up daily cron** (automated):
   - Scrapes news every day at 3 AM
   - Updates investor profiles automatically
   - Fresh data for matching engine

6. **Done!** Your matching engine now shows:
   - 65 diverse investors
   - Live news feeds
   - Recent activity
   - Enriched profiles

## Testing

After setup, verify everything works:

```bash
# 1. Check investor count
SELECT COUNT(*) FROM investors;
-- Should return: 65

# 2. Check news articles
SELECT COUNT(*) FROM investor_news;
-- Should return: >0

# 3. Check enriched view
SELECT name, recent_news FROM investor_profile_enriched LIMIT 5;
-- Should show investors with news arrays

# 4. Test in matching engine
# Open http://localhost:5173/match
# Click through matches - should see 65 different investors
# Click on investor card - should see news section
```

## Maintenance

### Daily Tasks (Automated via Cron)
- ✅ Scrape latest news for all investors
- ✅ Update investor profiles with new activity
- ✅ Archive old news (>30 days) to keep database lean

### Weekly Tasks (Manual)
- Review news quality (sentiment accuracy)
- Add new investors as they emerge
- Update investor info (new funds, team changes)

### Monthly Tasks
- Analyze which news drives most engagement
- Optimize scraper sources
- Add new data sources

## Troubleshooting

**Q: Only 5 investors showing up?**
A: You haven't run the bulk import yet. Run `npx tsx scripts/bulk-import-investors.ts`

**Q: News not appearing?**
A: Run the news schema migration: `supabase-investor-news-schema.sql`

**Q: Scraper failing?**
A: Check your API keys, rate limits, and source availability

**Q: Duplicate articles?**
A: The schema has UNIQUE constraint on (investor_id, url) - duplicates are automatically prevented

## Files Created

- ✅ `scripts/bulk-import-investors.ts` - Bulk import script
- ✅ `supabase-investor-news-schema.sql` - Database schema
- ✅ `src/lib/investorNewsService.ts` - News scraping service
- ✅ `investors-bulk-template.csv` - CSV template for manual import
- ✅ `INVESTOR_DATA_PIPELINE_GUIDE.md` - This guide

## Next Steps

1. Run your scraper to get 65 investors
2. Run the database migration
3. Import investors using the bulk script
4. Set up daily news scraping
5. Test the matching engine

Questions? The system is designed to integrate seamlessly with your existing scraper!
