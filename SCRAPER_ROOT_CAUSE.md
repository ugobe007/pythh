# Scraper Issue - Root Cause Analysis

## Date: January 24, 2025

## TL;DR
Scraper is working correctly with `.eq()` fix, BUT the database is polluted with 100+ garbage "companies" like "Hard", "Invest", "Successful" that were scraped and approved in the past. Real companies now match as duplicates and get skipped.

## Issues Identified

### 1. ✅ FIXED: `.ilike()` Duplicate Detection
**Problem**: Using `.ilike('name', companyName)` for duplicate checking
- This did LIKE pattern matching instead of exact match
- "Nucleoresearch" would match "Nucleoresearch (nucleoresearch.com)"

**Fix Applied**: Changed to `.eq('name', companyName)` on lines 581 and 595

### 2. ❌ CURRENT ISSUE: Poor Company Name Extraction
**Problem**: `extractCompanyName()` function extracting garbage

Examples from logs:
```
"Please Fund More Science" → Extracts "Please Fund" ❌
"Hard Startups" → Extracts "Hard" ❌
"How To Invest In Startups" → Extracts "Invest" ❌
"Reinforcement Learning Progress" → Extracts "Reinforcement" ❌
"American Equity" → Extracts "American" ❌
```

**Root Cause**: Regex patterns too greedy, extracting first capitalized word without validation

**Good Extractions**:
```
"Railway secures $100 million..." → "Railway" ✅
"How OpenAI is scaling..." → "OpenAI" ✅
"MemRL outperforms RAG..." → "MemRL" ✅
```

### 3. ❌ DATABASE POLLUTION
**Problem**: Bad extractions were approved and now exist in database

**Discovered in `discovered_startups`**:
- Hard (1/8/2026)
- Invest (1/8/2026)
- Successful (1/8/2026)
- Reinforcement (1/8/2026)
- Please Fund (1/8/2026)
- Pur (1/8/2026)
- American
- Researchers (1/23/2026)
- Everything (1/22/2026)

**WORSE - Approved in `startup_uploads`**:
- American (approved)
- Everything (approved)
- Hard (approved)
- Invest (approved)
- Reinforcement (approved)
- Researchers (approved)
- Successful (approved)
- Pur (approved)
- Please Fund (rejected) ← At least one was rejected!

## Current Scraper Behavior

```
📰 Sam Altman Blog
   Found 30 items
   🎯 Title: "Hard Startups"
   🎯 Extracted: "Hard"
   ℹ️  30 items skipped (12 not startup-related, 2 no name, 16 duplicates)
```

**What's happening**:
1. Extract company name → "Hard" ❌ (bad extraction)
2. Check `discovered_startups`: "Hard" exists ✅
3. Mark as duplicate and skip ✅ (correct behavior given the extraction)

**The paradox**: The scraper is now working correctly (exact match duplicates), but it's matching against GARBAGE DATA.

## Fix Strategy

### Option 1: Clean Database First (RECOMMENDED)
1. **Identify bad entries**: Single-word generic nouns in startup_uploads
2. **Delete bad discovered_startups**: WHERE name IN ('Hard', 'Invest', ...)
3. **Reject bad startup_uploads**: UPDATE status = 'rejected'
4. **Improve extractCompanyName()**: Add validation rules
5. **Re-run scraper**: Should find real companies now

### Option 2: Fix Extraction Then Clean
1. **Improve extractCompanyName()** immediately
2. **Add validation**: Must be 2+ words OR be in allowlist (OpenAI, etc.)
3. **Re-run scraper**: Will extract better names
4. **Clean old data**: Bulk reject single-word garbage

## Recommended Extraction Improvements

```javascript
// After extracting company name, validate it:
function isValidCompanyName(name) {
  const words = name.split(' ').filter(w => w.length > 0);
  
  // Allow well-known single-word companies
  const allowList = new Set([
    'OpenAI', 'Railway', 'MemRL', 'LinkedIn', 'Waymo', 'Rippling', 
    'Harvey', 'Hexus', 'PopWheels', 'Deel'
  ]);
  
  if (allowList.has(name)) return true;
  
  // Reject single generic words
  const genericWords = new Set([
    'hard', 'invest', 'successful', 'reinforcement', 'american',
    'everything', 'researchers', 'pur', 'please', 'fund'
  ]);
  
  if (words.length === 1 && genericWords.has(name.toLowerCase())) {
    return false;
  }
  
  // Require 2+ words OR single word that ends with specific patterns
  return words.length >= 2 || /AI|ML|Labs|Tech|io|ly|er$/i.test(name);
}
```

## Database Cleanup SQL

```sql
-- Find all single-word generic names
SELECT name, status, COUNT(*) 
FROM startup_uploads 
WHERE name !~ ' ' -- No spaces = single word
  AND name IN ('Hard', 'Invest', 'Successful', 'Reinforcement', 
               'American', 'Everything', 'Researchers', 'Pur', 'Please Fund')
GROUP BY name, status;

-- Reject them
UPDATE startup_uploads 
SET status = 'rejected'
WHERE name IN ('Hard', 'Invest', 'Successful', 'Reinforcement', 
               'American', 'Everything', 'Researchers', 'Pur', 'Please Fund');

-- Delete from discovered_startups
DELETE FROM discovered_startups 
WHERE name IN ('Hard', 'Invest', 'Successful', 'Reinforcement', 
               'American', 'Everything', 'Researchers', 'Pur', 'Please Fund');
```

## Fix Status - January 24, 2025 7:45 PM

### ✅ Completed
1. Changed `.ilike()` to `.eq()` for exact duplicate matching (lines 581, 595)
2. Added detailed debug logging to scraper
3. Identified root cause: Database polluted with bad extractions
4. Created cleanup script `scripts/cleanup-scraper-data.js`
5. Attempted cleanup - **PARTIAL**: Rejected 16/18 bad entries in startup_uploads

### ⚠️ In Progress
- Database delete from `discovered_startups` failed (RLS policy or permission issue)
- Need to use service role key or disable RLS temporarily

### ⏳ Next Actions
1. Fix cleanup script to properly delete bad entries
2. Improve `extractCompanyName()` validation (add isValidCompanyName check)
3. Restart scraper and monitor for real discoveries
4. Verify 100-200 startups/day growth rate

## Database Cleanup SQL

1. ✅ Document findings (this file)
2. ⏳ Clean database of bad entries
3. ⏳ Improve `extractCompanyName()` validation
4. ⏳ Test scraper on fresh feed
5. ⏳ Monitor for 24h to verify 100-200 startups/day

## Evidence

**Test extraction results** (test-extraction.js):
```
Title: How PopWheels helped a food cart ditch generators...
Extracted: PopWheels ✅

Title: Legal AI giant Harvey acquires Hexus...
Extracted: Legal ❌ (should be Harvey)

Title: Who's behind AMI Labs...
Extracted: Whos ❌ (should be AMI Labs)

Title: Waymo probed by National Transportation...
Extracted: Waymo ✅
```

**Database check** (check-bad-names.js):
```
Found 10 matches in discovered_startups:
❌ Researchers (1/23/2026)
❌ Everything (1/22/2026)
✅ MemRL (1/22/2026)
❌ Pur (1/8/2026)
❌ Reinforcement (1/8/2026)
❌ Successful (1/8/2026)
❌ Invest (1/8/2026)
❌ Hard (1/8/2026)
```

**Scraper logs** (pm2 logs):
```
🎯 Title: "Hard Startups"
🎯 Extracted: "Hard"
🎯 Title: "Please Fund More Science"
🎯 Extracted: "Please Fund"
ℹ️  30 items skipped (12 not startup-related, 2 no name, 16 duplicates)
```

## Files Modified

- `scripts/core/simple-rss-scraper.js` - Fixed `.ilike()` → `.eq()`, added debug logging
- `test-extraction.js` - Test harness for company name extraction
- `check-bad-names.js` - Database pollution checker

## Related Files

- `SCRAPER_DIAGNOSIS_AND_FIX.md` - Initial diagnosis of scraper issues
- `ecosystem.config.js` - PM2 process configuration
- `.github/copilot-instructions.md` - Project context
