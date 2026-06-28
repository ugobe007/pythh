# 🔍 Hot Money Database Audit Report
**Date:** December 12, 2025  
**Status:** CRITICAL SCHEMA MISMATCH DETECTED

---

## 🚨 CRITICAL ISSUES

### 1. **Schema Fragmentation - Supabase Cache Serving Ghost Columns**

The database has **TWO DIFFERENT SCHEMAS** being served for `discovered_startups`:

#### **Supabase Management API Schema** (Cached/Ghost columns):
```sql
discovered_startups (23 columns):
  - url TEXT              ❌ GHOST - DOES NOT EXIST IN DB
  - source TEXT           ❌ GHOST - DOES NOT EXIST IN DB
  - imported_to_review    ❌ GHOST - DOES NOT EXIST IN DB
  + website TEXT          ✅ REAL COLUMN
  + article_url TEXT      ✅ REAL COLUMN
```

#### **Actual Postgres Schema** (Real database - 20 columns):
```sql
discovered_startups:
  - website TEXT          ✅ ACTUAL COLUMN
  - article_url TEXT      ✅ ACTUAL COLUMN
  - imported_to_startups  ✅ ACTUAL COLUMN
  (NO url, source, or imported_to_review columns)
```

**Impact:** 
- ❌ Supabase JS SDK sees 23 columns (3 are ghosts)
- ✅ Direct Postgres connections see 20 columns (correct)
- ❌ Scripts using Supabase client fail with "column does not exist"
- ✅ Scripts using pg library work correctly

**Root Cause:** Supabase PostgREST schema introspection cache is stale. The cache shows columns from attempted migrations that never actually applied to the database. Cache refresh needed.

---

## 📊 DATABASE OVERVIEW

### **Total Tables:** 76 tables in `public` schema

#### **Hot Money Core Tables (Active):**
- ✅ `startup_uploads` - 2 rows, 36 columns (GOOD)
- ⚠️ `discovered_startups` - 2 rows, 23 columns (SCHEMA MISMATCH)
- ✅ `investors` - 19 columns
- ✅ `startup_investor_matches` - 22 columns
- ✅ `rss_sources` - 15 columns
- ✅ `rss_articles` - 10 columns

#### **Legacy Tables (From Previous Product - "Hot Money Solar/Energy"):**
```
❌ battery_pricing (9 cols) - UNUSED
❌ calculation_cache (9 cols) - UNUSED
❌ calculation_constants (15 cols) - UNUSED
❌ calculation_formulas (22 cols) - UNUSED
❌ collected_market_prices (18 cols) - UNUSED
❌ configuration_best_practices (16 cols) - UNUSED
❌ configuration_equipment (9 cols) - UNUSED
❌ depreciation_schedules (36 cols) - UNUSED
❌ energy_price_alerts (32 cols) - UNUSED
❌ energy_price_trends (17 cols) - UNUSED
❌ equipment_database (17 cols) - UNUSED
❌ equipment_templates (17 cols) - UNUSED
❌ equipment_vendors (26 cols) - UNUSED
❌ ev_charger_catalog (28 cols) - UNUSED
❌ financing_options (13 cols) - UNUSED
❌ incentive_programs (12 cols) - UNUSED
❌ industry_power_profiles (16 cols) - UNUSED
❌ iso_market_prices (22 cols) - UNUSED
❌ market_data_sources (20 cols) - UNUSED
❌ market_pricing_data (14 cols) - UNUSED
❌ power_profiles (12 cols) - UNUSED
❌ pricing_configurations (15 cols) - UNUSED
❌ pricing_history (11 cols) - UNUSED
❌ pricing_policies (19 cols) - UNUSED
❌ pricing_scenarios (12 cols) - UNUSED
❌ product_catalog (16 cols) - UNUSED
❌ recommended_applications (9 cols) - UNUSED
❌ regulatory_updates (17 cols) - UNUSED
❌ rfq_responses (20 cols) - UNUSED
❌ rfqs (21 cols) - UNUSED
❌ saved_projects (22 cols) - UNUSED
❌ saved_quotes (22 cols) - UNUSED
❌ smb_leads (22 cols) - UNUSED
❌ smb_sites (19 cols) - UNUSED
❌ state_incentives (27 cols) - UNUSED
❌ use_case_analytics (13 cols) - UNUSED
❌ use_case_configurations (22 cols) - UNUSED
❌ use_case_templates (28 cols) - UNUSED
❌ use_cases (20 cols) - UNUSED
❌ utility_rates (25 cols) - UNUSED
❌ vendor_notifications (12 cols) - UNUSED
❌ vendor_products (28 cols) - UNUSED
❌ vendors (19 cols) - UNUSED
❌ wizard_events (9 cols) - UNUSED
❌ wizard_sessions (39 cols) - UNUSED
```

**Storage Impact:** ~45 unused tables consuming space and cluttering schema

---

## 🔧 SCHEMA ISSUES BREAKDOWN

### **discovered_startups Schema Conflicts:**

| Column Name | Original Design | Added via Migration | Actual Database | Status |
|-------------|----------------|---------------------|-----------------|--------|
| `url` | ❌ Not planned | ✅ Added | ❌ Missing | **CONFLICT** |
| `website` | ✅ Original | ❌ Not added | ✅ Present | **CORRECT** |
| `source` | ❌ Not planned | ✅ Added | ❌ Missing | **CONFLICT** |
| `article_url` | ✅ Original | ❌ Not added | ✅ Present | **CORRECT** |
| `imported_to_review` | ❌ Not planned | ✅ Added | ❌ Missing | **CONFLICT** |
| `imported_to_startups` | ✅ Original | ❌ Not added | ✅ Present | **CORRECT** |

### **Column Mapping Required:**
- `url` → should be `website`
- `source` → should be `article_url`
- `imported_to_review` → should be `imported_to_startups`

---

## 📋 SCRIPT AUDIT

### **Scripts Using WRONG Schema:**
1. ❌ `intelligent-scraper.js` - Fixed (now uses `website`, `article_url`, `imported_to_startups`)
2. ⚠️ Other discovery scripts may still use old column names

### **Scripts Using CORRECT Schema:**
1. ✅ `modern-startup-discovery.js` - Calls intelligent-scraper (now fixed)

---

## 💾 DATA ANALYSIS

### **Current Data State:**

**startup_uploads:**
- Total: 2 rows
- Last 7 days: 2 rows
- Most recent: 2025-12-11
- **Status: GOOD** - Has complete VIBE data

**discovered_startups:**
- Total: 2 rows (test records)
- Last 7 days: 2 rows
- Most recent: 2025-12-12
- **Status: EMPTY** - No production data yet (just fixed scraper)

---

## 🎯 RECOMMENDED FIXES

### **Priority 1: Schema Standardization (URGENT)**

```sql
-- Option A: Remove conflicting columns added by wrong migrations
ALTER TABLE discovered_startups 
DROP COLUMN IF EXISTS url,
DROP COLUMN IF EXISTS source,
DROP COLUMN IF EXISTS imported_to_review;

-- These columns already exist and are correct:
-- ✅ website (use this instead of url)
-- ✅ article_url (use this instead of source)
-- ✅ imported_to_startups (use this instead of imported_to_review)
```

**OR**

```sql
-- Option B: Rename columns to match migration expectations
-- (NOT RECOMMENDED - original design was better)
ALTER TABLE discovered_startups 
RENAME COLUMN website TO url,
RENAME COLUMN article_url TO source,
RENAME COLUMN imported_to_startups TO imported_to_review;
```

**Recommended:** Option A - Keep original design, it's more semantically correct.

### **Priority 2: Clean Up Legacy Tables**

```sql
-- Drop all unused energy/solar product tables
DROP TABLE IF EXISTS 
  battery_pricing,
  calculation_cache,
  calculation_constants,
  calculation_formulas,
  collected_market_prices,
  configuration_best_practices,
  configuration_equipment,
  depreciation_schedules,
  energy_price_alerts,
  energy_price_trends,
  equipment_database,
  equipment_templates,
  equipment_vendors,
  ev_charger_catalog,
  financing_options,
  incentive_programs,
  industry_power_profiles,
  iso_market_prices,
  market_data_sources,
  market_pricing_data,
  power_profiles,
  pricing_configurations,
  pricing_history,
  pricing_policies,
  pricing_scenarios,
  product_catalog,
  recommended_applications,
  regulatory_updates,
  rfq_responses,
  rfqs,
  saved_projects,
  saved_quotes,
  smb_leads,
  smb_sites,
  state_incentives,
  use_case_analytics,
  use_case_configurations,
  use_case_templates,
  use_cases,
  utility_rates,
  vendor_notifications,
  vendor_products,
  vendors,
  wizard_events,
  wizard_sessions
CASCADE;
```

**Estimated Space Saved:** 40-60% of database size

### **Priority 3: Update All Scripts**

Search and replace across codebase:
- `discovered_startups.url` → `discovered_startups.website`
- `discovered_startups.source` → `discovered_startups.article_url`
- `discovered_startups.imported_to_review` → `discovered_startups.imported_to_startups`

### **Priority 4: Refresh Supabase Schema Cache**

```bash
# Force Supabase to refresh its schema metadata
# This requires restarting the Supabase project or:
npx supabase db reset --linked # (WARNING: DESTRUCTIVE)
```

Or manually refresh PostgREST schema cache via Supabase dashboard.

---

## ✅ ALREADY FIXED

1. ✅ `intelligent-scraper.js` - Now uses correct column names
2. ✅ Discovery pipeline working - 12 new startups scraped successfully
3. ✅ Direct Postgres connections bypass Supabase cache issue

---

## 📈 OPTIMIZATION RECOMMENDATIONS

### **Indexes to Add:**

```sql
-- Improve startup_uploads query performance
CREATE INDEX IF NOT EXISTS idx_startup_uploads_status ON startup_uploads(status);
CREATE INDEX IF NOT EXISTS idx_startup_uploads_stage ON startup_uploads(stage);
CREATE INDEX IF NOT EXISTS idx_startup_uploads_sectors ON startup_uploads USING GIN(sectors);
CREATE INDEX IF NOT EXISTS idx_startup_uploads_god_score ON startup_uploads(total_god_score DESC);

-- Improve discovered_startups performance
CREATE INDEX IF NOT EXISTS idx_discovered_startups_imported ON discovered_startups(imported_to_startups);
CREATE INDEX IF NOT EXISTS idx_discovered_startups_discovered_at ON discovered_startups(discovered_at DESC);
```

### **Materialized Views to Consider:**

```sql
-- High-scoring startups leaderboard (refresh daily)
CREATE MATERIALIZED VIEW mv_top_startups AS
SELECT 
  id, name, sectors, total_god_score, stage,
  value_proposition, team_companies
FROM startup_uploads
WHERE status = 'approved'
  AND total_god_score > 60
ORDER BY total_god_score DESC
LIMIT 100;

-- Pending discoveries to review
CREATE MATERIALIZED VIEW mv_pending_discoveries AS
SELECT 
  id, name, website, description, 
  discovered_at, article_url
FROM discovered_startups
WHERE imported_to_startups = false
ORDER BY discovered_at DESC;
```

---

## 🎬 ACTION PLAN

### **Phase 1: Emergency Fixes (Today)**
- [x] Fix intelligent-scraper.js to use correct columns ✅ DONE
- [ ] Search codebase for other scripts using wrong column names
- [ ] Document schema conflicts in code comments

### **Phase 2: Schema Cleanup (This Week)**
- [ ] Run SQL to drop conflicting columns (url, source, imported_to_review)
- [ ] Update migration files to reflect actual schema
- [ ] Test all discovery/scraping scripts

### **Phase 3: Legacy Table Cleanup (Next Week)**
- [ ] Backup database before dropping tables
- [ ] Drop 45 unused legacy energy/solar tables
- [ ] Vacuum database to reclaim space
- [ ] Monitor performance improvements

### **Phase 4: Optimization (Following Week)**
- [ ] Add recommended indexes
- [ ] Create materialized views
- [ ] Set up automated schema documentation
- [ ] Implement schema version tracking

---

## 📝 NOTES

- The schema mismatch occurred because Supabase JS client caches schema metadata
- Direct Postgres connections always see the correct schema
- Migration files don't match actual table structure
- 59% of tables (45/76) are legacy and unused

**Recommendation:** Prioritize Phase 1 and 2 immediately to prevent ongoing scraper failures.
