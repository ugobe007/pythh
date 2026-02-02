# Phase A Canon Flow - COMPLETE ✅

## Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: HOME (/)                                           │
│  FindMyInvestors.tsx (81 lines)                            │
│  ─────────────────────────────────────────────────────────  │
│  • Minimal CTA page                                         │
│  • SmartSearchBar component                                 │
│  • No discovery features, just input + submit               │
│  • On submit → /discover?url=...                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: DISCOVER (/discover?url=...)                       │
│  PythhMatchingEngine.tsx (461 lines)                        │
│  ─────────────────────────────────────────────────────────  │
│  • Discover-only surface (NO viewer UI)                     │
│  • Resolves startup from URL                                │
│  • Loads matches from Supabase                              │
│  • Computes signal (AI adoption, fintech, etc.)             │
│  • Shows loading phases (4 steps rotating)                  │
│  • Once complete → /matches?url=...&startup_id=...&signal=..│
│  • Redirect after 450ms delay (intentional feel)            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: MATCHES (/matches?url=...&startup_id=...&signal=..)│
│  DiscoveryResultsPage.tsx (280 lines)                       │
│  ─────────────────────────────────────────────────────────  │
│  • Minimal "pythh signals" results                          │
│  • Title: "pythh signals"                                   │
│  • Subhead: "Top Matches by [signal]: ..."                  │
│  • Shows 3 rows minimum (degraded-but-alive)                │
│  • Format: rank + firm name + [focus] [stage] [size] [signal]│
│  • Uses startup_id from query (fast)                        │
│  • Falls back to URL resolution if needed                   │
│  • Never empty: shows "Scanning…" placeholders              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. URL Resolution
```typescript
// /discover receives: ?url=stripe.com
// Finds or creates startup in database
// Returns: startup_id (UUID)
```

### 2. Match Loading
```typescript
// Query: startup_investor_matches
// Filter: startup_id, status='suggested', match_score >= 20
// Order: match_score DESC
// Limit: 150 (for /discover), 25 (for /matches)
```

### 3. Signal Computation
```typescript
// Best-effort heuristic until taxonomy formalized
chooseTopSignal(startup) → string
  - AI sectors → "AI adoption"
  - Climate/Energy → "climate momentum"
  - Fintech → "fintech traction"
  - Dev tools → "developer gravity"
  - Health → "health signal"
  - Default → first sector or "alignment"
```

### 4. Redirect with Context
```typescript
// /discover → /matches with query string:
{
  url: "https://stripe.com",
  startup_id: "uuid-here",
  signal: "fintech traction"
}
```

## Key Decisions

### ✅ What Changed
1. **PythhMatchingEngine** reduced from 1,061 → 461 lines
   - Removed: cycling, cards, modals, save/share, 10-min refresh
   - Fixed: missing `<X />` import crash
   - Added: redirect logic to /matches

2. **DiscoveryResultsPage** reduced from 836 → 280 lines
   - Removed: capital nav components, triads, charts, convergence theater
   - Fixed: Phase B instrument mode UI bleeding into Phase A
   - Added: minimal "pythh signals" list matching mock

3. **Bundle size** reduced: 1.75MB → 1.59MB (-160KB / -9%)

### ✅ What Stayed
- Routing structure in App.tsx (no changes needed)
- SmartSearchBar navigation logic (already correct)
- Database schema and queries (no breaking changes)
- All admin routes and legacy surfaces (untouched)

### ✅ Degraded-but-Alive Doctrine
Both pages implement graceful degradation:
- `/discover` shows error but allows retry
- `/matches` always shows 3 rows (placeholders if needed)
- Never shows "no results" blank page

## Testing Checklist

- [ ] Visit `/` → see minimal home with search bar
- [ ] Submit `stripe.com` → redirect to `/discover?url=stripe.com`
- [ ] Wait ~2-3 seconds → see loading phases rotate
- [ ] Automatic redirect to `/matches?url=...&startup_id=...&signal=...`
- [ ] See "pythh signals" title with 3+ firm rows
- [ ] Click "New scan" → return to `/`

## Next Steps (Phase B)

When ready for instrument-mode capital nav:
1. Create `/nav` route for DiscoveryResultsPageV2.tsx
2. Add toggle or user preference for "simple vs nav"
3. Keep `/matches` as canonical public-facing results
4. Use `/nav` for power users who want triads/charts

---

**Status**: Phase A canon complete ✅  
**Build**: 3.77s, 1.59MB bundle, 346KB gzipped  
**Date**: January 22, 2026
