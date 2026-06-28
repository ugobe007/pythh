# Database Cleanup - Quick Reference

## 🎯 TL;DR

Your database has **~52 junk startups** and **~4 junk investors** that need cleaning.

These are scraped news fragments like:
- `"I've"` (sentence fragment)
- `"Company $42M"` (financial notation)
- `"Startup Announces"` (action verb headline)
- `"Nvidia"` / `"Google"` (tech giants out of context)

## ⚡ Quick Fix

```bash
# 1. Preview what will be deleted
node scripts/cleanup-database.js --dry-run

# 2. Review the lists
cat cleanup-junk-startups.json | head -50
cat cleanup-junk-investors.json | head -10

# 3. Execute cleanup (PERMANENTLY DELETES)
node scripts/cleanup-database.js --execute

# 4. Rebuild matches with clean data
node match-regenerator.js
```

## 📊 Expected Results

- **Before**: 6,221 startups (948 clean, 52 junk)
- **After**: 6,169 clean startups
- **Match quality**: Significantly improved (no more "Nvidia CEO" or "I've")

## 🛡️ Safety

- ✅ Script only targets clear junk patterns
- ✅ Full lists saved to JSON before deletion
- ✅ Can restore from Supabase backups if needed
- ⚠️ Always run `--dry-run` first!

## 📖 Full Documentation

See [DATABASE_CLEANUP_GUIDE.md](DATABASE_CLEANUP_GUIDE.md) for details.

## 🔧 What's Fixed

**LiveMatchingStrip Component:**
- ✅ Added comprehensive garbage filtering (both startups AND investors)
- ✅ Increased query limit to 100 (to compensate for filtering)
- ✅ Fixed field mapping issues

**Database Cleanup Script:**
- ✅ Detects 8 types of junk patterns
- ✅ Word boundary checking (won't flag "Abby" for "by")
- ✅ Exports full lists to JSON for review
- ✅ Batch deletion (100 records at a time)

---

**Next Steps:**
1. Run cleanup script in dry-run mode
2. Review the JSON files
3. Execute cleanup if satisfied
4. Regenerate matches
5. Hard refresh browser (Cmd+Shift+R)

**Status**: Ready to execute ✅
