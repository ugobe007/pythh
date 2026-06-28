# 🚀 Quick Start: World-Class Scraper

## ⚡ **Use Real URLs!**

The 404 errors you're seeing are **expected** - those were example URLs that don't exist. Use **real, working URLs** to test.

---

## ✅ **Quick Test with Real URLs**

### **Option 1: Y Combinator Companies**
```bash
# Get a real company from YC
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup
```

**Find YC companies here**: https://ycombinator.com/companies
- Pick any company
- Use their YC profile URL (e.g., `https://ycombinator.com/companies/companyname`)

### **Option 2: TechCrunch Articles**
```bash
# Find a recent TechCrunch article
node scripts/scrapers/resilient-scraper.js https://techcrunch.com/2024/01/15/real-article-url startup
```

**Find articles here**: https://techcrunch.com
- Find a recent startup funding article
- Copy the article URL

### **Option 3: Any Startup Website**
```bash
# Use any real startup website
node scripts/scrapers/resilient-scraper.js https://real-startup-website.com startup --useAI
```

---

## 🎯 **What to Expect**

### **Success (Real URL):**
```
🛡️  RESILIENT SCRAPING: https://ycombinator.com/companies/airbnb
📋 Data Type: startup

🌐 Scraping: https://ycombinator.com/companies/airbnb
📋 Data Type: startup
  🔄 Trying css strategy...
  ✅ Success with css strategy
✅ Success! Parsed with css strategy
📊 Quality Score: 85/100

✅ SUCCESS!
   Strategy: css
   📊 Quality Score: 85/100
```

### **404 Error (Fake URL - Expected):**
```
🛡️  RESILIENT SCRAPING: https://example.com/startup
📋 Data Type: startup

⚠️  Error is not recoverable: not_found
   Reason: URL returned 404 - page does not exist or URL is incorrect

❌ FAILED
   Error: Page not found (404): https://example.com/startup
   Recoverable: No
```

---

## 🔧 **Fixed Issues**

1. ✅ **404 Error Classification** - Now correctly identifies 404s as "not_found" (not recoverable)
2. ✅ **Removed Duplicate Logic** - Auto-recovery only runs once now
3. ✅ **Better Error Messages** - Clearer explanations for non-recoverable errors

---

## 📋 **Error Types & Recoverability**

| **Error Type** | **Recoverable?** | **Action** |
|----------------|------------------|------------|
| `selector_not_found` | ✅ Yes | Auto-regenerates selectors |
| `html_structure_changed` | ✅ Yes | Analyzes HTML, generates new selectors |
| `rate_limited` | ✅ Yes | Waits and retries |
| `timeout` | ✅ Yes | Tries browser automation |
| `not_found` (404) | ❌ No | URL issue - check URL |
| `captcha` | ❌ No | Manual intervention needed |
| `permission_denied` (403) | ❌ No | Access issue - check permissions |

---

## 🚀 **Try This Now**

**Get a real URL and test:**
1. Visit https://ycombinator.com/companies
2. Pick any company (e.g., "Stripe")
3. Copy their YC profile URL
4. Run:
```bash
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/stripe startup --useAI
```

**Expected**: Success with CSS strategy, or auto-recovery if CSS fails!

---

**The 404 errors are expected - use real URLs to test!** ✅

