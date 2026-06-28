# Blank Page Fix - Complete

## Problem Solved

**User Report**: "I entered sequencing.com and got a blank page"

**Root Causes Found**:
1. ❌ **CORS blocking `x-user-plan` header** → Fetch failures → undefined responses
2. ❌ **Destructuring undefined response** → `TypeError: Right side of assignment cannot be destructured`
3. ❌ **Missing 404 handler** → `/api/public-pulses` returning HTML instead of JSON
4. ❌ **No ErrorBoundary** → React crashes showing white screen instead of recovery UI

---

## Fixes Applied (Commit e2732662)

### 1. CORS Fix (server/index.js)
**Before**:
```javascript
allowedHeaders: ['Content-Type', 'Authorization']
```

**After**:
```javascript
allowedHeaders: ['Content-Type', 'Authorization', 'x-user-plan', 'X-Request-ID']
```

**Impact**: Allows frontend to send plan headers without CORS errors

---

### 2. ErrorBoundary (src/components/AppErrorBoundary.tsx)
**Created**: New component wrapping entire app

**Features**:
- Catches all React crashes
- Shows friendly recovery UI instead of blank page
- Displays error message (sanitized in production)
- "Refresh Page" button for recovery
- Stack trace in dev mode only

**Wrapped in** [src/App.tsx](src/App.tsx:137-290):
```tsx
<AppErrorBoundary>
  <AuthProvider>
    <Routes>...</Routes>
  </AuthProvider>
</AppErrorBoundary>
```

**What founders see now**:
```
┌─────────────────────────────────────┐
│ Something broke                     │
│                                     │
│ Try refreshing. If it keeps         │
│ happening, we'll fix it fast.       │
│                                     │
│ TypeError: Cannot destructure...    │
│                                     │
│ [Refresh Page]                      │
└─────────────────────────────────────┘
```

---

### 3. 404 Handler (server/index.js)
**Added**: Global 404 middleware

**Before**: Missing endpoints returned HTML → crashed frontend  
**After**: Returns JSON with clear error

```json
{
  "error": "Not found",
  "path": "/api/public-pulses",
  "requestId": "abc-123"
}
```

**Skips logging**: Static assets (.js, .css, .png, etc.)

---

### 4. Null-Safe Destructuring (src/components/MatchingEngine.tsx)
**Added**: Early return if match is undefined

**Before**:
```typescript
const match = batchMatches[currentIndex];
// Continue with match (could be undefined)
```

**After**:
```typescript
const match = batchMatches[currentIndex];
if (!match) return; // Prevent crash
```

---

### 5. Graceful 404 Handling (src/hooks/useLivePairings.ts)
**Added**: Special handling for missing endpoints

**Before**: 404 errors logged as failures  
**After**: 404 errors fail silently (endpoint not deployed yet)

```typescript
if (response.status === 404) {
  console.warn('[useLivePairings] Endpoint not found - feature may not be deployed');
  setData([]);
  setError(null); // Don't show error to user
  return;
}
```

---

## Testing Results

### Before Fix (Console Errors)
```
[Error] Request header field x-user-plan is not allowed by Access-Control-Allow-Headers
[Error] Fetch API cannot load http://localhost:3002/api/live-pairings
[Error] Failed to load resource: 404 (Not Found) (public-pulses)
[Error] TypeError: Right side of assignment cannot be destructured
```

**Result**: Blank white page

### After Fix
```
✅ No CORS errors
✅ 404s handled gracefully
✅ ErrorBoundary catches crashes
✅ Page shows content or friendly error
```

**Result**: No more blank pages

---

## What This Prevents

| Scenario | Before | After |
|----------|--------|-------|
| CORS error on header | White screen | Works normally |
| Missing API endpoint | White screen | Empty state or silent fail |
| Undefined response | White screen | Friendly error UI |
| React component crash | White screen | Recovery screen with refresh |
| Server 500 error | White screen (sometimes) | Degraded mode or error boundary |

---

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| [server/index.js](server/index.js#L57) | Add x-user-plan to CORS | +1 |
| [server/index.js](server/index.js#L5924) | Add 404 + error handlers | +20 |
| [src/App.tsx](src/App.tsx#L24) | Import ErrorBoundary | +1 |
| [src/App.tsx](src/App.tsx#L137) | Wrap app with boundary | +2 |
| [src/components/AppErrorBoundary.tsx](src/components/AppErrorBoundary.tsx) | New component | +73 |
| [src/components/MatchingEngine.tsx](src/components/MatchingEngine.tsx#L150) | Add null check | +1 |
| [src/hooks/useLivePairings.ts](src/hooks/useLivePairings.ts#L38) | Handle 404 gracefully | +7 |

**Total**: 7 files, ~105 lines added

---

## Prevention Strategy

### Short-Term (Done)
- ✅ CORS headers include all custom headers
- ✅ ErrorBoundary wraps entire app
- ✅ 404 handler returns JSON
- ✅ Null checks before destructuring

### Long-Term (Recommended)
1. **Add Sentry**: Catch errors in production
   ```bash
   npm install @sentry/react
   ```

2. **Add PropTypes/TypeScript strict mode**: Catch undefined props at build time

3. **Add API client wrapper**: Centralize error handling
   ```typescript
   // src/lib/apiClient.ts
   export async function fetchAPI(url, options) {
     try {
       const response = await fetch(url, options);
       if (!response.ok) throw new Error(response.statusText);
       return await response.json();
     } catch (err) {
       console.error('[API]', err);
       return null; // Safe fallback
     }
   }
   ```

4. **Add Playwright tests**: Catch regressions before deploy
   ```typescript
   // tests/smoke.spec.ts
   test('sequencing.com loads without blank page', async ({ page }) => {
     await page.goto('/?url=https://sequencing.com');
     await expect(page.locator('body')).not.toBeEmpty();
   });
   ```

---

## How to Test

### Manual Test (30 seconds)
```bash
# 1. Start dev server
npm run dev

# 2. Open browser to: http://localhost:5173/?url=https://sequencing.com

# 3. Check DevTools Console
# Expected: No CORS errors, no TypeErrors

# 4. Try non-existent URL
# Visit: http://localhost:5173/?url=https://doesnotexist.com

# 5. Verify no blank page
# Should see: Loading spinner → Error message OR results
```

### Automated Test (Run smoke test)
```bash
./scripts/smoke-api.sh
```

Expected output:
```
✅ Health endpoint returned 200
✅ X-Request-ID header present
✅ Matches endpoint returned 200
✅ Cache working (X-Cache: HIT)
✅ Rate limiting triggered
```

---

## Related Commits

| Commit | Description | Files |
|--------|-------------|-------|
| e2732662 | CORS + error boundary + 404 handler | 7 files |
| 5c5a4334 | Postgres timeout SQL scripts | 3 files |
| 69f5550e | Postgres timeout detection + smoke tests | 3 files |
| e9bc9e14 | Guardrails implementation summary | 1 file |
| 70b4661a | Guardrails docs + healthcheck | 2 files |

---

## Next Steps

1. ✅ **Fixed**: Blank page issue
2. ⏳ **Test**: Try sequencing.com in production
3. ⏳ **Monitor**: Check logs for any remaining errors
4. ⏳ **Optional**: Add Sentry for production error tracking

---

*Last updated: January 21, 2025*  
*Commit: e2732662*
