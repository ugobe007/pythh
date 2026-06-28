# 🚀 Commands Quick Reference

## **Required Environment Variables**

Your `.env` file MUST contain:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

OR:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

---

## **Available Commands**

### **1. Social Signals Scraper**
```bash
# Test with Corli (verifies false positive filtering)
node scripts/enrichment/social-signals-scraper.js 1

# Run full collection
node scripts/enrichment/social-signals-scraper.js
```

### **2. Main Pipeline (Full Automation)**
```bash
# Run full pipeline: RSS scraping → discovery → enrichment → GOD scoring → matching
npm run pipeline

# Run as daemon (continuous)
npm run pipeline:daemon
```

### **3. Individual Scripts**

```bash
# Find new startups from RSS feeds
npm run scrape

# Calculate GOD scores for startups
npm run score

# Generate matches between startups and investors
npm run match

# Enrich existing startup data
npm run enrich
```

### **4. Health Checks**
```bash
# Daily health check
npm run health:check

# Generate health report
npm run health:report
```

---

## **Troubleshooting**

### **Error: "supabaseUrl is required"**

**Fix:**
1. Check if `.env` file exists in project root
2. Verify environment variables are set:
   ```bash
   # Check if variables are loaded
   node -e "require('dotenv').config(); console.log('URL:', process.env.VITE_SUPABASE_URL ? '✅' : '❌'); console.log('KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅' : '❌');"
   ```

3. If missing, add to `.env`:
   ```bash
   VITE_SUPABASE_URL=your-url-here
   SUPABASE_SERVICE_KEY=your-key-here
   ```

---

## **Script Locations**

- **Pipeline:** `scripts/core/hot-match-autopilot.js`
- **RSS Scraper:** `scripts/core/simple-rss-scraper.js`
- **GOD Scoring:** `scripts/core/god-score-v5-tiered.js`
- **Matching:** `scripts/core/queue-processor-v16.js`
- **Enrichment:** `scripts/core/enrichment-orchestrator.js`
- **Social Signals:** `scripts/enrichment/social-signals-scraper.js`

---

## **Quick Test**

```bash
# Test if environment is set up correctly
node -e "require('dotenv').config(); const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY; console.log('URL:', url ? '✅ Set' : '❌ Missing'); console.log('KEY:', key ? '✅ Set' : '❌ Missing');"
```

