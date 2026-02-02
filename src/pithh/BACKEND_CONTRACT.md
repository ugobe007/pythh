# Backend Contract: PYTHH Must-Haves

## 6 Non-Negotiables for Stable Frontend

The frontend will remain rock-solid if backend guarantees these contracts:

### 1. **Cursor Monotonicity** (CRITICAL)

**Requirement**: Cursor must never regress or duplicate.

```
✅ Cursor timestamps: YYYY-MM-DDTHH:MM:SS.SSSZ (ISO 8601)
✅ Cursor integers: 1000, 1001, 1002, ... (ever-increasing)
❌ Same cursor twice: BREAKS merge logic
❌ Cursor jumping back: BREAKS incremental updates
```

**Frontend impact**: If cursor duplicates, polling loop stays stuck. Tracking mode appears frozen.

**Test**: After 10 polls, `cursor[n] > cursor[n-1]` always.

---

### 2. **Scan Status Machine** (CRITICAL)

**Requirement**: Only these states, transitions are deterministic.

```json
{
  "POST /api/v1/scans → { scan_id, status }": {
    "valid_states": ["building", "ready", "failed"],
    "never_return": ["pending", "processing", "done", "success"],
    "transitions": {
      "building": ["ready", "failed"],
      "ready": [],
      "failed": []
    }
  }
}
```

**Frontend impact**: If you return "pending", UI mode machine breaks (invalid transition).

**Test**: Poll `/api/v1/scans/{id}` 100 times, status never regresses.

---

### 3. **Delta Shape** (CRITICAL)

**Requirement**: Tracking endpoint returns one of these:

```typescript
// Option A: Cursor-based incremental
{
  ok: true,
  cursor: "2025-01-26T12:34:56Z",
  delta: {
    channels: [{ id: "grit", value: 55, delta: 3, direction: "up" }],
    feed: [{ id: "...", text: "...", timestamp: "...", confidence: 0.9, impacts: [] }],
    radar: {
      events: [{ id: "...", type: "ingestion", magnitude: 0.8, timestamp: "...", channelImpacts: [] }],
      arcs: [{ id: "investor_cluster_1", strength: 0.7 }],
      phaseChange: { id: "...", magnitude: 0.9, timestamp: "..." }
    },
    panels: null,  // Don't send panels on incremental update
    nextMoves: null
  }
}

// Option B: Full snapshot (first poll or reset)
{
  ok: true,
  cursor: "2025-01-26T12:34:56Z",
  delta: { ... full snapshot ... }
}
```

**Frontend impact**: If delta has unexpected fields or wrong types, merge fails silently.

**Test**: Validate delta schema matches types.ts on every response.

---

### 4. **Feed/Event Ordering** (IMPORTANT)

**Requirement**: New items first (descending timestamp).

```json
{
  "feed": [
    { "timestamp": "2025-01-26T12:34:56Z", "text": "Newest" },
    { "timestamp": "2025-01-26T12:34:50Z", "text": "Older" },
    { "timestamp": "2025-01-26T12:34:40Z", "text": "Oldest" }
  ]
}
```

**Frontend impact**: If newest comes last, feed appears backwards in UI.

**Test**: After every delta, `feed[i].timestamp >= feed[i+1].timestamp` always.

---

### 5. **No Breaking Concurrency** (IMPORTANT)

**Requirement**: Return immediately if backend is slow (don't wait for expensive computation).

- `/api/v1/startups/resolve`: **< 500ms** (or return cached if unavailable)
- `/api/v1/scans`: **< 200ms** (return "building" immediately, compute in background)
- `/api/v1/scans/{id}`: **< 100ms** (poll-friendly)
- `/api/v1/startups/{id}/tracking`: **< 100ms** (poll every 2s, must not block)

**Frontend impact**: If tracking endpoint takes 5s, polling loop backs off (triggers tracking degraded state). User sees "paused" notice every 2s.

**Test**: Measure endpoint latencies in production. Alert if p95 > threshold above.

---

### 6. **Server Time (Optional but Recommended)** 

```json
{
  "ok": true,
  "cursor": "...",
  "delta": { ... },
  "server_time": "2025-01-26T12:34:56.789Z"
}
```

**Why**: Helps frontend detect clock skew (user's laptop clock wrong), detect retries/duplicates.

**Frontend usage**: Log if `|server_time - client_time| > 5s`.

---

## Error Shape (all endpoints)

```json
{
  "ok": false,
  "reason": "startup_not_found | invalid_url | rate_limited | server_error | unknown"
}
```

**Frontend impact**: If error shape is unpredictable, error handling breaks.

---

## Latency SLA

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| `/api/v1/startups/resolve` | 100ms | 200ms | 500ms |
| `/api/v1/scans` | 50ms | 100ms | 200ms |
| `/api/v1/scans/{id}` | 30ms | 50ms | 100ms |
| `/api/v1/startups/{id}/tracking` | 40ms | 80ms | 150ms |
| `/api/v1/alerts/subscribe` | 100ms | 200ms | 500ms |

**Why**: Frontend assumes polling every 2s. If tracking takes 1s, you can only poll 2/sec. If it takes 5s, polling backs off → tracking degraded state visible.

---

## Health Check Endpoint (REQUIRED)

```
GET /api/v1/health
Response: 200 OK (empty body or { status: "ok" })
Purpose: Runtime detection (startup). Used by runtimeConfig.ts.
Timeout: 2s
```

---

## Summary Table

| Feature | Requirement | Impact | Test |
|---------|------------|--------|------|
| Cursor | Monotonic | Polling loop freezes if not | Poll 100x, validate order |
| Scan status | Deterministic FSM | UI mode breaks if invalid state | Poll until ready, check states |
| Delta shape | Fixed schema | Silent merge failures if wrong | Validate on every response |
| Feed order | Newest first | Feed appears backwards | Sort check on every delta |
| Latency | P95 < 200ms | Tracking mode pauses | Monitor endpoints in prod |
| Health check | < 2s response | Runtime fallback fails | Call at startup |

---

## Enforcement

Add these to your CI/CD:

```bash
# Schema validation
npm run test:backend-contract

# Load test
k6 run tests/pythh-endpoints.js

# Cursor monotonicity check
./scripts/validate-cursor-monotonicity.sh

# Latency SLA check
./scripts/validate-latency-sla.sh
```

---

## If You Can't Meet These Contracts...

**Scenario**: Your endpoint is sometimes slow (1-3s).

**Solution**: Return partial data immediately, compute rest in background.

```json
{
  "ok": true,
  "cursor": "2025-01-26T12:34:56Z",
  "delta": {
    "channels": [{ "id": "grit", "value": 55 }],
    "feed": null,  // Will send in next poll
    "radar": null  // Will send in next poll
  }
}
```

Frontend handles null deltas gracefully (just skips merge for that field).

---

*Last validated: Jan 26, 2026*
