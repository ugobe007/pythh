# PYTHH ENGINE - CANONICAL WORKFLOW

## ⚠️ CRITICAL SYSTEM - DO NOT MODIFY WITHOUT FULL UNDERSTANDING

This document defines the **CANONICAL pythh workflow** for URL submission, processing, and signal matching. This is the core value proposition of the platform.

---

## 📊 The Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: USER SUBMITS URL                                       │
│  Location: src/pages/PythhHome.tsx (line ~133)                  │
│  Action: navigate(`/signals?url=${encodeURIComponent(url)}`)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: CANONICAL REDIRECT                                     │
│  Location: src/App.tsx (line ~180)                              │
│  Route: /signals → /signals-radar (preserves query params)      │
│  Critical: DO NOT DELETE THIS REDIRECT                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: SIGNALS RADAR PAGE RECEIVES URL                        │
│  Location: src/pages/app/SignalsRadarPage.tsx (line ~69)        │
│  Code: const urlToResolve = searchParams.get('url')             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: URL RESOLUTION HOOK                                    │
│  Location: src/pages/app/SignalsRadarPage.tsx (line ~72)        │
│  Hook: useResolveStartup(urlToResolve)                          │
│  File: src/services/pythh-rpc.ts                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: RPC CALL TO SUPABASE                                   │
│  RPC Function: resolve_startup_by_url                           │
│  Location: Supabase database function                           │
│                                                                  │
│  The RPC performs:                                               │
│  1. Scrape the website                                           │
│  2. Extract startup data (name, description, sectors, etc.)      │
│  3. Build database entry in startup_uploads table                │
│  4. Calculate GOD score (team, traction, market, etc.)           │
│  5. Generate investor matches (faith_alignment_matches)          │
│  6. Return: startup_id + name + found flag                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  STEP 6: DISPLAY RESULTS                                        │
│  Location: src/pages/app/SignalsRadarPage.tsx                   │
│  Component: LiveMatchTable                                       │
│                                                                  │
│  Shows:                                                          │
│  - 5 unlocked investor signals (visible)                         │
│  - 50+ locked investor signals (blurred, paywall)                │
│  - GOD score, sector alignment, conviction scores                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Protected Code Sections

### 1. Homepage Submit Function
**File:** `src/pages/PythhHome.tsx`  
**Line:** ~133  
**Code:**
```typescript
const submit = () => {
  if (url.trim()) navigate(`/signals?url=${encodeURIComponent(url.trim())}`);
};
```
**Protection:** DO NOT change the route from `/signals`

---

### 2. Canonical Redirect
**File:** `src/App.tsx`  
**Line:** ~180  
**Code:**
```typescript
<Route path="/signals" element={<Navigate to={toWithQuery('/signals-radar')} replace />} />
```
**Protection:** 
- DO NOT DELETE this route
- DO NOT change destination from `/signals-radar`
- DO NOT remove `toWithQuery` (preserves URL params)
- This redirect is MANDATORY for the workflow

---

### 3. URL Parameter Extraction
**File:** `src/pages/app/SignalsRadarPage.tsx`  
**Line:** ~69  
**Code:**
```typescript
const urlToResolve = searchParams.get('url');
```
**Protection:** DO NOT rename the query parameter from `url`

---

### 4. Resolution Hook
**File:** `src/pages/app/SignalsRadarPage.tsx`  
**Line:** ~72  
**Code:**
```typescript
const { result: resolverResult, loading: resolverLoading } = useResolveStartup(urlToResolve);
```
**Protection:** 
- DO NOT remove this hook call
- This triggers the entire pythh engine

---

## 🧪 Testing the Workflow

### Manual Test
1. Go to pythh.ai homepage
2. Enter URL: `stripe.com`
3. Click submit
4. Verify redirect to: `/signals-radar?url=stripe.com`
5. Watch for loading state
6. Confirm results show: startup name + investor matches

### Expected Behavior
- **Success:** Startup profile displays with 5 unlocked + 50 locked signals
- **Not Found:** "Startup not found" message with option to try another URL
- **Loading:** Skeleton loader while RPC processes

### Failure Modes
| Issue | Cause | Fix |
|-------|-------|-----|
| Redirect not working | `/signals` route deleted | Restore route in App.tsx |
| URL param missing | Query not preserved | Check `toWithQuery()` function |
| Hook not firing | `urlToResolve` is null | Check searchParams.get('url') |
| RPC fails | Database function error | Check Supabase logs |

---

## 🚨 Breaking Changes to Avoid

### ❌ NEVER DO THIS:
```typescript
// BAD: Removing the canonical redirect
// <Route path="/signals" element={<Navigate to="/signals-radar" replace />} />

// BAD: Changing the URL parameter name
const myUrl = searchParams.get('startup_url'); // ❌ Must be 'url'

// BAD: Skipping the redirect and going direct to /signals-radar
navigate(`/signals-radar?url=${url}`); // ❌ Must go through /signals first

// BAD: Removing the useResolveStartup hook
// This breaks the entire engine
```

### ✅ SAFE CHANGES:
- Styling the loading state
- Updating the results display
- Adding analytics tracking
- Improving error messages
- Optimizing the RPC function (with testing)

---

## 📝 Architecture Notes

### Why the /signals → /signals-radar redirect?
- Historical: `/signals` was the original public route
- Separation: `/signals-radar` is the internal processing route
- Flexibility: Allows us to change implementation without breaking external links
- Analytics: Track entry point vs processing separately

### Why not go directly to /signals-radar?
- Public API: `/signals?url=...` is the documented public endpoint
- Backward compatibility: Many links/bookmarks point to `/signals`
- Clean URLs: `/signals` is simpler than `/signals-radar` for marketing

---

## 🔧 Related Files

| File | Purpose |
|------|---------|
| [src/pages/PythhHome.tsx](src/pages/PythhHome.tsx) | Homepage with URL input |
| [src/App.tsx](src/App.tsx) | Route definitions + canonical redirect |
| [src/pages/app/SignalsRadarPage.tsx](src/pages/app/SignalsRadarPage.tsx) | URL processing + results display |
| [src/services/pythh-rpc.ts](src/services/pythh-rpc.ts) | useResolveStartup hook |
| [supabase/functions/resolve_startup_by_url.sql](supabase/functions/) | Database RPC function |

---

## 📞 Support

If you need to modify this workflow, please:
1. Read this entire document
2. Understand each step in the flow
3. Test extensively in development
4. Create a backup branch
5. Monitor error logs after deployment

**This is the pythh engine. Handle with extreme care.**

---

*Last Updated: February 2, 2026*
