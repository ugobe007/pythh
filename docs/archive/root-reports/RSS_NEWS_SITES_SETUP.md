# RSS News Sites Setup Guide

## Current Status
The RSS Manager is now fully functional with authentication checks and proper form validation.

## How to Add New News Sites

### 1. Access the RSS Manager
- Navigate to: `/admin/rss-manager`
- Ensure you're logged in with admin credentials

### 2. Add RSS Sources
Click "Add RSS Source" and enter:
- **Name**: Display name for the source
- **URL**: RSS feed URL (must be valid RSS/XML format)
- **Category**: Optional categorization

### 3. Recommended News Sites for Startup/VC Ecosystem

#### Tier 1: Essential Tech News
```
TechCrunch
https://techcrunch.com/feed/

VentureBeat
https://venturebeat.com/feed/

The Information (if accessible)
https://www.theinformation.com/feed

Hacker News
https://news.ycombinator.com/rss

Product Hunt
https://www.producthunt.com/feed
```

#### Tier 2: Business & Finance
```
Bloomberg Technology
https://www.bloomberg.com/feed/podcast/bloomberg-technology

Wall Street Journal Tech
https://feeds.wsj.com/xml/rss/3_7455.xml

Reuters Technology
https://www.reuters.com/technology

Business Insider Tech
https://www.businessinsider.com/sai/rss
```

#### Tier 3: VC & Startup Specific
```
500 Startups Blog
https://500.co/blog/feed/

Andreessen Horowitz
https://a16z.com/feed/

First Round Review
https://review.firstround.com/feed

SaaStr
https://www.saastr.com/feed/

Both Sides of the Table (Mark Suster)
https://bothsidesofthetable.com/feed
```

#### Tier 4: Industry Verticals
```
AI/ML News
https://syncedreview.com/feed/

Crypto/Web3
https://cointelegraph.com/rss

Fintech
https://www.fintechfutures.com/feed/

Health Tech
https://medcitynews.com/feed/
```

#### Tier 5: Regional/Geographic
```
EU Startups
https://www.eu-startups.com/feed/

TechInAsia
https://www.techinasia.com/feed

TechCrunch Africa
https://techcrunch.com/tag/africa/feed/
```

## How the Scoring System Uses RSS Data

### 1. Momentum Detection
- **Recent Coverage**: Startups mentioned in last 30 days get +5 GOD score
- **Frequency**: Multiple mentions = higher momentum score
- **Trending Topics**: Articles with >1000 shares boost visibility

### 2. Market Validation
- **Funding Announcements**: Detected keywords boost credibility
- **Product Launches**: Coverage of new features = traction signal
- **Partnerships**: Enterprise deals mentioned = growth indicator

### 3. Sentiment Analysis
- **Positive Coverage**: "revolutionary", "breakthrough", "leading" = +3 points
- **Neutral Coverage**: Informational articles = +1 point
- **Critical Coverage**: May reduce score if pattern detected

### 4. Authority Weighting
```javascript
TechCrunch article:    Weight = 10
Bloomberg coverage:    Weight = 8
Hacker News mention:   Weight = 6
Smaller blog:          Weight = 3
```

## Technical Implementation

### Database Schema
```sql
-- RSS articles are stored here
rss_articles (
  id,
  source_id,
  title,
  url,
  published_at,
  content,
  processed,
  startup_mentions JSONB  -- { startup_id: relevance_score }
)

-- Link articles to startups
startup_article_mentions (
  startup_id,
  article_id,
  relevance_score,
  sentiment_score,
  created_at
)
```

### Scoring Algorithm
```javascript
function calculateNewsBoost(startup) {
  let newsScore = 0;
  
  // Recent coverage (last 30 days)
  const recentArticles = getRecentArticles(startup.id, 30);
  newsScore += Math.min(recentArticles.length * 2, 20);
  
  // Authority weighting
  recentArticles.forEach(article => {
    const sourceWeight = getSourceWeight(article.source_id);
    newsScore += sourceWeight * article.sentiment_score;
  });
  
  // Trending boost
  const weeklyMentions = getRecentArticles(startup.id, 7);
  if (weeklyMentions.length >= 3) {
    newsScore += 10; // Trending this week
  }
  
  return Math.min(newsScore, 30); // Cap at 30 points
}
```

## Adding Sources via Admin Dashboard

### Method 1: Through UI
1. Go to `/admin/rss-manager`
2. Fill in the form:
   - Name: "TechCrunch"
   - URL: "https://techcrunch.com/feed/"
   - Category: "Tech News"
3. Click "Add RSS Source"
4. Verify connection status turns green

### Method 2: Bulk Import (SQL)
```sql
INSERT INTO rss_sources (name, url, category, active, created_by) VALUES
  ('TechCrunch', 'https://techcrunch.com/feed/', 'Tech News', true, 'admin@hotmoney.com'),
  ('Hacker News', 'https://news.ycombinator.com/rss', 'Tech News', true, 'admin@hotmoney.com'),
  ('VentureBeat', 'https://venturebeat.com/feed/', 'Tech News', true, 'admin@hotmoney.com'),
  ('500 Startups', 'https://500.co/blog/feed/', 'VC Blog', true, 'admin@hotmoney.com'),
  ('a16z', 'https://a16z.com/feed/', 'VC Blog', true, 'admin@hotmoney.com');
```

## Monitoring & Maintenance

### Health Checks
- RSS Manager shows connection status for each source
- Green = healthy, fetching articles
- Orange = intermittent issues
- Red = connection failed, needs attention

### Testing New Sources
1. Add source via UI
2. Wait 5 minutes for first fetch
3. Check `rss_articles` table for new entries
4. Verify `processed = true` after AI analysis

### Troubleshooting
**Issue**: Source added but no articles appear
- **Fix**: Check URL is valid RSS/XML feed
- **Fix**: Verify RSS parser is running (background job)
- **Fix**: Check firewall/CORS isn't blocking fetch

**Issue**: Articles fetched but not processed
- **Fix**: Verify OpenAI API key is configured
- **Fix**: Check `ai_logs` table for errors
- **Fix**: Restart ML processing pipeline

## Next Steps

### Immediate Actions
1. Add the Tier 1 sources (TechCrunch, Hacker News, etc.)
2. Test each source for 24 hours
3. Monitor article fetch rates
4. Validate GOD score updates

### Future Enhancements
1. **Twitter/X Integration**: Real-time social signals
2. **Crunchbase API**: Funding round detection
3. **GitHub Activity**: Open source project momentum
4. **LinkedIn Signals**: Team growth indicators
5. **Google Trends**: Search volume analysis

## Performance Metrics

Target benchmarks:
- **Sources Active**: 20-30 feeds
- **Articles/Day**: 500-1000 new articles
- **Processing Time**: <2 minutes per article
- **Startup Mentions**: 50-100 per day
- **Score Updates**: Real-time (within 5 minutes)

## Questions?

If you need help:
1. Check RSS Manager connection status
2. Review `ai_logs` table for errors
3. Verify authentication is working
4. Contact: admin@hotmoney.com
