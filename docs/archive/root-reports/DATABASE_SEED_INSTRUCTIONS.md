# Database Seeding Instructions

## Problem
Only "Founders Fund" is showing in the matching engine because there's only 1 investor in the database.

## Solution
Add 5 investors to the database using the SQL script below.

## Steps to Seed the Database

### Option 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the SQL**
   - Copy the entire contents from `seed-investors-simple.sql`
   - Paste into the SQL editor

4. **Run the Query**
   - Click "Run" or press `Cmd/Ctrl + Enter`
   - You should see: "Success. 5 rows affected."

5. **Verify the Data**
   - The query includes a SELECT statement at the end
   - You should see 5 investors listed:
     - Y Combinator (4000 portfolio companies)
     - Techstars (3000 portfolio companies)
     - Sequoia Capital (1000 portfolio companies)
     - Andreessen Horowitz (800 portfolio companies)
     - Founders Fund (200 portfolio companies)

### Option 2: Using Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db reset --local
psql postgresql://[YOUR_CONNECTION_STRING] < seed-investors-simple.sql
```

## After Seeding

1. **Refresh your browser** (hard refresh: Cmd+Shift+R or Ctrl+Shift+F5)
2. **Check the console** - You should now see:
   ```
   ✅ Loaded 51 startups and 5 investors
   
   🏦 ALL INVESTORS IN DATABASE:
      1. Y Combinator
      2. Andreessen Horowitz
      3. Sequoia Capital
      4. Founders Fund
      5. Techstars
   ```

3. **Click "Show Next Match"** - The investor should now rotate through different VCs!

## What the Script Does

- **Deletes existing investors** (line 5) - Remove this line if you want to keep any existing data
- **Inserts 5 investors** with complete data:
  - Name, type (vc_firm/accelerator)
  - Tagline, description, website
  - Check size (investment range)
  - Stage focus (pre_seed, seed, series_a, etc.)
  - Sector focus (AI/ML, Software, etc.)
  - Geography (Global)
  - Portfolio metrics (count, exits, unicorns)
  - Notable investments (famous companies they've funded)

## Troubleshooting

### "Error: duplicate key value violates unique constraint"
This means investors already exist. Either:
- Remove the `DELETE FROM investors;` line to keep existing data
- Or keep it to replace all investors with the 5 new ones

### "Error: relation 'investors' does not exist"
The investors table hasn't been created yet. Run the schema migration first:
```sql
-- Run this first to create the table
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('vc_firm', 'accelerator', 'angel_network', 'corporate_vc')),
  tagline TEXT,
  description TEXT,
  website TEXT,
  check_size TEXT,
  stage JSONB,
  sectors JSONB,
  geography TEXT,
  portfolio_count INTEGER DEFAULT 0,
  exits INTEGER DEFAULT 0,
  unicorns INTEGER DEFAULT 0,
  notable_investments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Still seeing only "Founders Fund"?
1. Check the browser console for the investor count
2. Hard refresh the page (Cmd+Shift+R)
3. Clear browser cache
4. Verify the SQL query succeeded in Supabase dashboard

## Expected Behavior After Fix

- **51 matches generated** (51 startups × 5 investors cycling)
- **Different investor each click**: Y Combinator → Andreessen Horowitz → Sequoia → Founders Fund → Techstars → Y Combinator...
- **Complete investor data**: All fields populated (check size, stages, sectors, notable investments)
- **Rotation works**: Cards actually change when clicking "Show Next Match"

## Files Created
- `seed-investors-simple.sql` - The SQL script to run
- `DATABASE_SEED_INSTRUCTIONS.md` - This file (instructions)
