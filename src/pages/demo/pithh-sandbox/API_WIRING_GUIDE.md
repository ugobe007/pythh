# PYTHH ApiDataSource - Production Wiring Guide

## What Just Shipped ✅

**File**: `src/pithh/dataSources/apiDataSource.ts`

A complete, production-ready API datasource that:
- ✅ Implements all 5 endpoints (resolve, createScan, pollScan, pollTracking, subscribe)
- ✅ AbortController per request + 10s timeout
- ✅ Safe JSON parsing (never crashes on bad responses)
- ✅ Normalized error shapes: `{ ok: false, reason, status? }`
- ✅ Timing logs: `[PYTHH:api:operation] GET /path → OK in 123ms`
- ✅ HTTP error handling (4xx, 5xx, network errors, timeouts all recoverable)
- ✅ Zero merge logic (that stays in `mergeHelpers.ts`)

---

## How It Works

```typescript
// In SignalRadarPage.tsx
import { getRuntimeConfig } from "./runtimeConfig";
import { createApiDataSource } from "./dataSource";

useEffect(() => {
  getRuntimeConfig().then((cfg) => {
    if (cfg.mode === "api") {
      dataSourceRef.current = createApiDataSource(cfg.apiBase);
      // ^ Automatically wired, zero code changes needed
    }
  });
}, []);
```

No code changes required. The app auto-detects API availability at startup and swaps datasources.

---

## Error Handling (Built-In)

Every endpoint returns:

```typescript
// Success
{ ok: true, ... actual data ... }

// Network error
{ ok: false, reason: "network_error" }

// Timeout (10s)
{ ok: false, reason: "timeout" }

// Bad JSON from backend
{ ok: false, reason: "bad_json" }

// Backend error (e.g., startup not found)
{ ok: false, reason: "startup_not_found", status: 404 }
```

Your error handlers in `errorStates.ts` receive these and show graceful UI.

---

## Timing Logs (Observability)

Every request logs with millisecond precision:

```
[PYTHH:api:resolveStartup] POST /api/v1/startups/resolve
[PYTHH:api:resolveStartup] POST /api/v1/startups/resolve → OK in 142ms

[PYTHH:api:pollTracking] GET /api/v1/startups/{id}/tracking
[PYTHH:api:pollTracking] GET /api/v1/startups/{id}/tracking → OK in 23ms

[PYTHH:api:pollTracking] GET /api/v1/startups/{id}/tracking → HTTP 500 in 5ms
```

Copy/paste any log into your monitoring tool.

---

## Request Flow

```
SignalRadarPage.tsx calls dataSource.resolveStartup(req)
  ↓
ApiDataSource.resolveStartup() creates AbortController + 10s timeout
  ↓
fetch() to ${baseUrl}/api/v1/startups/resolve
  ↓
Response comes back (or timeout fires)
  ↓
Safe JSON parse (no crash on bad response)
  ↓
Check res.ok and parse.ok
  ↓
Return { ok: true, ... } or { ok: false, reason: "..." }
  ↓
SignalRadarPage error handler (errorStates.ts) shows feed notice
```

At no point can the system crash. All failures are normalized to `{ ok: false, reason }`.

---

## Configuration

In your `.env.local`:

```bash
VITE_PYTHH_DATASOURCE=api
VITE_PYTHH_API_BASE=http://localhost:3000
```

Backend must be running at that URL with these endpoints:

| Method | Endpoint | Response |
|--------|----------|----------|
| POST | `/api/v1/startups/resolve` | `ResolveStartupResponse` |
| POST | `/api/v1/scans` | `CreateScanResponse` |
| GET | `/api/v1/scans/{scan_id}` | `GetScanResponse` |
| GET | `/api/v1/startups/{id}/tracking?cursor=...` | `TrackingUpdateResponse` |
| POST | `/api/v1/alerts/subscribe` | `AlertSubscribeResponse` |
| GET | `/api/v1/health` | Any 2xx response |

All endpoints must return the correct TypeScript shapes (from `src/pithh/types.ts`).

---

## Testing the Wiring

### Local Test (Fake Data)

```bash
VITE_PYTHH_DATASOURCE=fake npm run dev
# App runs with fake data, never calls API
# [PYTHH:init] Datasource: fake (VITE_PYTHH_DATASOURCE=fake (explicit))
```

### Local Test (Real API)

```bash
VITE_PYTHH_DATASOURCE=api VITE_PYTHH_API_BASE=http://localhost:3000 npm run dev
# App tries API at startup health check
# [PYTHH:init] Datasource: api (Auto-detected: API responding...)
# Then every fetch logs [PYTHH:api:operation] timing
```

### Production Test (Auto-Detect)

```bash
npm run build
npm run preview
# No explicit VITE_PYTHH_DATASOURCE set
# Auto-detection: tries /api/v1/health at window.location.origin
# If healthy → uses real API
# If unhealthy → falls back to fake data + warning in feed
```

---

## Timeline Integration

Your choreography timings (420/620/1200/2200ms) remain **UI-driven** even when backend is slow:

1. User submits URL → `beginInjection()` starts clock
2. Timer fires at 420ms → shows "We found you: ..."
3. Timer fires at 620ms → halo pulse
4. Meanwhile, `createScan()` may still be pending (backend slow)
5. Timer fires at 1200ms → transition to "reveal" regardless
6. If backend finally ready, merge real panels
7. If backend still pending, show "computing..." placeholder

**Result**: UI always feels snappy. Backend latency only affects data freshness, never choreography.

---

## Monitoring Checklist

- [ ] Health endpoint: `GET /api/v1/health` returns 200 within 2s
- [ ] Resolve endpoint: `POST /api/v1/startups/resolve` returns 200 within 500ms
- [ ] Scan endpoint: `POST /api/v1/scans` returns 200 within 200ms
- [ ] Poll endpoints: `GET /api/v1/scans/{id}`, `/tracking` return 200 within 100ms
- [ ] Error responses: all errors include `reason` field (e.g., `"startup_not_found"`)
- [ ] Cursor: monotonically increasing on every `/tracking` poll
- [ ] Feed items: newest first in delta responses

---

## Fallback Behavior (If API Down)

```
User at http://localhost:5173/signals-radar
  ↓
getRuntimeConfig() tries health check at /api/v1/health
  ↓
Timeout or fails after 2s
  ↓
Falls back to FakeDataSource automatically
  ↓
Feed shows: "[GUARD] API unavailable, running on fake data..."
  ↓
User can still demo the product (all fake, but UI works)
```

**Result**: Demos never break. Presentations never crash.

---

## What's Next

1. **Implement backend** endpoints matching types from `BACKEND_CONTRACT.md`
2. **Test resolve endpoint**: `curl -X POST http://localhost:3000/api/v1/startups/resolve -d '{"url":"example.com"}'`
3. **Test polling**: hit scan endpoint 20 times, verify status progresses from building → ready
4. **Test cursor**: hit tracking endpoint 50 times, verify cursor never duplicates
5. **Flip VITE_PYTHH_DATASOURCE=api** and watch real data flow through

---

## For Your Team

Share these commands:

```bash
# Dev: fake data (for UI work)
VITE_PYTHH_DATASOURCE=fake npm run dev

# Dev: real API (when backend ready)
VITE_PYTHH_DATASOURCE=api VITE_PYTHH_API_BASE=http://localhost:3000 npm run dev

# Prod: auto-detect
npm run build && npm run preview
```

All three modes produce identical UI. Difference is data source only.

---

## Architecture

```
SignalRadarPage.tsx
    ↓ (at startup)
runtimeConfig.ts
    ├─ reads VITE_PYTHH_DATASOURCE env var
    ├─ tries /api/v1/health (2s timeout)
    └─ decides: fake or api
    ↓
dataSource.ts (interface)
    ├─ createFakeDataSource() → fakeEngine.ts
    └─ createApiDataSource() → dataSources/apiDataSource.ts ← YOU ARE HERE
         ├─ resolveStartup()
         ├─ createScan()
         ├─ pollScan()
         ├─ pollTracking()
         └─ subscribe()
    ↓ (response)
SignalRadarPage (never knows which source)
    ├─ errorStates.ts (handles errors gracefully)
    ├─ modeGuards.ts (validates transitions)
    └─ mergeHelpers.ts (merges deltas)
```

Zero coupling. Swap sources. Same UI.

---

*Status: 🚀 Production-ready, awaiting backend implementation*
