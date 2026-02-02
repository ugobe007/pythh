## 🛡️ PYTHH Production Hardening Checklist

### ✅ COMPLETED: Foundation

- [x] **Locked API Contracts** in `types.ts`
  - All 6 endpoints have explicit `Request`/`Response` types
  - Single source of truth prevents drift between prose and code
  - Types: `ResolveStartupRequest/Response`, `CreateScanRequest/Response`, `GetScanResponse`, `TrackingUpdateResponse`, `AlertSubscribeRequest/Response`

- [x] **DataSource Abstraction** in `dataSource.ts`
  - Single interface that both `FakeDataSource` and `ApiDataSource` must implement
  - SwappableSignalRadarPage.tsx never knows which implementation is active
  - Factory functions: `createFakeDataSource()`, `createApiDataSource(url)`

- [x] **Mode Choreography Guards** in `modeGuards.ts`
  - Valid transitions: `global → injecting → reveal → tracking → global`
  - Invariants enforced: channels frozen during injecting, panels/events only in reveal+
  - Guards: `isValidModeTransition()`, `checkModeInvariants()`, `canUpdateChannels()`, etc.

- [x] **Delta Merge Strategy** in `mergeHelpers.ts`
  - Channels: keyed merge by ID (update changed fields only)
  - Feed: prepend-only (append semantics, no deletes)
  - Radar events: prepend-only (newest first)
  - Panels: atomic replace (full snapshot)
  - **pulseSeq never touched** (UI-only animation)

- [x] **Concurrency Safety** in `SignalRadarPage.tsx`
  - `AbortController` for in-flight requests (gate concurrent API calls)
  - `inFlightRef` boolean gate prevents simultaneous requests
  - Timer tracking with cleanup in `useEffect` return
  - `ConcurrencyContext` tracks mode + in-flight + pending timers

- [x] **Mode Transitions** in `SignalRadarPage.tsx`
  - `transitionMode()` validates transitions before committing
  - Checks invariants using `checkModeInvariants()` from guards
  - Logs with `logModeTransition()` for debugging
  - Updates `concurrencyCtxRef` atomically

- [x] **Observability** in all modules
  - Centralized logging: `[PYTHH:operation]` prefix in `SignalRadarPage.tsx`
  - Merge logging: `[MERGE]` prefix in `mergeHelpers.ts`
  - Mode logging: `[MODE]` prefix in `modeGuards.ts`
  - Each operation logs entry, decisions, and completion

---

### 🔧 IN-PROGRESS: Real API Wiring

**Current Status**: Fake data only. Ready for API wiring.

#### Step 1: Implement `ApiDataSource`

Create `/src/pithh/apiDataSource.ts`:

```typescript
import { DataSource, FetchChannelsRequest, FetchChannelsResponse } from "./dataSource";
import { UUID, CreateScanRequest, CreateScanResponse, GetScanResponse, TrackingUpdateResponse, AlertSubscribeRequest, AlertSubscribeResponse, ResolveStartupRequest, ResolveStartupResponse } from "./types";

export class ApiDataSource implements DataSource {
  constructor(private baseUrl: string) {}

  async resolveStartup(req: ResolveStartupRequest): Promise<ResolveStartupResponse> {
    const resp = await fetch(`${this.baseUrl}/api/v1/startups/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return resp.json();
  }

  async createScan(req: CreateScanRequest): Promise<CreateScanResponse> {
    const resp = await fetch(`${this.baseUrl}/api/v1/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return resp.json();
  }

  async pollScan(scan_id: UUID): Promise<GetScanResponse> {
    const resp = await fetch(`${this.baseUrl}/api/v1/scans/${scan_id}`);
    return resp.json();
  }

  async pollTracking(startup_id: UUID, cursor?: string): Promise<TrackingUpdateResponse> {
    const params = new URLSearchParams();
    if (cursor) params.append("cursor", cursor);
    const resp = await fetch(`${this.baseUrl}/api/v1/startups/${startup_id}/tracking?${params}`);
    return resp.json();
  }

  async subscribe(req: AlertSubscribeRequest): Promise<AlertSubscribeResponse> {
    const resp = await fetch(`${this.baseUrl}/api/v1/alerts/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return resp.json();
  }
}
```

#### Step 2: Wire in `SignalRadarPage.tsx`

```typescript
// Replace fake datasource with real one
const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3002";
dataSourceRef.current = new ApiDataSource(apiUrl);
```

#### Step 3: Add error handling

- Wrap API calls with try/catch
- Log errors to console + feed
- Graceful fallback (show "error" feed item, reset state)

#### Step 4: Add polling loop for tracking mode

```typescript
useEffect(() => {
  if (vm.mode !== "tracking" || !vm.startup) return;

  let pollInterval: number;
  
  const poll = async () => {
    try {
      const result = await dataSourceRef.current.pollTracking(vm.startup!.id, cursorRef.current);
      if (result.ok && result.delta) {
        // Update cursor for next poll
        cursorRef.current = result.cursor;
        
        // Merge delta into current state
        setVm(prev => mergeViewModelDelta(prev, result.delta));
      }
    } catch (err) {
      console.error("[TRACKING] Poll failed", err);
      // Retry next interval
    }
  };

  pollInterval = window.setInterval(poll, 2000); // Poll every 2s
  
  return () => window.clearInterval(pollInterval);
}, [vm.mode, vm.startup]);
```

---

### ⚡ Future: Enhancements

- [ ] **Offline Mode**: Cache last state, show "offline" badge, sync when reconnected
- [ ] **Error Recovery**: Exponential backoff on failed polls
- [ ] **Performance**: Memoize channel computations, virtualize feed
- [ ] **Testing**: Unit tests for mode guards, merge helpers, invariants
- [ ] **Monitoring**: Add error tracking (Sentry), telemetry

---

### 📝 Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Single DataSource interface** | Swappable implementations without UI changes |
| **Locked API contracts in types.ts** | Prevent drift between frontend/backend specs |
| **Mode guard invariants** | Prevent impossible states (e.g., panels in "global" mode) |
| **Delta merge strategy** | Preserve animations, avoid clobbering, maintain consistency |
| **Concurrency gates** | Prevent race conditions (concurrent API calls, timer collisions) |
| **Centralized logging** | Easy debugging, observable choreography |
| **pulseSeq as animation trigger** | Pure UI concern, never merged from API |

---

### 🎯 Next Steps

1. **Implement ApiDataSource** (if real backend ready)
2. **Wire polling loop** for tracking mode
3. **Add error handling** (try/catch, retry logic)
4. **Test mode transitions** (especially injecting → reveal → tracking)
5. **Performance audit** (channel update frequency, feed growth)
6. **Deploy to staging** for real user testing

