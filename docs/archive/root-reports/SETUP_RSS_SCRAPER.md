# RSS Scraper Setup Guide

## Problem
Your RSS sources are uploaded but not scraping because the **Supabase Service Key is missing**.

The anon key has Row Level Security (RLS) restrictions that prevent inserting data into tables.

## Solution

### Step 1: Get Your Service Key

1. Go to: https://supabase.com/dashboard
2. Select your project: `unkpogyhhjbvxxjvmxlt`
3. Navigate to: **Settings** → **API**
4. Scroll down to **Project API keys**
5. Find the **`service_role`** key (⚠️ **NOT** the `anon` key)
6. Click the eye icon to reveal it
7. Copy the entire key

### Step 2: Add to .env File

Open `/Users/leguplabs/Desktop/hot-honey/.env` and add this line:

```bash
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBh...
```

Replace with your actual service key from Step 1.

### Step 3: Run the Scraper

```bash
node run-rss-scraper.js
```

## Expected Results

The scraper will:
- ✅ Connect to 14 RSS sources
- ✅ Parse 37+ articles from last 7 days
- ✅ Save articles to `rss_articles` table
- ✅ Update `last_scraped` timestamps

Working sources:
- ✅ TechCrunch (20 articles)
- ✅ VentureBeat (7 articles)
- ✅ Crunchbase News (10 articles)

Broken sources (will be disabled):
- ❌ Founders Today (not RSS)
- ❌ Morning Brew (not RSS)
- ❌ PitchBook (403 forbidden)
- ❌ The Information (403 forbidden)
- ❌ AI News (malformed HTML)
- ❌ SOSV News (malformed HTML)
- ❌ Wired (malformed HTML)

## Verify It Worked

```bash
node check-rss-sources.js
```

Should show:
- 📄 Total articles scraped: 37+
- 📰 Recent articles with titles and sources

## Troubleshooting

**Error: "supabaseUrl is required"**
- Make sure `VITE_SUPABASE_URL` is in `.env`

**Error: "Could not find table rss_articles"**
- Run `supabase-rss-articles.sql` in Supabase SQL Editor

**Error: "new row violates row-level security policy"**
- You're using the anon key instead of service key
- Follow steps above to get and add the service key

## Security Note

⚠️ **Never commit the service key to git!**

Make sure `.env` is in your `.gitignore` file.
