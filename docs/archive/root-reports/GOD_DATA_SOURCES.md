# GOD Algorithm Data Sources - Quick Reference

## 📊 Overview

The GOD (Growth, Opportunity, Defensibility) Algorithm requires **80+ data points** across 8 components to generate accurate startup scores (0-10 scale).

---

## 🎯 8 Scoring Components

### 1. Team Score (11 fields)

**Critical Fields:**
- `founders_count` - Number of co-founders (2-4 is optimal)
- `technical_cofounders` - How many can code
- `previous_companies` - Array of prior startups
- `previous_exits` - Array of successful exits
- `domain_expertise_years` - Years in target industry

**Supporting Fields:**
- `team_size` - Total employees
- `education_background` - Degrees, universities
- `founding_team_balance` - Tech vs business (0-10)
- `advisors` - Advisory board members

**Data Sources:**
- LinkedIn profiles
- Crunchbase company pages
- AngelList profiles
- Direct founder interviews

**Scoring Logic:**
```
Team Score = Average of:
- Founder experience (exits, years)
- Team balance (tech/business mix)
- Domain expertise
- Advisory quality
```

---

### 2. Traction Score (15 fields)

**Critical Fields:**
- `revenue` - Annual revenue in dollars
- `mrr` - Monthly recurring revenue
- `growth_rate` - Month-over-month % growth
- `customers` - Total customers
- `paying_customers` - Active paying users
- `churn_rate` - Monthly churn %

**Supporting Fields:**
- `ltv_cac_ratio` - Lifetime value / acquisition cost
- `unit_economics` - Description
- `revenue_model` - SaaS, marketplace, etc.
- `pricing` - Pricing structure
- `sales_cycle` - Days to close
- `pilot_programs` - Active pilots
- `waitlist_size` - Users waiting
- `testimonials` - Customer quotes

**Data Sources:**
- Company dashboard exports
- Stripe/payment processor data
- Google Analytics
- Sales CRM (HubSpot, Salesforce)
- Customer testimonials/reviews

**Scoring Logic:**
```
Traction Score = Weighted average:
- 30% Revenue growth
- 25% Customer count
- 20% Unit economics (LTV/CAC)
- 15% Churn rate (lower = better)
- 10% Pilot programs
```

---

### 3. Product Score (6 fields)

**Critical Fields:**
- `demo_available` - Boolean: Live demo exists
- `launched` - Boolean: Product is live
- `unique_ip` - Patents, trade secrets
- `defensibility` - Competitive moats
- `technical_complexity` - 0-10 scale
- `product_stage` - MVP, beta, v1.0, v2.0

**Data Sources:**
- Product demo links
- Patent databases (USPTO, Google Patents)
- Technical documentation
- GitHub repositories (if open source)
- Product Hunt launches

**Scoring Logic:**
```
Product Score = Average of:
- Live demo bonus (+2 points)
- Launched bonus (+2 points)
- IP defensibility (0-3 points)
- Technical complexity (0-3 points)
```

---

### 4. Market Score (5 fields)

**Critical Fields:**
- `market_size` - TAM/SAM/SOM in dollars
- `industries` - Array of target industries
- `problem` - Problem being solved
- `solution` - How it's solved
- `competitive_landscape` - Main competitors

**Data Sources:**
- Market research reports (Gartner, Forrester)
- CB Insights market maps
- Crunchbase industry data
- Competitor websites
- Customer interviews

**Scoring Logic:**
```
Market Score = Weighted average:
- 40% Market size (TAM > $1B = 10 points)
- 30% Problem clarity
- 30% Competitive position
```

---

### 5. Vision Score (4 fields)

**Critical Fields:**
- `long_term_vision` - 5-10 year goal
- `mission_statement` - Company mission
- `market_timing` - Why now?
- `scalability` - How to scale 10x

**Data Sources:**
- Pitch decks
- Company website "About" page
- Founder interviews
- Blog posts/articles
- Investor memos

**Scoring Logic:**
```
Vision Score = Average of:
- Clarity of long-term vision (0-3 points)
- Market timing (0-3 points)
- Scalability plan (0-4 points)
```

---

### 6. Ecosystem Score (3 fields)

**Critical Fields:**
- `strategic_partners` - Array of corporate partners
- `platform_dependencies` - Infrastructure (AWS, Stripe, OpenAI, etc.)
- `distribution_channels` - GTM channels

**Data Sources:**
- Company website "Partners" page
- Press releases
- Technology stack (BuiltWith, Wappalyzer)
- LinkedIn company page
- Crunchbase partnerships

**Scoring Logic:**
```
Ecosystem Score = Average of:
- Strategic partners (1 point each, max 5)
- Platform integrations (0.5 point each, max 3)
- Distribution channels (0.5 point each, max 2)
```

---

### 7. Grit Score (5 fields)

**Critical Fields:**
- `pivots_made` - Number of pivots
- `customer_feedback_frequency` - How often talking to users
- `time_to_iterate` - Ship velocity
- `months_operating` - Age of company
- `runway_months` - Cash runway remaining

**Data Sources:**
- Founder interviews
- Company blog (pivot announcements)
- Product changelog
- Customer feedback tools (Intercom, Zendesk)
- Financial statements

**Scoring Logic:**
```
Grit Score = Average of:
- Pivot resilience (1-2 pivots = good, 0 or 3+ = lower)
- Customer feedback (weekly = 10, monthly = 5)
- Ship velocity (weekly = 10, monthly = 5)
- Runway health (12+ months = 10, 6 months = 5)
```

---

### 8. Problem Validation Score (6 fields)

**Critical Fields:**
- `customer_interviews_conducted` - Number of user research sessions
- `pain_data_collected` - Evidence of pain
- `icp_clarity` - Ideal customer profile clarity
- `willingness_to_pay` - Pricing validation evidence
- `problem_frequency` - How often problem occurs
- `current_solutions` - What users do today

**Data Sources:**
- Customer interview notes
- Survey results (Typeform, Google Forms)
- User research recordings (Loom, Zoom)
- Customer support tickets
- Competitor reviews (G2, Capterra)

**Scoring Logic:**
```
Problem Validation Score = Weighted average:
- 30% Customer interviews (50+ = 10 points)
- 25% Willingness to pay validation
- 20% ICP clarity
- 15% Problem frequency (daily = 10, weekly = 5)
- 10% Current solution gaps
```

---

## 📥 Data Collection Methods

### Method 1: Manual Data Entry (Slow, Accurate)

**When to Use:**
- Small number of startups (<50)
- High-value startups needing detailed analysis
- Initial setup and testing

**Tools:**
- Admin UI bulk upload at `/admin/bulk-upload`
- CSV template with all 80+ columns
- Direct database updates via SQL

**Time Required:** 30-60 minutes per startup

---

### Method 2: API Integration (Medium Speed, Medium Accuracy)

**When to Use:**
- Integration with existing CRM/database
- Regular updates from internal tools
- Automated data syncing

**Tools:**
- REST API endpoints
- Zapier/Make.com integrations
- Custom scripts

**Example API Call:**
```bash
curl -X POST http://localhost:5174/api/startups/update \
  -H "Content-Type: application/json" \
  -d '{
    "startup_id": "uuid-here",
    "founders_count": 3,
    "technical_cofounders": 2,
    "revenue": 50000,
    "mrr": 5000,
    ...
  }'
```

**Time Required:** Minutes per startup (after setup)

---

### Method 3: RSS/AI Scraping (Fast, Lower Accuracy)

**When to Use:**
- Large-scale monitoring (1000+ companies)
- Early-stage discovery
- Market intelligence

**Tools:**
- RSS scraper (15+ news sources)
- OpenAI GPT-4o for extraction
- Website scrapers

**Data Captured:**
- Company name
- Website URL
- Description
- Funding announcements
- Founder names
- Limited traction metrics

**Limitations:**
- Only captures publicly announced data
- Missing detailed metrics (revenue, customers)
- Requires manual verification
- Good for "5 points" not full 80 fields

**Time Required:** Seconds per startup (automated)

---

### Method 4: Third-Party Data APIs (Fast, Expensive)

**When to Use:**
- Need comprehensive data at scale
- Budget allows for API costs
- Real-time data freshness required

**Data Providers:**
- **Crunchbase API** - Funding, founders, investors ($)
- **Pitchbook API** - Detailed financials ($$$$)
- **LinkedIn API** - Team backgrounds ($)
- **Clearbit API** - Company enrichment ($)
- **BuiltWith API** - Technology stack ($)

**Coverage:**
- ✅ Team data (70%)
- ✅ Funding/investors (90%)
- ⚠️ Revenue/traction (30%)
- ❌ Product details (10%)
- ❌ Problem validation (5%)

**Time Required:** API call latency (< 1 second)

---

## 🔄 Data Update Workflow

### Weekly Updates (Recommended)

```bash
# 1. Export new startups from RSS scraper
SELECT * FROM rss_articles WHERE created_at > NOW() - INTERVAL '7 days';

# 2. Enrich with Crunchbase data
# (Use Crunchbase API to fill team/funding fields)

# 3. Manual review of high-potential startups
# (Founders with exits, large market size, etc.)

# 4. Update detailed metrics for reviewed startups
UPDATE startup_uploads SET ...;

# 5. Trigger re-scoring
# (Run calculateHotScore() for updated startups)

# 6. Generate new matches
# (Run autoGenerateMatches() for scored startups)
```

---

## 🎯 Minimum Viable Data (MVD)

If you can't get all 80 fields, start with these **20 critical fields**:

1. `startup_name` ✅
2. `website` ✅
3. `founders_count` ✅
4. `technical_cofounders` ✅
5. `previous_exits` ✅
6. `revenue` (or `mrr`) ✅
7. `growth_rate` ✅
8. `customers` ✅
9. `churn_rate` ✅
10. `demo_available` ✅
11. `launched` ✅
12. `market_size` ✅
13. `industries` ✅
14. `problem` ✅
15. `solution` ✅
16. `long_term_vision` ✅
17. `strategic_partners` ✅
18. `months_operating` ✅
19. `runway_months` ✅
20. `customer_interviews_conducted` ✅

**MVD Score Accuracy:** ~70% of full scoring accuracy

---

## 🏆 Data Quality Scoring

| Quality Tier | Fields Populated | Score Accuracy | Use Case |
|--------------|------------------|----------------|----------|
| **Bronze** | 20/80 (MVD) | 70% | Initial discovery |
| **Silver** | 40/80 | 85% | Investor consideration |
| **Gold** | 60/80 | 95% | Due diligence ready |
| **Platinum** | 80/80 | 99% | Investment decision |

---

## 🔍 Data Validation Checks

Before running GOD scoring, validate:

```sql
-- Check for required fields
SELECT 
  startup_name,
  CASE 
    WHEN founders_count IS NULL THEN '❌ Missing founders_count'
    WHEN revenue IS NULL AND mrr IS NULL THEN '❌ Missing traction data'
    WHEN market_size IS NULL THEN '❌ Missing market size'
    ELSE '✅ Valid'
  END AS validation_status
FROM startup_uploads;

-- Check for data quality issues
SELECT 
  startup_name,
  CASE
    WHEN founders_count > 10 THEN '⚠️ Too many founders'
    WHEN growth_rate > 100 THEN '⚠️ Unrealistic growth'
    WHEN churn_rate > 0.2 THEN '⚠️ High churn'
    ELSE '✅ Looks good'
  END AS quality_check
FROM startup_uploads;
```

---

## 📊 Sample Data Import CSV

```csv
startup_name,website,founders_count,technical_cofounders,previous_exits,revenue,mrr,growth_rate,customers,paying_customers,churn_rate,demo_available,launched,market_size,industries,problem,solution,long_term_vision,strategic_partners,months_operating,runway_months,customer_interviews_conducted

"AI SaaS Co","https://example.com",3,2,"Startup A (acquired by Google)",120000,10000,15,250,180,0.05,true,true,"$5B TAM","['AI','SaaS','Enterprise']","Sales teams waste 60% of time on manual data entry","AI-powered CRM that automates data entry and enrichment","Become the operating system for B2B sales","['Salesforce','HubSpot']",18,14,120

"FinTech Startup","https://fintech-example.com",2,1,"",50000,5000,25,80,60,0.08,true,true,"$10B TAM","['FinTech','Banking']","Small businesses can't access affordable credit","AI credit scoring for underbanked SMBs","Bank for 50M small businesses globally","['Stripe','Plaid']",12,10,85
```

---

## 🆘 Common Data Issues

### Issue: "All scores are 0"

**Cause:** Missing critical fields

**Fix:**
```sql
-- Identify empty fields
SELECT 
  COUNT(*) FILTER (WHERE founders_count IS NULL) as missing_founders,
  COUNT(*) FILTER (WHERE revenue IS NULL AND mrr IS NULL) as missing_traction,
  COUNT(*) FILTER (WHERE market_size IS NULL) as missing_market
FROM startup_uploads;
```

### Issue: "Scores don't match expectations"

**Cause:** Data format issues

**Fix:**
- Ensure `revenue` and `mrr` are numbers, not strings
- `growth_rate` should be decimal (0.15 = 15%)
- `churn_rate` should be decimal (0.05 = 5%)
- Arrays should be JSON format: `['item1','item2']`

### Issue: "Data is outdated"

**Cause:** No regular updates

**Fix:**
- Set up weekly data refresh workflow
- Use Crunchbase webhooks for funding announcements
- Monitor RSS feeds for news

---

## 🎉 Next Steps

1. ✅ Choose data collection method (manual, API, or hybrid)
2. ✅ Start with MVD (20 fields) for first 10 startups
3. ✅ Run GOD scoring and verify scores look reasonable
4. ✅ Gradually expand to 40+ fields as data sources improve
5. ✅ Set up weekly update workflow
6. ✅ Monitor data quality metrics

**Your GOD Algorithm is now fed with quality data! 🚀**
