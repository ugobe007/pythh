# Publisher Blocking - Implemented ✅

## Fix A & B: Publisher Classification + Blocking

### What Was Done

1. **Created `scripts/pythia/utils/publisher-classifier.js`**
   - Hard blacklist (includes cointelegraph, fintechnews, arcticstartup, mattermark, axios, finsmes, etc.)
   - Pattern heuristics (publisher tokens: news, insights, telegraph, times, daily, post, journal, brief, etc.)
   - Path pattern detection (/news/, /research/, /2026/01/, /press/, /article/)
   - `isPublisherDomain(rawInput, normalizedHost)` function

2. **Integrated into `collect-from-company-domains.js`**
   - Import publisher classifier
   - Check for publishers BEFORE RSS discovery (fail fast)
   - Return error: "No valid company domain (publisher: [reason])"
   - Silent skip for publisher domains (same as invalid domains)

### Expected Impact

- **Immediate**: Stops scraping publisher RSS feeds (cointelegraph, fintechnews, etc.)
- **Tier Quality**: Prevents publisher RSS from being saved as "company_blog" Tier 2
- **Speed**: Faster runs (no wasted RSS discovery on publishers)
- **Data Quality**: Only real company domains get RSS scraped

### What Happens Now

When `collectFromCompanyDomain()` runs:
1. Normalizes domain from raw URL
2. Checks if normalized domain is a publisher
3. If publisher → returns error immediately (no RSS discovery)
4. If not publisher → proceeds with RSS discovery

### Next Steps

1. Run health check to see current tier distribution
2. Run domain collector - should see fewer "Found RSS feeds" for publishers
3. Health check should show better Tier 2 purity

## Fix C & D (Future)

- **Fix C**: Domain inference script (extract canonical company_domain from publisher pages)
- **Fix D**: If publishers are kept as source, use source_type="publisher_rss", tier=3

Ready to test!
