# Funding Rounds Cleanup 🧹

## Current Status

✅ **6 funding rounds created**  
⚠️ **3 duplicates found** (Lovable appears 3 times)  
⚠️ **Date issue** (dates in December 2025 - likely from RSS article dates)

## Issues Found

### 1. Duplicates
- **Lovable** appears 3 times:
  - series_b, $330M, 2025-12-19
  - seed, $330M, 2025-12-18
  - series_b, $330M, 2025-12-18

These are likely the same funding round extracted multiple times from different articles.

### 2. Date Issue
All dates are in December 2025, which seems incorrect. This might be:
- RSS article publication dates (not funding dates)
- Date parsing issue in the extraction script

## Cleanup Steps

### Step 1: Remove Duplicates

Run `cleanup-duplicate-funding-rounds.sql` in Supabase SQL Editor. This will:
- Identify duplicates (same startup, round_type, amount, date)
- Keep the most recent entry
- Delete the rest

### Step 2: Fix Dates (Optional)

If the dates are wrong, you can update them manually:

```sql
-- Update dates if you know the correct funding dates
UPDATE funding_rounds 
SET date = '2024-01-15'  -- Replace with actual date
WHERE startup_id = (SELECT id FROM startup_uploads WHERE name = 'Lovable')
AND round_type = 'series_b';
```

### Step 3: Verify

After cleanup, check the results:

```sql
SELECT 
  su.name,
  fr.round_type,
  fr.amount,
  fr.date
FROM funding_rounds fr
JOIN startup_uploads su ON su.id = fr.startup_id
ORDER BY su.name, fr.date;
```

## Expected Result After Cleanup

Should have **4 unique funding rounds**:
- Lovable - series_b ($330M)
- Athira Pharma - seed ($90M)
- Sprouty - seed ($550K)
- Neural Concept - series_b ($100M)

## Next Steps

1. **Run cleanup SQL** to remove duplicates
2. **Continue extraction** - Process more RSS articles
3. **Improve extraction** - Fix date parsing in the script
4. **Calculate velocity** - Once you have 2+ rounds per startup

## Improving the Extraction

The pattern-based extraction is working but could be improved:
- Better date extraction (use article date vs funding date)
- Better duplicate detection (check before inserting)
- Better company name matching

Would you like me to improve the extraction script? 🚀





