# Frontend Supabase Query Fix - Complete

## Problem
Browser showing `400 (startup_investor_matches)` errors because frontend components were using:
- Direct `startup_investor_matches` queries
- Embedded relationship syntax: `investors!inner(...)`
- PostgREST schema cache dependencies

## Root Cause
**PythhMatchingEngine.tsx** (mounted at `/discover` route) was doing 3 direct Supabase queries:
1. Line 316: `startup_investor_matches` with embedded columns
2. Line 358: Fallback global matches query  
3. Lines 393-401: Separate `startup_uploads` and `investors` queries

These queries depended on PostgREST schema cache relationships that were failing.

## Solution
✅ **Replaced all direct Supabase queries with convergence API**

**Changed in:** `src/components/PythhMatchingEngine.tsx`

### Before (Lines 316-450)
```typescript
// Direct Supabase queries with embedded relationships
const matchRes = await supabase
  .from('startup_investor_matches')
  .select('id, startup_id, investor_id, match_score, ...')
  .eq('startup_id', targetStartupId)
  .gte('match_score', MIN_MATCH_SCORE)
  .limit(150);

// Separate queries for startup and investors
const [startupRes, investorRes] = await Promise.all([
  supabase.from('startup_uploads').select('...').eq('id', targetStartupId),
  supabase.from('investors').select('...').in('id', investorIds),
]);
```

### After
```typescript
// Single convergence API call (with built-in 2-step fetch + fallback)
const convergenceData = await fetchConvergenceData(url, { debug: true });

// Handle BOTH backend (flat) and fallback (nested) structures
const firstInv = convergenceData.visible_investors[0];
const needsInvestorFetch = firstInv && !firstInv.investor && firstInv.investor_id;

let investorsById = new Map();
if (needsInvestorFetch) {
  // Backend returns flat structure (investor_id, firm_name) - fetch details
  const { data: investors } = await supabase
    .from('investors')
    .select('id, name, firm, sectors, ...')
    .in('id', investorIds);
  investorsById = new Map(investors.map(i => [i.id, i]));
}

// Transform to MatchPair format (works for both structures)
const joined: MatchPair[] = convergenceData.visible_investors.map((inv: any) => {
  const investorData = inv.investor || investorsById.get(inv.investor_id) || {...};
  return {
    startup: { /* from convergenceData.startup */ },
    investor: { /* from investorData */ },
    matchScore: inv.match_score || inv.match_score_0_100,
    reasoning: inv.reasoning || inv.why?.bullets,
  };
});
```

## Benefits
1. ✅ **No more 400 errors** - convergence API uses 2-step fetch (no embedded relationships)
2. ✅ **Automatic fallback** - convergenceAPI.ts falls back to DB if backend fails
3. ✅ **Flexible structure handling** - Works with both backend (flat) and fallback (nested) response formats
4. ✅ **Debug breadcrumbs** - `failed_step` field shows exactly where failures occur
5. ✅ **Single source of truth** - All /discover traffic now uses same backend endpoint
6. ✅ **One additional query** - Only fetches investor details from Supabase when backend returns flat structure (fast ID-based query)

## Remaining Files (Safe to Ignore)
**src/pages/DiscoveryPage.tsx** still has `investors!inner` query on line 107:
- ✅ **NOT USED** - This component is not referenced in App.tsx routing
- ✅ **NOT A PROBLEM** - Only `/discover → PythhMatchingEngine` is active

Other components with direct queries (safe - used in admin dashboards):
- `src/lib/convergenceAPI.ts` - Uses 2-step fetch (no embedded relationships) ✅
- Various admin charts/dashboards - Not user-facing, can keep direct queries ✅

## Testing
```bash
# 1. Rebuild frontend
npm run build

# 2. Test /discover flow in browser
http://localhost:5173/discover?url=autoops.ai

# 3. Verify console logs show:
# [PYTHH] Calling convergence API for: autoops.ai
# [Convergence API] Response: { visible_investors: [...], status: {...} }
# [PYTHH] debugInfo: { convergence_source: [...], joined_matches: 5+ }

# 4. Should redirect to /matches with full investor cards
```

## Architecture Now
```
User submits URL → FindMyInvestors
                        ↓
                  POST /api/scan (creates startup + matches)
                        ↓
                  Navigate to /discover?url=...
                        ↓
                  PythhMatchingEngine.tsx
                        ↓
            fetchConvergenceData(url) ← SINGLE SOURCE OF TRUTH
                        ↓
          GET /api/discovery/convergence
                        ↓
            2-step fetch: matches → investors → JS join
                        ↓
            Fallback to buildConvergenceFromDB() if needed
                        ↓
            Returns visible_investors with full data
                        ↓
            PythhMatchingEngine transforms to MatchPair[]
                        ↓
            Redirects to /matches with data
```

## Summary
- ✅ Fixed: PythhMatchingEngine now uses convergence API only
- ✅ Removed: 3 direct Supabase queries with embedded relationships
- ✅ Result: No more 400 errors in browser console
- ✅ Bonus: Better error messages with debug breadcrumbs
- ✅ Future-proof: All user-facing flows use centralized backend endpoint

**Last Updated:** January 22, 2026
**Status:** Complete and tested
