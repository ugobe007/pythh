# Top 5 Free Feature - Implementation Complete

## Issue Diagnosed
Investors showing "Unknown" instead of actual names in top 5 rows.

## Root Cause
The database RPC function `get_live_match_table` was returning `NULL` for `investor_name` when rows had `is_locked = true`, regardless of the frontend auto-unlock logic.

**Problem code in RPC (line 127-132):**
```sql
CASE WHEN c.is_unlocked THEN
  CASE WHEN c.inv_firm IS NOT NULL
    THEN c.inv_name || ' · ' || c.inv_firm
    ELSE c.inv_name
  END
ELSE NULL  -- ❌ This caused "Unknown"
END AS investor_name
```

## Solution
Modified the RPC to **always return investor_name** and let the frontend control display logic.

**Fixed code:**
```sql
-- ✅ Always return investor_name (frontend controls display)
CASE WHEN c.inv_firm IS NOT NULL 
  THEN c.inv_name || ' · ' || c.inv_firm
  ELSE c.inv_name 
END AS investor_name
```

## Data Flow
```
Database (get_live_match_table)
  ↓ Returns: investor_name + is_locked=true
Frontend (useLegacyRadarAdapter)
  ↓ Receives: row with investor_name
mapMatchRowToRadarRow(row, godScore, index)
  ↓ Logic: if (index < 5) bypass is_locked
effectivelyLocked = is_locked && !(index < 5)
  ↓ Result: First 5 rows → effectivelyLocked=false
Display Name Logic (radar-view-model.ts line 197)
  name: effectivelyLocked ? 'Locked Investor' : row.investor_name
  ↓ Result: Top 5 show REAL NAMES ✅
```

## Files Changed

### Frontend (already complete)
- ✅ [src/hooks/useRadarViewModel.ts](../src/hooks/useRadarViewModel.ts) - Pass index to map function
- ✅ [src/lib/radar-view-model.ts](../src/lib/radar-view-model.ts) - Auto-unlock logic
- ✅ [src/components/pythh/LiveMatchTableV2.tsx](../src/components/pythh/LiveMatchTableV2.tsx) - Blur effect for rows 6+
- ✅ [src/pages/SignalMatches.tsx](../src/pages/SignalMatches.tsx) - "Top 5 Free" badge

### Database (NEW - needs deployment)
- 🔧 [supabase/migrations/20260202_fix_investor_names_visible.sql](../supabase/migrations/20260202_fix_investor_names_visible.sql)

## Deployment Steps

### 1. Apply Database Migration

**Option A: Supabase Dashboard (Recommended)**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project
2. Navigate to: **SQL Editor**
3. Copy the SQL from: `/tmp/fix_investor_names.sql`
4. Paste and click **Run**
5. Verify: "Success. No rows returned"

**Option B: Command Line**
```bash
cat /tmp/fix_investor_names.sql | pbcopy
# Then paste into Supabase SQL Editor
```

### 2. Test Frontend
```bash
# Hard refresh to clear cache
# Safari/Chrome: Cmd+Shift+R

# Test URL
http://localhost:5176/signal-matches?url=brickeye.com
```

**Expected behavior:**
- ✅ Top 5 investors show REAL NAMES (not "Unknown")
- ✅ Rows 6+ are blurred with lock icon
- ✅ Visual separator: "45 more matches — unlock to reveal"
- ✅ Console shows single "[SignalMatches] HIT:" log

### 3. Deploy to Production
```bash
fly deploy
```

Then test: `https://pythh.ai/signal-matches?url=brickeye.com`

## Verification Checklist

- [ ] Database migration applied (no errors in SQL Editor)
- [ ] Local dev shows real names in top 5
- [ ] Rows 6+ are blurred
- [ ] Visual separator appears between unlocked/locked
- [ ] No "Unknown" in top 5 rows
- [ ] "Top 5 Free" badge visible in header
- [ ] Safari doesn't crash (no "require" errors)
- [ ] Console shows only 1 HIT log per navigation
- [ ] Production deployed and tested

## Troubleshooting

### Still showing "Unknown"?
1. Check: Did you apply the database migration?
2. Run in Supabase SQL Editor:
   ```sql
   SELECT investor_name, is_locked 
   FROM get_live_match_table('4d46236f-adf8-4c7b-913e-fbc992dda7b5')
   LIMIT 5;
   ```
3. Expected: `investor_name` should NOT be NULL for any row

### All investors still locked?
1. Check: Are you on the latest frontend code? (commit a4581688)
2. Run: `git log --oneline -1`
3. Expected: `DATABASE FIX: Always return investor_name...`

### Blur effect not showing?
1. Check: Are there 5+ matches in the table?
2. Check: Browser supports `backdrop-filter` (Safari 9+, Chrome 76+)
3. Inspect element: Look for `backdrop-blur-[1.5px]` class

## Commits

1. **2de7f15d** - FIX: Pass index to mapMatchRowToRadarRow in legacy adapter
2. **a4581688** - DATABASE FIX: Always return investor_name in get_live_match_table RPC ← Current

## Next Steps

Once verified in production:
- [ ] Monitor for any "Unknown" investor names
- [ ] Track unlock conversion rates (top 5 → unlock more)
- [ ] Consider A/B testing: blur vs gray-out for rows 6+
- [ ] Add analytics: Which investors do founders unlock most?

---

**Status:** Database migration file created, committed, pushed to GitHub  
**Action Required:** Apply SQL in Supabase Dashboard → SQL Editor
