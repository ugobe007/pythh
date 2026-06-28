# 🔧 Scraper Improvements for Better Field Extraction

## ✅ **What I Fixed**

### **1. Added Domain-Specific Selectors**
- ✅ YC-specific selectors for description, funding, URL
- ✅ More comprehensive CSS selector list
- ✅ Better fallback strategies

### **2. Improved URL Extraction**
- ✅ Checks `link[rel="canonical"]` first
- ✅ Tries `meta[property="og:url"]`
- ✅ Finds external links (not YC domain)
- ✅ Handles relative URLs

### **3. Enhanced Description Extraction**
- ✅ Tries meta tags first (`meta[name="description"]`)
- ✅ Falls back to first paragraph
- ✅ Tries YC-specific selectors
- ✅ Joins multiple paragraphs for better content

### **4. Better Funding Extraction**
- ✅ More flexible currency pattern matching
- ✅ Checks data attributes
- ✅ Handles various formats ($100M, $100 million, etc.)

---

## 🧪 **Test the Improvements**

### **Try with CSS only:**
```bash
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup
```

### **Try with AI fallback (recommended for better extraction):**
```bash
node scripts/scrapers/resilient-scraper.js https://ycombinator.com/companies/airbnb startup --useAI
```

The `--useAI` flag will:
- ✅ Try CSS first (fast)
- ✅ If fields are missing, use Claude AI to extract
- ✅ More comprehensive data extraction

---

## 📊 **Expected Output (Better)**

After improvements, you should see:
```json
{
  "name": "Airbnb",
  "description": "Airbnb is a community marketplace for people to list, discover, and book unique accommodations...",
  "funding": 6200000000,
  "url": "https://airbnb.com"
}
```

---

## 🎯 **Why Use `--useAI`?**

For YC company pages:
- ✅ CSS can find name (h1)
- ✅ AI can extract description from full page context
- ✅ AI can find funding amounts mentioned anywhere
- ✅ AI can identify company website URL
- ✅ More reliable for complex pages

**Trade-off**: AI is slower but more accurate.

---

## 🔄 **How It Works Now**

1. **Try CSS selectors** (fast, specific)
2. **Try domain-specific selectors** (YC structure)
3. **Try common patterns** (fallback)
4. **Try meta tags** (for description/URL)
5. **Try AI** (if `--useAI` flag and fields still missing)

**Result**: Much better field extraction! 🎉

