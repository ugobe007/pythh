# Investor Data Scraper Integration Guide

## Overview
Enhanced investor enrichment system that scrapes:
- **Partner Names & Details**: Team members, titles, bios, LinkedIn, focus areas
- **Investment Portfolio**: Portfolio companies, investment dates, round types, amounts
- **Startup Advice**: Blog posts, interviews, podcasts, tweets with actionable insights
- **Focus Areas**: Detailed investment thesis and sector preferences

## Database Schema

### New Tables Created

#### 1. `investor_partners`
Stores detailed information about VC partners/team members.

```sql
CREATE TABLE investor_partners (
  id UUID PRIMARY KEY,
  investor_id UUID REFERENCES investors(id),
  name TEXT NOT NULL,
  title TEXT, -- 'Managing Partner', 'General Partner'
  bio TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  email TEXT,
  focus_areas JSONB, -- ['AI/ML', 'Healthcare']
  stage_preference JSONB, -- ['Seed', 'Series A']
  geography_focus JSONB, -- ['US West Coast', 'Europe']
  is_active BOOLEAN DEFAULT true,
  joined_date DATE,
  image_url TEXT
);
```

**Example Data:**
```json
{
  "name": "Keith Rabois",
  "title": "General Partner",
  "bio": "Former COO of Square, VP at LinkedIn...",
  "linkedin_url": "https://linkedin.com/in/krabois",
  "focus_areas": ["Fintech", "Consumer", "Marketplace"],
  "stage_preference": ["Seed", "Series A"],
  "geography_focus": ["US", "Latin America"]
}
```

#### 2. `investor_investments`
Tracks portfolio companies and investment details.

```sql
CREATE TABLE investor_investments (
  id UUID PRIMARY KEY,
  investor_id UUID REFERENCES investors(id),
  partner_id UUID REFERENCES investor_partners(id), -- Who led
  startup_id UUID REFERENCES startup_uploads(id),
  company_name TEXT NOT NULL,
  company_description TEXT,
  investment_date DATE,
  round_type TEXT, -- 'Seed', 'Series A'
  amount TEXT, -- '$5M', 'Undisclosed'
  is_lead BOOLEAN DEFAULT false,
  co_investors JSONB, -- ['Sequoia', 'a16z']
  industries JSONB, -- ['AI', 'Healthcare']
  status TEXT DEFAULT 'active', -- 'active', 'exited', 'acquired'
  exit_date DATE,
  source_url TEXT
);
```

**Example Data:**
```json
{
  "company_name": "Stripe",
  "company_description": "Online payment processing",
  "investment_date": "2012-07-09",
  "round_type": "Series A",
  "amount": "$20M",
  "is_lead": true,
  "industries": ["Fintech", "Payments"],
  "status": "active"
}
```

#### 3. `investor_advice`
Stores startup advice, insights, and guidance from partners.

```sql
CREATE TABLE investor_advice (
  id UUID PRIMARY KEY,
  investor_id UUID REFERENCES investors(id),
  partner_id UUID REFERENCES investor_partners(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT, -- 'fundraising', 'product', 'hiring'
  tags JSONB, -- ['pitch-deck', 'metrics']
  source_type TEXT, -- 'blog', 'interview', 'podcast'
  source_url TEXT,
  published_date DATE,
  is_featured BOOLEAN DEFAULT false
);
```

**Example Data:**
```json
{
  "title": "What to Look for in a Pitch Deck",
  "content": "The most important thing is clarity...",
  "category": "fundraising",
  "tags": ["pitch-deck", "fundraising", "storytelling"],
  "source_type": "blog",
  "source_url": "https://foundersfund.com/blog/pitch-deck"
}
```

## Data Sources

### 1. Partner Information Sources
- **Crunchbase API**: `/organizations/{permalink}/people`
- **LinkedIn**: Search "{firm_name} partner" or "{firm_name} team"
- **Firm Website**: Parse `/team`, `/about`, `/people` pages
- **Twitter**: Search for partner bios and introductions
- **PitchBook**: Partner profiles and backgrounds

### 2. Investment Portfolio Sources
- **Crunchbase API**: `/organizations/{permalink}/investments`
- **PitchBook API**: Investment data and valuations
- **Firm Website**: `/portfolio` pages
- **TechCrunch/VentureBeat**: Press release parsing
- **SEC Filings**: For public disclosure requirements
- **AngelList**: Portfolio listings

### 3. Startup Advice Sources
- **Firm Blogs**: Medium, Ghost, WordPress sites
- **YouTube**: Partner interviews and talks
- **Podcasts**: Spotify, Apple Podcasts transcripts
- **Twitter**: Partner threads and tweets
- **LinkedIn**: Articles and long-form posts
- **Conferences**: Slides and recordings (YC Startup School, Saastr)

## Scraper Implementation

### Priority 1: Crunchbase Integration
```typescript
// Install: npm install axios
import axios from 'axios';

const CRUNCHBASE_API_KEY = process.env.CRUNCHBASE_API_KEY;
const BASE_URL = 'https://api.crunchbase.com/api/v4';

async function scrapeCrunchbasePartners(permalink: string) {
  const response = await axios.get(
    `${BASE_URL}/entities/organizations/${permalink}`,
    {
      headers: { 'X-cb-user-key': CRUNCHBASE_API_KEY },
      params: {
        card_ids: 'founders,investors',
        field_ids: 'name,title,linkedin,focus_areas'
      }
    }
  );
  
  return response.data.cards.founders.map(person => ({
    name: person.properties.name,
    title: person.properties.title,
    linkedin_url: person.properties.linkedin?.value
  }));
}

async function scrapeCrunchbaseInvestments(permalink: string) {
  const response = await axios.get(
    `${BASE_URL}/entities/organizations/${permalink}/investments`,
    {
      headers: { 'X-cb-user-key': CRUNCHBASE_API_KEY }
    }
  );
  
  return response.data.investments.map(inv => ({
    company_name: inv.organization.name,
    investment_date: inv.announced_on,
    round_type: inv.funding_round.investment_type,
    amount: inv.funding_round.money_raised?.value
  }));
}
```

### Priority 2: Website Scraping
```typescript
// Install: npm install cheerio axios
import cheerio from 'cheerio';

async function scrapeTeamPage(url: string) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const partners = [];
  $('.team-member, .partner-card').each((i, elem) => {
    partners.push({
      name: $(elem).find('.name, h3').text().trim(),
      title: $(elem).find('.title, .role').text().trim(),
      bio: $(elem).find('.bio, p').text().trim(),
      linkedin_url: $(elem).find('a[href*="linkedin"]').attr('href')
    });
  });
  
  return partners;
}

async function scrapePortfolioPage(url: string) {
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const investments = [];
  $('.portfolio-company, .company-card').each((i, elem) => {
    investments.push({
      company_name: $(elem).find('.company-name, h3').text().trim(),
      company_description: $(elem).find('.description, p').text().trim(),
      company_url: $(elem).find('a').attr('href'),
      industries: $(elem).find('.tag, .industry').map((i, el) => $(el).text().trim()).get()
    });
  });
  
  return investments;
}
```

### Priority 3: Blog/Advice Scraping
```typescript
async function scrapeBlogAdvice(blogUrl: string) {
  const response = await axios.get(blogUrl);
  const $ = cheerio.load(response.data);
  
  const articles = [];
  $('.blog-post, article').each((i, elem) => {
    const title = $(elem).find('h1, h2, .title').text().trim();
    const content = $(elem).find('.content, .body, p').text().trim();
    const category = inferCategory(title, content); // Helper function
    
    articles.push({
      title,
      content: content.substring(0, 1000), // First 1000 chars
      category,
      source_type: 'blog',
      source_url: $(elem).find('a').attr('href'),
      tags: extractTags(content) // Helper function
    });
  });
  
  return articles;
}

function inferCategory(title: string, content: string): string {
  const keywords = {
    fundraising: ['pitch', 'deck', 'fundraise', 'term sheet', 'valuation'],
    product: ['product', 'pmf', 'market fit', 'launch', 'iterate'],
    hiring: ['hire', 'recruiting', 'team', 'culture', 'talent'],
    growth: ['growth', 'scale', 'metrics', 'kpi', 'traction'],
    general: []
  };
  
  const text = (title + ' ' + content).toLowerCase();
  
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(word => text.includes(word))) {
      return category;
    }
  }
  
  return 'general';
}
```

## Usage Examples

### Enrich a Single Investor
```typescript
import { enrichInvestor } from './lib/investorEnrichmentService';

// Enrich Founders Fund
const result = await enrichInvestor(
  'founders-fund-uuid',
  'Founders Fund'
);

console.log(result);
// {
//   success: true,
//   partners: 12,
//   investments: 145,
//   advice: 23
// }
```

### Get Enriched Profile
```typescript
import { getEnrichedProfile } from './lib/investorEnrichmentService';

const profile = await getEnrichedProfile('founders-fund-uuid');

console.log(profile.partners); // Array of partner objects
console.log(profile.investments); // Array of portfolio companies
console.log(profile.advice); // Array of advice articles
```

### Bulk Enrichment (Cron Job)
```typescript
import { enrichAllInvestors } from './lib/investorEnrichmentService';

// Run this daily via cron
const results = await enrichAllInvestors();

console.log(results);
// [
//   { investor: 'Founders Fund', success: true, partners: 12 },
//   { investor: 'Sequoia', success: true, partners: 18 },
//   ...
// ]
```

## API Integration Priority

### Phase 1 (Immediate)
1. ✅ **Crunchbase API** - Best source for partners and investments
2. ✅ **Website Scraping** - Direct from firm websites
3. ✅ **Manual CSV Import** - For initial data population

### Phase 2 (Week 2)
4. **PitchBook API** - Additional investment data
5. **LinkedIn Scraping** - Partner profiles and bios
6. **Medium/Blog RSS** - Automated advice collection

### Phase 3 (Month 2)
7. **YouTube API** - Interview transcripts
8. **Twitter API** - Partner insights
9. **Podcast APIs** - Advice extraction

## Data Quality Checks

### Validation Rules
```typescript
// Validate partner data
function validatePartner(partner: Partner): boolean {
  return (
    partner.name?.length > 0 &&
    partner.title?.length > 0 &&
    (partner.linkedin_url || partner.twitter_handle) // At least one contact
  );
}

// Validate investment data
function validateInvestment(investment: Investment): boolean {
  return (
    investment.company_name?.length > 0 &&
    investment.investment_date && // Must have date
    investment.round_type?.length > 0
  );
}

// Validate advice data
function validateAdvice(advice: Advice): boolean {
  return (
    advice.title?.length > 0 &&
    advice.content?.length > 100 && // Minimum content length
    advice.category && // Must be categorized
    advice.source_url // Must have source
  );
}
```

## Scraper Schedule

### Daily Tasks (3 AM)
- Scrape news feeds for all investors
- Update partner LinkedIn profiles
- Check for new blog posts

### Weekly Tasks (Sunday)
- Full investment portfolio refresh
- Deep scrape of firm websites
- YouTube/podcast check

### Monthly Tasks
- Complete re-enrichment of top 100 VCs
- Validate all data for accuracy
- Remove stale/outdated information

## Environment Variables

Add to `.env`:
```bash
# Crunchbase
CRUNCHBASE_API_KEY=your_crunchbase_key

# PitchBook (if available)
PITCHBOOK_API_KEY=your_pitchbook_key

# LinkedIn (for scraping)
LINKEDIN_EMAIL=your_email
LINKEDIN_PASSWORD=your_password

# OpenAI (for content analysis)
OPENAI_API_KEY=your_openai_key
```

## Next Steps

1. **Run the Schema**: Execute `supabase-investor-news-schema.sql` in Supabase SQL Editor
2. **Set Up Crunchbase**: Get API key from https://www.crunchbase.com/
3. **Implement Scrapers**: Start with Crunchbase and website scraping
4. **Test on 5 VCs**: Manually verify data quality
5. **Deploy Cron Job**: Set up automated enrichment
6. **Build UI**: Display enriched data on investor profile pages

## Success Metrics

- ✅ 80%+ investors have partner data
- ✅ 50%+ investors have investment portfolio
- ✅ 30%+ investors have startup advice
- ✅ Data freshness < 7 days
- ✅ < 5% error rate in scraping

---

**Status**: Schema created ✅ | Service scaffolded ✅ | Ready for API integration 🚀
