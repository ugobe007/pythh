# Bug Fixes - February 2, 2026

## ✅ Issue 1: View Button Navigation Broken

**Problem**: Clicking "View" on investor rows redirected to main page instead of investor profile.

**Root Cause**: LiveMatchTableV2 component was navigating to wrong route:
- ❌ Used: `/app/investors/${investorId}` (doesn't exist)
- ✅ Correct: `/investor/${investorId}` (defined in routes.ts and App.tsx)

**Fix**: [src/components/pythh/LiveMatchTableV2.tsx](../src/components/pythh/LiveMatchTableV2.tsx#L75)
```typescript
// BEFORE (broken):
const handleView = (investorId: string) => {
  navigate(`/app/investors/${investorId}`);
};

// AFTER (working):
const handleView = (investorId: string) => {
  navigate(`/investor/${investorId}`);
};
```

**Testing**:
1. Go to `/signal-matches?url=brickeye.com`
2. Click "View" on any unlocked investor
3. Should navigate to `/investor/{uuid}` and show profile
4. Should NOT redirect to main page

**Commit**: cb629721

---

## ✅ Issue 2: VC Sheet Appearing as Investor

**Problem**: "VC Sheet" showing up in match results (it's a data aggregator, not an investor)

**Root Cause**: Database contains data sources/aggregators incorrectly classified as investors:
- VC Sheet (data source)
- Crunchbase (data platform)
- AngelList (data platform)
- PitchBook (data platform)

**Fix**: Database migration to mark these as `status = 'inactive'`

**Migration**: [supabase/migrations/20260202_remove_vc_sheet_from_matches.sql](../supabase/migrations/20260202_remove_vc_sheet_from_matches.sql)

```sql
UPDATE investors 
SET status = 'inactive'
WHERE LOWER(name) LIKE '%vc sheet%' 
   OR LOWER(name) IN ('crunchbase', 'angellist', 'pitchbook', ...);
```

**Note**: The `get_live_match_table` RPC already filters for `status IS NULL OR status = 'active'`, so marking as 'inactive' removes them from results automatically.

**Deployment**:
1. Go to Supabase Dashboard → SQL Editor
2. Run the migration SQL
3. Verify: VC Sheet and aggregators no longer appear in matches

**Commit**: 85b66e51

---

## Related Context

### Routes Structure
```typescript
// Public routes (no /app prefix)
/investor/:id              → InvestorProfile component

// App routes (inside /app)
/app/signals-dashboard     → SignalsDashboard
/app/in-signal-matches     → InSignalMatches
```

### Status Field Usage
In `investors` table:
- `NULL` or `'active'` → Shows in matches
- `'inactive'` → Hidden from matches (but data preserved)
- `'archived'` → Soft deleted

### Match Query Logic
From `get_live_match_table` RPC (line 104):
```sql
WHERE (i.status IS NULL OR i.status = 'active')
```

This ensures only active investors appear in results.

---

## Verification Checklist

Frontend Fix (View button):
- [ ] Test on localhost:5176
- [ ] Click View on unlocked investor
- [ ] Verifies: Opens /investor/{uuid} page
- [ ] Verifies: Shows investor profile (not main page)
- [ ] Deploy to production: `fly deploy`
- [ ] Test on pythh.ai

Database Fix (VC Sheet):
- [ ] Run migration in Supabase Dashboard
- [ ] Refresh /signal-matches page
- [ ] Verify: VC Sheet no longer appears
- [ ] Verify: Crunchbase/AngelList also hidden
- [ ] Check: Real investors still showing

---

## Files Changed

### Frontend
- [src/components/pythh/LiveMatchTableV2.tsx](../src/components/pythh/LiveMatchTableV2.tsx) - Fixed navigation route

### Database
- [supabase/migrations/20260202_remove_vc_sheet_from_matches.sql](../supabase/migrations/20260202_remove_vc_sheet_from_matches.sql) - Mark aggregators as inactive

---

**Status**: Frontend fix committed and pushed. Database migration ready to apply in Supabase Dashboard.
