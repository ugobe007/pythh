# Automated VC Enrichment Setup Guide

## 🎯 Goal
Automatically scrape VC data multiple times daily without manual intervention.

---

## ✅ Storage Impact: NONE

**TL;DR:** No storage issues! You can run this 10x daily for years on free tier.

- **10 VCs:** ~20 MB/year (< 5% of free tier)
- **100 VCs:** ~100 MB/year (< 20% of free tier)
- **1,000 VCs:** ~1 GB/year (may need Pro after 1 year)

See `STORAGE_ANALYSIS.md` for details.

---

## 🚀 Quick Setup (GitHub Actions - Recommended)

**Why GitHub Actions?**
- ✅ **100% Free** (2,000 minutes/month)
- ✅ **Zero maintenance** - runs in cloud
- ✅ **No server required**
- ✅ **Already configured** in `.github/workflows/enrich-vcs.yml`

### Step 1: Add Secrets to GitHub

1. Go to your GitHub repo: `https://github.com/ugobe007/hot-honey`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these two secrets:

   **Secret 1:**
   - Name: `VITE_SUPABASE_URL`
   - Value: Your Supabase project URL (from `.env`)

   **Secret 2:**
   - Name: `VITE_SUPABASE_ANON_KEY`
   - Value: Your Supabase anon key (from `.env`)

### Step 2: Push Workflow to GitHub

```bash
# The workflow file is already created at:
# .github/workflows/enrich-vcs.yml

# Commit and push
cd /Users/leguplabs/Desktop/hot-honey
git add .github/workflows/enrich-vcs.yml
git commit -m "Add automated VC enrichment workflow"
git push origin main
```

### Step 3: Verify It's Working

1. Go to **Actions** tab in GitHub
2. You'll see "VC Data Enrichment" workflow
3. Click **Run workflow** to test manually
4. Watch the logs - should complete in ~40 seconds

### Step 4: Schedule Options

Edit `.github/workflows/enrich-vcs.yml` schedule section:

```yaml
schedule:
  # Once daily at 3 AM UTC
  - cron: '0 3 * * *'
  
  # OR twice daily (3 AM and 3 PM)
  # - cron: '0 3,15 * * *'
  
  # OR every 6 hours (4x daily)
  # - cron: '0 */6 * * *'
  
  # OR every 12 hours (2x daily)
  # - cron: '0 */12 * * *'
```

**Recommended:** `0 3 * * *` (once daily)

---

## 🖥️ Alternative: Local Cron Job

**Best for:** Server/VPS deployment

### macOS/Linux Setup

```bash
# Open crontab editor
crontab -e

# Add one of these lines:

# Once daily at 3 AM
0 3 * * * cd /Users/leguplabs/Desktop/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1

# Twice daily (3 AM and 3 PM)
0 3,15 * * * cd /Users/leguplabs/Desktop/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1

# Every 6 hours
0 */6 * * * cd /Users/leguplabs/Desktop/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1
```

### Create logs directory

```bash
mkdir -p logs
```

### View logs

```bash
tail -f logs/enrichment.log
```

---

## 📊 Monitoring

### Check if it's running (GitHub Actions)

1. Go to **Actions** tab
2. See recent runs and their status
3. Click any run to see detailed logs

### Check data freshness (Supabase)

```sql
-- See last enrichment date for each VC
SELECT 
  name,
  last_enrichment_date,
  AGE(NOW(), last_enrichment_date) as age
FROM investors
WHERE last_enrichment_date IS NOT NULL
ORDER BY last_enrichment_date DESC;

-- Count new data from last 24 hours
SELECT 
  COUNT(*) as new_news,
  'investor_news' as table_name
FROM investor_news
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
  COUNT(*),
  'investor_advice'
FROM investor_advice
WHERE created_at > NOW() - INTERVAL '24 hours';
```

---

## 🧹 Storage Maintenance (Optional)

### Auto-cleanup old news (recommended)

Add this to cron or GitHub Actions:

```bash
# Delete news older than 90 days
psql $DATABASE_URL -c "DELETE FROM investor_news WHERE published_date < NOW() - INTERVAL '90 days'"
```

### Or add to `.github/workflows/cleanup.yml`:

```yaml
name: Cleanup Old Data

on:
  schedule:
    - cron: '0 4 1 * *'  # First day of month at 4 AM

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Delete old news
        run: |
          psql $DATABASE_URL -c "DELETE FROM investor_news WHERE published_date < NOW() - INTERVAL '90 days'"
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## ⚡ Optimization Tips

### 1. Incremental Updates (Smart Scraping)

Only scrape news/advice daily, refresh portfolio monthly:

```typescript
// scripts/enrich-vcs-daily.ts
async function dailyEnrichment() {
  // Only scrape news and advice (fast)
  for (const vc of VCs) {
    await scrapeNews(vc);
    await scrapeAdvice(vc);
  }
}

// scripts/enrich-vcs-monthly.ts
async function monthlyEnrichment() {
  // Full refresh including partners and portfolio
  for (const vc of VCs) {
    await enrichInvestor(vc); // Full scrape
  }
}
```

Schedule:
```yaml
# Daily: news only
- cron: '0 3 * * *'

# Monthly: full refresh
- cron: '0 4 1 * *'
```

### 2. Parallel Processing

Speed up enrichment with batching:

```typescript
// Process 3 VCs in parallel
const chunks = _.chunk(VCs, 3);
for (const chunk of chunks) {
  await Promise.all(chunk.map(vc => enrichInvestor(vc)));
  await sleep(5000); // 5s between batches
}
```

### 3. Smart Rate Limiting

```typescript
const RATE_LIMITS = {
  'linkedin.com': 40, // requests per hour
  'ycombinator.com': 100,
  'techcrunch.com': 60
};
```

---

## 🎯 Recommended Setup

### For MVP/Startup (Free)

```yaml
# .github/workflows/enrich-vcs.yml
schedule:
  - cron: '0 3 * * *'  # Daily at 3 AM
```

**Cost:** $0/month  
**Storage:** < 20 MB/year  
**Freshness:** 24 hours

### For Production (Aggressive)

```yaml
schedule:
  - cron: '0 */6 * * *'  # Every 6 hours
```

**Cost:** $0/month (still free)  
**Storage:** < 50 MB/year  
**Freshness:** 6 hours

---

## 🚨 Troubleshooting

### Workflow not running?

1. Check GitHub Actions is enabled for your repo
2. Verify secrets are set correctly
3. Make sure `.github/workflows/enrich-vcs.yml` is in main branch

### Getting blocked by websites?

1. Reduce frequency (once daily instead of 4x)
2. Increase delays between requests (5-10 seconds)
3. Rotate User-Agent strings
4. Some sites may require proxies (advanced)

### Storage filling up?

1. Run cleanup script monthly
2. Reduce retention period (30 days instead of 90)
3. Archive old data to cheaper storage

---

## ✅ Checklist

- [ ] Add GitHub secrets (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Push workflow to GitHub
- [ ] Test manual run in GitHub Actions
- [ ] Verify data in Supabase after run
- [ ] Set up monitoring (optional)
- [ ] Configure cleanup schedule (optional)

---

## 📈 Expected Results

After setup, you'll have:

- ✅ **Fresh VC data** updated automatically
- ✅ **Zero manual work** - set it and forget it
- ✅ **$0 monthly cost** - completely free
- ✅ **No storage issues** - well under limits
- ✅ **Professional data** - equivalent to $29-99/month API

**You're replacing a $29-99/month Crunchbase subscription with a free automated scraper!** 🎉
