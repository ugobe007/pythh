# 🧹 Matching Engine & Database Cleanup Guide

## Overview

Two cleanup scripts have been created to address:
1. **Duplicate/repeat matches** in the matching engine
2. **Non-startup companies** (like GitHub, Google, etc.) in the database

---

## Script 1: Cleanup Duplicate Matches

**File**: `scripts/cleanup-duplicate-matches.js`

### What It Does

Identifies and removes duplicate matches where the same startup-investor pair has been matched multiple times.

**How it works:**
- Finds all startup_id + investor_id pairs with multiple matches
- Keeps the **highest scoring match** (or most recent if scores are equal)
- Removes all other duplicates

### Usage

**Dry Run (Preview - No Changes):**
```bash
node scripts/cleanup-duplicate-matches.js
```

**Execute (Actually Remove Duplicates):**
```bash
node scripts/cleanup-duplicate-matches.js --execute
```

### Expected Output

```
🔍 Finding duplicate matches...

📊 Total matches: 350,800
📈 Analysis:
   Total unique pairs: 125,000
   Duplicate pairs: 45,000
   Matches to keep: 45,000
   Matches to delete: 225,000

🔝 Top 10 duplicate pairs:
   1. Startup abc123... + Investor xyz789... = 15 matches (keeping best: score=85)
   ...

📋 Would delete 225,000 duplicate matches
💡 Run with --execute to actually delete duplicates
```

---

## Script 2: Cleanup Non-Startup Companies

**File**: `scripts/cleanup-non-startup-companies.js`

### What It Does

Identifies and removes established companies (like GitHub, Google, Microsoft, etc.) that are NOT startups from:
- `startup_uploads` table (marks as 'rejected' - safer than deletion)
- `discovered_startups` table (deletes directly - haven't been imported yet)

**Companies Filtered:**
- **Public companies**: GitHub, Google, Microsoft, Apple, Amazon, Facebook, etc.
- **Mature startups**: Established companies that are too old/large to be startups
- **Closed/failed companies**: Companies that have shut down

### Usage

**Cleanup startup_uploads (approved startups):**

Dry Run:
```bash
node scripts/cleanup-non-startup-companies.js
```

Execute:
```bash
node scripts/cleanup-non-startup-companies.js --execute
```

**Cleanup discovered_startups (scraped startups, not yet imported):**

Dry Run:
```bash
node scripts/cleanup-non-startup-companies.js --discovered
```

Execute:
```bash
node scripts/cleanup-non-startup-companies.js --discovered --execute
```

### Expected Output

```
🔍 Finding non-startup companies in startup_uploads...

📊 Total companies checked: 3,400
📈 Analysis:
   Total companies: 3,400
   Non-startups found: 67
   Percentage: 2.0%

📊 Breakdown by category:
   Public company: 42 companies
      - GitHub
      - Google
      - Microsoft
      - ...
   Mature/established startup: 20 companies
      - ...
   Closed/failed company: 5 companies
      - ...

📋 Would mark 67 companies as rejected
💡 Run with --execute to actually remove them
```

---

## Recommended Cleanup Order

1. **First: Clean up duplicate matches**
   ```bash
   # Preview
   node scripts/cleanup-duplicate-matches.js
   
   # Execute if looks good
   node scripts/cleanup-duplicate-matches.js --execute
   ```

2. **Second: Clean up non-startup companies**
   ```bash
   # Preview approved startups
   node scripts/cleanup-non-startup-companies.js
   
   # Execute if looks good
   node scripts/cleanup-non-startup-companies.js --execute
   
   # Also cleanup discovered_startups (optional)
   node scripts/cleanup-non-startup-companies.js --discovered --execute
   ```

---

## Safety Features

### Dry Run Mode (Default)
- **All scripts run in dry-run mode by default**
- Shows what would be changed without making any changes
- Review the output before executing

### Backup Recommendations
- Scripts mark companies as 'rejected' (not deleted) for `startup_uploads`
- For `discovered_startups`, companies are deleted (they haven't been imported yet)
- Consider backing up your database before running cleanup scripts

### Batch Processing
- Both scripts process changes in batches to avoid overwhelming the database
- Progress indicators show status during execution
- Errors are logged but don't stop the entire process

---

## What Gets Removed

### Duplicate Matches
- Same startup-investor pair matched multiple times
- Keeps only the **best match** (highest score, or most recent)
- Removes all duplicates

### Non-Startup Companies

**From startup_uploads:**
- Marked as `status = 'rejected'`
- Added `admin_notes` explaining the rejection
- **NOT deleted** - can be recovered if needed

**From discovered_startups:**
- **Deleted** (they haven't been imported yet, so safe to delete)
- Prevents them from being imported in the future

---

## After Cleanup

### Verify Results

**Check duplicate matches cleanup:**
```sql
-- Should show 0 or very few duplicates
SELECT startup_id, investor_id, COUNT(*) as match_count
FROM startup_investor_matches
GROUP BY startup_id, investor_id
HAVING COUNT(*) > 1
ORDER BY match_count DESC
LIMIT 20;
```

**Check non-startup cleanup:**
```sql
-- Check rejected startups
SELECT COUNT(*) as rejected_count
FROM startup_uploads
WHERE status = 'rejected';

-- Check for GitHub, Google, etc. (should be 0 or very few)
SELECT name, status
FROM startup_uploads
WHERE name ILIKE '%github%' 
   OR name ILIKE '%google%'
   OR name ILIKE '%microsoft%'
ORDER BY name;
```

### Next Steps

1. **Monitor matching engine** - Verify matches are cleaner and less repetitive
2. **Review rejected companies** - Check if any were incorrectly rejected
3. **Update filters** - If you find companies that should be filtered but weren't, update `utils/companyFilters.js`

---

## Troubleshooting

### Script Fails with "Module not found"
- Make sure you're running from the project root
- Check that `utils/companyFilters.js` exists

### Too Many Companies Being Removed
- Run in dry-run mode first
- Review the output carefully
- The script uses conservative filtering - only removes obvious non-startups

### Script Times Out
- Scripts process in batches
- If it times out, it may have partially completed
- Check the database to see how many were processed
- You can run the script again (it's safe - won't duplicate work)

---

## Files Created

- `scripts/cleanup-duplicate-matches.js` - Removes duplicate matches
- `scripts/cleanup-non-startup-companies.js` - Removes non-startup companies
- `CLEANUP_GUIDE.md` - This guide

---

**Remember**: Always run in dry-run mode first to preview changes! 🧹
