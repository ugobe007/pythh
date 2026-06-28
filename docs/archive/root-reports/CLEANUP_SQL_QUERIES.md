# 🧹 Cleanup SQL Queries

**Direct SQL queries you can run in Supabase SQL Editor**

---

## 1. Cleanup Duplicate Matches

**File**: `migrations/cleanup_duplicate_matches.sql`

### Step-by-Step:

**STEP 1: Preview duplicates**
```sql
SELECT 
  startup_id,
  investor_id,
  COUNT(*) as duplicate_count,
  MAX(match_score) as max_score,
  MIN(created_at) as oldest_match,
  MAX(created_at) as newest_match
FROM startup_investor_matches
GROUP BY startup_id, investor_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 100;
```

**STEP 2: Count total duplicates**
```sql
SELECT 
  COUNT(*) as total_duplicate_pairs,
  SUM(duplicate_count) as total_duplicate_matches
FROM (
  SELECT 
    startup_id,
    investor_id,
    COUNT(*) as duplicate_count
  FROM startup_investor_matches
  GROUP BY startup_id, investor_id
  HAVING COUNT(*) > 1
) duplicates;
```

**STEP 3: Delete duplicates** (keeps best match - highest score, then most recent)
```sql
DELETE FROM startup_investor_matches
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY startup_id, investor_id 
        ORDER BY match_score DESC NULLS LAST, created_at DESC
      ) as rn
    FROM startup_investor_matches
  ) ranked
  WHERE rn > 1
);
```

**STEP 4: Verify** (should return 0 or very few)
```sql
SELECT 
  startup_id,
  investor_id,
  COUNT(*) as match_count
FROM startup_investor_matches
GROUP BY startup_id, investor_id
HAVING COUNT(*) > 1
ORDER BY match_count DESC
LIMIT 20;
```

---

## 2. Cleanup Non-Startup Companies

**File**: `migrations/cleanup_non_startup_companies.sql`

### Step-by-Step:

**STEP 1: Preview companies to filter**
```sql
SELECT 
  id,
  name,
  tagline,
  status,
  website
FROM startup_uploads
WHERE status = 'approved'
  AND (
    name ILIKE ANY(ARRAY['%github%', '%google%', '%microsoft%', '%apple%', '%amazon%'])
    OR name IN ('GitHub', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Facebook')
    OR tagline ILIKE ANY(ARRAY['%NYSE:%', '%NASDAQ:%', '%IPO%', '%publicly traded%'])
  )
ORDER BY name;
```

**STEP 2: Count companies to reject**
```sql
SELECT COUNT(*) as companies_to_reject
FROM startup_uploads
WHERE status = 'approved'
  AND (
    name ILIKE ANY(ARRAY['%github%', '%google%', '%microsoft%', '%apple%', '%amazon%'])
    OR name IN ('GitHub', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Facebook')
    OR tagline ILIKE ANY(ARRAY['%NYSE:%', '%NASDAQ:%', '%IPO%', '%publicly traded%'])
  );
```

**STEP 3: Mark as rejected** (run after reviewing STEP 1 and STEP 2)
```sql
UPDATE startup_uploads
SET 
  status = 'rejected',
  admin_notes = COALESCE(admin_notes || ' | ', '') || 'Auto-rejected: Public/Mature company (cleanup)'
WHERE status = 'approved'
  AND (
    name ILIKE ANY(ARRAY['%github%', '%google%', '%microsoft%', '%apple%', '%amazon%'])
    OR name IN ('GitHub', 'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Facebook')
    OR tagline ILIKE ANY(ARRAY['%NYSE:%', '%NASDAQ:%', '%IPO%', '%publicly traded%'])
  );
```

**STEP 4: Verify** (should return 0 or very few)
```sql
SELECT name, status, admin_notes
FROM startup_uploads
WHERE name ILIKE '%github%' 
   OR name ILIKE '%google%'
   OR name ILIKE '%microsoft%'
ORDER BY name;
```

---

## Quick Reference

- **Full SQL files**: See `migrations/cleanup_duplicate_matches.sql` and `migrations/cleanup_non_startup_companies.sql`
- **Always run STEP 1 first** to preview what will be changed
- **Run STEP 3 only after reviewing** the preview results
- **Run STEP 4** to verify cleanup worked

---

**Note**: These are pure SQL queries - no JavaScript, no script headers. Just copy and paste into Supabase SQL Editor! ✅
