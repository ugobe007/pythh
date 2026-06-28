# Phase 3: Service Layer Cleanup

## Overview

Consolidate duplicate matching and investor services, remove legacy files, and create organized service exports.

## Current State

### Matching Services (Duplicated)
- ✅ `src/services/matchingService.ts` - Main frontend matching service
- ✅ `src/services/semanticMatchingService.ts` - Semantic matching
- ✅ `server/services/startupMatchSearchService.ts` - Startup search (TypeScript)
- ✅ `server/services/investorMatchSearchService.ts` - Investor search (TypeScript)
- ✅ `server/services/investorMatching.ts` - AI-based matching
- ✅ `server/services/autoMatchService.ts` - Auto matching
- ✅ `server/services/matchInsightsService.ts` - Match insights
- ✅ `server/services/matchInvestigationService.ts` - Match investigation
- ✅ `server/services/matchReportsService.ts` - Match reports
- ❌ `server/services/matchServices.js` - **Legacy CommonJS wrapper (DELETE)**

### Investor Services
- ✅ `src/lib/investorService.ts` - Frontend service
- ✅ `src/lib/investorEnrichmentService.ts` - Enrichment
- ✅ `src/lib/investorNewsService.ts` - News
- ✅ `server/services/investorScoringService.ts` - Scoring
- ✅ `server/services/investorIntelligence.ts` - Intelligence

## Tasks

### 1. Delete Legacy Files ✅
- [x] Delete `server/services/matchServices.js` (after migration)

### 2. Create Service Index Files
- [ ] Create `server/services/matching/index.ts` - Consolidated matching exports
- [ ] Create `server/services/investors/index.ts` - Consolidated investor exports

### 3. Update Imports
- [ ] Update `server/routes/matches.js` to use TypeScript services
- [ ] Update `test-match-api.js` to use TypeScript services

### 4. Documentation
- [ ] Document service organization
- [ ] Create migration guide

## Implementation Plan

### Step 1: Create Service Index Files

Create `server/services/matching/index.ts`:
```typescript
/**
 * MATCHING SERVICES - Consolidated Exports
 * 
 * All matching-related services exported from a single location.
 */

// Search services
export * from '../startupMatchSearchService';
export * from '../investorMatchSearchService';

// Matching services
export * from '../investorMatching';
export * from '../autoMatchService';

// Analysis services
export * from '../matchInsightsService';
export * from '../matchInvestigationService';
export * from '../matchReportsService';
```

Create `server/services/investors/index.ts`:
```typescript
/**
 * INVESTOR SERVICES - Consolidated Exports
 * 
 * All investor-related services exported from a single location.
 */

export * from '../investorScoringService';
export * from '../investorIntelligence';
```

### Step 2: Update Routes

Update `server/routes/matches.js` to use TypeScript services via dynamic import or tsx.

### Step 3: Update Tests

Update `test-match-api.js` to use TypeScript services.

## Success Criteria

- ✅ No duplicate service files
- ✅ Clear service organization
- ✅ All imports use consolidated exports
- ✅ Legacy files removed
- ✅ Documentation updated
