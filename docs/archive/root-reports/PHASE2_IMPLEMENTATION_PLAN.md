# Phase 2: Component Consolidation - Implementation Plan

## Strategy

Given the complexity of the components, we'll use a **gradual migration approach**:

1. **Mark duplicates as deprecated** with clear migration paths
2. **Create unified components** with variant props
3. **Migrate incrementally** - one component at a time

## Component Analysis

### Startup Cards

| Component | Lines | Usage | Features |
|-----------|-------|-------|----------|
| `StartupCard.tsx` | 197 | Voting pages | Simple voting, reactions, stage progress |
| `StartupCardOfficial.tsx` | 510 | Matching, Portfolio | GOD scores, detailed metrics, swipe away |

**Decision:** Keep `StartupCard.tsx` as base, add `variant="detailed"` prop to support `StartupCardOfficial` features.

### Investor Cards

| Component | Lines | Usage | Features |
|-----------|-------|-------|----------|
| `InvestorCard.tsx` | 129 | InvestorsPage | Basic info, type badge, metrics |
| `EnhancedInvestorCard.tsx` | 510 | MatchingEngine | Match scores, expandable, detailed |
| `VCFirmCard.tsx` | 130 | Various | VC-specific layout |

**Decision:** Keep `InvestorCard.tsx` as base, add `variant="enhanced"` and `variant="vc"` props.

## Implementation Steps

### Step 1: Enhance StartupCard with Variants ✅
- Add `variant?: 'simple' | 'detailed'` prop
- Merge GOD score display from StartupCardOfficial
- Add detailed metrics view
- Keep backward compatible (default: 'simple')

### Step 2: Enhance InvestorCard with Variants ✅
- Add `variant?: 'basic' | 'enhanced' | 'vc'` prop
- Merge features from EnhancedInvestorCard and VCFirmCard
- Keep backward compatible (default: 'basic')

### Step 3: Deprecate Duplicates
- Add `@deprecated` comments to StartupCardOfficial
- Add `@deprecated` comments to EnhancedInvestorCard
- Add `@deprecated` comments to VCFirmCard
- Add migration instructions in comments

### Step 4: Update Imports (Gradual)
- Update MatchingEngine to use StartupCard with variant="detailed"
- Update PortfolioPage to use StartupCard with variant="detailed"
- Update other pages incrementally

## Migration Pattern

### Before:
```typescript
import StartupCardOfficial from './StartupCardOfficial';
<StartupCardOfficial startup={startup} onVote={handleVote} />
```

### After:
```typescript
import StartupCard from './StartupCard';
<StartupCard startup={startup} variant="detailed" onVote={handleVote} />
```

## Benefits

1. **Single source of truth** for each component type
2. **Easier maintenance** - one file to update
3. **Consistent styling** across variants
4. **Type safety** - shared interfaces
5. **Backward compatible** - existing code still works

## Timeline

- **Week 1:** Enhance base components with variants
- **Week 2:** Deprecate duplicates, update core pages
- **Week 3:** Migrate remaining pages incrementally
- **Week 4:** Remove deprecated components (if desired)

## Notes

- Keep deprecated components for now (backward compatibility)
- Migration can be done incrementally
- No breaking changes during migration
- Can remove deprecated components after all migrations complete




