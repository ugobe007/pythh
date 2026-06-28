# VC Enrichment Quick Commands

## 🚀 Run Enrichment

```bash
# Enrich all top 10 VCs (Y Combinator, Sequoia, a16z, etc.)
npx tsx scripts/enrich-vcs.ts

# Watch the output - shows progress for each VC
# ✅ News articles found
# ✅ Partners scraped
# ✅ Portfolio companies extracted
# ✅ Advice articles saved
```

## 📊 Check Results in Supabase

```sql
-- See which VCs have been enriched
SELECT 
  name,
  last_enrichment_date,
  news_feed_url,
  linkedin_url
FROM investors
WHERE last_enrichment_date IS NOT NULL
ORDER BY last_enrichment_date DESC;

-- Count enriched data by VC
SELECT 
  i.name,
  COUNT(DISTINCT p.id) as partners,
  COUNT(DISTINCT inv.id) as investments,
  COUNT(DISTINCT a.id) as advice,
  COUNT(DISTINCT n.id) as news
FROM investors i
LEFT JOIN investor_partners p ON p.investor_id = i.id
LEFT JOIN investor_investments inv ON inv.investor_id = i.id
LEFT JOIN investor_advice a ON a.investor_id = i.id
LEFT JOIN investor_news n ON n.investor_id = i.id
WHERE i.last_enrichment_date IS NOT NULL
GROUP BY i.id, i.name
ORDER BY news DESC;

-- View sample enriched profile
SELECT * FROM investor_profile_enriched 
WHERE name = 'Y Combinator' 
LIMIT 1;
```

## 🎯 What to Expect

After running `npx tsx scripts/enrich-vcs.ts`:

1. **Y Combinator** → ~20 partners, ~3000 companies, ~50 blog posts
2. **Sequoia Capital** → ~30 partners, ~500 companies, ~30 insights
3. **Andreessen Horowitz (a16z)** → ~100 partners, ~400 companies, ~200 podcasts
4. **Accel** → ~50 partners, ~500 companies, ~20 articles
5. **Benchmark** → ~10 partners, ~200 companies, ~10 blog posts
6. **Founders Fund** → ~12 partners, ~150 companies, ~15 interviews
7. **Greylock** → ~25 partners, ~250 companies, ~40 articles
8. **Lightspeed** → ~60 partners, ~400 companies, ~30 posts
9. **NEA** → ~30 partners, ~1000 companies, ~20 insights
10. **Kleiner Perkins** → ~20 partners, ~300 companies, ~25 stories

## ⏱️ Runtime

- **Total time:** ~30-40 seconds (3s delay between VCs)
- **Data sources:** VC websites, RSS feeds, TechCrunch, VentureBeat
- **Cost:** $0 (no API keys needed!)

## 🔧 Troubleshooting

If you see errors:

```bash
# Check if dependencies are installed
npm list axios cheerio

# Reinstall if needed
npm install axios cheerio @types/cheerio

# Check Supabase connection
# Make sure .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## 📅 Set Up Daily Auto-Enrichment

```bash
# Option 1: macOS/Linux crontab (runs daily at 3 AM)
crontab -e

# Add this line:
0 3 * * * cd /Users/leguplabs/Desktop/hot-honey && npx tsx scripts/enrich-vcs.ts >> logs/enrichment.log 2>&1

# Option 2: Run manually when needed
npx tsx scripts/enrich-vcs.ts
```

## ✨ Next Steps

1. Run the enrichment script
2. Check results in Supabase SQL editor
3. Update investor profile pages to display new data
4. Add filters to search by partners, portfolio, advice topics

---

**Free Forever** 🎉 • **No API Keys** ✅ • **Real VC Data** 📊
