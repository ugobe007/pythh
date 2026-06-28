# Hot Money ML/AI Workflow Setup Guide

## 🚀 Overview

Hot Money has **4 integrated ML/AI services** ready to activate:

1. **GOD Algorithm** - Startup scoring engine (20 VC models, 8-component scoring)
2. **RSS Scraper** - Automated news monitoring (15+ RSS feeds)
3. **Auto-Match Service** - Vector embedding matching
4. **News Scraper** - Google News & press release tracking

---

## 📋 Current Status

### ✅ What's Already Built
- All 4 ML/AI services exist and are integrated
- Database tables configured (`rss_sources`, `rss_articles`, `ai_logs`, `startup_uploads`)
- OpenAI GPT-4o integration for article extraction
- Vector embedding generation for semantic matching
- Automated matching triggers on startup submission

### ⚠️ What Needs Activation
- RSS scheduler not started (runs every 6 hours)
- Environment variables may need verification
- Connection monitoring just added to RSS Manager UI

---

## 🔧 Step 1: Environment Variables

Verify these are set in your `.env` file:

```bash
# Required for AI Services
OPENAI_API_KEY=sk-...your-key-here...

# Required for Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-key...

# Optional: OpenAI Configuration
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=1500
```

**How to get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and paste into `.env`

---

## 🤖 Step 2: Activate RSS Scraper

### Location
`/server/services/rss.scheduler.ts`

### How to Start

**Option A: Add to Server Startup**

Edit `/server/index.ts` or your main server file:

```typescript
import { rssScheduler } from './services/rss.scheduler';

// After server initialization
rssScheduler.start();
console.log('✅ RSS Scheduler started - runs every 6 hours');
```

**Option B: Manual Trigger**

Run in terminal:
```bash
cd /Users/leguplabs/Desktop/hot-honey
node -e "require('./server/services/rss.scheduler').rssScheduler.start()"
```

### What It Does
- Runs every 6 hours automatically
- Scrapes 15+ RSS feeds:
  - TechCrunch
  - VentureBeat
  - Hacker News
  - AngelList
  - Techstars Blog
  - Y Combinator News
  - Product Hunt
  - TechNode
  - Tech.eu
  - Sifted
  - Built In
  - Crunchbase News
  - The Information
  - Axios Pro Rata
  - PitchBook
- Uses OpenAI to extract company names from articles
- Visits company websites to scrape "5 points"
- Stores articles in `rss_articles` table

### Verify It's Working

Check `rss_articles` table:
```sql
SELECT COUNT(*), MAX(created_at) FROM rss_articles;
```

Check `ai_logs` table:
```sql
SELECT * FROM ai_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 📊 Step 3: GOD Algorithm Data Sources

### Location
`/server/services/startupScoringService.ts`

### Input Data Structure

The GOD Algorithm requires **80+ data fields** per startup:

#### 1. Team Component (11 fields)
```typescript
founders_count: number;           // Number of co-founders
technical_cofounders: number;     // How many are technical
previous_companies: string[];     // Prior startup experience
previous_exits: string[];         // Successful exits
domain_expertise_years: number;   // Years in industry
team_size: number;                // Total employees
education_background: string[];   // Degrees, universities
founding_team_balance: number;    // Tech vs business balance (0-10)
advisors: string[];              // Advisory board
```

#### 2. Traction Component (15 fields)
```typescript
revenue: number;                  // Annual revenue ($)
mrr: number;                      // Monthly recurring revenue
growth_rate: number;              // Month-over-month growth %
customers: number;                // Total customers
paying_customers: number;         // Active paying users
churn_rate: number;              // Monthly churn %
ltv_cac_ratio: number;           // Customer lifetime value / acquisition cost
unit_economics: string;           // Description of unit economics
revenue_model: string;            // SaaS, marketplace, etc.
pricing: string;                 // Pricing structure
sales_cycle: number;             // Days to close deal
pilot_programs: number;           // Active pilot customers
waitlist_size: number;           // Users waiting
testimonials: string[];          // Customer testimonials
```

#### 3. Product Component (6 fields)
```typescript
demo_available: boolean;          // Live demo exists
launched: boolean;               // Product is live
unique_ip: string;               // Patents, trade secrets
defensibility: string;           // Competitive moats
technical_complexity: number;     // 0-10 scale
product_stage: string;           // MVP, beta, v1.0, etc.
```

#### 4. Market Component (5 fields)
```typescript
market_size: string;             // TAM, SAM, SOM
industries: string[];            // Target industries
problem: string;                 // Problem being solved
solution: string;                // How it's solved
competitive_landscape: string;   // Main competitors
```

#### 5. Vision Component (4 fields)
```typescript
long_term_vision: string;        // 5-10 year goal
mission_statement: string;       // Company mission
market_timing: string;           // Why now?
scalability: string;             // How to scale 10x
```

#### 6. Ecosystem Component (3 arrays)
```typescript
strategic_partners: string[];    // Corporate partners
platform_dependencies: string[]; // Infrastructure (AWS, Stripe, etc.)
distribution_channels: string[]; // GTM channels
```

#### 7. Grit Component (5 fields)
```typescript
pivots_made: number;             // Number of pivots
customer_feedback_frequency: string; // How often talking to users
time_to_iterate: string;         // Ship velocity
months_operating: number;        // Age of company
runway_months: number;           // Cash runway
```

#### 8. Problem Validation Component (6 fields)
```typescript
customer_interviews_conducted: number;  // User research depth
pain_data_collected: string;           // Evidence of pain
icp_clarity: string;                   // Ideal customer profile
willingness_to_pay: string;            // Pricing validation
problem_frequency: string;             // How often problem occurs
current_solutions: string;             // What users do today
```

### How to Update Data

**Option A: Bulk Upload via CSV**

Format your CSV with these columns:
```csv
startup_name,founders_count,technical_cofounders,revenue,mrr,growth_rate,customers,...
```

Upload via admin interface at `/admin/bulk-upload`

**Option B: API Endpoint**

```bash
curl -X POST http://localhost:5174/api/startups/update \
  -H "Content-Type: application/json" \
  -d '{
    "startup_id": "uuid-here",
    "founders_count": 3,
    "technical_cofounders": 2,
    "revenue": 50000,
    "mrr": 5000,
    "growth_rate": 15,
    ...
  }'
```

**Option C: Direct Database Update**

```sql
UPDATE startup_uploads
SET 
  founders_count = 3,
  technical_cofounders = 2,
  revenue = 50000,
  mrr = 5000,
  growth_rate = 15,
  customers = 120,
  team_size = 8
WHERE id = 'startup-uuid-here';
```

### Trigger Re-Scoring

After updating data, recalculate GOD scores:

```typescript
import { calculateHotScore } from './server/services/startupScoringService';

// Recalculate for single startup
const score = calculateHotScore(startupData);

// Update in database
await supabase
  .from('startup_uploads')
  .update({
    total_god_score: score.totalScore,
    team_score: score.teamScore,
    traction_score: score.tractionScore,
    market_score: score.marketScore,
    product_score: score.productScore,
    vision_score: score.visionScore,
    ecosystem_score: score.ecosystemScore,
    grit_score: score.gritScore,
    problem_validation_score: score.problemValidationScore
  })
  .eq('id', startupId);
```

---

## 🎯 Step 4: Auto-Match Service

### Location
`/server/services/autoMatchService.ts`

### How It Works

The auto-match service **automatically triggers** when:
1. New startup is submitted via `/submit-startup` page
2. Startup data is scraped from RSS feeds
3. Manual trigger via API endpoint

### Workflow

```
1. Startup submitted/scraped
   ↓
2. Generate vector embedding (OpenAI text-embedding-ada-002)
   ↓
3. Calculate GOD score (8 components)
   ↓
4. Store embedding in startup_uploads.embedding
   ↓
5. Match against investor embeddings
   ↓
6. Calculate similarity scores
   ↓
7. Store matches in startup_investor_matches table
```

### Manual Trigger

```typescript
import { autoGenerateMatches } from './server/services/autoMatchService';

// Generate matches for specific startup
await autoGenerateMatches('startup-uuid-here');
```

### Verify Matches

```sql
SELECT 
  s.startup_name,
  i.name AS investor_name,
  m.similarity_score,
  m.total_god_score
FROM startup_investor_matches m
JOIN startup_uploads s ON s.id = m.startup_id
JOIN investors i ON i.id = m.investor_id
ORDER BY m.similarity_score DESC
LIMIT 20;
```

---

## 🔍 Step 5: RSS Connection Monitoring

### Location
`/src/pages/RSSManager.tsx`

### Features Just Added

✅ **Connection Status Badges**
- 🟢 Green: "Connected" - Feed is healthy
- 🔴 Red: "Connection Error" - Feed is down
- ⚪ Gray: "Unknown" - Not yet checked

✅ **Error Messages**
- Shows specific error when connection fails
- Example: "⚠️ net::ERR_NAME_NOT_RESOLVED"

✅ **Test Connection Button**
- Blue refresh icon next to each feed
- Click to test connection immediately
- Shows spinning animation while testing

✅ **Refresh All Button**
- Top right of page
- Tests all feeds at once
- Shows "Checking..." state

✅ **Last Checked Timestamp**
- Displays when each feed was last tested
- Updates in real-time

### How to Use

1. Navigate to `/rss-manager`
2. Click **"Refresh All"** to test all sources
3. Or click individual **refresh icon** to test one source
4. Check for red error badges
5. Fix dead sources immediately (update URL or remove)

### Dead Source Protocol

If a source shows "Connection Error":
1. Click the URL to visit in browser - does it load?
2. Check if RSS feed URL changed (common with site redesigns)
3. If permanently dead, click trash icon to remove
4. Replace with alternative source in same category

---

## 📈 Step 6: Monitor AI Operations

### Check AI Logs

```sql
-- Recent AI operations
SELECT * FROM ai_logs 
ORDER BY created_at DESC 
LIMIT 50;

-- AI operations by type
SELECT 
  operation_type,
  COUNT(*) as count,
  AVG(tokens_used) as avg_tokens,
  SUM(tokens_used) as total_tokens
FROM ai_logs
GROUP BY operation_type;

-- Failed operations
SELECT * FROM ai_logs 
WHERE status = 'error'
ORDER BY created_at DESC;
```

### Check Scraper Jobs

```sql
-- Recent scraper runs
SELECT * FROM scraper_jobs 
ORDER BY started_at DESC 
LIMIT 20;

-- Job success rate
SELECT 
  status,
  COUNT(*) as count
FROM scraper_jobs
GROUP BY status;
```

---

## 🎨 Step 7: View Results in UI

### Matching Engine Page
Navigate to: `http://localhost:5174/matching`

Features:
- View all startup-investor matches
- Filter by GOD score threshold
- See similarity scores
- Review matching reasons

### Admin Dashboard
Navigate to: `http://localhost:5174/admin`

Features:
- View all startups with GOD scores
- Bulk upload new startups
- Trigger manual matching
- View AI operation logs

### RSS Manager
Navigate to: `http://localhost:5174/rss-manager`

Features:
- View all RSS sources with connection status
- Test individual feeds
- Refresh all feeds at once
- Add/remove sources
- View article counts

---

## 🚨 Troubleshooting

### RSS Scraper Not Finding Companies

**Problem:** Articles scraped but no companies extracted

**Solution:**
1. Check OpenAI API key is valid
2. Verify `ai_logs` for errors:
   ```sql
   SELECT * FROM ai_logs WHERE operation_type = 'extract_companies' AND status = 'error';
   ```
3. Increase OpenAI timeout in `rssScraper.ts`

### GOD Scores All Zero

**Problem:** Startups have 0 scores across all components

**Solution:**
1. Check if startup data is populated:
   ```sql
   SELECT * FROM startup_uploads WHERE id = 'startup-uuid';
   ```
2. Verify at least these fields have data:
   - `founders_count`
   - `revenue` or `mrr`
   - `customers`
   - `market_size`
3. Re-run scoring:
   ```typescript
   calculateHotScore(startupData);
   ```

### Vector Embeddings Not Generated

**Problem:** `startup_uploads.embedding` column is null

**Solution:**
1. Check OpenAI API key has embedding permissions
2. Manually trigger:
   ```typescript
   await autoGenerateMatches(startupId);
   ```
3. Check `ai_logs` for embedding errors

### RSS Feed Shows "Connection Error"

**Problem:** Red badge on RSS Manager

**Solutions:**
1. **URL Changed:** Check if site redesigned and RSS moved
2. **CORS Issue:** Some feeds block HEAD requests - this is normal, feed may still work
3. **Dead Domain:** Remove and replace with alternative
4. **Temporary Outage:** Re-check in 1 hour

---

## 📊 Data Flow Diagram

```
RSS Feeds (15+ sources)
    ↓
RSS Scraper (6hr schedule)
    ↓
OpenAI GPT-4o (extract companies)
    ↓
rss_articles table
    ↓
Website Scraper (get "5 points")
    ↓
startup_uploads table
    ↓
Auto-Match Service
    ↓
├─→ Generate Vector Embedding (OpenAI)
├─→ Calculate GOD Score (20 VC models)
└─→ Store in startup_uploads
    ↓
Match Against Investors
    ↓
startup_investor_matches table
    ↓
Display in /matching UI
```

---

## 🎯 Quick Start Checklist

- [ ] **Environment Variables Set**
  - [ ] `OPENAI_API_KEY` added to `.env`
  - [ ] `SUPABASE_URL` configured
  - [ ] `SUPABASE_SERVICE_KEY` configured

- [ ] **RSS Scraper Started**
  - [ ] Added `rssScheduler.start()` to server startup
  - [ ] Verified first scrape completed
  - [ ] Checked `rss_articles` table has data

- [ ] **RSS Monitoring Active**
  - [ ] Visited `/rss-manager`
  - [ ] Clicked "Refresh All" to test connections
  - [ ] Fixed any red "Connection Error" badges

- [ ] **GOD Algorithm Data Loaded**
  - [ ] Updated startup data with 80+ fields
  - [ ] Triggered re-scoring
  - [ ] Verified scores are non-zero

- [ ] **Auto-Match Tested**
  - [ ] Submitted test startup
  - [ ] Verified vector embedding generated
  - [ ] Checked `startup_investor_matches` has results
  - [ ] Viewed matches in `/matching` page

- [ ] **Monitoring Setup**
  - [ ] Created SQL queries to check `ai_logs`
  - [ ] Setup alerts for failed RSS scrapes
  - [ ] Regular checks of connection status

---

## 📚 File Reference

| Service | File Path | Description |
|---------|-----------|-------------|
| GOD Algorithm | `/server/services/startupScoringService.ts` | 20 VC models, 8-component scoring |
| RSS Scraper | `/server/services/rssScraper.ts` | 15+ RSS feeds, OpenAI extraction |
| RSS Scheduler | `/server/services/rss.scheduler.ts` | 6-hour cron job |
| Auto-Match | `/server/services/autoMatchService.ts` | Vector embeddings, matching |
| News Scraper | `/server/services/newsScraper.ts` | Google News, press releases |
| RSS Manager UI | `/src/pages/RSSManager.tsx` | Connection monitoring UI |
| Matching UI | `/src/pages/MatchingEngine.tsx` | View matches and scores |

---

## 🆘 Support

**Common Issues:**
- "OpenAI API Error 429" → Rate limit hit, wait or upgrade plan
- "Supabase connection refused" → Check `SUPABASE_URL` format
- "No embeddings generated" → Verify OpenAI key has embedding access
- "RSS feed connection error" → URL may have changed, check manually

**Need Help?**
1. Check `ai_logs` table for error details
2. Check `scraper_jobs` table for job status
3. Review server console logs
4. Test OpenAI API key: https://platform.openai.com/account/api-keys

---

## 🎉 Success Metrics

After setup, you should see:
- ✅ 15+ RSS sources showing "Connected" status
- ✅ New articles appearing in `rss_articles` every 6 hours
- ✅ Startups with GOD scores 0-10 across 8 components
- ✅ Vector embeddings in `startup_uploads.embedding`
- ✅ Matches in `startup_investor_matches` table
- ✅ Zero red error badges in RSS Manager

**Your ML/AI workflow is now active! 🚀**
