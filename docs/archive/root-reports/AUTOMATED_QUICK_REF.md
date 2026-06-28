# Automated VC Enrichment - Quick Reference

## 🎯 Storage Answer: NO ISSUES

- **10 VCs:** ~20 MB/year ✅
- **100 VCs:** ~100 MB/year ✅  
- **Free tier:** 500 MB ✅
- **Conclusion:** Can run 10x daily for years with zero storage problems

---

## 🚀 Setup in 3 Steps

### 1. Add GitHub Secrets
Go to: `https://github.com/ugobe007/hot-honey/settings/secrets/actions`

Add:
- `VITE_SUPABASE_URL` → (from your .env)
- `VITE_SUPABASE_ANON_KEY` → (from your .env)

### 2. Push Workflow
```bash
git add .github/workflows/
git commit -m "Add automated VC enrichment"
git push origin main
```

### 3. Test It
Go to **Actions** tab → Click **Run workflow** → Watch it run

---

## 📅 Schedules Available

Edit `.github/workflows/enrich-vcs.yml`:

```yaml
# Once daily (recommended)
- cron: '0 3 * * *'

# Twice daily
- cron: '0 3,15 * * *'

# Every 6 hours
- cron: '0 */6 * * *'

# Every 12 hours
- cron: '0 */12 * * *'
```

---

## 🧹 Cleanup (Optional)

Already configured in `.github/workflows/cleanup.yml`

**Runs:** First day of month at 4 AM  
**Deletes:**
- News > 90 days old
- Advice > 180 days old
- Activity > 60 days old

**Manual cleanup:**
```bash
npx tsx scripts/cleanup-old-data.ts
```

---

## 📊 Monitoring

### Check if enrichment ran today
```sql
SELECT 
  name,
  last_enrichment_date,
  AGE(NOW(), last_enrichment_date) as age
FROM investors
WHERE last_enrichment_date IS NOT NULL
ORDER BY last_enrichment_date DESC;
```

### Check storage usage
```sql
SELECT 
  'investor_news' as table_name, 
  COUNT(*) as records
FROM investor_news
UNION ALL
SELECT 'investor_partners', COUNT(*) FROM investor_partners
UNION ALL
SELECT 'investor_investments', COUNT(*) FROM investor_investments
UNION ALL
SELECT 'investor_advice', COUNT(*) FROM investor_advice;
```

---

## 💰 Cost Breakdown

| Item | Cost |
|------|------|
| GitHub Actions | $0 (free tier) |
| Supabase Storage | $0 (< 100 MB) |
| VC Data API (saved) | $29-99/month saved |
| **Total** | **$0/month** ✅ |

---

## 🎉 What You Get

✅ **Daily VC data** updates automatically  
✅ **Partners, portfolio, advice, news** - all scraped  
✅ **Zero maintenance** - runs in cloud  
✅ **No storage issues** - well under limits  
✅ **$0 monthly cost** - completely free  
✅ **Replaces Crunchbase** - saves $29-99/month  

---

## 🚨 Troubleshooting

**Workflow not running?**
- Check GitHub Actions is enabled
- Verify secrets are added
- Ensure workflow file is in main branch

**Getting rate limited?**
- Reduce frequency to once daily
- Increase delays between requests (see service file)

**Need help?**
- See `AUTOMATED_ENRICHMENT_SETUP.md` for full guide
- See `STORAGE_ANALYSIS.md` for storage details
