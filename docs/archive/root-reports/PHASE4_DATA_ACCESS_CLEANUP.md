# Phase 4: Data Access Cleanup

## Overview

Remove static fallback data, simplify service layer, and enforce SSOT (Supabase as single source of truth).

## Current State

### Static Data Files (Deprecated)
- ❌ `src/data/startupData.ts` - Static startup data (already deprecated)
- ❌ `src/data/investorData.ts` - Static investor data (already deprecated)
- ❌ `src/data/startupCards.ts` - Static startup cards (if exists)

### Fallback Logic Locations
- `src/store.ts` - Falls back to `startupData.ts` when Supabase fails
- `src/pages/VoteDemo.tsx` - Uses `startupData` directly
- `src/pages/PortfolioPage.tsx` - Uses `startupData` directly
- `src/components/FrontPageNew.tsx` - Uses `startupData` directly
- `src/pages/InvestorsPage.tsx` - Uses `investorData` directly
- Other files using static data

## Tasks

### 1. Remove Fallback Logic
- [ ] Remove fallback logic from `src/store.ts`
- [ ] Update error handling to fail gracefully instead of falling back

### 2. Update Direct Static Data Imports
- [ ] `src/pages/VoteDemo.tsx` - Use Supabase instead
- [ ] `src/pages/PortfolioPage.tsx` - Use Supabase instead
- [ ] `src/components/FrontPageNew.tsx` - Use Supabase instead
- [ ] `src/pages/InvestorsPage.tsx` - Use Supabase instead
- [ ] `src/pages/SyncStartups.tsx` - Keep (migration tool)
- [ ] `src/pages/MigrateStartupData.tsx` - Keep (migration tool)
- [ ] `src/components/SyndicateForm.tsx` - Update to use Supabase
- [ ] `src/utils/voteAnalytics.ts` - Update to use Supabase
- [ ] `src/pages/Feed.tsx` - Update to use Supabase
- [ ] `src/lib/voteService.ts` - Update to use Supabase
- [ ] `src/components/UserActivityStats.tsx` - Update to use Supabase

### 3. Create Data Access Layer
- [ ] Create `src/lib/dataAccess/startupAccess.ts` - Centralized startup data access
- [ ] Create `src/lib/dataAccess/investorAccess.ts` - Centralized investor data access
- [ ] Enforce SSOT - all data must come from Supabase

### 4. Documentation
- [ ] Document data access patterns
- [ ] Create migration guide
- [ ] Mark static data files for deletion (keep for now as backup)

## Implementation Strategy

### Step 1: Remove Fallback Logic
Update `src/store.ts` to:
- Remove `startupData` import
- Remove fallback logic
- Fail gracefully with clear error messages
- Return empty array if no data (let UI handle empty state)

### Step 2: Update Components
For each component using static data:
- Replace `import startupData` with Supabase query
- Use `loadApprovedStartups()` from store or direct Supabase call
- Handle loading and error states properly

### Step 3: Create Data Access Layer
Create centralized data access functions that:
- Always use Supabase
- Provide consistent error handling
- Return typed data
- Handle pagination, filtering, etc.

## Success Criteria

- ✅ No fallback logic in services
- ✅ All components use Supabase directly or through data access layer
- ✅ Static data files marked for deletion (kept as backup)
- ✅ Clear error handling (no silent fallbacks)
- ✅ SSOT enforced (Supabase is only source)




