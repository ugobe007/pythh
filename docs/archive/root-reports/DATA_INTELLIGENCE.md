# 🕷️ Hot Honey Data Intelligence System

## Overview

The Data Intelligence system automatically crawls multiple sources to track:
- 💰 Funding announcements
- 🚀 New startups
- 💼 Investor activity
- 🔥 Hot deals and trending news

Daily reports aggregate this data with insights, trends, and key metrics.

---

## Features

### Data Sources

1. **TechCrunch** - Funding announcements and startup news
2. **VentureBeat** - Tech industry trends and deals
3. **Y Combinator** - Latest batch companies
4. **Product Hunt** - Trending products and startups
5. **SEC EDGAR** - Form D filings (private offerings)
6. **AngelList/Wellfound** - Startups raising and hiring
7. **Crunchbase** (requires API key) - Comprehensive startup data
8. **PitchBook** (requires subscription) - VC deal flow

### Automated Tracking

- **Funding Rounds**: Amount, investors, round type, valuation
- **Startup Discovery**: New companies, industries, team backgrounds
- **Investor Activity**: Recent investments, portfolio changes
- **Hot Deals**: Trending acquisitions, IPOs, major news

### Daily Reports Include

- 📊 Key metrics (total funding, deal count, etc.)
- 💡 AI-generated insights
- 📈 Trending industries
- 🏆 Most active investors
- 💵 Average round sizes by stage
- 🔥 Hot deals ranked by significance

---

## Setup

### 1. Database Setup

Run the SQL migration in your Supabase dashboard:

```bash
# Navigate to your Supabase project
# Go to: SQL Editor → New Query
# Copy and paste the contents of: database/data_intelligence_tables.sql
# Click "Run"
```

This creates:
- `funding_data` table
- `crawled_startups` table
- `investor_data` table
- `hot_deals` table
- `daily_reports` table

### 2. Optional: Add API Keys

For enhanced data quality, add these to your `.env`:

```bash
# Optional: Crunchbase API (paid)
VITE_CRUNCHBASE_API_KEY=your_key_here

# Optional: Product Hunt API
VITE_PRODUCT_HUNT_API_KEY=your_key_here

# Optional: Twitter API (for funding announcements)
VITE_TWITTER_API_KEY=your_key_here
```

### 3. Access the Dashboard

Navigate to: **https://yourdomain.com/data-intelligence**

Or from Admin Dashboard → "📊 Data Intelligence" button

---

## Usage

### Running Crawlers

1. Click **"🚀 Run All Crawlers"**
2. Wait for crawlers to complete (usually 30-60 seconds)
3. Review results showing items found per source

### Generating Reports

1. After crawlers finish, click **"📊 Generate Report"**
2. View the compiled daily report with all metrics
3. Reports are saved and accessible anytime

### Manual Mode

- **Run Crawlers**: Fetch latest data on-demand
- **Generate Report**: Create report from existing data
- **Refresh**: Reload the latest saved report

---

## Architecture

### Crawler System

```
BaseCrawler (abstract class)
├── TechCrunchFundingCrawler
├── VentureBeatCrawler
├── YCombinatorCrawler
├── ProductHuntCrawler
├── VCActivityCrawler
├── HotDealsAggregator
├── AngelListCrawler
├── SECEdgarCrawler
├── CrunchbaseCrawler
└── PitchBookCrawler
```

### Data Flow

```
1. Orchestrator runs crawlers in parallel
2. Each crawler fetches & parses data
3. Data saved to Supabase tables
4. Report generator aggregates data
5. Insights generated with analysis
6. Daily report saved and displayed
```

---

## Scheduling (Production)

### Option 1: Supabase Edge Functions

Create a scheduled Edge Function to run crawlers daily:

```typescript
// supabase/functions/daily-crawl/index.ts
import { CrawlerOrchestrator } from './orchestrator.ts';

Deno.serve(async (req) => {
  const orchestrator = new CrawlerOrchestrator();
  
  // Run crawlers
  await orchestrator.runAllCrawlers();
  
  // Generate report
  await orchestrator.generateDailyReport();
  
  return new Response('Daily crawl completed', { status: 200 });
});
```

Schedule with cron:
```bash
# Run daily at 6 AM UTC
*/0 6 * * * # Daily at 6 AM
```

### Option 2: GitHub Actions

```yaml
# .github/workflows/daily-crawl.yml
name: Daily Data Crawl
on:
  schedule:
    - cron: '0 6 * * *' # Daily at 6 AM UTC
  workflow_dispatch: # Manual trigger

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run crawl
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_KEY }}
```

### Option 3: Vercel Cron Jobs

```typescript
// api/cron/daily-crawl.ts
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Verify cron secret
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Run crawlers...
  
  return new Response('Success', { status: 200 });
}
```

Then configure in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/daily-crawl",
    "schedule": "0 6 * * *"
  }]
}
```

---

## Extending the System

### Adding a New Crawler

1. **Create crawler class**:

```typescript
import { BaseCrawler, CrawlerResult } from './types';

export class MyNewCrawler extends BaseCrawler {
  constructor() {
    super('My Source', 'https://example.com');
  }

  async crawl(): Promise<CrawlerResult> {
    const crawledAt = new Date().toISOString();
    
    // Your scraping logic here
    const data = await this.scrapeData();
    
    return {
      success: true,
      dataType: 'funding',
      itemsFound: data.length,
      data,
      crawledAt
    };
  }

  private async scrapeData() {
    // Implementation
    return [];
  }
}
```

2. **Add to orchestrator**:

```typescript
// In orchestrator.ts constructor
this.crawlers = [
  // ... existing crawlers
  new MyNewCrawler()
];
```

### Adding Custom Insights

Extend the `generateInsights()` method in `orchestrator.ts`:

```typescript
private generateInsights(...): string[] {
  const insights: string[] = [];
  
  // Add your custom insight logic
  if (someCondition) {
    insights.push('💡 Your custom insight here');
  }
  
  return insights;
}
```

---

## Best Practices

### Rate Limiting

- Add delays between requests: `await this.delay(1000)`
- Respect `robots.txt` files
- Use exponential backoff for retries

### Error Handling

```typescript
try {
  const result = await this.fetchData();
} catch (error) {
  return {
    success: false,
    error: error.message,
    data: [],
    // ...
  };
}
```

### Data Quality

- Validate amounts: `this.extractAmount(text)`
- Sanitize text: `this.sanitizeText(text)`
- Deduplicate: Check for existing records

---

## Monitoring

### Check Crawler Health

```sql
-- Recent crawl activity
SELECT 
  DATE(crawled_at) as date,
  COUNT(*) as items_crawled
FROM funding_data
GROUP BY DATE(crawled_at)
ORDER BY date DESC
LIMIT 7;
```

### Report Generation Status

```sql
-- Latest reports
SELECT 
  date,
  generated_at,
  total_funding_announcements,
  total_funding_amount
FROM daily_reports
ORDER BY date DESC
LIMIT 10;
```

---

## Troubleshooting

### Crawlers Not Finding Data

1. Check source website structure hasn't changed
2. Verify API keys if using paid services
3. Check Supabase RLS policies allow inserts
4. Review browser console for errors

### Reports Not Generating

1. Ensure crawlers have run recently
2. Check database tables have data
3. Verify admin permissions
4. Look for errors in console

### Performance Issues

1. Add indexes to database tables
2. Reduce crawler frequency
3. Limit parallel crawler count
4. Implement data archiving

---

## Roadmap

### Planned Features

- [ ] Email digest of daily reports
- [ ] Slack/Discord notifications for hot deals
- [ ] Machine learning for trend prediction
- [ ] Custom alert rules (e.g., "notify me of $50M+ rounds")
- [ ] Integration with Zapier/Make
- [ ] Export reports to PDF
- [ ] API for external access
- [ ] Real-time websocket updates

### Potential Data Sources

- LinkedIn company updates
- Reddit r/startups
- Indie Hackers
- Hacker News "Show HN"
- Twitter #vc hashtag
- Startup job boards

---

## Support

For issues or questions:
1. Check console logs
2. Review Supabase logs
3. Test crawlers individually
4. Open GitHub issue with details

---

## License

Part of Hot Money Honey platform. All rights reserved.
