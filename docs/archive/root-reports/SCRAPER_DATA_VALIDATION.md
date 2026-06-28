# 🔍 Scraper Data Validation & Schema Management

## Problem Identified

The scraper was **not saving all available schema fields**, causing data loss and inconsistency:

1. **Missing Fields**: `article_title`, `article_date`, `rss_source` were extracted but not saved
2. **Outdated Comment**: Code had comment saying these columns "don't exist" - but they DO exist
3. **Inconsistent Scrapers**: Different scrapers save different fields

---

## ✅ Fix Applied

### Fixed `discover-startups-from-rss.js`
- Now saves `article_title`, `article_date`, and `rss_source`
- Removed outdated comment
- Properly formats dates before saving

**Before:**
```javascript
// Note: article_title, article_date, rss_source columns don't exist
// Store extra info in description if needed
```

**After:**
```javascript
article_title: startup.article_title || null,
article_date: startup.article_date ? new Date(startup.article_date).toISOString() : null,
rss_source: startup.rss_source || null,
```

---

## 🛠️ Validation Script Created

Created `validate-scraper-data.js` to:
- ✅ Check schema compliance
- ✅ Detect missing fields
- ✅ Identify data quality issues
- ✅ Monitor scraper consistency
- ✅ Provide recommendations

### Run Validation:
```bash
node validate-scraper-data.js
```

---

## 📋 Common Schema Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|----------|-----------|
| `url` | `website` |
| `source` | `article_url` |
| `imported_to_review` | `imported_to_startups` |
| `imported` | `imported_to_startups` |

---

## 🔧 Complete Schema Reference

### Required Fields:
- `name` (TEXT) - **REQUIRED**

### Optional Fields:
- `website` (TEXT)
- `description` (TEXT)
- `funding_amount` (TEXT)
- `funding_stage` (TEXT)
- `investors_mentioned` (TEXT[])
- `article_url` (TEXT)
- `article_title` (TEXT) ✅ **NOW SAVED**
- `article_date` (TIMESTAMPTZ) ✅ **NOW SAVED**
- `rss_source` (TEXT) ✅ **NOW SAVED**
- `imported_to_startups` (BOOLEAN)
- `discovered_at` (TIMESTAMPTZ)

---

## 🚨 Prevention Strategy

### 1. **Unified Save Function** (Recommended)
Create a single `saveDiscoveredStartup()` helper that all scrapers use:

```javascript
async function saveDiscoveredStartup(startup) {
  return await supabase.from('discovered_startups').insert({
    name: startup.name,
    website: startup.website,
    description: startup.description,
    funding_amount: startup.funding_amount,
    funding_stage: startup.funding_stage,
    investors_mentioned: startup.investors_mentioned,
    article_url: startup.article_url,
    article_title: startup.article_title || null,
    article_date: startup.article_date ? new Date(startup.article_date).toISOString() : null,
    rss_source: startup.rss_source || null,
    discovered_at: new Date().toISOString(),
    imported_to_startups: false
  });
}
```

### 2. **Regular Validation**
Run `validate-scraper-data.js`:
- After scraper changes
- Weekly as part of maintenance
- Before major data imports

### 3. **Schema Documentation**
Keep `COLUMN_MAPPING_REFERENCE.md` updated with:
- Current schema
- Common mistakes
- Migration notes

---

## 📊 Monitoring

### Key Metrics to Watch:
1. **Field Completion Rate**: % of records with article_title, article_date, rss_source
2. **Schema Errors**: Any insert errors due to wrong column names
3. **Data Quality**: Missing required fields, invalid dates

### Automated Checks:
- Add to `system-guardian.js` to run validation weekly
- Alert if field completion drops below 50%
- Log schema errors for review

---

## ✅ Status

- ✅ **Fixed**: `discover-startups-from-rss.js` now saves all fields
- ✅ **Created**: Validation script for ongoing monitoring
- ✅ **Documented**: Schema reference and common mistakes
- ⚠️ **Recommended**: Create unified save function for all scrapers

---

**Last Updated:** December 20, 2025  
**Next Review:** After next scraper run





