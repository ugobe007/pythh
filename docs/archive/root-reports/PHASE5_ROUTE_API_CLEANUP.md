# Phase 5: Route & API Cleanup

## Overview

Consolidate routes, remove duplicates, standardize API patterns, and create route configuration.

## Current State

### Route Issues
- **80+ routes** in `App.tsx` with unclear organization
- **Multiple admin routes** (`/admin/*`) - some duplicates
- **Multiple dashboard routes** - confusing navigation
- **Duplicate functionality routes** - same component, different paths
- **Unused/legacy routes** - routes that may not be used

### API Pattern Issues
- **Direct Supabase calls** in components (should use services)
- **Service layer** (`src/lib/*.ts`) - good pattern
- **Backend API** (`server/index.js`, `server/routes/`) - good pattern
- **Mixed patterns** - unclear which to use

## Tasks

### 1. Route Consolidation
- [ ] Analyze all routes in `App.tsx`
- [ ] Identify duplicate routes (same component, different paths)
- [ ] Identify unused/legacy routes
- [ ] Consolidate admin routes under `/admin/*`
- [ ] Create route configuration file

### 2. Route Documentation
- [ ] Document all active routes
- [ ] Create route navigation map
- [ ] Add route comments in `App.tsx`

### 3. API Pattern Standardization
- [ ] Identify components making direct Supabase calls
- [ ] Create service layer functions for common operations
- [ ] Update components to use services instead of direct calls
- [ ] Document API pattern guidelines

### 4. Route Configuration File
- [ ] Create `src/config/routes.ts` - centralized route definitions
- [ ] Export route constants
- [ ] Export route helpers

## Implementation Strategy

### Step 1: Analyze Routes
1. List all routes from `App.tsx`
2. Group by category (public, admin, matching, etc.)
3. Identify duplicates and unused routes
4. Create route inventory

### Step 2: Consolidate Routes
1. Remove duplicate routes (keep canonical path)
2. Remove unused/legacy routes
3. Organize admin routes better
4. Add route comments

### Step 3: Standardize API Patterns
1. Find components with direct Supabase calls
2. Create service functions for common operations
3. Update components to use services
4. Document pattern

### Step 4: Create Route Config
1. Create `src/config/routes.ts`
2. Define route constants
3. Export route helpers
4. Update `App.tsx` to use config

## Success Criteria

- ✅ Routes organized and documented
- ✅ Duplicate routes removed
- ✅ Unused routes removed
- ✅ Route configuration file created
- ✅ API patterns standardized
- ✅ Components use services, not direct Supabase calls




