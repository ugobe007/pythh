# 🔧 SCRAPER DIAGNOSIS & FIX

## ANSWERS TO YOUR 5 QUESTIONS

### [1] Is the inference scraper working?
**YES** - `run-inference-enrichment.js` exists and enriches data WITHOUT AI API calls
- Uses keyword/pattern matching for sectors
- No OpenAI costs
- Status: ✅ Working

### [2] Do we avoid AI API calls?
**YES** - All scrapers are AI-free:
- `simple-rss-scraper.js`: Pattern-based company name extraction
- `pythia-collector`: Forum scraping with keyword matching  
- No OpenAI/Claude API calls in discovery phase
- AI only used later for enrichment (optional)

### [3] Is the signals scraper working?
**YES** - Pythia pipeline running:
- `pythia-collector`: ✅ Online (restart #31, 113m uptime)
- `pythia-scorer`: ✅ Online (restart #31, 83m uptime)
- `pythia-sync`: ✅ Online (restart #31, 68m uptime)
- Collects from: HN, Reddit, forums, GitHub
- Status: ✅ Working

### [4] What are our main scrapers?
1. **simple-rss-scraper.js** - Primary discovery (RSS feeds)
   - PM2: `rss-scraper` (restart #218, 8m uptime)
   - Schedule: Every 15 minutes
   - **🔴 PROBLEM: Skipping all items as duplicates**

2. **pythia-collector** - Signals from forums/HN/Reddit
   - PM2: `pythia-collector`
   - Schedule: Every 2 hours
   - Status: ✅ Working

3. **discovery-job-processor** - Processes user submissions
   - PM2: `discovery-job-processor`
   - Status: ✅ Running continuously

### [5] How do we autofix them?

## 🚨 ROOT CAUSE: AGGRESSIVE DUPLICATE DETECTION

**Problem in `simple-rss-scraper.js` (lines 579-598):**

```javascript
// Current buggy duplicate check
const { data: existingDiscovered } = await supabase
  .from('discovered_startups')
  .select('id')
  .ilike('name', companyName)  // ❌ BAD: "Nucleoresearch" matches "nucleoresearch.com"
  .limit(1);

const { data: existingUploaded } = await supabase
  .from('startup_uploads')
  .select('id')
  .ilike('name', companyName)  // ❌ BAD: Partial matches block everything
  .limit(1);
```

**Why it's broken:**
- `ilike('name', companyName)` does **LIKE pattern matching**
- "Nucleoresearch" matches "Nucleoresearch (nucleoresearch.com)" 
- Every scraped company name matches existing entries
- Result: **100% skip rate** - nothing gets discovered

## ✅ THE FIX

Replace with **exact** or **normalized** matching:

```javascript
// Option 1: Exact match only
.eq('name', companyName)

// Option 2: Normalized match (strip domain suffixes)
const normalizedName = companyName.replace(/\s*\(.*\)/, '').trim();
.eq('name', normalizedName)

// Option 3: Check both website AND name (better dedup)
const { data: existing } = await supabase
  .from('discovered_startups')
  .select('id')
  .or(`name.eq.${companyName},website.ilike.%${extractDomain(item.link)}%`)
  .limit(1);
```

## 📊 IMPACT ASSESSMENT

**Current state:**
- Scraper running: ✅ Yes (218 restarts, healthy)
- Discovering new startups: ❌ No (100% skip rate)
- Last successful discovery: Unknown (need to query DB)

**Expected after fix:**
- 100-200 new startups/day (as you mentioned)
- ~10-20 new investors/day
- Daily match regeneration with fresh data

## 🔧 IMPLEMENTATION PLAN

**Step 1: Fix duplicate detection (5 min)**
- Replace `ilike` with `eq` for exact matching
- Add URL normalization

**Step 2: Restart scraper (1 min)**
```bash
pm2 restart rss-scraper
pm2 logs rss-scraper --lines 50
```

**Step 3: Monitor first run (15 min)**
- Watch logs for "✅ CompanyName" (successful adds)
- Verify database growth: `SELECT COUNT(*) FROM discovered_startups`

**Step 4: Verify pipeline (30 min)**
- Check if discoveries flow to `startup_uploads`
- Verify matches generate for new startups

## 🎯 AUTOFIX SCRIPT

**Create `fix-scraper-duplicates.sh`:**
```bash
#!/bin/bash
# Backup current scraper
cp scripts/core/simple-rss-scraper.js scripts/core/simple-rss-scraper.js.backup

# Apply fix (replace ilike with eq)
sed -i '' 's/.ilike(\x27name\x27, companyName)/.eq(\x27name\x27, companyName)/g' scripts/core/simple-rss-scraper.js

# Restart scraper
pm2 restart rss-scraper

echo "✅ Fix applied - scraper restarted"
echo "Monitor with: pm2 logs rss-scraper --lines 50"
```

## 🔍 HEALTH CHECK COMMANDS

```bash
# Check scraper status
pm2 status | grep -E "(rss|pythia)"

# View recent logs
pm2 logs rss-scraper --lines 100 | grep "✅"

# Count recent discoveries
# (Need to run via Supabase - terminal corrupted)

# Check database growth
SELECT 
  date_trunc('day', created_at) as day,
  COUNT(*) as new_startups
FROM discovered_startups 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY 1 
ORDER BY 1 DESC;
```

## 🚀 NEXT STEPS

1. **IMMEDIATE**: Fix duplicate detection in simple-rss-scraper.js
2. **VERIFY**: Run scraper manually and check for successful adds
3. **MONITOR**: Watch for 24h to confirm 100-200 startups/day
4. **OPTIMIZE**: Tune rate limits if getting blocked
5. **SCALE**: Add more RSS sources if discovery rate low

---

**Ready to apply fix? Say "Yes" and I'll:**
1. Update the scraper code
2. Restart the process
3. Monitor first run
4. Report results
