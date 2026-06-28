# 🔍 Debug: Why Resilient Scraper Not Running

## **Possible Reasons:**

### 1. **No Discovered Startups with Company Websites**
The RSS scraper stores `item.link` (article URL) as `website`, not the actual company website. So most discovered startups have article URLs like:
- `https://techcrunch.com/2024/01/01/startup-raises-5m`
- `https://venturebeat.com/article/...`

These are **filtered out** as article URLs (not company websites).

### 2. **Check If Integration Is Working:**

Run this to see what's happening:
```bash
# Check if there are any discovered startups with actual company websites
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

supabase
  .from('discovered_startups')
  .select('id, name, website, imported_to_startups')
  .eq('imported_to_startups', false)
  .limit(10)
  .then(({data}) => {
    console.log('Unimported discovered startups:', data?.length || 0);
    data?.forEach(s => {
      const isArticle = s.website?.match(/\/\d{4}\/\d{2}\/|article|news|blog|post|techcrunch|venturebeat/i);
      console.log(\`\n\${s.name}:\`);
      console.log(\`  Website: \${s.website || 'NONE'}\`);
      console.log(\`  Is Article URL: \${isArticle ? 'YES ❌' : 'NO ✅'}\`);
    });
  });
"
```

### 3. **To See Resilient Scraper In Action:**

**Option A: Manually test with a real company website:**
```bash
node scripts/scrapers/resilient-scraper.js https://example.com/startup startup
```

**Option B: Add a discovered startup with a real company website:**
```sql
-- In Supabase SQL Editor
INSERT INTO discovered_startups (name, website, description, imported_to_startups)
VALUES ('Test Company', 'https://stripe.com', 'Payment processing', false);
```

Then run auto-import:
```bash
node scripts/core/auto-import-pipeline.js
```

You should see:
```
🔍 [RESILIENT SCRAPER] Enriching Test Company...
   URL: https://stripe.com
   ✅ Got description (...)
   ✅ [RESILIENT SCRAPER] Enriched Test Company (quality: 85/100)
```

---

## **Solution: Extract Company Website from Article**

The real fix is to **extract the actual company website from the RSS article content**, not just use the article URL. This requires:

1. **AI extraction** from article content
2. **Website lookup** (Google search, Crunchbase API, etc.)
3. **Or better RSS parsing** that extracts company URLs from article body

---

## **Current Status:**

✅ Resilient scraper is **integrated** and **ready**  
⚠️ But it's **not being triggered** because:
- Most `discovered_startups.website` are article URLs (filtered out)
- Need actual company websites to scrape

---

## **Next Steps:**

1. **Test with a real company website** (see Option B above)
2. **Enhance RSS scraper** to extract company websites from article content
3. **Use AI** to identify company websites from article text

