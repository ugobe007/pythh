# Hot Match Architecture - Quick Reference

## 🎯 Current Status

**Foundation:** ✅ Complete  
**Migration:** ⏳ Incremental (as needed)

## 📁 Key Files

### Type System (SSOT)
- `src/types/index.ts` - **Import types from here**
- `src/utils/startupAdapters.ts` - Convert database → component types
- `src/utils/investorAdapters.ts` - Convert database → investor types

### Components
- `src/components/StartupCard.tsx` - **Use this** (supports `variant="detailed"`)
- `src/components/InvestorCard.tsx` - **Use this** (supports variants)

### Deprecated (Still work, but migrate)
- `src/components/StartupCardOfficial.tsx` - Use StartupCard with `variant="detailed"`
- `src/components/EnhancedInvestorCard.tsx` - Use InvestorCard with `variant="enhanced"`
- `src/components/VCFirmCard.tsx` - Use InvestorCard with `variant="vc"`

## 🔄 Quick Migration

### Types
```typescript
// ✅ DO THIS
import { Startup, StartupComponent } from '@/types';
import { adaptStartupForComponent } from '@/utils/startupAdapters';

// ❌ DON'T DO THIS
import { Startup } from '@/lib/supabase';
import { Startup } from '@/types'; // Old types.ts
```

### Components
```typescript
// ✅ DO THIS
import StartupCard from '@/components/StartupCard';
<StartupCard startup={startup} variant="detailed" />

// ❌ DON'T DO THIS
import StartupCardOfficial from '@/components/StartupCardOfficial';
```

## 📚 Documentation

- **Full Audit:** `ARCHITECTURE_AUDIT_REPORT.md`
- **Type Migration:** `PHASE1_SSOT_MIGRATION_GUIDE.md`
- **Component Consolidation:** `PHASE2_IMPLEMENTATION_PLAN.md`
- **Complete Summary:** `ARCHITECTURE_IMPROVEMENTS_SUMMARY.md`

## 🚀 Next Steps

1. Use SSOT types in new code
2. Migrate components incrementally
3. Refer to migration guides when updating old code




