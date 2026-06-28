# 📡 RSS Sources Setup Guide

## 🎯 **Goal: Scrape Hundreds of Pages**

Your scraper should be processing **hundreds of RSS feeds** from various sources.

---

## 📊 **Current Status**

### **Check Current Sources:**
```bash
node scripts/check-rss-sources.js
```

This shows:
- Total sources in database
- Active vs inactive
- Last scraped dates
- Sources by category

---

## 🚀 **Add Hundreds of Sources**

### **Step 1: Add Comprehensive Source List**
```bash
node scripts/add-hundreds-rss-sources.js
```

This adds **100+ RSS sources** including:
- ✅ Major Tech News (TechCrunch, VentureBeat, The Verge)
- ✅ Startup & Funding News (Crunchbase, PitchBook)
- ✅ Product Hunt & Discovery (HN, Product Hunt, Indie Hackers)
- ✅ Accelerators (YC, Techstars, 500 Startups)
- ✅ Top VC Blogs (a16z, Sequoia, Bessemer, Index, etc.)
- ✅ Industry Verticals (AI, Fintech, HealthTech, SaaS, Crypto)
- ✅ Geographic (Europe, Asia, Africa, Latin America)
- ✅ Developer Tools (GitHub, GitLab, Stack Overflow)

---

## 🔄 **How It Works**

### **Current Flow:**
1. **RSS Scraper** (`scripts/core/simple-rss-scraper.js`)
   - Reads from `rss_sources` table
   - Processes **100 sources per run** (increased from 20)
   - Scrapes oldest first (prioritizes never-scraped)
   - Extracts company names and saves to `discovered_startups`

2. **Autopilot** (`scripts/core/hot-match-autopilot.js`)
   - Runs RSS scraper daily
   - Processes feeds automatically

---

## 📈 **Expected Scale**

After adding sources:
- ✅ **100+ RSS feeds** in database
- ✅ **Thousands of articles** per day
- ✅ **Hundreds of new startups** discovered weekly
- ✅ **Comprehensive coverage** across industries

---

## 🔍 **Verify It's Working**

### **1. Check Source Count:**
```bash
node scripts/check-rss-sources.js
```

### **2. Run RSS Scraper:**
```bash
node scripts/core/simple-rss-scraper.js
```

Expected output:
```
Found 100+ active RSS sources

📰 TechCrunch
   Found 10 items
   ✅ Company1 (AI, SaaS)
   ✅ Company2 (Fintech)
   ...
```

### **3. Check Discovered Startups:**
Query `discovered_startups` table in Supabase to see new companies.

---

## 🎛️ **Configuration**

### **Batch Size**
Current: **100 sources per run**
- Located in: `scripts/core/simple-rss-scraper.js` (line ~438)
- Can be increased if needed

### **Rate Limiting**
- 2-second delay between feeds (line ~76 in simple-rss-scraper.js)
- Prevents overwhelming servers

### **Items Per Feed**
- Currently: **10 items per feed** (line ~451)
- Can be increased for more thorough scraping

---

## 📋 **Categories**

Sources are organized by:
- **Tech News** - General tech coverage
- **Startup News** - Startup launches, announcements
- **Funding** - Funding rounds, valuations
- **VC News** - VC firm news, blog posts
- **AI News** - AI/ML specific
- **Fintech** - Financial technology
- **HealthTech** - Healthcare technology
- **SaaS** - Software as a service
- **Crypto** - Cryptocurrency/Web3
- **Geographic** - Europe, Asia, etc.

---

## ✅ **Next Steps**

1. **Run source checker:**
   ```bash
   node scripts/check-rss-sources.js
   ```

2. **Add hundreds of sources:**
   ```bash
   node scripts/add-hundreds-rss-sources.js
   ```

3. **Run RSS scraper:**
   ```bash
   node scripts/core/simple-rss-scraper.js
   ```

4. **Monitor results:**
   - Check `discovered_startups` table
   - Verify companies are being found
   - Adjust sources as needed

---

**You're now set up to scrape hundreds of pages!** 🚀

