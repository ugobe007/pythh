# ✅ Premium Sources Added

## Successfully Added (6 sources)

### Y Combinator Company Directories
1. **Y Combinator - Summer 2025 Batch**
   - URL: https://www.ycombinator.com/companies?batch=Summer%202025
   - Type: Web scraping required
   - Category: startup_directory

2. **Y Combinator - All Companies**
   - URL: https://www.ycombinator.com/companies
   - Type: Web scraping required
   - Category: startup_directory

3. **Y Combinator - Collaboration Industry**
   - URL: https://www.ycombinator.com/companies/industry/collaboration
   - Type: Web scraping required
   - Category: startup_directory

### Sequoia Capital
4. **Sequoia Capital - Stories**
   - URL: https://sequoiacap.com/stories/
   - Type: Web scraping required
   - Category: vc_blog

5. **Sequoia Capital - News**
   - URL: https://sequoiacap.com/stories/?_story-category=news
   - Type: Web scraping required
   - Category: vc_news

### HAX
6. **HAX - Startups**
   - URL: https://hax.co/startups/
   - Type: Web scraping required
   - Category: startup_directory

## RSS Feeds (Need Manual Addition)

These have RSS feeds but need to be added manually to the `rss_sources` table:

- **Sequoia Capital - Medium**: https://sequoia.medium.com/feed
- **a16z - News Content**: https://a16z.com/feed/

## Next Steps

### 1. For RSS Sources
The RSS scraper (`simple-rss-scraper.js`) will automatically pick up RSS feeds from the `rss_sources` table.

### 2. For Web Scraping Sources
These sources require dedicated scrapers because they're web pages, not RSS feeds:

#### Y Combinator Scraper
- Already exists: `speedrun-yc-scraper.mjs`
- Can be enhanced to scrape company directory pages
- Should extract: company name, description, batch, industry, location

#### Sequoia Capital Scraper
- Need to create: `sequoia-scraper.js`
- Scrape stories and news pages
- Extract: portfolio companies, funding news, insights

#### HAX Scraper
- Need to create: `hax-scraper.js`
- Scrape startups page
- Extract: portfolio companies, descriptions, sectors

### 3. Integration with Unified Orchestrator
Update `unified-scraper-orchestrator.js` to include these new scrapers in the discovery phase.

## Example: Adding RSS Feeds Manually

```sql
INSERT INTO rss_sources (name, url, category, active)
VALUES 
  ('Sequoia Capital - Medium', 'https://sequoia.medium.com/feed', 'vc_blog', true),
  ('a16z - News Content', 'https://a16z.com/feed/', 'vc_news', true);
```

Or use the admin interface at `/admin/rss-manager` to add them.


