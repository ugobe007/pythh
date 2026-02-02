# Bulletproof Routing System

## Overview

Type-safe route builders that **guarantee valid URLs** and prevent routing bugs.

## Why?

❌ **Before:**
```tsx
<Link to="/investor/123">Profile</Link>  // typo: should be /investor/:id
navigate('/signals/abc/investors');       // broken link - tab renamed
```

✅ **After:**
```tsx
<Link to={routes.investorProfile('123')}>Profile</Link>  // TypeScript enforces
navigate(routes.signalsInvestors('abc'));                 // refactor-safe
```

## Usage

### 1. Import routes
```tsx
import { routes } from '@/routes';
```

### 2. Use in components
```tsx
// Links
<Link to={routes.signals(startupId)}>View Signals</Link>
<Link to={routes.signalsInvestors(startupId)}>Investors Tab</Link>

// Navigation
navigate(routes.resultsByUrl());
navigate(routes.investorProfile(investorId));

// With query params
const url = buildResultsByUrl('example.com');  // /matches?url=example.com
```

### 3. Route parsing
```tsx
// Extract IDs from current path
const { startupId, tab } = parseSignalsRoute(location.pathname);
const { investorId } = parseInvestorRoute(location.pathname);
```

## Current Flow (Phase 4)

```
/ → /discover → /matches?url=example.com
                    ↓
            [Job state machine]
                    ↓
            Display results
```

**Routes:**
- `routes.home()` → `/`
- `routes.discover()` → `/discover`
- `routes.resultsByUrl()` → `/matches`
- `buildResultsByUrl('example.com')` → `/matches?url=example.com`

## Future Flow (Phase 5+)

```
/ → /find → /signals/:id/investors
              ↓
       [Tabbed layout]
         - Investors
         - Your Signals
         - Improve
         - Proof
         - Referrals
```

**Routes:**
- `routes.signals(id)` → `/signals/:id`
- `routes.signalsInvestors(id)` → `/signals/:id/investors`
- `routes.signalsYourSignals(id)` → `/signals/:id/your-signals`
- `routes.signalsImprove(id)` → `/signals/:id/improve`
- `routes.signalsProof(id)` → `/signals/:id/proof`
- `routes.signalsReferrals(id)` → `/signals/:id/referrals`

## Route Guards

```tsx
// Check auth requirement
if (requiresAuth(pathname)) {
  // redirect to login
}

// Check admin requirement
if (requiresAdmin(pathname)) {
  // check permissions
}
```

## Migration Path

### Step 1: Add routes to imports (non-breaking)
```tsx
import { routes } from '@/routes';  // ✅ Add this
// Old hardcoded strings still work
```

### Step 2: Convert one page at a time
```tsx
// Before
<Link to="/investor/123">Profile</Link>

// After
<Link to={routes.investorProfile('123')}>Profile</Link>
```

### Step 3: Enable ESLint rule (optional)
```js
// .eslintrc.js
rules: {
  'no-template-curly-in-string': 'error',  // catch `/investor/${id}`
}
```

## Benefits

1. **Refactor-safe**: Rename route once, update everywhere
2. **Type-safe**: TypeScript catches invalid IDs
3. **Autocomplete**: IDE suggests valid routes
4. **Backwards compatible**: Existing code keeps working
5. **Future-proof**: Easy to add tabs, params, query strings

## Implementation Status

| Route | Status | Notes |
|-------|--------|-------|
| `/` | ✅ Live | Home page |
| `/discover` | ✅ Live | URL submission |
| `/matches` | ✅ Live | Results (with polling) |
| `/signals/:id` | 🚧 Future | Canonical results page |
| `/signals/:id/investors` | 🚧 Future | Default tab |
| `/signals/:id/your-signals` | 🚧 Future | What VCs see |
| `/signals/:id/improve` | 🚧 Future | Guidance |
| `/signals/:id/proof` | 🚧 Future | Case studies |
| `/signals/:id/referrals` | 🚧 Future | Warm intros |

## API Contract (Next Step)

See `src/lib/api/README.md` for:
- `ResolveStartupResponse` (URL → startup_id)
- `TopMatchesResponse` (Paginated investor list)
- `SignalProfileResponse` (Startup signals)
- `PipelineDiagnosticResponse` (Debug info)
