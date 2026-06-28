# 🏗️ Scraper Architecture V2: Tiered Ingestion System

## Core Philosophy
**"Capture enough signal to rank + match, then selectively deepen only the winners."**

## 3-Tier Ingestion Ladder

### Tier 0: Structured Sources (Cheapest, Highest Stability)
- RSS feeds ✅ (already have)
- Sitemaps
- JSON endpoints (API responses)
- Public datasets
- Newsletter emails → structured items

**Output**: Startup lead records (name, URL, context URL, timestamp, source, key strings)

### Tier 1: Lightweight Extraction (No Browser)
- `requests`/`http` + HTML parse
- Embedded JSON extraction (`__NEXT_DATA__`, `apolloState`, script tags)
- Metadata extraction (OpenGraph, schema.org JSON-LD)

**Output**: Normalized fields for early GOD scoring:
- category
- stage hints
- traction keywords
- team hints
- geography
- investor mentions

### Tier 2: Browser + AI (Only When Needed)
- Playwright/Stagehand for:
  - JS-rendered content
  - Sites requiring interaction/scroll
  - Pages where Tier 1 confidence is low
- LLM calls for top 5-15% where incremental signal changes decisions

## Data Contracts + Confidence Scoring

### Startup Data Contract
```typescript
interface StartupContract {
  // Required fields
  startup_id: string;        // Canonical domain or stable hash
  name: string;
  website: string;
  one_liner: string;
  
  // Categorized fields
  category: string[];         // Enum
  stage: string;              // Enum: pre-seed/seed/A/B/etc
  
  // Signal arrays
  traction_signals: Array<{
    text: string;
    source_url: string;
    confidence: number;
  }>;
  
  team_signals: Array<{
    role: string;
    prior_company?: string;
    source_url: string;
    confidence: number;
  }>;
  
  investor_signals: Array<{
    name: string;
    source_url: string;
    confidence: number;
  }>;
  
  // Evidence
  source_evidence: Array<{
    url: string;
    snippet: string;
    timestamp: string;
  }>;
  
  // Metadata
  confidence_scores: {
    overall: number;
    name: number;
    website: number;
    category: number;
    stage: number;
  };
  
  provenance: {
    source: string;
    extraction_method: 'rss' | 'api' | 'html' | 'browser' | 'llm';
    timestamp: string;
    selector?: string;
  };
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. ✅ Data contract definitions
2. ✅ Confidence scoring system
3. ✅ Entity resolution/deduplication service
4. ✅ Tier 0 adapters (RSS, sitemaps)

### Phase 2: Extraction Tiers (Week 2)
1. ✅ Tier 1 extractors (HTML, JSON, metadata)
2. ✅ Tier 2 browser extractors (Playwright/Stagehand)
3. ✅ Confidence-based routing logic

### Phase 3: Inference Gate (Week 3)
1. ✅ Heuristic rules engine
2. ✅ LLM gating logic
3. ✅ Early vs Deep GOD scoring

### Phase 4: Production Pipeline (Week 4)
1. ✅ Per-source adapters
2. ✅ Health checks + observability
3. ✅ Failure artifact storage
4. ✅ Daily pipeline orchestration


