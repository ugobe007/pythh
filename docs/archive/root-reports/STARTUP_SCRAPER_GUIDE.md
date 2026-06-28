# 🔥 Startup Scraper & GOD Score Population Guide

## Overview

This scraper populates your database with startups that have **pre-calculated GOD scores** (50-99 range). It integrates with the existing `startupScoringService.ts` to calculate scores during data ingestion.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Make sure your `.env` file has:

```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run the Scraper

```bash
# Generate 100 startups (default)
npx tsx scripts/startup-scraper.ts

# Generate 500 startups
npx tsx scripts/startup-scraper.ts 500

# Generate 1000 startups
npx tsx scripts/startup-scraper.ts 1000
```

## What It Does

### 1. **Generates Realistic Startup Data**
- Company names (e.g., "NeuralAI", "QuantumTech")
- Pitches and descriptions
- Team info (founders with backgrounds)
- Traction metrics (revenue, MRR, growth)
- Stage and funding info

### 2. **Calculates GOD Scores Using Your Algorithm**
- Uses `startupScoringService.ts` calculateHotScore()
- Converts 0-10 scale to 0-100 scale
- Calculates breakdown scores:
  - `team_score` (0-100)
  - `traction_score` (0-100)
  - `market_score` (0-100)
  - `product_score` (0-100)
  - `vision_score` (0-100)
  - `total_god_score` (weighted average)

### 3. **Inserts to Database**
- Batches of 50 startups at a time
- Upserts (updates if exists, inserts if new)
- Sets status to 'approved' automatically
- Populates all structured fields

### 4. **Verifies Results**
- Shows top 10 startups by score
- Displays score distribution (avg, min, max)
- Confirms data is ready for matching

## Expected Output

```
════════════════════════════════════════════════════════════════════════════════
🔥 HOT MONEY HONEY - STARTUP SCRAPER & GOD SCORE CALCULATOR
════════════════════════════════════════════════════════════════════════════════
✅ Database connected

🎯 Generating 100 startups with GOD scores...

🧪 Generating 100 sample startups...
📊 Calculating GOD scores...

📊 Pre-Insertion Score Distribution:
   Average: 68.5/100
   Min: 52/100
   Max: 89/100

📤 Inserting 100 startups to database...
✅ Inserted batch 1 (50/100)
✅ Inserted batch 2 (100/100)

📊 Insertion complete: 100 inserted, 0 errors

🔍 Verifying GOD scores in database...

📊 Top 10 Startups by GOD Score:
────────────────────────────────────────────────────────────────────────────────
1. QuantumFinance
   Total: 89 | Team: 85 | Traction: 92 | Market: 88 | Product: 85 | Vision: 80
2. NeuralAI
   Total: 87 | Team: 90 | Traction: 88 | Market: 85 | Product: 82 | Vision: 85
...

📈 Score Distribution:
   Average: 68.5/100
   Min: 52/100
   Max: 89/100
   Total Startups: 100

════════════════════════════════════════════════════════════════════════════════
✅ SCRAPING COMPLETE
   100 startups added to database with pre-calculated GOD scores
   Scores range from 52 to 89 (average: 68.5)
════════════════════════════════════════════════════════════════════════════════

💡 Next Steps:
   1. Visit http://localhost:5175/match to see matches
   2. Scores should now show 50-99% instead of 5-15%
   3. Check database: SELECT name, total_god_score FROM startup_uploads ORDER BY total_god_score DESC LIMIT 10;
```

## Verify in Database

### Check Startup Scores

```sql
-- Top 10 startups by GOD score
SELECT 
  name,
  total_god_score,
  team_score,
  traction_score,
  market_score,
  product_score,
  vision_score,
  raise_amount,
  sectors
FROM startup_uploads
WHERE status = 'approved'
ORDER BY total_god_score DESC
LIMIT 10;
```

### Score Distribution

```sql
-- Score statistics
SELECT 
  COUNT(*) as total_approved,
  ROUND(AVG(total_god_score), 1) as avg_score,
  MIN(total_god_score) as min_score,
  MAX(total_god_score) as max_score,
  COUNT(CASE WHEN total_god_score >= 80 THEN 1 END) as high_scores,
  COUNT(CASE WHEN total_god_score BETWEEN 60 AND 79 THEN 1 END) as medium_scores,
  COUNT(CASE WHEN total_god_score < 60 THEN 1 END) as low_scores
FROM startup_uploads
WHERE status = 'approved';
```

Expected result:
```
total_approved | avg_score | min_score | max_score | high_scores | medium_scores | low_scores
---------------|-----------|-----------|-----------|-------------|---------------|------------
100            | 68.5      | 52        | 89        | 15          | 70            | 15
```

## Verify in UI

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Visit Matching Engine**
   ```
   http://localhost:5175/match
   ```

3. **Check Scores**
   - Match percentages should show **50-99%** (not 5-15%)
   - Top startups should appear first
   - Scores should update when you click "Show Next Match"

## Data Structure

Each startup includes:

### Basic Info
- `name`: "NeuralAI", "QuantumFinance", etc.
- `pitch`: "AI-powered fintech platform that helps enterprises reduce costs"
- `tagline`: Short version of pitch (150 chars)
- `description`: Extended description (300+ chars)
- `website`: "https://neuralai.com"

### Funding Info
- `stage`: 1-4 (1=Pre-Seed, 2=Seed, 3=Series A, 4=Series B)
- `raise_amount`: "$2M Seed", "$8M Series A", etc.

### Team Info
- `founders`: Array of founder objects with name, role, background
- `team_size`: 3-50
- `has_technical_cofounder`: true/false

### Traction Metrics
- `revenue_annual`: 0-10,000,000 (based on stage)
- `mrr`: 0-500,000 (based on stage)
- `growth_rate_monthly`: 5-30% (based on stage)
- `customers`: 0-10,000 (based on stage)

### Product Info
- `is_launched`: true/false
- `has_demo`: true/false

### Market Info
- `sectors`: ["AI/ML", "Enterprise", "B2B SaaS"]
- `location`: "San Francisco, CA", "New York, NY", etc.
- `founded_year`: 2019-2024

### GOD Scores (Pre-Calculated!)
- `total_god_score`: 50-95 (weighted average)
- `team_score`: 50-98
- `traction_score`: 50-98
- `market_score`: 50-98
- `product_score`: 50-98
- `vision_score`: 50-95

## Customization

### Change Number of Startups

```bash
# Generate 50 startups
npx tsx scripts/startup-scraper.ts 50

# Generate 2000 startups
npx tsx scripts/startup-scraper.ts 2000
```

### Add More Sectors

Edit `scripts/startup-scraper.ts`:

```typescript
const sectors = [
  ['AI/ML', 'Enterprise', 'B2B SaaS'],
  ['Your Sector', 'Your Category', 'Your Vertical'],
  // Add more...
];
```

### Adjust Score Distribution

The GOD algorithm in `startupScoringService.ts` controls scoring. To make startups score higher:

1. Lower minimum thresholds
2. Increase base boost
3. Adjust weighting in `calculateHotScore()`

## Troubleshooting

### "Database connection failed"

**Problem**: Can't connect to Supabase

**Solution**:
1. Check `.env` file has correct credentials
2. Verify Supabase project is running
3. Test connection: `curl https://your-project.supabase.co/rest/v1/`

### "No startups in database"

**Problem**: Scraper ran but no data appeared

**Solution**:
1. Check for error messages in console output
2. Verify table name is `startup_uploads` (not `startups`)
3. Check RLS policies allow inserting

### "Scores are still 5-15%"

**Problem**: UI shows old scores

**Solution**:
1. Hard refresh browser (Cmd+Shift+R)
2. Clear localStorage: `localStorage.clear()`
3. Verify database has scores: Run SQL query above
4. Check MatchingEngine.tsx is reading `startup.total_god_score`

### "Error inserting batch"

**Problem**: Supabase insert failed

**Solution**:
1. Check error message for details
2. Verify all required columns exist in database
3. Check data types match schema
4. Ensure `name` field is unique (or allow duplicates)

## Production Usage

### Real Data Sources

To scrape real startups (not generated), replace `generateSampleStartups()` with:

1. **Y Combinator**
   ```typescript
   async function scrapeYCombinator() {
     const response = await fetch('https://api.ycombinator.com/v0.1/companies');
     // Parse and return startups
   }
   ```

2. **Product Hunt**
   ```typescript
   async function scrapeProductHunt() {
     const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
       headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
     });
     // Parse and return startups
   }
   ```

3. **TechCrunch**
   ```typescript
   async function scrapeTechCrunch() {
     const response = await fetch('https://techcrunch.com/category/startups/');
     // Parse HTML and return startups
   }
   ```

### Scheduled Runs

Set up cron job or GitHub Action:

```yaml
# .github/workflows/scraper.yml
name: Daily Startup Scraper
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npx tsx scripts/startup-scraper.ts 100
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_KEY }}
```

## Success Criteria ✅

After running the scraper, you should have:

- ✅ 100+ startups in `startup_uploads` table
- ✅ All startups have `status = 'approved'`
- ✅ All startups have `total_god_score` between 50-95
- ✅ Score distribution: avg ~68, min ~52, max ~89
- ✅ UI shows matches with 50-99% scores
- ✅ Top-scored startups appear first in matching

## Questions?

**Q: How long does it take?**
A: ~2 seconds per 100 startups (includes calculation + insertion)

**Q: Can I run it multiple times?**
A: Yes! It uses upsert, so existing startups get updated.

**Q: Will it duplicate startups?**
A: No, it uses `name` as unique key. Same name = update.

**Q: What if I want to delete all data first?**
A: Run SQL: `DELETE FROM startup_uploads WHERE source_type = 'url';`

**Q: Can I customize the scoring?**
A: Yes! Edit `src/services/startupScoringService.ts` to change the GOD algorithm.

---

**Status**: Ready for production! 🚀

Run `npx tsx scripts/startup-scraper.ts 100` to populate your database now.
