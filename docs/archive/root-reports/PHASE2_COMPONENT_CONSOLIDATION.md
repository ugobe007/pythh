# Phase 2: Component Consolidation Plan

## Analysis

### Startup Card Components
1. **StartupCard.tsx** (197 lines) - Simple voting card with reactions
   - Used in: VotePage, FrontPageNew, Vote, VoteDemo
   - Features: Voting, reactions, stage progress

2. **StartupCardOfficial.tsx** (510 lines) - Detailed card with GOD scores
   - Used in: MatchingEngine, PortfolioPage
   - Features: GOD scores, detailed metrics, swipe away

**Decision:** Keep both as variants of unified component

### Investor Card Components
1. **InvestorCard.tsx** (129 lines) - Basic investor card
   - Used in: InvestorsPage
   - Features: Basic info, type badge, metrics

2. **EnhancedInvestorCard.tsx** (510 lines) - Enhanced investor card
   - Used in: MatchingEngine
   - Features: Match scores, expandable, detailed view

3. **VCFirmCard.tsx** - VC firm specific
   - Used in: Various pages
   - Features: VC-specific layout

**Decision:** Consolidate into unified InvestorCard with variants

## Consolidation Strategy

### Option 1: Props-based Variants (Recommended)
- Single component with `variant` prop
- Cleaner imports
- Easier maintenance

### Option 2: Separate Variant Files
- Keep separate files but share base logic
- More modular but more files

**We'll use Option 1** - Props-based variants

## Implementation Plan

### Step 1: Create Unified StartupCard
- Add `variant?: 'simple' | 'detailed'` prop
- Merge functionality from both cards
- Update all imports

### Step 2: Create Unified InvestorCard
- Add `variant?: 'basic' | 'enhanced' | 'vc'` prop
- Merge functionality from all three cards
- Update all imports

### Step 3: Update Imports
- Find all usages
- Update to use new unified components
- Test each page

## Files to Update

### StartupCard Imports (13 files)
- src/components/StartupCard.tsx (keep, enhance)
- src/components/StartupCardOfficial.tsx (deprecate, merge)
- src/pages/Submit.tsx
- src/components/VotePage.tsx
- src/components/FrontPageNew.tsx
- src/pages/PortfolioPage.tsx
- src/pages/Vote.tsx
- src/components/WelcomeModal.tsx
- src/pages/VoteDemo.tsx
- src/pages/MigrateStartupData.tsx
- src/pages/Home.tsx

### InvestorCard Imports (6 files)
- src/components/MatchingEngine.tsx
- src/components/VotePage.tsx
- src/pages/InvestorsPage.tsx
- src/components/EnhancedInvestorCard.tsx (deprecate, merge)
- src/components/VCFirmCard.tsx (deprecate, merge)
- src/components/InvestorCard.tsx (keep, enhance)




