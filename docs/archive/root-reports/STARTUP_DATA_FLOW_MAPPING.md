# STARTUP DATA FLOW MAPPING
## Complete Field Mapping: Scraper → Database → UI → ML Agent → Database

**Last Updated:** December 12, 2025  
**Purpose:** Document data field mappings across the entire startup processing pipeline

---

## 📊 EXECUTIVE SUMMARY

### CRITICAL ISSUES IDENTIFIED:

1. **❌ SCRAPER OUTPUT IS MINIMAL** - Only 4 fields collected
2. **❌ MASSIVE DATA GAP** - ML agent expects 50+ fields, scraper provides 4
3. **❌ NO ENRICHMENT PIPELINE** - Data goes directly from scraper to database without enrichment
4. **❌ MISSING CRITICAL FIELDS** - No founders, advisors, funding_rounds, retention, adoption, scalability data

### DATA FLOW PROBLEMS:

```
SCRAPER OUTPUT (4 fields)
    ↓ [NO ENRICHMENT]
DATABASE (expects 50+ fields)
    ↓ [MISSING DATA]
UI COMPONENT (needs 35+ fields)
    ↓ [INCOMPLETE DATA]
ML AGENT (requires 50+ fields for scoring)
    ↓ [USES DEFAULTS/ZEROS]
DATABASE (stores incomplete scores)
```

---

## 1️⃣ SCRAPER OUTPUT (intelligent-scraper.js)

### Current Fields Scraped:
```javascript
// intelligent-scraper.js extracts ONLY these fields:
{
  "name": "string",           // ✅ Company name
  "description": "string",    // ✅ Brief description (< 200 chars)
  "category": "string",       // ✅ Industry/Category
  "url": "string"            // ✅ Website URL
}
```

### Saved to Database:
```javascript
// Line 285-290: discovered_startups table insert
INSERT INTO discovered_startups (
  name,              // ← Scraper field: name
  website,           // ← Scraper field: url
  description,       // ← Scraper field: description
  article_url,       // ← Source URL (where scraped from)
  discovered_at,     // ← Timestamp (auto)
  imported_to_startups  // ← Boolean false (not yet imported)
)
```

### ⚠️ MISSING FROM SCRAPER:
- Team/Founders data
- Funding information
- Traction metrics (revenue, users, growth)
- Product details (launched, demo, IP)
- Advisors
- Funding rounds
- Customer metrics (retention, adoption)
- Scalability indicators

---

## 2️⃣ DATABASE SCHEMA (startup_uploads table)

### Full Schema (supabase/migrations/create_investors_and_uploads.sql):

```sql
CREATE TABLE startup_uploads (
  id UUID PRIMARY KEY,
  
  -- Basic Info (4 fields from scraper)
  name TEXT NOT NULL,              -- ✅ From scraper
  description TEXT,                -- ✅ From scraper
  website TEXT,                    -- ✅ From scraper (as "url")
  tagline TEXT,                    -- ❌ NOT from scraper
  
  -- Pitch/Story
  pitch TEXT,                      -- ❌ NOT from scraper
  linkedin TEXT,                   -- ❌ NOT from scraper
  
  -- Funding
  raise_amount TEXT,               -- ❌ NOT from scraper
  raise_type TEXT,                 -- ❌ NOT from scraper
  stage INTEGER,                   -- ❌ NOT from scraper
  
  -- Upload Metadata
  source_type TEXT,                -- Set to 'url' by scraper
  source_url TEXT,                 -- Article URL where found
  deck_filename TEXT,              -- NULL (scraper doesn't upload decks)
  
  -- CRITICAL: All additional data stored here
  extracted_data JSONB,            -- ❌ NULL from scraper (expects enrichment)
  
  -- Processing Status
  status TEXT DEFAULT 'pending',   -- Set to 'pending'
  admin_notes TEXT,
  
  -- Submitter Info
  submitted_by UUID,               -- NULL (auto-discovery)
  submitted_email TEXT,            -- NULL
  
  -- Timestamps
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by UUID
)
```

### Expected `extracted_data` JSONB Structure:
```typescript
// From server/services/autoMatchService.ts and store.ts
extracted_data: {
  // Team Data (MISSING FROM SCRAPER)
  team?: Array<{
    name: string;
    role: string;
    background?: string;
    previousCompanies?: string[];
    education?: string;
  }>;
  founders_count?: number;
  technical_cofounders?: number;
  
  // Traction Data (MISSING FROM SCRAPER)
  revenue?: number;
  mrr?: number;
  arr?: number;
  active_users?: number;
  growth_rate?: number;
  customers?: number;
  signed_contracts?: number;
  churn_rate?: number;
  retention_rate?: number;
  prepaying_customers?: number;
  gmv?: number;
  
  // Product Data (MISSING FROM SCRAPER)
  demo_available?: boolean;
  launched?: boolean;
  unique_ip?: boolean;
  defensibility?: string;
  mvp_stage?: boolean;
  
  // Market Data (MISSING FROM SCRAPER)
  market_size?: number;
  industries?: string[];
  sectors?: string[];
  problem?: string;
  solution?: string;
  
  // Funding Data (MISSING FROM SCRAPER)
  previous_funding?: number;
  backed_by?: string[];
  funding_needed?: number;
  runway_months?: number;
  burn_rate?: number;
  use_of_funds?: string;
  next_milestone?: string;
  
  // Advisors (MISSING FROM SCRAPER)
  advisors?: Array<{
    name: string;
    background: string;
    role: string;
  }>;
  
  // Partnerships (MISSING FROM SCRAPER)
  strategic_partners?: Array<{
    name: string;
    type: string;
    relationship_stage: string;
  }>;
  
  // Problem Validation (MISSING FROM SCRAPER)
  customer_interviews_conducted?: number;
  customer_pain_data?: {
    cost_of_problem?: number;
    time_wasted_hours?: number;
    frequency?: string;
    willingness_to_pay_validated?: boolean;
  };
  icp_clarity?: string;
  problem_discovery_depth?: string;
  
  // Five Points Format (MISSING FROM SCRAPER)
  fivePoints?: string[];  // [value_prop, market, unique, team, funding]
  
  // VIBE Score Fields (MISSING FROM SCRAPER)
  value_proposition?: string;
  team_companies?: string[];
}
```

---

## 3️⃣ UI COMPONENT (StartupCardOfficial.tsx)

### Expected Props Interface:
```typescript
interface Startup {
  // Basic Info
  id: number | string;
  name: string;                    // ✅ From scraper
  tagline?: string;                // ❌ Missing
  pitch?: string;                  // ❌ Missing
  description?: string;            // ✅ From scraper
  
  // Display Fields
  sectors?: string[];              // ❌ Missing (category from scraper not used)
  stage?: number;                  // ❌ Missing
  location?: string;               // ❌ Missing
  website?: string;                // ✅ From scraper
  linkedin?: string;               // ❌ Missing
  
  // Funding
  raise_amount?: string;           // ❌ Missing
  raise_type?: string;             // ❌ Missing
  
  // Metrics (for display)
  team_size?: number;              // ❌ Missing
  revenue_annual?: number;         // ❌ Missing
  mrr?: number;                    // ❌ Missing
  growth_rate_monthly?: number;    // ❌ Missing
  has_technical_cofounder?: boolean; // ❌ Missing
  is_launched?: boolean;           // ❌ Missing
  
  // GOD Scores (calculated by ML)
  total_god_score?: number;        // ❌ Calculated from incomplete data
  team_score?: number;             // ❌ Calculated from incomplete data
  traction_score?: number;         // ❌ Calculated from incomplete data
  market_score?: number;           // ❌ Calculated from incomplete data
  product_score?: number;          // ❌ Calculated from incomplete data
  vision_score?: number;           // ❌ Calculated from incomplete data
  
  // VIBE Fields
  value_proposition?: string;      // ❌ Missing
  problem?: string;                // ❌ Missing
  solution?: string;               // ❌ Missing
  market_size?: string;            // ❌ Missing
  team_companies?: string[];       // ❌ Missing
  
  // Social
  yesVotes?: number;
  noVotes?: number;
  fivePoints?: string[];           // ❌ Missing
}
```

### Component Rendering:
- **Name Display**: Uses `startup.name` ✅
- **Tagline**: Uses `startup.tagline` ❌ (missing)
- **Stage Badge**: Uses `startup.stage` ❌ (missing)
- **Metrics Cards**: Revenue, MRR, Growth Rate ❌ (all missing)
- **Five Points**: Uses `startup.fivePoints` ❌ (missing)
- **GOD Score**: Uses `startup.total_god_score` ❌ (calculated from incomplete data)

---

## 4️⃣ ML AGENT (startupScoringService.ts + autoMatchService.ts)

### Required Fields for Scoring:

#### Team Scoring (0-3 points):
```typescript
// REQUIRED:
founders_count?: number;           // ❌ Missing
technical_cofounders?: number;     // ❌ Missing
team?: Array<{                     // ❌ Missing
  name: string;
  role: string;
  background?: string;
  previousCompanies?: string[];
  education?: string;
}>;
```

#### Traction Scoring (0-3 points):
```typescript
// REQUIRED:
revenue?: number;                  // ❌ Missing
mrr?: number;                      // ❌ Missing
active_users?: number;             // ❌ Missing
growth_rate?: number;              // ❌ Missing
customers?: number;                // ❌ Missing
signed_contracts?: number;         // ❌ Missing
retention_rate?: number;           // ❌ Missing - USER REQUESTED
churn_rate?: number;               // ❌ Missing
prepaying_customers?: number;      // ❌ Missing
gmv?: number;                      // ❌ Missing
```

#### Market Scoring (0-2 points):
```typescript
// REQUIRED:
market_size?: number;              // ❌ Missing
industries?: string[];             // ⚠️ Has "category" but not array
problem?: string;                  // ❌ Missing
solution?: string;                 // ❌ Missing
```

#### Product Scoring (0-2 points):
```typescript
// REQUIRED:
demo_available?: boolean;          // ❌ Missing
launched?: boolean;                // ❌ Missing
unique_ip?: boolean;               // ❌ Missing
defensibility?: string;            // ❌ Missing - SCALABILITY INDICATOR
mvp_stage?: boolean;               // ❌ Missing
```

#### Ecosystem Scoring (0-1.5 points):
```typescript
// REQUIRED:
advisors?: Array<{                 // ❌ Missing - USER REQUESTED
  name: string;
  background: string;
  role: string;
}>;
strategic_partners?: Array<{       // ❌ Missing
  name: string;
  type: string;
  relationship_stage: string;
}>;
```

#### Problem Validation Scoring (0-2 points):
```typescript
// REQUIRED:
customer_interviews_conducted?: number;  // ❌ Missing - ADOPTION INDICATOR
customer_pain_data?: {                   // ❌ Missing
  cost_of_problem?: number;
  time_wasted_hours?: number;
  frequency?: string;
  willingness_to_pay_validated?: boolean;
};
icp_clarity?: string;                    // ❌ Missing
problem_discovery_depth?: string;        // ❌ Missing
```

#### Funding/Financial Scoring:
```typescript
// REQUIRED:
previous_funding?: number;         // ❌ Missing - FUNDING ROUNDS
backed_by?: string[];              // ❌ Missing
funding_needed?: number;           // ❌ Missing
runway_months?: number;            // ❌ Missing
burn_rate?: number;                // ❌ Missing
use_of_funds?: string;             // ❌ Missing
```

#### Valuation Updates:
```typescript
// NOT IN CURRENT SCHEMA - USER REQUESTED
valuation_history?: Array<{        // ❌ Missing - USER REQUESTED
  date: string;
  valuation: number;
  round_type: string;
}>;
```

### Current ML Behavior:
```typescript
// From autoMatchService.ts line 104-130
const hotScore = calculateHotScore({
  team: startup.team,                    // ❌ NULL → Score: 0
  founders_count: startup.founders_count, // ❌ NULL → Score: 0
  technical_cofounders: startup.technical_cofounders, // ❌ NULL → Score: 0
  revenue: startup.revenue,              // ❌ NULL → Score: 0
  mrr: startup.mrr,                      // ❌ NULL → Score: 0
  active_users: startup.active_users,    // ❌ NULL → Score: 0
  growth_rate: startup.growth_rate,      // ❌ NULL → Score: 0
  customers: startup.customers,          // ❌ NULL → Score: 0
  // ... ALL FIELDS NULL
});

// Result: Hot Score = 5/10 (MINIMUM BASE BOOST)
// Breakdown: Team 0, Traction 0, Market 0.5, Product 0.5, Vision 0.5
// Match Count: 5 (minimum)
```

---

## 5️⃣ DATA FLOW GAPS

### Gap Analysis:

| Field Category | Scraper Provides | Database Expects | UI Needs | ML Needs | Gap Size |
|---------------|------------------|------------------|----------|----------|----------|
| **Basic Info** | 4 fields | 10 fields | 10 fields | 5 fields | ⚠️ Medium |
| **Team Data** | 0 fields | 7 fields | 5 fields | 7 fields | ❌ Critical |
| **Traction** | 0 fields | 12 fields | 6 fields | 12 fields | ❌ Critical |
| **Product** | 0 fields | 5 fields | 3 fields | 5 fields | ❌ High |
| **Market** | 1 field | 6 fields | 5 fields | 6 fields | ❌ High |
| **Funding** | 0 fields | 10 fields | 3 fields | 8 fields | ❌ Critical |
| **Advisors** | 0 fields | 3 fields | 0 fields | 3 fields | ❌ High |
| **Partnerships** | 0 fields | 4 fields | 0 fields | 4 fields | ⚠️ Medium |
| **Validation** | 0 fields | 8 fields | 0 fields | 8 fields | ❌ Critical |
| **Valuation** | 0 fields | 0 fields | 0 fields | 0 fields | ❌ Missing |
| **Funding Rounds** | 0 fields | 0 fields | 0 fields | 1 field | ❌ Missing |

### User-Requested Fields Status:

#### ❌ FOUNDERS:
- **Scraper**: Not collected
- **Database**: Expected in `extracted_data.team` array
- **UI**: Not displayed
- **ML**: Required for team_score (0-3 points)
- **Status**: MISSING

#### ❌ ADVISORS:
- **Scraper**: Not collected
- **Database**: Expected in `extracted_data.advisors` array
- **UI**: Not displayed
- **ML**: Required for ecosystem_score (0-1.5 points)
- **Status**: MISSING

#### ❌ FUNDING ROUNDS:
- **Scraper**: Not collected
- **Database**: No dedicated table (should be separate table)
- **UI**: Not displayed
- **ML**: Uses `previous_funding` number, not history
- **Status**: MISSING - Needs separate `funding_rounds` table

#### ❌ VALUATION UPDATES:
- **Scraper**: Not collected
- **Database**: Not in schema
- **UI**: Not displayed
- **ML**: Not used
- **Status**: MISSING - Needs new table/field

#### ❌ RETENTION RATE:
- **Scraper**: Not collected
- **Database**: Expected in `extracted_data.retention_rate`
- **UI**: Not displayed
- **ML**: Required for traction_score (0-3 points)
- **Status**: MISSING

#### ❌ CUSTOMER ADOPTION:
- **Scraper**: Not collected
- **Database**: Expected in `extracted_data.customer_interviews_conducted`
- **UI**: Not displayed
- **ML**: Required for problem_validation_score (0-2 points)
- **Status**: MISSING

#### ❌ SCALABILITY:
- **Scraper**: Not collected
- **Database**: Expected in `extracted_data.defensibility`
- **UI**: Not displayed
- **ML**: Required for product_score (0-2 points)
- **Status**: MISSING

---

## 6️⃣ SOLUTIONS REQUIRED

### Immediate Actions:

#### 1. **Enhance Scraper with AI Enrichment**

**Current Scraper** (intelligent-scraper.js line 75-135):
```javascript
// CURRENT: Only extracts basic fields
const userPrompt = `Extract:
1. STARTUPS (Companies, Products)
   - Name
   - Description (brief, under 200 chars)
   - Industry/Category
   - URL if available
`;
```

**ENHANCED Scraper** (REQUIRED):
```javascript
// ENHANCED: Extract comprehensive data
const userPrompt = `Extract comprehensive startup data:

1. BASIC INFO:
   - Name (company name)
   - Tagline (one-sentence value prop, max 60 chars)
   - Description (brief overview, max 200 chars)
   - Website URL
   - LinkedIn URL
   - Industry/Sectors (array)

2. FOUNDERS & TEAM:
   - Founders (array of names, roles, backgrounds)
   - Founder count
   - Technical co-founders count
   - Notable previous companies (array)
   - Education (universities)

3. TRACTION METRICS:
   - Revenue (annual or MRR)
   - Active users
   - Customers count
   - Growth rate (% monthly)
   - Retention rate (% monthly)
   - Notable traction milestones

4. PRODUCT:
   - Is launched (boolean)
   - Demo available (boolean)
   - Has unique IP (boolean)
   - Product description
   - Key differentiators

5. MARKET:
   - Problem being solved
   - Solution description
   - Market size (TAM/SAM)
   - Target customer

6. FUNDING:
   - Previous funding raised
   - Current raise amount/type
   - Notable investors/backers
   - Funding stage

7. ADVISORS:
   - Advisor names and backgrounds (if mentioned)

Return JSON in this format:
{
  "name": "string",
  "tagline": "string",
  "description": "string",
  "website": "string",
  "linkedin": "string",
  "sectors": ["string"],
  "founders": [{
    "name": "string",
    "role": "string",
    "background": "string",
    "previousCompanies": ["string"],
    "education": "string"
  }],
  "founders_count": number,
  "technical_cofounders": number,
  "revenue": number,
  "mrr": number,
  "active_users": number,
  "growth_rate": number,
  "customers": number,
  "retention_rate": number,
  "launched": boolean,
  "demo_available": boolean,
  "unique_ip": boolean,
  "problem": "string",
  "solution": "string",
  "market_size": number,
  "previous_funding": number,
  "raise_amount": "string",
  "raise_type": "string",
  "backed_by": ["string"],
  "advisors": [{
    "name": "string",
    "background": "string",
    "role": "string"
  }]
}
`;
```

#### 2. **Update Database Save Logic**

**Current** (intelligent-scraper.js line 285-290):
```javascript
// ONLY saves 4 fields
INSERT INTO discovered_startups (name, website, description, article_url)
```

**REQUIRED**:
```javascript
// Save to startup_uploads with full extracted_data
INSERT INTO startup_uploads (
  name,
  description,
  tagline,
  website,
  linkedin,
  source_type,
  source_url,
  status,
  extracted_data  // ← Store ALL enriched data here as JSONB
)
VALUES (
  $1,  // name
  $2,  // description
  $3,  // tagline
  $4,  // website
  $5,  // linkedin
  'scraper',  // source_type
  $6,  // article_url
  'pending',
  $7::jsonb  // extracted_data (full JSON object)
)
```

#### 3. **Create Missing Database Tables**

**funding_rounds table** (NEW - Required):
```sql
CREATE TABLE funding_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  round_type TEXT NOT NULL,  -- Seed, Series A, B, C, etc.
  amount NUMERIC,            -- Funding amount in USD
  valuation NUMERIC,         -- Post-money valuation
  date DATE,                 -- Funding date
  lead_investor TEXT,        -- Lead investor name
  investors TEXT[],          -- Array of investor names
  announced BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_funding_rounds_startup ON funding_rounds(startup_id);
CREATE INDEX idx_funding_rounds_date ON funding_rounds(date DESC);
```

**valuation_history table** (NEW - Required):
```sql
CREATE TABLE valuation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  valuation NUMERIC NOT NULL,
  valuation_type TEXT,  -- pre-money, post-money, market
  date DATE NOT NULL,
  source TEXT,          -- Where valuation came from
  round_type TEXT,      -- Associated funding round
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_valuation_history_startup ON valuation_history(startup_id);
CREATE INDEX idx_valuation_history_date ON valuation_history(date DESC);
```

#### 4. **Update ML Scoring Service**

**Add Null Checks** (server/services/startupScoringService.ts):
```typescript
// CURRENT: Assumes data exists
function scoreTeam(startup: StartupProfile): number {
  let score = 0;
  
  if (startup.technical_cofounders && startup.founders_count) {
    // Scores...
  }
  
  return score;  // Returns 0 if no data
}

// ENHANCED: Provide feedback on missing data
function scoreTeam(startup: StartupProfile): number {
  let score = 0;
  const missingFields: string[] = [];
  
  if (!startup.founders_count) missingFields.push('founders_count');
  if (!startup.technical_cofounders) missingFields.push('technical_cofounders');
  if (!startup.team || startup.team.length === 0) missingFields.push('team');
  
  if (missingFields.length > 0) {
    console.warn(`⚠️ Team scoring limited - missing: ${missingFields.join(', ')}`);
  }
  
  if (startup.technical_cofounders && startup.founders_count) {
    // Scores...
  }
  
  return score;
}
```

#### 5. **Create Data Quality Dashboard**

Track data completeness for each startup:
```typescript
interface DataQualityReport {
  startup_id: string;
  startup_name: string;
  completeness_score: number;  // 0-100
  missing_fields: {
    basic_info: string[];      // Missing: tagline, linkedin, etc.
    team: string[];            // Missing: founders, team, etc.
    traction: string[];        // Missing: revenue, users, etc.
    product: string[];         // Missing: launched, demo, etc.
    market: string[];          // Missing: problem, solution, etc.
    funding: string[];         // Missing: previous_funding, etc.
    ecosystem: string[];       // Missing: advisors, partners, etc.
    validation: string[];      // Missing: customer_interviews, etc.
  };
  impact_on_scoring: {
    team_score_limited: boolean;
    traction_score_limited: boolean;
    market_score_limited: boolean;
    product_score_limited: boolean;
    ecosystem_score_limited: boolean;
    validation_score_limited: boolean;
  };
}
```

---

## 7️⃣ FIELD-BY-FIELD MAPPING TABLE

| Field Name | Scraper Output | DB Column | DB extracted_data | UI Component | ML Scoring | Status |
|-----------|----------------|-----------|-------------------|--------------|------------|---------|
| **name** | ✅ name | ✅ name | - | ✅ name | ✅ Used | ✅ COMPLETE |
| **description** | ✅ description | ✅ description | - | ✅ description | ⚠️ Used | ✅ COMPLETE |
| **website** | ✅ url | ✅ website | - | ✅ website | - | ✅ COMPLETE |
| **category** | ✅ category | - | ⚠️ industries | ⚠️ sectors | ⚠️ industries | ⚠️ PARTIAL |
| **tagline** | ❌ | ✅ tagline | ✅ tagline | ✅ tagline | ✅ Used | ❌ MISSING |
| **linkedin** | ❌ | ✅ linkedin | - | ✅ linkedin | - | ❌ MISSING |
| **pitch** | ❌ | ✅ pitch | ✅ pitch | ✅ pitch | ✅ Used | ❌ MISSING |
| **stage** | ❌ | ✅ stage | - | ✅ stage | ✅ Used | ❌ MISSING |
| **raise_amount** | ❌ | ✅ raise_amount | - | ✅ raise_amount | - | ❌ MISSING |
| **raise_type** | ❌ | ✅ raise_type | - | ✅ raise_type | - | ❌ MISSING |
| **founders** | ❌ | - | ✅ team[] | - | ✅ Required | ❌ MISSING |
| **founders_count** | ❌ | - | ✅ founders_count | - | ✅ Required | ❌ MISSING |
| **technical_cofounders** | ❌ | - | ✅ technical_cofounders | ✅ has_technical | ✅ Required | ❌ MISSING |
| **revenue** | ❌ | - | ✅ revenue | ✅ revenue_annual | ✅ Required | ❌ MISSING |
| **mrr** | ❌ | - | ✅ mrr | ✅ mrr | ✅ Required | ❌ MISSING |
| **active_users** | ❌ | - | ✅ active_users | - | ✅ Required | ❌ MISSING |
| **growth_rate** | ❌ | - | ✅ growth_rate | ✅ growth_rate_monthly | ✅ Required | ❌ MISSING |
| **customers** | ❌ | - | ✅ customers | - | ✅ Required | ❌ MISSING |
| **retention_rate** | ❌ | - | ✅ retention_rate | - | ✅ Required | ❌ MISSING |
| **launched** | ❌ | - | ✅ launched | ✅ is_launched | ✅ Required | ❌ MISSING |
| **demo_available** | ❌ | - | ✅ demo_available | - | ✅ Required | ❌ MISSING |
| **unique_ip** | ❌ | - | ✅ unique_ip | - | ✅ Required | ❌ MISSING |
| **defensibility** | ❌ | - | ✅ defensibility | - | ✅ Required | ❌ MISSING |
| **problem** | ❌ | - | ✅ problem | ✅ problem | ✅ Required | ❌ MISSING |
| **solution** | ❌ | - | ✅ solution | ✅ solution | ✅ Required | ❌ MISSING |
| **market_size** | ❌ | - | ✅ market_size | ✅ market_size | ✅ Required | ❌ MISSING |
| **previous_funding** | ❌ | - | ✅ previous_funding | - | ✅ Required | ❌ MISSING |
| **backed_by** | ❌ | - | ✅ backed_by | - | ✅ Used | ❌ MISSING |
| **advisors** | ❌ | - | ✅ advisors[] | - | ✅ Required | ❌ MISSING |
| **strategic_partners** | ❌ | - | ✅ strategic_partners[] | - | ✅ Used | ❌ MISSING |
| **customer_interviews** | ❌ | - | ✅ customer_interviews | - | ✅ Required | ❌ MISSING |
| **value_proposition** | ❌ | - | ✅ value_proposition | ✅ value_proposition | ✅ Used | ❌ MISSING |
| **team_companies** | ❌ | - | ✅ team_companies | ✅ team_companies | ✅ Used | ❌ MISSING |
| **funding_rounds** | ❌ | - | - | - | ⚠️ Partial | ❌ MISSING TABLE |
| **valuation_history** | ❌ | - | - | - | - | ❌ MISSING TABLE |

---

## 8️⃣ RECOMMENDATIONS

### Priority 1 (CRITICAL):
1. **Enhance intelligent-scraper.js** with comprehensive AI extraction
2. **Update database save** to populate extracted_data JSONB
3. **Create funding_rounds table** for historical funding data
4. **Create valuation_history table** for valuation tracking

### Priority 2 (HIGH):
1. **Add data validation** in scraper to ensure minimum fields
2. **Create enrichment pipeline** for post-scrape data enhancement
3. **Update ML scoring** to handle missing data gracefully
4. **Add data completeness dashboard** for monitoring

### Priority 3 (MEDIUM):
1. **Create manual data entry forms** for missing fields
2. **Add API integrations** (Crunchbase, PitchBook) for automatic enrichment
3. **Implement data quality scoring** system
4. **Create admin tools** for bulk data editing

---

## 9️⃣ IMPACT ANALYSIS

### Current State:
- **Scraper Coverage**: 4/50+ fields (8%)
- **ML Scoring Accuracy**: Low (most fields null)
- **UI Data Completeness**: 10-20%
- **Match Quality**: Limited (vector similarity only, no business logic)

### After Fixes:
- **Scraper Coverage**: 40/50+ fields (80%)
- **ML Scoring Accuracy**: High (comprehensive data)
- **UI Data Completeness**: 80-90%
- **Match Quality**: High (business logic + ML)

---

**END OF MAPPING DOCUMENT**
