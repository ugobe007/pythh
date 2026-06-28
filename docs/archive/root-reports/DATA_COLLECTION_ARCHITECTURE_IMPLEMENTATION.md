# Data Collection Architecture - Implementation Plan

Based on your comprehensive architecture document, here's what I've gathered from the codebase and a concrete implementation plan.

## 📋 Current State (From Codebase Analysis)

### 1. Table Schemas

#### `startup_uploads` (Main Table)
**Core Fields:**
- `id` (UUID), `name` (TEXT), `website` (TEXT), `linkedin` (TEXT)
- `tagline`, `pitch`, `description`
- `raise_amount`, `raise_type`, `stage` (INTEGER)
- `extracted_data` (JSONB) - Stores AI-extracted fields
- `status` (pending/reviewing/approved/rejected/published)
- `source_type`, `source_url`
- `founders` (JSONB), `sectors` (JSONB), `industries` (JSONB)
- `total_god_score`, `pythia_score`, `founder_voice_score`
- `created_at`, `updated_at`

**Additional JSONB Fields:**
- `ip_filings`, `team_hires`, `advisors`, `board_members`, `customer_traction`

#### `investors` (Main Table)
**Core Fields:**
- `id` (UUID), `name` (TEXT), `firm` (TEXT), `type` (TEXT)
- `website`, `linkedin`, `twitter`, `email`
- `bio`, `tagline`, `description`
- `sectors` (JSONB), `stage` (JSONB), `geography` (TEXT)
- `check_size_min`, `check_size_max` (NUMERIC)
- `fund_size`, `aum` (TEXT)
- `portfolio_count`, `exits`, `unicorns` (INTEGER)
- `notable_investments` (JSONB), `partners` (JSONB)
- `status`, `created_at`, `updated_at`

#### `pythia_speech_snippets` (PYTHIA Table)
- `id` (BIGSERIAL), `entity_id` (UUID), `entity_type` (TEXT)
- `text` (TEXT), `source_url` (TEXT), `date_published` (TIMESTAMPTZ)
- `source_type` (TEXT), `tier` (INTEGER: 1-3)
- `context_label` (TEXT), `text_hash` (TEXT)
- `created_at`, `updated_at`

#### `pythia_scores` (PYTHIA Table)
- `id` (BIGSERIAL), `entity_id` (UUID), `entity_type` (TEXT)
- `pythia_score` (INTEGER 0-100), `confidence` (NUMERIC 0.10-0.95)
- Invariant scores, penalties, optional ontologies
- `source_mix` (JSONB), `breakdown` (JSONB)
- `computed_at`

### 2. Current Seed Sources

**From codebase analysis:**
- **RSS Feeds**: `rss_sources` table (63 active sources)
  - TechCrunch, Crunchbase, VentureBeat, Product Hunt, Hacker News
  - Sources: `server/services/rssScraper.ts`
- **Discovered Startups**: `discovered_startups` table (staging)
  - Feed: RSS article extraction → `discovered_startups` → import to `startup_uploads`
  - Sources: `server/services/startupDiscoveryService.ts`
- **Manual/Deck Uploads**: Direct submissions
- **YC/Product Hunt**: Mentioned in docs but not clearly implemented

**Current Flow:**
```
RSS Articles → AI Extraction (GPT-4o) → discovered_startups → Manual Review → startup_uploads
```

### 3. Current Stack

**Confirmed from `package.json` and codebase:**
- **Node.js** + TypeScript (via tsx)
- **Playwright** - Not directly used, but `@browserbasehq/stagehand` present
- **Stagehand** (`@browserbasehq/stagehand`) - Browser automation
- **Axios** - HTTP requests
- **Cheerio** - HTML parsing
- **Supabase** - Database (Postgres)
- **RSS Parser** - RSS feed parsing
- **No Parse.bot found** - May be legacy/unused

**Current Scraping Approach:**
- RSS feeds (structured XML)
- HTML scraping with Cheerio (investor websites)
- OpenAI GPT-4o for extraction (costly - used in discovery)

### 4. Target Throughput

**From architecture doc:**
- 200-500 startups/day target
- Current: ~149 startups/day (from RSS discovery)
- **Gap**: Need to scale up 2-3x

### 5. Current Limitations

**Identified issues:**
1. **No dynamic API discovery** - Only HTML scraping
2. **No JSON-LD/microdata extraction** - Missing structured data
3. **No GraphQL/Next.js data extraction** - Missing modern APIs
4. **No entity resolution system** - Name ambiguity issues
5. **No provenance/confidence tracking** - Missing for quality scoring
6. **Heavy reliance on OpenAI** - Expensive for extraction
7. **No job queue system** - Sequential processing
8. **Limited seed sources** - Only RSS feeds (need YC, GitHub, etc.)

## 🎯 Implementation Plan

### Phase 1: Foundation (1-3 days) - "Stop the Bleeding"

**Priority: Get basic dynamic API discovery working**

#### 1.1 Create API Discovery Module
**File**: `scripts/data-collection/api-discovery.js`
- Playwright network interception
- Capture XHR/fetch requests
- Identify endpoints (GraphQL, Next.js, Algolia, WordPress JSON)
- Build site profile per domain

#### 1.2 Create Company Profile Extractor
**File**: `scripts/data-collection/company-profile-extractor.js`
- JSON-LD parser (schema.org)
- OpenGraph meta tags
- Footer link discovery
- Sitemap.xml parsing
- robots.txt parsing

#### 1.3 Enhance Seed Sources
**Files**: 
- `scripts/data-collection/seed-yc.js` - YC directory
- `scripts/data-collection/seed-product-hunt.js` - Product Hunt
- `scripts/data-collection/seed-github.js` - GitHub trending

### Phase 2: Dynamic APIs + Deal Graph (1-2 weeks)

#### 2.1 Playwright Network Interceptor
**File**: `scripts/data-collection/playwright-interceptor.js`
- Intercept all network calls
- Store JSON responses
- Identify API patterns
- Build endpoint catalog

#### 2.2 Investor Portfolio Parser
**File**: `scripts/data-collection/investor-portfolio-parser.js`
- Parse portfolio pages (HTML + APIs)
- Extract startup lists
- Cross-enrich startups

#### 2.3 Entity Resolution System
**File**: `scripts/data-collection/entity-resolver.js`
- EntityKey generation (domain-based)
- Name normalization
- Token Jaccard similarity
- Optional: Local embeddings (MiniLM)

### Phase 3: PYTHIA + GOD Feature Pipelines

#### 3.1 Speech Collector Enhancement
**File**: `scripts/data-collection/speech-collector.js`
- HN Algolia (already done ✅)
- RSS feeds (founder blogs, Substack)
- Podcast transcripts (YouTube captions)
- GitHub issues/discussions
- Company blog JSON endpoints

#### 3.2 Feature Extractors
**Files**:
- `scripts/data-collection/constraint-extractor.js`
- `scripts/data-collection/mechanism-extractor.js`
- `scripts/data-collection/reality-extractor.js`
- Use regex/rules (no LLM)

#### 3.3 Confidence + Provenance System
**Database Schema Addition:**
- Add `extraction_metadata` JSONB to `startup_uploads`
- Store: source_url, extracted_at, extraction_method, confidence, evidence_text

### Phase 4: Infrastructure

#### 4.1 Job Queue System
- Use BullMQ + Redis (or simpler: queue in Postgres)
- Concurrent processing per domain
- Retry logic

#### 4.2 Caching System
- Store raw HTML/JSON for reprocessing
- S3 or local file system

#### 4.3 Rate Limiting + Blocking
- Per-domain concurrency limits
- Exponential backoff
- User-Agent rotation

## 🛠️ Concrete Next Steps

### Immediate (This Week)

1. **Create API Discovery Module**
   - Playwright script to intercept network calls
   - Test on 10-20 startup websites
   - Identify common patterns

2. **Enhance Company Profile Extractor**
   - Add JSON-LD parsing
   - Add OpenGraph extraction
   - Add sitemap/robots.txt discovery

3. **Add YC Seed Source**
   - Scrape YC directory (public)
   - Extract: name, website, batch, description
   - Save to `discovered_startups`

### Short-term (Next 2 Weeks)

4. **Build Entity Resolution**
   - EntityKey system
   - Name normalization
   - Deduplication logic

5. **Investor Portfolio Parser**
   - Parse portfolio pages
   - Extract startup lists
   - Cross-link data

6. **Job Queue System**
   - Set up BullMQ or simple Postgres queue
   - Concurrent processing
   - Error handling

## 📊 Database Schema Additions Needed

```sql
-- Add extraction metadata to startup_uploads
ALTER TABLE startup_uploads
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}'::jsonb;

-- Create entity_keys table for resolution
CREATE TABLE IF NOT EXISTS entity_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'startup' or 'investor'
  entity_id UUID NOT NULL,
  entity_key TEXT NOT NULL, -- normalized key
  domain TEXT,
  normalized_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_key)
);

CREATE INDEX idx_entity_keys_key ON entity_keys(entity_key);
CREATE INDEX idx_entity_keys_domain ON entity_keys(domain);

-- Create scraping_jobs queue table
CREATE TABLE IF NOT EXISTS scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'company_profile', 'investor_portfolio', etc.
  target_url TEXT NOT NULL,
  entity_id UUID,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);
CREATE INDEX idx_scraping_jobs_type ON scraping_jobs(job_type);
```

## 🔧 Stack Additions Needed

```json
{
  "dependencies": {
    "playwright": "^1.40.0",
    "jsonld": "^8.3.2",
    "bullmq": "^5.0.0",  // Optional - can use Postgres queue
    "ioredis": "^5.3.2", // If using BullMQ
    "@sentence-transformers/all-MiniLM-L6-v2": "^2.0.0" // Optional - local embeddings
  }
}
```

## ✅ What's Already Done

1. ✅ PYTHIA speech collection (HN forums)
2. ✅ RSS feed scraping
3. ✅ Basic HTML scraping (investors)
4. ✅ Database schemas (startup_uploads, investors, pythia tables)
5. ✅ RSS discovery pipeline

## 🚀 Recommended Starting Point

**Start with Phase 1.1: API Discovery Module**

This will:
- Unlock structured data from modern sites
- Reduce HTML parsing needs
- Provide foundation for all other modules

Should I start implementing the API Discovery Module now?

---

*This document is a living implementation plan. Update as we build.*