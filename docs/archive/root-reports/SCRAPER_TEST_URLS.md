# 🧪 Test URLs for World-Class Scraper

## ⚠️ **Important Note**

The 404 errors you're seeing are **expected** - those were example URLs that don't exist. Use **real, working URLs** to test the scraper.

---

## ✅ **Real Test URLs**

### **Startup Companies:**
```bash
# Y Combinator companies (real companies)
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/doordash startup
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/stripe startup

# TechCrunch articles (find recent articles)
node scripts/scrapers/resilient-scraper.js https://techcrunch.com/2024/01/15/startup-funding-round startup
```

### **Investor Pages:**
```bash
# VC firm pages
node scripts/scrapers/resilient-scraper.js https://sequoiacap.com/companies investor
node scripts/scrapers/resilient-scraper.js https://a16z.com/companies investor
```

### **News Articles:**
```bash
# Any news article
node scripts/scrapers/resilient-scraper.js https://techcrunch.com/2024/01/15/article-title article
```

---

## 🔍 **How to Find Test URLs**

1. **Visit Y Combinator Companies**: https://ycombinator.com/companies
   - Pick any company
   - Use their YC profile URL

2. **Visit TechCrunch**: https://techcrunch.com
   - Find a recent startup funding article
   - Use the article URL

3. **Visit VC Websites**: https://sequoiacap.com, https://a16z.com
   - Use portfolio company pages

---

## 🎯 **Expected Behavior**

### **With Real URLs:**
```
🛡️  RESILIENT SCRAPING: https://ycombinator.com/companies/airbnb
📋 Data Type: startup
  🔄 Trying css strategy...
  ✅ Success with css strategy
✅ SUCCESS!
   Strategy: css
   📊 Quality Score: 85/100
```

### **With 404 URLs (Expected):**
```
🛡️  RESILIENT SCRAPING: https://example.com/startup
📋 Data Type: startup
❌ FAILED
   Error: Page not found (404): https://example.com/startup
   Recoverable: No (URL issue)
```

---

## 🚀 **Quick Test**

Try this with a **real** YC company:
```bash
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup --useAI
```

**Note**: Replace `airbnb` with any company from https://ycombinator.com/companies

---

## 💡 **Why 404s Happen**

404 errors mean the **URL doesn't exist**. This is not a scraper issue - it's a URL issue.

- ✅ **Recoverable**: HTML changed, selector broke, rate limited
- ❌ **Not Recoverable**: 404 (URL doesn't exist), CAPTCHA, 403 (permission denied)

The scraper correctly identifies 404s as non-recoverable now.

