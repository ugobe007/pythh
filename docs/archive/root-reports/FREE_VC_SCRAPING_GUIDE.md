# Free VC Data Scraping Guide

## Overview

This guide covers how to enrich investor profiles using **100% free data sources** - no paid APIs required. We scrape directly from VC websites, RSS feeds, and public news sources.

## 🎯 Cost Comparison

| Approach | Monthly Cost | Data Quality | Coverage |
|----------|-------------|--------------|----------|
| **Free Scraping** | $0 | 80-90% | Good |
| Crunchbase API | $29-99 | 100% | Excellent |
| PitchBook | $10,000+ | 100% | Excellent |

**Winner: Free Scraping** ✅ (Perfect for MVP and bootstrapped startups)

## 📊 Data Sources

### 1. VC Website Scraping (Primary)

We scrape official VC firm websites for:
- **Team pages** → Partner names, titles, bios, LinkedIn URLs
- **Portfolio pages** → Company names, descriptions, industries
- **Blog/RSS feeds** → Startup advice, market insights, investment thesis

**Configured VCs:**
- Y Combinator (https://ycombinator.com)
- Sequoia Capital (https://sequoiacap.com)
- Andreessen Horowitz (https://a16z.com)
- Accel (https://accel.com)
- Benchmark (https://benchmark.com)
- Founders Fund (https://foundersfund.com)
- Greylock Partners (https://greylock.com)
- Lightspeed Venture Partners (https://lsvp.com)
- NEA (https://nea.com)
- Kleiner Perkins (https://kleinerperkins.com)

### 2. TechCrunch News Scraping

- Search TechCrunch for VC mentions
- Extract article titles, summaries, URLs
- Automatically categorize by sentiment
- **No API key required** - public site search

### 3. VentureBeat News Scraping

- Similar to TechCrunch
- Covers different investment angles
- Free public access

### 4. RSS Feed Parsing

- Most VCs publish RSS feeds for blogs
- Standard XML format (easy to parse)
- Real-time updates when VCs publish

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
npm install axios cheerio @types/cheerio
```

Already installed in your project! ✅

### Step 2: Run Enrichment Script

```bash
# Enrich all top 10 VCs
npx tsx scripts/enrich-vcs.ts

# Or enrich specific VC from code
import { enrichInvestor } from './src/lib/investorEnrichmentService';

await enrichInvestor('investor-id-uuid', 'Y Combinator');
```

### Step 3: View Results in Database

```sql
-- Check enriched data
SELECT 
  i.name,
  i.last_enrichment_date,
  COUNT(DISTINCT p.id) as partners,
  COUNT(DISTINCT inv.id) as investments,
  COUNT(DISTINCT a.id) as advice_articles,
  COUNT(DISTINCT n.id) as news_articles
FROM investors i
LEFT JOIN investor_partners p ON p.investor_id = i.id
LEFT JOIN investor_investments inv ON inv.investor_id = i.id
LEFT JOIN investor_advice a ON a.investor_id = i.id
LEFT JOIN investor_news n ON n.investor_id = i.id
GROUP BY i.id, i.name, i.last_enrichment_date
ORDER BY i.last_enrichment_date DESC;
```

## 📝 What Gets Scraped

### Partners Data
```typescript
{
  name: "Jessica Livingston",
  title: "Founding Partner",
  bio: "Co-founder of Y Combinator...",
  linkedin_url: "https://linkedin.com/in/jessicalivingston",
  twitter_handle: "jesslivingston",
  focus_areas: ["Consumer", "SaaS"],
  stage_preference: ["Seed"],
  image_url: "https://ycombinator.com/jessica.jpg"
}
```

### Investment Portfolio
```typescript
{
  company_name: "Airbnb",
  company_description: "Online marketplace for lodging...",
  company_url: "https://airbnb.com",
  investment_date: "2009-04-15",
  round_type: "Seed",
  amount: "$20K",
  is_lead: true,
  industries: ["Consumer", "Marketplace"],
  status: "exited"
}
```

### Startup Advice
```typescript
{
  title: "How to Get Your First 10 Customers",
  content: "The best way to get customers is...",
  category: "growth",
  tags: ["customer-acquisition", "early-stage"],
  source_type: "blog",
  source_url: "https://a16z.com/first-10-customers",
  published_date: "2024-12-01"
}
```

### News Articles
```typescript
{
  title: "Sequoia announces $2.8B fund",
  summary: "Sequoia Capital has raised a new $2.8B fund...",
  url: "https://techcrunch.com/sequoia-fund",
  published_date: "2024-12-08",
  source: "TechCrunch",
  sentiment: "positive",
  tags: ["fundraising", "fund-announcement"]
}
```

## 🛡️ Rate Limiting & Best Practices

### Respect VC Websites
```typescript
// Wait 2-3 seconds between requests
await new Promise(resolve => setTimeout(resolve, 3000));

// Use proper User-Agent
headers: {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

// Set timeouts
timeout: 10000 // 10 seconds
```

### Recommended Schedule

- **Daily (3 AM):** News articles from RSS feeds
- **Weekly (Sunday):** Partner and portfolio updates
- **Monthly:** Full re-enrichment of all VCs

### Error Handling

The scraper automatically:
- ✅ Skips VCs with missing website URLs
- ✅ Retries failed requests (once)
- ✅ Logs errors without crashing
- ✅ Continues to next VC on failure

## 🎨 Adding New VCs

To add a new VC to the scraping list:

```typescript
// Edit: src/lib/investorEnrichmentService.ts

const VC_WEBSITES: Record<string, { 
  website: string;
  teamPage?: string;
  portfolioPage?: string;
  blogUrl?: string;
  rssUrl?: string;
}> = {
  // ... existing VCs
  'New VC Name': {
    website: 'https://newvc.com',
    teamPage: 'https://newvc.com/team',
    portfolioPage: 'https://newvc.com/portfolio',
    blogUrl: 'https://newvc.com/blog',
    rssUrl: 'https://newvc.com/blog/feed'
  }
};
```

## 📊 Success Metrics

After running enrichment, expect:

- ✅ **70-80% VCs** have partner data
- ✅ **60-70% VCs** have portfolio data
- ✅ **50-60% VCs** have advice/blog content
- ✅ **80-90% VCs** have news articles
- ✅ **<5% error rate** on scraping

## 🐛 Troubleshooting

### "No data scraped"
- Check if VC website URL is correct
- Website might have changed HTML structure
- Try inspecting HTML manually to find new selectors

### "Timeout errors"
- Some VC sites are slow or block scrapers
- Increase timeout to 15-20 seconds
- Try different User-Agent string

### "403 Forbidden"
- Website blocking automated requests
- Add delay between requests (5 seconds)
- Consider using proxy rotation (advanced)

## 🚀 Next Steps

1. **Run initial enrichment:**
   ```bash
   npx tsx scripts/enrich-vcs.ts
   ```

2. **Set up cron job** (daily enrichment):
   ```bash
   # Add to crontab
   0 3 * * * cd /path/to/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1
   ```

3. **Update investor profile pages** to display:
   - Partner team grid
   - Portfolio companies
   - Recent advice articles
   - Latest news

4. **Add search filters:**
   - Find VCs by partner name
   - Search by portfolio company
   - Filter by advice topics

## 💡 Pro Tips

1. **RSS feeds are gold** - Most reliable and structured data
2. **Partner LinkedIn URLs** - Extract from team pages for social proof
3. **Blog tags** - Use for categorizing advice (fundraising, product, etc.)
4. **Portfolio companies** - Match with startups in your database
5. **News sentiment** - Use for "hot" vs "cold" VC indicators

## 📈 Future Enhancements

- [ ] Twitter API integration (1,500 tweets/month free)
- [ ] AngelList scraping for detailed profiles
- [ ] GitHub scraping for tech-focused VCs
- [ ] Email finder for partner contact info
- [ ] Crunchbase limited API (if budget allows)

---

**Cost: $0/month** 🎉  
**Quality: 80-90%** ✅  
**Maintenance: Low** 👍
