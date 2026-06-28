# Phase 1: SSOT Type Migration Guide

## ✅ Completed

1. **Created SSOT Type Index** (`src/types/index.ts`)
   - Exports `Startup` and `Investor` from `database.types.ts`
   - Provides `StartupComponent` and `InvestorComponent` for UI components
   - Single import point: `import { Startup, Investor } from '@/types'`

2. **Created Adapter Functions**
   - `src/utils/startupAdapters.ts` - Convert between database and component formats
   - `src/utils/investorAdapters.ts` - Convert between database and investor formats

3. **Deprecated Old Types**
   - Added `@deprecated` warnings to old `Startup` interface in `src/types.ts`
   - Removed duplicate `Startup` interface from `src/lib/supabase.ts`

## 📋 Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import { Startup } from '@/types'; // Old types.ts
import { Startup } from '@/lib/supabase'; // Old supabase.ts
```

**After:**
```typescript
import { Startup } from '@/types'; // New unified index
// OR
import { Startup } from '@/lib/database.types'; // Direct from SSOT
```

### Step 2: Use Adapters for Component Data

**Before:**
```typescript
// Direct use of database type
const startup: Startup = await getStartup(id);
startup.description; // ❌ May be null
startup.marketSize; // ❌ Doesn't exist
```

**After:**
```typescript
import { adaptStartupForComponent } from '@/utils/startupAdapters';

const dbStartup: Startup = await getStartup(id);
const componentStartup = adaptStartupForComponent(dbStartup);
componentStartup.description; // ✅ Always available
componentStartup.marketSize; // ✅ Extracted from extracted_data
```

### Step 3: Update Component Props

**Before:**
```typescript
interface Props {
  startup: Startup; // Old type from types.ts
}
```

**After:**
```typescript
import { StartupComponent } from '@/types';

interface Props {
  startup: StartupComponent; // Extended type with component fields
}
```

### Step 4: Update Service Functions

**Before:**
```typescript
export async function getStartup(id: string): Promise<Startup> {
  const { data } = await supabase.from('startup_uploads').select('*').eq('id', id).single();
  return data; // Returns database type
}
```

**After:**
```typescript
import { adaptStartupForComponent } from '@/utils/startupAdapters';

export async function getStartup(id: string): Promise<StartupComponent> {
  const { data } = await supabase.from('startup_uploads').select('*').eq('id', id).single();
  return adaptStartupForComponent(data); // Returns component type
}
```

## 🔄 Files to Update

### High Priority (Core Services)
- [ ] `src/store.ts` - Update Startup type usage
- [ ] `src/services/matchingService.ts` - Update type imports
- [ ] `src/lib/investorService.ts` - Update Investor type usage
- [ ] `src/components/MatchingEngine.tsx` - Update component props

### Medium Priority (Components)
- [ ] `src/components/StartupCard.tsx`
- [ ] `src/components/Dashboard.tsx`
- [ ] `src/pages/PortfolioPage.tsx`
- [ ] `src/pages/StartupDetail.tsx`
- [ ] `src/pages/GetMatchedPage.tsx`

### Low Priority (Other Pages)
- [ ] `src/pages/Vote.tsx`
- [ ] `src/pages/Feed.tsx`
- [ ] `src/pages/UploadPage.tsx`
- [ ] Other pages using Startup/Investor types

## 🎯 Migration Pattern

1. **Import SSOT types:**
   ```typescript
   import { Startup, Investor } from '@/types';
   ```

2. **Use adapters for component data:**
   ```typescript
   import { adaptStartupForComponent } from '@/utils/startupAdapters';
   const componentData = adaptStartupForComponent(dbData);
   ```

3. **Use component types for props:**
   ```typescript
   import { StartupComponent } from '@/types';
   interface Props { startup: StartupComponent; }
   ```

4. **Remove old imports:**
   ```typescript
   // Remove these
   import { Startup } from '@/lib/supabase';
   import { Startup } from '@/types'; // If using old types.ts
   ```

## ⚠️ Breaking Changes

- `Startup` from `src/types.ts` is deprecated (different schema)
- `Startup` from `src/lib/supabase.ts` is removed
- Component code must use adapters to access legacy fields
- Database queries return SSOT types, not component types

## 📝 Notes

- Adapters handle field mapping automatically
- `extracted_data` JSONB field contains legacy fields
- Component types extend database types with computed fields
- Migration can be done incrementally (file by file)

## 🚀 Next Steps

1. Update core services first (store.ts, matchingService.ts)
2. Update components that use these services
3. Update pages that use components
4. Remove deprecated type definitions once migration is complete




