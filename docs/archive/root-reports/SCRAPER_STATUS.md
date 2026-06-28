# 🎣 Scraper Status & Results

*Last Updated: Today*

## ✅ Working Scrapers

### 1. RSS Scraper (`simple-rss-scraper.js`)
**Status:** ✅ WORKING - Fixed schema issues  
**Latest Run:** Saved 61 startups  
**Issues Fixed:**
- ✅ Schema mismatch: Changed `source` → `rss_source`
- ✅ Schema mismatch: Changed `source_url` → `article_url`
- ✅ Improved company name extraction (filters out garbage words)
- ✅ Better duplicate detection (checks both tables)

**Current Issues:**
- ⚠️ Still extracting some garbage names ("New", "Legacy", "Why")
- 🔧 **FIXED:** Improved extraction to filter out common words
- 🔧 **FIXED:** More strict pattern matching

**Next Steps:**
- Run again to test improved extraction
- Consider using AI for better name extraction if needed

---

### 2. Speedrun Scraper (`speedrun-full.mjs`)
**Status:** ✅ WORKING  
**Latest Run:** Found 58 startups (all duplicates - already in DB)  
**Notes:** All Speedrun startups already captured

---

### 3. Intelligent Scraper (`discover-more-startups.js`)
**Status:** ✅ WORKING  
**Latest Run:** Found 35 new startups
- TechCrunch: 6
- CB Insights: 2
- **Wellfound: 23** ⭐ Best source!
- Alchemist Accelerator: 4

---

## ⚠️ Issues to Fix

### 1. YC Scraper (`speedrun-yc-scraper.mjs`)
**Status:** ❌ NOT WORKING  
**Problem:** Finding 0 startups from all batches  
**Symptoms:**
- Page loads (1274 chars of text)
- DOM extraction finds 0 company links
- AI extraction returns empty array

**Possible Causes:**
- YC website structure changed
- Heavy JavaScript loading (needs more wait time)
- Anti-scraping measures
- Need to use YC API instead

**Attempted Fixes:**
- ✅ Increased wait times
- ✅ Added "Load More" button detection
- ✅ More scroll iterations
- ⏳ Still testing...

**Next Steps:**
1. Try YC API: `https://api.ycombinator.com/v0.1/companies`
2. Use different user agent
3. Try headless: false to see what's happening
4. Check if YC requires authentication

---

## 📊 Current Database Stats

- **Total startups:** 3,423
- **Approved startups:** 3,211
- **Discovered (pending):** 61+ (from latest RSS run)

---

## 🎯 Recommended Actions

1. **Clean up garbage names** from `discovered_startups`:
   ```sql
   DELETE FROM discovered_startups 
   WHERE name IN ('New', 'Legacy', 'Why', 'Four', 'Six', 'Three', 'Gentle', 'Jakub', 'Reflections', 'GPT-4o');
   ```

2. **Test improved RSS scraper**:
   ```bash
   node simple-rss-scraper.js
   ```

3. **Fix YC scraper** - Try API approach:
   ```bash
   curl https://api.ycombinator.com/v0.1/companies
   ```

4. **Run Wellfound scraper more** (best source!):
   ```bash
   node intelligent-scraper.js "https://wellfound.com/discover/startups?stage=seed" startups
   ```

---

## 🔧 Quick Fixes Applied

1. ✅ Fixed `discovered_startups` schema mismatch
2. ✅ Improved company name extraction (filters garbage)
3. ✅ Better duplicate detection
4. ✅ Enhanced YC scraper loading logic
