# Tiered Scraping Architecture

## Overview

This document describes the comprehensive tiered scraping architecture for Hot Match, designed to process 200-500 startups per day while minimizing costs.

## Schema

### Startup Card Schema (V2)

#### A) Identity (dedupe backbone)
- `startup_id` (UUID) - Assigned on save
- `canonical_domain` (TEXT) - Primary key for dedupe (e.g., "acme.ai")
- `company_name` (TEXT)
- `aliases[]` (JSONB) - Name variants
- `website_url` (TEXT)
- `hq_location` (JSONB) - {city, region, country}
- `founded_year` (INTEGER)
- `status` (TEXT) - active / acquired / dead / unknown

#### B) Snapshot (investor-facing)
- `one_liner` (TEXT) - ≤160 chars
- `category_primary` (TEXT) - Enum
- `category_tags[]` (JSONB) - Secondary tags
- `stage_estimate` (TEXT) - pre-seed/seed/A/etc
- `stage_confidence` (NUMERIC) - 0.00-1.00
- `product_description_short` (TEXT) - 1-3 sentences
- `problem` (TEXT)
- `solution` (TEXT)

#### C) Signals (GOD inputs)
Stored in `extracted_data` JSONB:
- `traction_signals[]` - {type, value, evidence_url, evidence_snippet, date, confidence}
- `team_signals[]` - {person_name, role, prior_orgs[], evidence_url, confidence}
- `market_signals[]` - {tam_hint, ICP_hint, pricing_hint, evidence_url, confidence}
- `moat_signals[]` - {type, claim, evidence_url, confidence}

#### D) Funding / Investor Signals
- `funding_mentions[]` (JSONB) - {round, amount, date, investors[], evidence_url, confidence}
- `investor_mentions[]` (JSONB) - If round unknown
- `accelerators[]` (JSONB) - YC, Techstars, etc.

#### E) Evidence + Crawl Metadata
- `evidence[]` (JSONB) - {url, source, snippet, captured_at}
- `source_first_seen` (TIMESTAMP)
- `source_last_seen` (TIMESTAMP)
- `crawl_history[]` (JSONB) - {source, fetched_at, method, success, http_status, parse_version}
- `field_provenance` (JSONB) - field -> {source_url, extractor, confidence, timestamp}

#### F) GOD Outputs
- `god_score_total` (INTEGER) - 0-100
- `god_score_components` (JSONB) - {grit, opportunity, determination}
- `god_reason_codes[]` (JSONB) - Human-readable bullet reasons
- `god_risk_flags[]` (JSONB) - e.g., "unclear product", "no domain", etc.
- `god_model_version` (TEXT)

## Tiering Strategy

### Tier 0: Structured Sources (Free)
**Goal**: Create a lead with identity + evidence

**Extract**:
- Company name
- Possible website URL/domain
- Source URL (article/listing)
- Date
- 1-2 text snippets around the mention

**Sources**: RSS, sitemaps, press pages, "latest" pages, directories, job boards, newsletters

**Cost**: $0

### Tier 1: Lightweight HTML/JSON (Cheap)
**Goal**: Fill 60-80% of the card reliably

**Extract**:
- Canonical domain + OpenGraph/site title
- JSON-LD org fields (name, url, location)
- One-liner from meta description / hero text
- Category guess from keywords + nav structure
- Stage estimate heuristics ("seed", "Series A", "hiring", "stealth")
- Team names from "About" page if present
- Funding mentions from article text or embedded JSON

**Cost**: Minimal (HTTP requests only)

### Tier 2: Browser + AI (Expensive)
**Goal**: Complete fields only when Tier 1 confidence is low OR startup ranks high

**Use Browser For**:
- JS-only pages
- Infinite scroll lists
- "Load more" buttons
- Gated content (publicly viewable)

**Use LLM For** (small slice, only for score-moving ambiguity):
- Entity resolution edge cases
- Extracting structured funding/team info from messy text
- Compressing 3-5 evidence snippets into clean investor-facing summary
- Classifying category/stage when heuristics disagree

**Rule**: If startup won't make top cohort after Early GOD, don't spend tokens.

**Cost**: High (browser time + LLM tokens)

## Gating Matrix

### Step 1: Identity Gate (Hard Fail)
If any of these are true → do NOT LLM yet (re-crawl / try alternate evidence):

- ❌ No canonical_domain
- ❌ Domain is generic host (linktree, notion, substack, medium) with no official site found
- ❌ Company name too short/ambiguous ("Halo", "Nova", "Pilot")

**Fix**: Run "domain finder" (Tier 1) from evidence

### Step 2: Completeness Gate (Browser)
Escalate to Tier 2 if:

- ❌ one_liner missing AND site is JS-rendered
- ❌ category/stage confidence < 0.6
- ❌ team_signals empty AND "About/Team" route exists but is JS-only
- ❌ Startup is in top X% of Early GOD and missing key fields

### Step 3: Score-Impact Gate (LLM)
Only call LLM if:

- ✅ Startup is in top 5-15% of Early GOD AND
- ✅ Missing/uncertain field would likely change GOD by ≥ threshold (5-10 points)

**Examples**:
- "Is this enterprise or consumer?" (affects investor matching)
- "Is this actually funded / YC-backed?" (affects credibility)
- "Is traction real or marketing fluff?" (affects opportunity/determination)

## Dedupe + Entity Resolution

### Primary Key Strategy
**Canonical domain is king.**

If domain unknown: use provisional key = hash of (normalized_name + location + category_guess) until domain is found.

### Merge Rules

#### Auto-merge (high confidence):
- ✅ Same canonical domain
- ✅ One record's website redirects to the other
- ✅ Both share same LinkedIn company page / Crunchbase ID / GitHub org

#### Probable merge (needs confidence score):
- ✅ High fuzzy name match + same city/sector + shared founder name

#### Never auto-merge:
- ❌ Name matches but domains differ and both look legitimate
- ❌ One is a product and one is a parent company (need parent/child link)

### Evidence Graph Approach
Store all sightings as edges:
```
startup_node ←(mentioned_in)— source_article_node
```

Even if parser changes, you keep provenance and can re-extract later.

## Daily Pipeline (200-500/day)

### A) Ingest
Pull 5k-50k "items" (articles, listings, posts) daily
Extract leads (Tier 0): (name, possible URL, evidence URL, snippet)

### B) Normalize + Dedupe
- Resolve/assign canonical domain
- Merge into startup graph

### C) Early GOD Scoring (cheap, fast)
Runs only on Tier 0/1 fields:
- Keyword + metadata signals
- Velocity signals (mentions across sources, hiring, dev activity)
- Credibility signals (accelerator mentions, reputable press)
- Basic product clarity

### D) Enrichment for Winners
- Only top X% go to Tier 2 browser
- Only a subset of those go to paid LLM calls

### E) Investor Matching
- Hard filters first (stage/sector/geo/check size)
- Similarity/graph boosts second
- Output: 5-20 best investors per startup with reason codes

## Cost-Control Inference Engine

Three models:

1. **Classifier** (free/cheap): Category/stage/quality estimate from Tier 1 text
   - Rules + small local model + embeddings

2. **Ranker** (cheap): Early GOD score
   - Heuristics + signals

3. **Verifier** (expensive): LLM only to resolve contradictions or fill missing score-moving fields
   - Only for top 5-15% of startups

This keeps token usage proportional to value, not volume.

## Minimum Viable Card (500/day)

### Required (must have):
- ✅ Canonical domain
- ✅ Company name
- ✅ One-liner
- ✅ Category_primary
- ✅ Stage_estimate
- ✅ 3 evidence URLs/snippets
- ✅ Early GOD score + 3 reason codes

### Nice-to-have (enrich only for top cohort):
- Team signals
- Traction signals
- Funding mentions
- Investor mentions

This alone is enough to produce daily investor-ready queues without blowing budget.

## Implementation Files

- `supabase/migrations/upgrade_to_comprehensive_startup_schema.sql` - Database migration
- `lib/data-contracts-v2.js` - StartupContractV2 class
- `lib/inference-gate-v2.js` - Gating matrix implementation
- `lib/entity-resolver-v2.js` - Canonical domain dedupe
- `lib/tiered-extractors.js` - Tier 0/1/2 extraction logic

## Next Steps

1. Run migration: `upgrade_to_comprehensive_startup_schema.sql`
2. Update `tiered-scraper-pipeline.js` to use V2 contracts
3. Test gating matrix with real data
4. Monitor cost per startup (target: <$0.10 for Tier 0/1, <$1.00 for Tier 2)


