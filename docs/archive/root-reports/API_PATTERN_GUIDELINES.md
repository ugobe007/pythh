# API Pattern Guidelines

## Overview

This document defines the standard API patterns for the Hot Match application. All components should follow these patterns to ensure consistency and maintainability.

## SSOT: Service Layer Pattern

**Rule:** Components should **never** make direct Supabase calls. Always use service layer functions.

### ✅ Correct Pattern

```typescript
// ✅ GOOD: Use service layer
import { loadApprovedStartups } from '@/store';
import { getAllInvestors } from '@/lib/investorService';

const startups = await loadApprovedStartups();
const investors = await getAllInvestors();
```

### ❌ Incorrect Pattern

```typescript
// ❌ BAD: Direct Supabase call in component
import { supabase } from '@/lib/supabase';

const { data } = await supabase
  .from('startup_uploads')
  .select('*')
  .eq('status', 'approved');
```

## Service Layer Structure

### Frontend Services (`src/lib/`, `src/services/`)
- **Purpose:** Data access and business logic for frontend
- **Location:** `src/lib/investorService.ts`, `src/services/matchingService.ts`, etc.
- **Usage:** Called directly from React components
- **Examples:**
  - `getAllInvestors()` - Fetch all investors
  - `loadApprovedStartups()` - Load approved startups
  - `calculateAdvancedMatchScore()` - Calculate match scores

### Backend Services (`server/services/`)
- **Purpose:** Server-side operations, heavy processing, scheduled jobs
- **Location:** `server/services/`
- **Usage:** Called from API routes or automation scripts
- **Examples:**
  - `investorScoringService.ts` - Calculate investor scores
  - `matchReportsService.ts` - Generate match reports
  - `autoMatchService.ts` - Auto-generate matches

### API Routes (`server/routes/`, `server/index.js`)
- **Purpose:** REST API endpoints for frontend to call
- **Location:** `server/routes/`, `server/index.js`
- **Usage:** Called via `fetch()` from frontend
- **Examples:**
  - `POST /api/investors/scrape` - Trigger investor scraping
  - `GET /api/matches/startup/:id` - Get startup matches

## Migration Strategy

### Phase 1: Document Pattern (Current)
- ✅ Create API pattern guidelines (this document)
- ✅ Identify components with direct Supabase calls
- ✅ Document service layer structure

### Phase 2: Create Service Functions (Incremental)
- Create service functions for common operations
- Start with most frequently used patterns
- Update components incrementally

### Phase 3: Enforce Pattern (Future)
- Add linting rules to prevent direct Supabase calls
- Code review checklist
- Automated checks

## Common Operations & Service Functions

### Startup Operations
- ✅ `loadApprovedStartups()` - `src/store.ts`
- ⏳ `getStartupById(id)` - TODO: Create in `src/lib/startupService.ts`
- ⏳ `createStartup(data)` - TODO: Create in `src/lib/startupService.ts`
- ⏳ `updateStartup(id, data)` - TODO: Create in `src/lib/startupService.ts`

### Investor Operations
- ✅ `getAllInvestors()` - `src/lib/investorService.ts`
- ✅ `getInvestorById(id)` - `src/lib/investorService.ts`
- ✅ `searchInvestors(query, type)` - `src/lib/investorService.ts`
- ⏳ `createInvestor(data)` - TODO: Enhance in `src/lib/investorService.ts`

### Matching Operations
- ✅ `calculateAdvancedMatchScore()` - `src/services/matchingService.ts`
- ✅ `generateAdvancedMatches()` - `src/services/matchingService.ts`
- ✅ `findSemanticInvestorMatches()` - `src/services/semanticMatchingService.ts`

## Components with Direct Supabase Calls

The following components currently make direct Supabase calls and should be migrated to use services (incremental):

### High Priority
- `src/pages/Submit.tsx` - Creates startups directly
- `src/pages/CheckoutPage.tsx` - Creates user subscriptions
- `src/components/MatchingEngine.tsx` - Test code (can be removed)

### Medium Priority
- `src/pages/DiagnosticPage.tsx` - Diagnostic queries (acceptable)
- `src/pages/DatabaseDiagnostic.tsx` - Diagnostic queries (acceptable)
- Various admin pages - Admin operations (acceptable for now)

### Low Priority
- Migration tools - Can keep direct calls for migration purposes

## Best Practices

1. **Always use services** - Never call Supabase directly from components
2. **Handle errors gracefully** - Services should return `{ data, error }` pattern
3. **Type safety** - Use TypeScript types from `src/types/index.ts`
4. **SSOT** - All data must come from Supabase (no static fallbacks)
5. **Consistent patterns** - Follow existing service patterns

## Service Function Template

```typescript
/**
 * Service function template
 */
export async function serviceFunction(params: Params): Promise<Result> {
  try {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('field', params.value);
    
    if (error) {
      console.error('Error in serviceFunction:', error);
      return { data: null, error };
    }
    
    // Transform data if needed
    const transformed = data.map(item => adaptItem(item));
    
    return { data: transformed, error: null };
  } catch (error) {
    console.error('Unexpected error in serviceFunction:', error);
    return { data: null, error: error as Error };
  }
}
```




