# 🚀 Complete Database Population Guide

## Quick Start (One Command!)

```bash
npx tsx scripts/seed-database.ts
```

This will populate your database with:
- ✅ **1000 startups** with pre-calculated GOD scores (50-95 range)
- ✅ **500 investors** including real VCs (Y Combinator, Sequoia, a16z, etc.)
- ✅ **Complete matching data** ready for the UI

**Expected Time**: ~3-5 minutes

---

## Individual Scrapers

### 1. Startup Scraper

```bash
# Generate 100 startups (default)
npx tsx scripts/startup-scraper.ts

# Generate 500 startups
npx tsx scripts/startup-scraper.ts 500

# Generate 1000 startups
npx tsx scripts/startup-scraper.ts 1000
```

**What it does**:
- Generates realistic startup data
- Calculates GOD scores using your algorithm
- Inserts into `startup_uploads` table
- Sets status to 'approved'

**Output**: Startups with scores 50-95, avg ~68

### 2. Investor Scraper

```bash
# Generate 500 investors (default)
npx tsx scripts/investor-scraper.ts

# Generate 100 investors
npx tsx scripts/investor-scraper.ts 100

# Generate 1000 investors
npx tsx scripts/investor-scraper.ts 1000
```

**What it does**:
- Includes 10 real VCs (Y Combinator, Sequoia, a16z, etc.)
- Generates additional sample investors
- Inserts into `investors` table
- Sets investment criteria and track records

**Output**: Mix of real VCs and generated investors

---

## Verify Results

### Check Database

**Startups**:
```sql
SELECT 
  name, 
  total_god_score, 
  raise_amount, 
  sectors
FROM startup_uploads
WHERE status = 'approved'
ORDER BY total_god_score DESC
LIMIT 10;
```

**Expected**: 10 startups with scores 70-90

**Investors**:
```sql
SELECT 
  name, 
  type, 
  check_size, 
  sectors, 
  portfolio_count
FROM investors
ORDER BY portfolio_count DESC
LIMIT 10;
```

**Expected**: Y Combinator (4000 companies), Sequoia (1500), a16z (800), etc.

### Check UI

1. **Start Dev Server**
   ```bash
   npm run dev
   ```

2. **View Matches**
   ```
   http://localhost:5175/match
   ```
   **Expected**: Match percentages show 50-99%

3. **View Investors**
   ```
   http://localhost:5175/investors
   ```
   **Expected**: 500+ investors with real VCs at top

---

## What You Get

### Startups (1000)
- **Names**: NeuralAI, QuantumTech, CloudBase, etc.
- **Pitches**: AI-powered solutions, enterprise platforms
- **Teams**: Founders from Google, Meta, Stanford, MIT
- **Traction**: Revenue, MRR, growth rates (stage-appropriate)
- **GOD Scores**: 50-95 (avg ~68)
  - Team: 50-98
  - Traction: 50-98
  - Market: 50-98
  - Product: 50-98
  - Vision: 50-95

### Investors (500)

**Real VCs (10)**:
1. Y Combinator - World's top accelerator
2. Andreessen Horowitz (a16z) - Software powerhouse
3. Sequoia Capital - Legendary early-stage VC
4. Founders Fund - Peter Thiel's fund
5. First Round Capital - Pre-seed/seed specialist
6. Techstars - Global accelerator network
7. Accel - Early-stage leader
8. Benchmark - Equal partnership VC
9. Greylock Partners - Enterprise + consumer
10. Kleiner Perkins - 50+ years of investing

**Generated VCs (490)**:
- Names: Alpha Ventures, Beta Capital, Gamma Partners, etc.
- Types: VC firms (70%), accelerators (10%), angel networks (10%), corporate VCs (5%), family offices (5%)
- Stages: Pre-seed to Growth
- Sectors: AI/ML, Fintech, Healthcare, Climate, etc.
- Check Sizes: $250K to $100M

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE SEEDING FLOW                        │
│                                                                 │
│   ┌──────────────┐         ┌──────────────┐                    │
│   │  Investor    │         │   Startup    │                    │
│   │  Scraper     │         │   Scraper    │                    │
│   └──────┬───────┘         └──────┬───────┘                    │
│          │                        │                             │
│          ├─ Generate 500          ├─ Generate 1000             │
│          ├─ Include real VCs      ├─ Calculate GOD scores      │
│          ├─ Set criteria          ├─ Set status='approved'     │
│          │                        │                             │
│          ▼                        ▼                             │
│   ┌──────────────┐         ┌──────────────┐                    │
│   │  investors   │         │startup_uploads│                   │
│   │   table      │         │    table      │                   │
│   └──────────────┘         └──────────────┘                    │
│          │                        │                             │
│          └────────────┬───────────┘                             │
│                       │                                         │
│                       ▼                                         │
│              ┌─────────────────┐                                │
│              │ Matching Engine │                                │
│              │  (reads both)   │                                │
│              └─────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sample Output

```
════════════════════════════════════════════════════════════════════════════════
🔥 HOT MONEY HONEY - DATABASE SEEDER
════════════════════════════════════════════════════════════════════════════════

🎯 This will populate your database with:
   • 1000 startups with GOD scores
   • 500 investors (including top VCs)
   • Complete matching data

🔍 Checking database connection...
✅ Database connected

════════════════════════════════════════════════════════════════════════════════
STEP 1: POPULATING INVESTORS
════════════════════════════════════════════════════════════════════════════════
🧪 Generating 500 sample investors...
📤 Inserting 500 investors to database...
✅ Inserted batch 1 (50/500)
✅ Inserted batch 2 (100/500)
...
✅ Inserted batch 10 (500/500)

📊 Insertion complete: 500 inserted, 0 errors

✅ 500 investors added

════════════════════════════════════════════════════════════════════════════════
STEP 2: POPULATING STARTUPS
════════════════════════════════════════════════════════════════════════════════
🧪 Generating 1000 sample startups...
📊 Calculating GOD scores...

📊 Pre-Insertion Score Distribution:
   Average: 68.5/100
   Min: 52/100
   Max: 89/100

📤 Inserting 1000 startups to database...
✅ Inserted batch 1 (50/1000)
✅ Inserted batch 2 (100/1000)
...
✅ Inserted batch 20 (1000/1000)

📊 Insertion complete: 1000 inserted, 0 errors

✅ 1000 startups added

════════════════════════════════════════════════════════════════════════════════
STEP 3: VERIFYING DATA
════════════════════════════════════════════════════════════════════════════════

📊 Database Summary:
────────────────────────────────────────────────────────────────────────────────
   Startups (approved): 1000
   Average GOD Score: 68.5/100
   Investors: 500

   Investor Breakdown:
   - vc_firm: 350
   - accelerator: 50
   - angel_network: 50
   - corporate_vc: 25
   - family_office: 25

════════════════════════════════════════════════════════════════════════════════
✅ DATABASE SEEDING COMPLETE!
════════════════════════════════════════════════════════════════════════════════

💡 Next Steps:
   1. Start dev server: npm run dev
   2. Visit http://localhost:5175/match
   3. See matches with 50-99% scores
   4. Visit http://localhost:5175/investors
   5. Browse 500+ investors

🎉 Your Hot Money Honey database is ready to use!
════════════════════════════════════════════════════════════════════════════════
```

---

## Troubleshooting

### "Database connection failed"

**Problem**: Can't connect to Supabase

**Solution**:
1. Check `.env` file has correct credentials
2. Verify Supabase project is running
3. Test: `curl https://your-project.supabase.co/rest/v1/`

### "Error inserting batch"

**Problem**: Supabase insert failed

**Solution**:
1. Check error message for details
2. Verify RLS policies allow inserting
3. Check table schemas match expected columns

### "No matches showing in UI"

**Problem**: UI shows empty state

**Solution**:
1. Verify startups exist: Run SQL query above
2. Verify investors exist: Run SQL query above
3. Hard refresh browser (Cmd+Shift+R)
4. Check browser console for errors

### "Want to start fresh"

**Problem**: Want to delete all data and re-seed

**Solution**:
```sql
-- Delete all data
DELETE FROM startup_uploads WHERE source_type = 'url';
DELETE FROM investors;

-- Re-run seeder
npx tsx scripts/seed-database.ts
```

---

## Production Usage

### Real Data Sources

Replace generated data with real scrapers:

**Startup Sources**:
- Y Combinator API
- Product Hunt GraphQL
- TechCrunch RSS
- Crunchbase API
- AngelList/Wellfound

**Investor Sources**:
- Signal (NFX)
- Crunchbase VC database
- PitchBook
- VC firm websites
- LinkedIn

### Scheduled Runs

Set up daily/weekly scraping:

```yaml
# .github/workflows/scraper.yml
name: Daily Data Scraper
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npx tsx scripts/seed-database.ts
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_KEY }}
```

---

## Success Criteria ✅

After running the seeder:

- ✅ 1000 startups in database
- ✅ All startups have `status='approved'`
- ✅ All startups have GOD scores 50-95
- ✅ 500 investors in database
- ✅ Top 10 investors include Y Combinator, Sequoia, a16z
- ✅ UI shows 50-99% match scores
- ✅ Investor directory shows 500+ investors

---

## Next Steps

1. **Run the seeder**: `npx tsx scripts/seed-database.ts`
2. **Start dev server**: `npm run dev`
3. **View matches**: http://localhost:5175/match
4. **View investors**: http://localhost:5175/investors
5. **Celebrate!** 🎉

---

**Status**: READY TO USE! Run the seeder now. ⚡
