# Cleanup Instructions 🧹

## Current Situation

You have **6 funding rounds** but **3 are duplicates**:
- Lovable appears 3 times (same $330M, different dates/types)
- Should be 1 entry for Lovable

## Safe Cleanup Process

### Step 1: Review Duplicates

Run this in Supabase SQL Editor:

```sql
SELECT 
  su.name,
  fr.round_type,
  fr.amount,
  fr.date,
  COUNT(*) as duplicate_count
FROM funding_rounds fr
JOIN startup_uploads su ON su.id = fr.startup_id
GROUP BY su.id, su.name, fr.round_type, fr.amount, fr.date
HAVING COUNT(*) > 1;
```

This shows you what duplicates exist.

### Step 2: See What Will Be Deleted

Run this to see which records will be kept vs deleted:

```sql
SELECT 
  fr.id,
  su.name,
  fr.round_type,
  fr.amount,
  fr.date,
  fr.created_at,
  ROW_NUMBER() OVER (
    PARTITION BY fr.startup_id, fr.round_type, fr.amount, fr.date 
    ORDER BY fr.created_at DESC
  ) as keep_rank
FROM funding_rounds fr
JOIN startup_uploads su ON su.id = fr.startup_id
WHERE (fr.startup_id, fr.round_type, fr.amount, fr.date) IN (
  SELECT startup_id, round_type, amount, date
  FROM funding_rounds
  GROUP BY startup_id, round_type, amount, date
  HAVING COUNT(*) > 1
)
ORDER BY su.name, fr.date, keep_rank;
```

- Records with `keep_rank = 1` will be **kept** (most recent)
- Records with `keep_rank > 1` will be **deleted**

### Step 3: Delete Duplicates

Only run this after reviewing Step 2:

```sql
DELETE FROM funding_rounds
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY startup_id, round_type, amount, date 
        ORDER BY created_at DESC
      ) as rn
    FROM funding_rounds
  ) t
  WHERE t.rn > 1
);
```

### Step 4: Verify

Check the results:

```sql
SELECT 
  su.name as startup_name,
  fr.round_type,
  fr.amount,
  fr.date
FROM funding_rounds fr
JOIN startup_uploads su ON su.id = fr.startup_id
ORDER BY su.name, fr.date DESC;
```

Should show **4 unique funding rounds** (one per startup).

## Expected Result

After cleanup, you should have:
- ✅ Lovable - series_b ($330M) - **1 entry** (most recent kept)
- ✅ Athira Pharma - seed ($90M)
- ✅ Neural Concept - series_b ($100M)
- ✅ Sprouty - seed ($550K)

## All-in-One File

Or use `SAFE_CLEANUP_FUNDING_ROUNDS.sql` which has all steps with comments.

Run each step separately to be safe! 🚀





