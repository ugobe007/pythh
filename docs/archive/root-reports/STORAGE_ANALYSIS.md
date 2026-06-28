# Storage Analysis for Automated VC Scraping

## Current Database Schema

### Tables & Estimated Storage per VC

| Table | Fields | Avg Size per Record | Records per VC | Size per VC |
|-------|--------|---------------------|----------------|-------------|
| **investor_partners** | 15 fields | ~500 bytes | 20 partners | 10 KB |
| **investor_investments** | 18 fields | ~600 bytes | 500 companies | 300 KB |
| **investor_advice** | 12 fields | ~1 KB | 50 articles | 50 KB |
| **investor_news** | 14 fields | ~800 bytes | 10 articles | 8 KB |
| **Total per VC** | - | - | ~580 records | **~368 KB** |

### Projected Storage (10 VCs)

- **Initial Load:** 10 VCs × 368 KB = **3.68 MB**
- **Daily Updates:** ~50 KB/day (news + advice only)
- **Monthly Growth:** ~1.5 MB/month
- **Annual Growth:** ~18 MB/year

### Supabase Free Tier

- **Database Storage:** 500 MB (free tier)
- **Our Usage:** < 20 MB first year ✅
- **Conclusion:** **No storage issues** - you can scale to 1,000+ VCs

## Data Deduplication Strategy

The schema already prevents duplicates:

```sql
-- Partners: UNIQUE constraint
UNIQUE(investor_id, name)

-- Investments: UNIQUE constraint  
UNIQUE(investor_id, company_name, investment_date)

-- News: UNIQUE constraint
UNIQUE(investor_id, url)

-- Advice: No duplicates (new content each time)
```

**Result:** Re-running scraper only adds NEW data, not duplicates ✅

## Automated Scheduling Options

### Option 1: Cron Job (Recommended for Production)

**Best for:** Deployed servers, VPS, AWS EC2

```bash
# Edit crontab
crontab -e

# Schedule options:

# Every 6 hours (4x daily)
0 */6 * * * cd /path/to/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1

# Every 12 hours (2x daily)
0 */12 * * * cd /path/to/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1

# Twice daily (3 AM and 3 PM)
0 3,15 * * * cd /path/to/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1

# Once daily at 3 AM
0 3 * * * cd /path/to/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1
```

### Option 2: GitHub Actions (Recommended for MVP)

**Best for:** Free automation without maintaining servers

**Pros:**
- ✅ Free (2,000 minutes/month)
- ✅ No server maintenance
- ✅ Runs in cloud automatically
- ✅ Easy to configure

**Cons:**
- ❌ Requires code in GitHub
- ❌ Public repos only (or paid)

### Option 3: Vercel Cron Jobs

**Best for:** Next.js apps on Vercel

**Pros:**
- ✅ Integrated with Vercel deployment
- ✅ Free tier available
- ✅ Easy setup

**Cons:**
- ❌ Requires Pro plan for production ($20/month)
- ❌ Limited to serverless functions

### Option 4: Supabase Edge Functions + pg_cron

**Best for:** Full database integration

**Pros:**
- ✅ Runs directly in Supabase
- ✅ No external servers needed
- ✅ Direct database access

**Cons:**
- ❌ Requires Pro plan ($25/month)
- ❌ More complex setup

## Recommended Schedule

### Conservative (Once Daily)
```bash
# 3 AM daily - Low traffic time
0 3 * * * npx tsx scripts/enrich-vcs.ts
```

**Benefits:**
- Minimal API requests (respectful)
- Fresh daily data
- Low storage growth (~50 KB/day)

### Moderate (Twice Daily)
```bash
# 3 AM and 3 PM
0 3,15 * * * npx tsx scripts/enrich-vcs.ts
```

**Benefits:**
- Morning + afternoon updates
- Catches breaking news faster
- Still respectful to VC websites

### Aggressive (4x Daily)
```bash
# Every 6 hours
0 */6 * * * npx tsx scripts/enrich-vcs.ts
```

**Benefits:**
- Real-time news tracking
- Maximum data freshness
- Good for investor activity monitoring

**Risks:**
- May trigger rate limits on some sites
- Higher chance of being blocked

## Storage Optimization Strategies

### 1. Archive Old News (Recommended)

```sql
-- Delete news older than 90 days
DELETE FROM investor_news 
WHERE published_date < NOW() - INTERVAL '90 days';

-- Or soft delete
UPDATE investor_news 
SET is_published = false 
WHERE published_date < NOW() - INTERVAL '90 days';
```

### 2. Limit Advice Articles

```sql
-- Keep only latest 100 articles per VC
DELETE FROM investor_advice a
WHERE id NOT IN (
  SELECT id FROM investor_advice
  WHERE investor_id = a.investor_id
  ORDER BY published_date DESC
  LIMIT 100
);
```

### 3. Compress Old Data

```sql
-- Move old data to archive table (cheaper storage tier)
CREATE TABLE investor_news_archive AS
SELECT * FROM investor_news
WHERE published_date < NOW() - INTERVAL '1 year';

DELETE FROM investor_news
WHERE published_date < NOW() - INTERVAL '1 year';
```

## Monitoring Storage Usage

### SQL Query to Check Growth

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'investor%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Count records per table
SELECT 
  'investor_partners' as table_name, 
  COUNT(*) as records,
  pg_size_pretty(pg_total_relation_size('investor_partners')) as size
FROM investor_partners
UNION ALL
SELECT 
  'investor_investments', 
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('investor_investments'))
FROM investor_investments
UNION ALL
SELECT 
  'investor_advice', 
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('investor_advice'))
FROM investor_advice
UNION ALL
SELECT 
  'investor_news', 
  COUNT(*),
  pg_size_pretty(pg_total_relation_size('investor_news'))
FROM investor_news;
```

## Cost-Benefit Analysis

### Daily Scraping (Recommended)

**Storage Cost:** ~$0/month (well under free tier)  
**Server Cost:** ~$0/month (GitHub Actions free tier)  
**Benefit:** Fresh daily VC data worth $29-99/month (Crunchbase alternative)

**ROI:** ∞ (infinite - free service replacing paid API) 🎉

### Scaling to 100 VCs

**Storage:** 100 VCs × 368 KB = 36.8 MB (< 10% of free tier)  
**Monthly Growth:** ~5 MB/month  
**Annual Storage:** ~100 MB/year  
**Status:** Still free ✅

### Scaling to 1,000 VCs

**Storage:** 1,000 VCs × 368 KB = 368 MB (< 80% of free tier)  
**Monthly Growth:** ~50 MB/month  
**Annual Storage:** ~1 GB/year  
**Status:** May need Pro tier after 1 year ($25/month)

## Conclusion

### ✅ No Storage Issues!

1. **Current scale (10 VCs):** < 20 MB/year - totally fine
2. **Medium scale (100 VCs):** < 100 MB/year - still free
3. **Large scale (1,000 VCs):** ~1 GB/year - may need Pro tier

### Recommended Setup

```bash
# Schedule: Once daily at 3 AM
0 3 * * * cd /Users/leguplabs/Desktop/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1

# Archive old news monthly (cron job)
0 4 1 * * psql $DATABASE_URL -c "DELETE FROM investor_news WHERE published_date < NOW() - INTERVAL '90 days'"
```

**Result:** Zero storage concerns, fresh daily data, $0/month cost 🎉
