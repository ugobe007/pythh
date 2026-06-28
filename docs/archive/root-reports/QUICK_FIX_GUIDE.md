# 🔧 Quick Fix Guide for RSS Scraper

## 🎯 **Current Status**

✅ **Working**: RSS scraper finding new startups  
⚠️ **Issues**: 
- False positives ("Kids", "Congress", "Texas", etc.)
- Broken RSS feeds (404/403/401 errors)
- Low success rate on second run (21 added vs 179 first run)

---

## 🚀 **Quick Fixes**

### **1. Remove False Positives**

Run this to clean up false company names:
```bash
node scripts/fix-false-positives.js
```

**What it does**:
- Removes known false positives from `discovered_startups` table
- Includes: countries, regions, generic words, currency amounts, person names

---

### **2. Deactivate Broken RSS Feeds**

Run this to turn off feeds that are broken:
```bash
node scripts/deactivate-broken-feeds.js
```

**What it does**:
- Deactivates feeds returning 404/403/401 errors
- Deactivates feeds with parsing errors
- Prevents wasted time on broken feeds

---

### **3. Re-run RSS Scraper**

After cleanup, run the scraper again:
```bash
node scripts/core/simple-rss-scraper.js
```

**Expected**:
- Fewer false positives
- Faster runs (skipping broken feeds)
- Better quality results

---

## 📊 **Why Only 21 Added on Second Run?**

This is **normal** and **good**:
- ✅ **Deduplication working** - most companies already in database
- ✅ **First run found many** - 179 startups added initially
- ✅ **Second run finds new** - only articles published since first run

**This means**:
- Run daily/weekly for continuous discovery
- False positives are being filtered (duplicate check)
- System is working as designed

---

## 🔄 **Regular Workflow**

### **Daily/Weekly**:
```bash
# 1. Clean up false positives (optional, as needed)
node scripts/fix-false-positives.js

# 2. Run RSS scraper to find new startups
node scripts/core/simple-rss-scraper.js

# 3. Check results
node scripts/check-rss-sources.js
```

---

## ✅ **Next Steps**

1. **Clean up false positives** (one-time):
   ```bash
   node scripts/fix-false-positives.js
   ```

2. **Deactivate broken feeds** (one-time):
   ```bash
   node scripts/deactivate-broken-feeds.js
   ```

3. **Continue running RSS scraper** (regular):
   ```bash
   node scripts/core/simple-rss-scraper.js
   ```

**You're all set!** The scraper is working well. These cleanup scripts will improve quality. 🚀

