# Inference Engine Integration - Real-Time URL Enrichment

## Overview
The inference engine is now integrated into the instant URL submission flow, providing **immediate data enrichment** when users submit startup URLs.

## How It Works

### User Journey
```
User submits "stripe.com"
         ↓
[1] Website scraping (0.5s)
         ↓
[2] Pattern matching on HTML (0.1s)
         ↓
[3] Google News search for "Stripe" ← NEW STEP (2-3s)
         ↓
[4] Extract funding, sectors, traction (0.1s)
         ↓
[5] Calculate GOD score with enriched data (0.2s)
         ↓
[6] Generate matches (1-2s)
         ↓
Show rich startup card with:
  ✓ Sectors: FinTech, SaaS
  ✓ Funding: $2.2B Series I
  ✓ Revenue: $7.4B ARR
  ✓ Customers: 10M+ businesses
  ✓ GOD Score: 93
```

### Enrichment Pipeline (Priority Order)

**PHASE 1: Website Content**
- Scrape HTML from submitted URL
- Extract: name, description, product info from website

**PHASE 2: Pattern Matching**
- Run inference-extractor on HTML content
- Find: team signals, product status, basic info
- Classification: Tier A/B/C based on data richness

**PHASE 3: News-Based Enrichment** ← **NEW**
- **Trigger**: If still Tier C (sparse data) after Phase 2
- **Action**: Search Google News RSS for startup name
- **Extract**: Funding, sectors, customers, revenue from articles
- **Duration**: 2-3 seconds (with 3s timeout)
- **Success Rate**: 40-60% find additional data
- **Sources**: Pattern matching only (NO AI costs)

**PHASE 4: AI Scraper Fallback**
- **Trigger**: Only if still Tier C after Phase 3
- **Action**: GPT-4 structured extraction
- **Duration**: 5 seconds max (race timeout)
- **Use Case**: Complex/sparse websites where patterns fail

## Code Architecture

### Reusable Service Module
**File**: `server/services/inferenceService.js`

**Functions**:
- `searchStartupNews(name, website, maxArticles)` - Google News RSS search
- `extractDataFromArticles(articles, currentData)` - Pattern matching extraction
- `quickEnrich(name, data, website, timeout)` - Combined search + extract with timeout
- `isDataSparse(startup)` - Check if startup needs enrichment

**Pattern Extractors** (from `lib/inference-extractor.js`):
- `extractFunding(text)` - Find funding rounds, amounts
- `extractSectors(text)` - Identify industries
- `extractExecutionSignals(text)` - Traction metrics (customers, revenue, MRR)
- `extractTeamSignals(text)` - Team background, pedigree

### Integration Points

**Instant Submit Flow** (`server/routes/instantSubmit.js`):
```javascript
// Line 646-652: Website scraping
const websiteContent = await axios.get(fullUrl);

// Line 654-660: Pattern matching on HTML
inferenceData = extractInferenceData(websiteContent, fullUrl);
dataTier = inferenceData.confidence.tier;

// Line 662-680: NEWS-BASED ENRICHMENT ← NEW
if (dataTier === 'C' || isDataSparse({ extracted_data: inferenceData })) {
  const newsEnrichment = await quickEnrich(displayName, inferenceData, fullUrl, 3000);
  if (newsEnrichment.enrichmentCount > 0) {
    inferenceData = { ...inferenceData, ...newsEnrichment.enrichedData };
    dataTier = 'B'; // Upgrade!
    console.log(`News enrichment: +${newsEnrichment.enrichmentCount} fields`);
  }
}

// Line 683-693: AI scraper fallback (only if STILL Tier C)
if (dataTier === 'C') {
  aiData = await scrapeAndScoreStartup(fullUrl);
}
```

**Batch Enrichment** (`scripts/enrich-sparse-startups.js`):
- Still uses direct imports for batch processing
- Processes Phase 3-4 startups (sparse data)
- Rate limited: 2 seconds between startups
- Usage: `node scripts/enrich-sparse-startups.js --limit=1000`

## Data Sources

### Google News RSS
**Primary source** for fast, reliable news aggregation

**Query format**: `"Startup Name" startup funding`

**Advantages**:
- ✅ Fast (< 2 seconds typical)
- ✅ Free (no API key)
- ✅ Reliable (Google infrastructure)
- ✅ Recent content (updated hourly)
- ✅ Handles rate limits gracefully

**Limitations**:
- ⚠️ Only finds well-covered startups (TechCrunch, Bloomberg, etc.)
- ⚠️ Obscure/stealth startups may return 0 results
- ⚠️ Content snippets only (not full articles)

## Extraction Patterns

### Funding Detection
**Patterns**:
- `raised $10M in Series A`
- `$50 million funding round`
- `secured €25M Series B`

**Output**: `{ amount: 10000000, round: 'Series A' }`

### Sector Detection
**Keyword matching** against taxonomy:
- FinTech, SaaS, AI/ML, Healthcare, etc.
- Synonyms handled: `machine learning` → `AI/ML`

**Output**: `['FinTech', 'SaaS']`

### Traction Signals
**Patterns**:
- `10,000 customers`, `serves 50K users`
- `$5M ARR`, `MRR of $100K`
- `revenue exceeds $20M`

**Output**: `{ customer_count: 10000, arr: 5000000, mrr: 100000 }`

## Performance Benchmarks

### Enrichment Success Rates
**Test**: 50 Phase 3-4 startups

| Metric | Result |
|--------|--------|
| Startups processed | 50 |
| Enriched (found data) | 22 (44%) |
| No data found | 28 (56%) |
| Errors | 0 (0%) |

**Primary enrichment**: Sectors (95% of enriched startups)
**Secondary enrichment**: Funding (20%), customers (10%)

### Timing Analysis
**Total enrichment time**: ~2-3 seconds per startup

| Phase | Duration |
|-------|----------|
| Google News search | 1.5-2.5s |
| Article parsing | 0.2-0.5s |
| Pattern extraction | 0.05-0.1s |
| Database update | 0.1-0.2s |

**Timeout**: 3 seconds (race condition)
- If news search takes > 3s, return without enrichment
- Fall back to AI scraper if needed

## UX Impact

### Before Inference Integration
```
User submits URL → Sees sparse card
  ❌ Sectors: Unknown
  ❌ Funding: Not available
  ❌ Traction: No data
  ⚠️  GOD Score: 42 (low due to missing data)
  ⏰ Wait time: 3-5 seconds
```

### After Inference Integration
```
User submits URL → Sees rich card
  ✅ Sectors: FinTech, SaaS
  ✅ Funding: $2.2M Seed
  ✅ Customers: 500+
  ✅ GOD Score: 68 (accurate with real data)
  ⏰ Wait time: 5-7 seconds (+2s for enrichment)
```

**Key improvement**: +2 seconds wait, but **MUCH richer data**
- Users see "Analyzing from news sources..." during enrichment
- Perceived as "magic" - Pythh appears intelligent and comprehensive

## Monitoring & Debugging

### Log Messages
```bash
# Success case
[BG] Inference: Tier C
[BG] Attempting news enrichment for "Stripe"...
[BG] News enrichment: +3 fields (sectors, funding, customers) from 5 articles

# No data case
[BG] Inference: Tier C
[BG] Attempting news enrichment for "Obscure Startup"...
[BG] News enrichment: No data found (0 articles)

# Timeout case
[BG] News enrichment failed: Request timeout
```

### Database Tracking
**Enrichment metadata** stored in `extracted_data` JSONB:
```json
{
  "enrichment_sources": [
    {
      "title": "Stripe raises $2.2B Series I",
      "url": "https://...",
      "date": "2024-03-15",
      "source": "Google News"
    }
  ],
  "last_enrichment_date": "2024-03-15T10:30:00Z",
  "enrichment_method": "inference+news"
}
```

## Future Enhancements

### Short-term (Next 2 weeks)
1. **UI Loading State**: Show "Searching news for [Startup]..." indicator
2. **Source Attribution**: Display news article sources on startup card
3. **Cache News Results**: 24-hour cache per startup to avoid re-searching

### Medium-term (Next month)
1. **Additional News Sources**: Add TechCrunch RSS, VentureBeat
2. **Smart Retry**: If 0 results, try alternative queries (domain-based, founder names)
3. **Enrichment Analytics**: Track success rates per sector, funding stage

### Long-term (Next quarter)
1. **Real-time Webhooks**: Subscribe to news RSS feeds, enrich automatically
2. **ML Ranking**: Train model to rank article relevance before extraction
3. **Multi-language Support**: Enrich international startups with non-English sources

## Related Documentation
- [INFERENCE_ENGINE_GUIDE.md](./INFERENCE_ENGINE_GUIDE.md) - Batch enrichment usage
- [lib/inference-extractor.js](../lib/inference-extractor.js) - Pattern extraction logic
- [server/services/inferenceService.js](../server/services/inferenceService.js) - Reusable service module
- [server/routes/instantSubmit.js](../server/routes/instantSubmit.js) - Integration code

## Testing

### Manual Test
```bash
# 1. Start server
npm run dev

# 2. Submit a URL via frontend or curl
curl -X POST http://localhost:3002/api/instant/submit \
  -H "Content-Type: application/json" \
  -d '{"url": "stripe.com"}'

# 3. Watch server logs for enrichment messages
```

### Expected Output
```
⚡ [INSTANT] Processing: "stripe.com"
  🔄 [BG] PHASE 2: Enrichment...
  🔄 [BG] Inference: Tier C
  🔄 [BG] Attempting news enrichment for "Stripe"...
  🔍 Searching: ""Stripe" startup funding"
  ✅ Found 5 articles
    🏷️ Found sectors: FinTech, SaaS
    💰 Found funding: $2200000000 Series I
    📈 Found customers: 10000000
  🔄 [BG] News enrichment: +3 fields (sectors, funding, customers) from 5 articles
  🔄 [BG] GOD Score: 93 (T85 Tr95 M90 P88 V92)
```

## Troubleshooting

### Issue: "No data found (0 articles)"
**Cause**: Startup name too generic or obscure
**Solution**: Normal - AI scraper will kick in as fallback

### Issue: "News enrichment failed: Request timeout"
**Cause**: Google News RSS slow to respond
**Solution**: Automatic - falls back to AI scraper

### Issue: Enrichment found wrong data
**Cause**: Pattern matching matched unrelated startup with similar name
**Solution**: Add company domain to search query for disambiguation

---

**Status**: ✅ IMPLEMENTED (Jan 2025)
**Last Updated**: Jan 15, 2025
**Integration**: server/routes/instantSubmit.js lines 662-680
