# 🏗️ Tiered Scraper Architecture - Implementation Guide

## Overview

This implements a **3-tier ingestion ladder** that prioritizes cost efficiency:
- **Tier 0**: Free structured sources (RSS, APIs)
- **Tier 1**: Cheap HTML/JSON extraction
- **Tier 2**: Expensive browser/AI (only when needed)

## Key Components

### 1. Data Contracts (`lib/data-contracts.js`)
- Typed interfaces with confidence scoring
- Every field has provenance tracking
- Automatic confidence calculation

### 2. Tiered Extractors (`lib/tiered-extractors.js`)
- **Tier0Extractor**: RSS feeds, APIs
- **Tier1Extractor**: HTML parsing, JSON-LD, embedded JSON
- **Tier2Extractor**: Playwright + AI (only when needed)
- **SmartExtractor**: Routes intelligently between tiers

### 3. Entity Resolver (`lib/entity-resolver.js`)
- Deduplication service
- Domain matching (highest confidence)
- Fuzzy name matching (with location/sector boost)
- Evidence merging

### 4. Inference Gate (`lib/inference-gate.js`)
- Decides when to use expensive LLM calls
- Gates based on:
  - Missing canonical domain → re-crawl first
  - High confidence → skip LLM
  - Contradictions → escalate to LLM
  - Low early GOD score → skip enrichment

### 5. Pipeline (`tiered-scraper-pipeline.js`)
- Orchestrates the full flow
- Processes RSS feeds (Tier 0)
- Routes to Tier 1/2 as needed
- Handles deduplication
- Tracks costs

## Usage

### Run the Tiered Pipeline
```bash
node tiered-scraper-pipeline.js
```

### Process Individual Sources
```javascript
const { SmartExtractor } = require('./lib/tiered-extractors');
const contract = await SmartExtractor.extract('https://example.com', 'source-name');
```

## Cost Efficiency

### Before (Old Approach)
- Every startup: Browser + AI = ~$0.01-0.05
- 200 startups/day = $2-10/day

### After (Tiered Approach)
- Tier 0 (RSS): Free
- Tier 1 (HTML): ~$0.0001 per startup
- Tier 2 (Browser/AI): Only 5-15% = ~$0.01-0.05 per startup
- 200 startups/day = $0.10-0.75/day

**Savings: 90-95%**

## Next Steps

1. **Test the pipeline**: `node tiered-scraper-pipeline.js`
2. **Add more Tier 0 sources**: Sitemaps, JSON APIs
3. **Enhance Tier 1**: Better HTML parsing, more embedded JSON patterns
4. **Optimize Tier 2**: Only use when confidence < 0.4
5. **Add observability**: Track costs, success rates, confidence distributions

## Integration with Existing System

The tiered pipeline:
- ✅ Saves to `startup_uploads` (same schema)
- ✅ Uses existing `rss_sources` table
- ✅ Compatible with existing GOD scoring
- ✅ Works with existing matching engine

You can run both systems in parallel:
- Old scrapers: For specific sources (YC, Sequoia, etc.)
- Tiered pipeline: For bulk RSS processing


