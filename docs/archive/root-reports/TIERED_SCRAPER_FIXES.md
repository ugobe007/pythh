# Tiered Scraper Fixes Applied

## Issues Found

1. **Company Name Extraction**: Tier0Extractor was using `item.title` directly instead of extracting company names
2. **Duplicate Check**: Matching on article URLs (techcrunch.com, strictlyvc.com) instead of company websites
3. **Website Extraction**: Treating article URLs as company websites

## Fixes Applied

### 1. Company Name Extraction ✅
- **Before**: `contract.setField('name', item.title, ...)`
- **After**: Uses `extractCompanyName(item.title)` from `simple-rss-scraper.js`
- **Result**: Only extracts actual company names, not article titles

### 2. Duplicate Check ✅
- **Before**: Matched on any domain, including article URLs
- **After**: Skips duplicate check for article domains (techcrunch.com, medium.com, etc.)
- **Result**: Only checks duplicates for real company websites

### 3. Website Extraction ✅
- **Before**: Used article URLs as company websites
- **After**: Filters out article domains, only uses real company websites
- **Result**: No more false company websites

## Test Results Analysis

From your test run:
- ✅ Quality gates working (blocking garbage names)
- ✅ Duplicate detection working (but matching on wrong domains - FIXED)
- ❌ Company name extraction broken (extracting dates/titles - FIXED)
- ❌ 0 startups saved (because extraction was broken - FIXED)

## Next Test

Run again:
```bash
node tiered-scraper-pipeline.js
```

Expected improvements:
- Should extract actual company names (not "November 1, 2019")
- Should not mark everything as duplicates
- Should save startups to database

## Remaining Issues

1. **403 Errors**: Some RSS feeds blocking scrapers (Axios Pro Rata, Dealroom)
   - **Solution**: Add better error handling, skip blocked feeds

2. **Empty startup_uploads table**: All data is in `discovered_startups`
   - **Solution**: The tiered scraper saves to `startup_uploads`, which is correct
   - Need to import from `discovered_startups` first, or run tiered scraper to populate

3. **Multiple scrapers running**: automation-engine, rss-scraper, scraper all active
   - **Solution**: Stop conflicting scrapers, use only tiered-scraper-pipeline.js


