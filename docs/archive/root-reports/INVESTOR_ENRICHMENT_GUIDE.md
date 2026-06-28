# 💰 Investor Discovery & Enrichment Guide

## Current Status

**Date:** December 12, 2025

### Database Stats
- **163 investors** currently in database
- **0% enriched** with partner names and investment details
- **421 startups** pending review
- **81 approved startups** ready for matching

### Data Completeness
- ✅ 84% have basic bio
- ✅ 40% have LinkedIn
- ⚠️ 26% have investment thesis
- ⚠️ 26% have check size info
- ❌ 0% have partner names (NEEDS ENRICHMENT)
- ❌ 0% have portfolio details (NEEDS ENRICHMENT)

## 🔥 Currently Running

### Discovery Process
**Status:** 🟢 RUNNING  
**Script:** `discover-new-investors.js`  
**PID:** Check `investor-discovery.pid`  
**Log:** `investor-discovery.log`

**What it does:**
- Scrapes 73 VC websites from `all-vc-urls-combined.txt`
- Extracts firm names and basic info
- Adds new investors to database
- Estimated time: 30-45 minutes

**Monitor progress:**
```bash
tail -f investor-discovery.log
```

**Check status:**
```bash
ps -p $(cat investor-discovery.pid) && echo "Still running" || echo "Completed"
```

### Next: Enrichment Process
**Status:** ⏳ WAITING (will run after discovery)  
**Script:** `bulk-enrich-investors.js`

**What it does:**
- Takes all unenriched investors
- Uses GPT-4o-mini to research each one
- Adds: partner names, titles, investment thesis, notable investments, sectors, stages, check sizes
- Processes 30 investors per run (rate limited)
- Estimated time: 15 minutes per batch of 30

## 🔧 Available Tools

### 1. discover-new-investors.js
**Purpose:** Find NEW investors from VC website list

**Usage:**
```bash
node discover-new-investors.js
```

**Features:**
- Processes 73 VC URLs in batches of 5
- Tries multiple URL patterns (team page, about page, etc.)
- Automatically skips existing investors
- Rate limited to avoid blocking

**Output:**
- New investors added
- Already existed (skipped)
- Errors encountered

### 2. bulk-enrich-investors.js
**Purpose:** Add detailed data to existing investors

**Usage:**
```bash
node bulk-enrich-investors.js
```

**What it enriches:**
- **Partners:** Names and titles of key partners/GPs
- **Investment Thesis:** Focus areas and philosophy
- **Notable Investments:** Recent portfolio companies
- **Sectors:** AI, SaaS, FinTech, etc.
- **Stages:** Seed, Series A, B, etc.
- **Check Sizes:** Min/max investment amounts
- **Portfolio Count:** Total number of investments

**Features:**
- Processes 30 investors per run
- 2-second delay between requests (rate limiting)
- Updates `last_enrichment_date` timestamp
- Can be run multiple times for new investors

**Example output:**
```
[1/30] 🔍 First Round
   ✅ Enriched successfully
   👥 5 partners
   💼 5 investments
   🎯 Technology, Consumer, SaaS
```

### 3. test-investor-enrichment.js
**Purpose:** Test enrichment on one investor

**Usage:**
```bash
node test-investor-enrichment.js
```

**Use case:** Verify enrichment is working before running bulk operation

## 📊 Example Enrichment Data

**Investor:** First Round Capital

**Before enrichment:**
```json
{
  "name": "First Round",
  "firm": "First Round",
  "bio": "Basic description",
  "partners": null,
  "investment_thesis": null,
  "notable_investments": null
}
```

**After enrichment:**
```json
{
  "name": "First Round",
  "firm": "First Round",
  "partners": [
    {"name": "Josh Kopelman", "title": "Co-Founder & Partner"},
    {"name": "Harry Hurst", "title": "Partner"},
    {"name": "Christine Tsai", "title": "Partner"},
    {"name": "Rob Hayes", "title": "Partner"},
    {"name": "Caitlin McDevitt", "title": "Partner"}
  ],
  "investment_thesis": "Seed-stage funding to innovative technology companies, emphasizing strong founder relationships and operational support",
  "notable_investments": [
    {"company": "Uber", "stage": "Seed"},
    {"company": "Square", "stage": "Seed"},
    {"company": "Blue Apron", "stage": "Series A"},
    {"company": "Mint", "stage": "Seed"},
    {"company": "Notion", "stage": "Series A"}
  ],
  "sectors": ["Technology", "Consumer", "SaaS"],
  "stages": ["Seed", "Series A"],
  "check_size_min": 1000000,
  "check_size_max": 10000000,
  "portfolio_count": 50
}
```

## 🚀 Workflow: Complete Database Build

### Step 1: Discover (RUNNING NOW ✅)
```bash
node discover-new-investors.js
```
**Result:** 200-300+ investors with basic info

### Step 2: Enrich (UP NEXT)
```bash
node bulk-enrich-investors.js
```
**Result:** Partners, investments, thesis for 30 investors

### Step 3: Repeat Enrichment
```bash
# Run again for next batch
node bulk-enrich-investors.js
```
**Repeat until all investors enriched**

### Step 4: Verify
```bash
node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: 'postgresql://postgres:Q9PM1qv1xwf0jFf@db.unkpogyhhjbvxxjvmxlt.supabase.co:5432/postgres'});
pool.query('SELECT COUNT(*) as enriched FROM investors WHERE last_enrichment_date IS NOT NULL').then(r => {
  console.log('Enriched investors:', r.rows[0].enriched);
  pool.end();
});
"
```

## 💡 Tips

### Rate Limiting
- Discovery: 2 seconds between URLs
- Enrichment: 2 seconds between investors
- Both use GPT-4o-mini (fast and cheap)

### Cost Estimation
- **Discovery:** Free (web scraping only)
- **Enrichment:** ~$0.01 per investor (GPT-4o-mini)
- **Total for 300 investors:** ~$3

### Error Handling
Both scripts continue on errors and provide summary at end:
- ✅ Successful operations
- ❌ Failed operations
- ⏭️ Skipped (already exists)

### Resume After Interruption
Both scripts check existing data:
- Discovery skips investors already in database
- Enrichment only processes where `last_enrichment_date IS NULL`

Safe to run multiple times!

## 🔍 Monitoring Commands

### Check discovery progress:
```bash
tail -f investor-discovery.log
```

### Count new investors found:
```bash
node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: 'postgresql://postgres:Q9PM1qv1xwf0jFf@db.unkpogyhhjbvxxjvmxlt.supabase.co:5432/postgres'});
pool.query('SELECT COUNT(*) as total FROM investors').then(r => {
  console.log('Total investors:', r.rows[0].total);
  pool.end();
});
"
```

### Check enrichment status:
```bash
node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: 'postgresql://postgres:Q9PM1qv1xwf0jFf@db.unkpogyhhjbvxxjvmxlt.supabase.co:5432/postgres'});
pool.query(\`
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE last_enrichment_date IS NOT NULL) as enriched,
    COUNT(*) FILTER (WHERE partners IS NOT NULL) as has_partners
  FROM investors
\`).then(r => {
  const row = r.rows[0];
  console.log('Total:', row.total);
  console.log('Enriched:', row.enriched, '(' + Math.round(row.enriched/row.total*100) + '%)');
  console.log('Has partners:', row.has_partners);
  pool.end();
});
"
```

## 📝 Next Steps After Enrichment

Once all investors are enriched:

1. **Review startup-investor matches**
   ```bash
   node generate-matches-advanced.js
   ```

2. **Check match quality**
   - High-scoring startups paired with relevant investors
   - Based on sector, stage, check size alignment

3. **Surface in workflow**
   - Matches appear in admin dashboard
   - Partners can see relevant startups
   - Startups see matched investors

## 🆘 Troubleshooting

### Discovery stuck?
```bash
# Check if process is running
ps -p $(cat investor-discovery.pid)

# View last 50 lines of log
tail -50 investor-discovery.log

# Kill if needed
kill $(cat investor-discovery.pid)
```

### Enrichment errors?
- Check OpenAI API key: `echo $VITE_OPENAI_API_KEY`
- Verify database connection: `echo $POSTGRES_URL`
- Check rate limits (shouldn't hit with 2-second delays)

### Database schema issues?
If you see "column does not exist" errors:
```bash
# Check actual schema
node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: 'postgresql://postgres:Q9PM1qv1xwf0jFf@db.unkpogyhhjbvxxjvmxlt.supabase.co:5432/postgres'});
pool.query(\`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'investors'
\`).then(r => {
  console.log('Investors table columns:');
  r.rows.forEach(c => console.log('  ' + c.column_name + ': ' + c.data_type));
  pool.end();
});
"
```

## 📚 Related Files

- `all-vc-urls-combined.txt` - List of 73 VC websites
- `intelligent-scraper.js` - Core scraping engine (uses GPT-4 to extract data)
- `investor-discovery.log` - Current discovery log
- `investor-discovery.pid` - Process ID of running discovery

## ✅ Success Criteria

**Discovery complete when:**
- All 73 URLs processed
- Log shows final summary with totals
- Process exits (PID no longer running)

**Enrichment complete when:**
```sql
SELECT COUNT(*) FROM investors WHERE last_enrichment_date IS NULL
-- Returns: 0
```

**Database ready when:**
- 200+ investors with partner details
- 421 startups reviewed and approved
- Matches generated and scored
- Workflow showing connections
