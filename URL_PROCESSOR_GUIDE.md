# 🔗 URL Processor - Smart URL Resolution for Scrapers

## Overview

The URL Processor provides intelligent URL classification and resolution for Hot Honey's scraping infrastructure. It answers three key questions:

1. **Is this URL new or existing?** → If new, enrich. If existing, skip or update.
2. **Is this a company website or news article?** → Company = create startup. News = extract mentions.
3. **Is this URL in a quote/example context?** → If yes, ignore it.

## File Location

```
/lib/url-processor.js
```

## Quick Start

```javascript
const urlProcessor = require('./lib/url-processor');

// Single URL processing
const result = await urlProcessor.processUrl('https://newstartup.io');
// → { action: 'CREATE_STARTUP', url, domain, reason }

// Text processing (extracts all URLs)
const results = await urlProcessor.processText(articleText, 'rss_scraper');
// → Array of URL processing results

// Batch processing
const results = await urlProcessor.processBatch(urlArray, 'batch_import');
```

## Action Types

| Action | Meaning | Next Step |
|--------|---------|-----------|
| `CREATE_STARTUP` | New company website | Scrape and create startup record |
| `EXTRACT_FROM_ARTICLE` | News article | Parse to extract mentioned startups |
| `UPDATE_EXISTING` | Already in database | Skip or merge new data |
| `SKIP` | Should be ignored | No action needed |

## URL Classification

### Company Websites (CREATE_STARTUP)
- Unknown domains not in news or skip lists
- URLs extracted from semantic mentions like "Check out Acme Corp (acmecorp.com)"

### News Articles (EXTRACT_FROM_ARTICLE)
- TechCrunch, VentureBeat, Bloomberg, Forbes, etc.
- URLs with date patterns like `/2024/01/15/`
- URLs with `/news/`, `/article/`, `/blog/` paths

### Infrastructure/Services (SKIP)
- GitHub, Google, Amazon, Microsoft
- CDNs: cloudflare.com, amazonaws.com
- Analytics: mixpanel.com, segment.com

### Quote/Example Context (SKIP)
- URLs inside backticks: \`https://example.com\`
- URLs in quotes: "See https://example.com"
- Known example domains: example.com, test.com

## Database Existence Check

The processor checks three tables for existing records:

1. **startup_uploads** - Approved startups
2. **discovered_startups** - Pending review
3. **entity_ontologies** - Known entities

Uses strict domain matching to avoid false positives.

## Integration with Scrapers

### enhanced-startup-discovery.js

The enhanced scraper now uses URL Processor automatically:

```javascript
// In extractLinksFromListPage()
if (urlProcessor) {
  const result = await urlProcessor.processUrl(url, { source: sourceName });
  await urlProcessor.logUrlDecision(result, sourceName);
  
  if (result.action === 'CREATE_STARTUP' || result.action === 'EXTRACT_FROM_ARTICLE') {
    processedLinks.push({ url, action: result.action });
  }
}
```

### startupExists() Enhanced

```javascript
async function startupExists(name, website) {
  if (urlProcessor && website) {
    const existsResult = await urlProcessor.checkUrlExists(website);
    if (existsResult.exists) {
      return { exists: true, table: existsResult.table };
    }
  }
  // Fallback to original behavior...
}
```

## Semantic Expression Extraction

The processor extracts URLs from semantic patterns:

| Pattern | Example | Extracted |
|---------|---------|-----------|
| Company mention | "Acme Corp (acmecorp.com)" | name: "Acme Corp", url: "acmecorp.com" |
| Funding mention | "funded by Y at website.com" | url: "website.com" |
| Description | "X, a startup building..., at x.com" | name: "X", url: "x.com" |

## Logging

All URL decisions are logged to `ai_logs` table:

```javascript
await urlProcessor.logUrlDecision(result, 'rss_scraper');
```

View stats:
```javascript
const stats = await urlProcessor.getUrlStats(24); // Last 24 hours
// { total: 1500, byAction: { CREATE_STARTUP: 50, SKIP: 1200, ... } }
```

## Constants Available

```javascript
const { NEWS_DOMAINS, SKIP_DOMAINS, QUOTE_CONTEXT_PATTERNS, SEMANTIC_EXPRESSIONS } = urlProcessor;
```

## CLI Testing

```bash
node lib/url-processor.js
```

Outputs test results for sample URLs.

## Adding New Domains

### Skip Domains (never process)
```javascript
const SKIP_DOMAINS = new Set([
  'newdomain.com',  // Add here
  // ...
]);
```

### News Domains (extract from article)
```javascript
const NEWS_DOMAINS = new Set([
  'newnewssite.com',  // Add here
  // ...
]);
```

## Related Files

| File | Purpose |
|------|---------|
| [lib/url-processor.js](lib/url-processor.js) | This module |
| [lib/inference-extractor.js](lib/inference-extractor.js) | Pattern extraction (funding, sectors) |
| [lib/urlCanonicalizer.ts](lib/urlCanonicalizer.ts) | TypeScript URL utilities |
| [scripts/scrapers/enhanced-startup-discovery.js](scripts/scrapers/enhanced-startup-discovery.js) | Integrated scraper |

## Flow Diagram

```
                    ┌─────────────────────────────────────┐
                    │       SCRAPER FINDS URL             │
                    └─────────────────┬───────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────┐
                    │     urlProcessor.processUrl()       │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
     ┌────────────────┐     ┌────────────────┐     ┌────────────────┐
     │ In quote/code? │     │  News domain?  │     │ Skip domain?   │
     │    SKIP        │     │EXTRACT_ARTICLE │     │    SKIP        │
     └────────────────┘     └────────────────┘     └────────────────┘
                                      │
                                      │ No
                                      ▼
                    ┌─────────────────────────────────────┐
                    │    checkUrlExists() - DB lookup     │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
              ▼                                               ▼
     ┌────────────────┐                             ┌────────────────┐
     │    EXISTS      │                             │   NOT FOUND    │
     │UPDATE_EXISTING │                             │CREATE_STARTUP  │
     └────────────────┘                             └────────────────┘
```

---

*Created: December 2024*
*Version: 1.0*
