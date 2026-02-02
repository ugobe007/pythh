# 🎯 NEXT STEPS: Backend Implementation Roadmap

## Current State (Jan 26, 2026)

✅ **Frontend: Complete**
- PYTHH Signal Radar hardened and production-ready
- Signals Context layer positioned and wired
- Build verified: 10.82s, 2508 modules, no errors
- Runtime config ready (fake/api auto-detection)

⏳ **Backend: Awaiting Implementation**
- 6 API endpoints need implementation
- Cursor model locked
- Delta schema locked
- Latency SLA: P95 < 200ms per endpoint

---

## 6 Endpoints to Implement

### Endpoint 1: POST /api/v1/startups/resolve
**Purpose:** Resolve a URL to startup identity
**Called by:** SignalRadarPage.tsx beginInjection()
**Request:**
```json
{
  "url": "example.com"
}
```
**Response (Success - 200):**
```json
{
  "ok": true,
  "startup": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Example Corp",
    "category": "AI",
    "stage": "Seed",
    "value_proposition": "AI-powered X"
  }
}
```
**Response (Not Found - 404):**
```json
{
  "ok": false,
  "reason": "startup_not_found"
}
```

### Endpoint 2: POST /api/v1/scans
**Purpose:** Create a scan job for a startup
**Called by:** SignalRadarPage.tsx beginInjection() → polling loop
**Request:**
```json
{
  "startup_id": "550e8400-e29b-41d4-a716-446655440000"
}
```
**Response (200):**
```json
{
  "ok": true,
  "scan": {
    "scan_id": "550e8400-e29b-41d4-a716-446655440001",
    "status": "building",
    "cursor": "scan_001"
  }
}
```

### Endpoint 3: GET /api/v1/scans/{scan_id}
**Purpose:** Poll scan status (building → ready transition)
**Called by:** SignalRadarPage.tsx polling interval (tracking mode)
**Response (Still Building - 200):**
```json
{
  "ok": true,
  "status": "building",
  "progress": 0.65,
  "estimated_seconds_remaining": 5
}
```
**Response (Ready - 200):**
```json
{
  "ok": true,
  "status": "ready",
  "channels": {
    "Talent": {
      "current_value": 45,
      "direction": "accelerating",
      "recent_deltas": [
        { "value_change": 3, "narrative": "Senior hire" }
      ]
    },
    "Velocity": {
      "current_value": 38,
      "direction": "stable",
      "recent_deltas": []
    }
    // ... 16 more channels
  },
  "panels": {
    "power": {
      "score": 62,
      "changed": true,
      "delta": 5
    },
    "fundraisingWindow": {
      "state": "opening",
      "startDays": 7,
      "endDays": 45
    },
    "alignment": {
      "count": 12,
      "delta": 2
    },
    "nextMoves": [
      { "title": "Land 1 enterprise customer", "impact": 9 },
      { "title": "Hire VP Sales", "impact": 6 }
    ]
  },
  "radar": {
    "events": [
      { "x": 45, "y": 67, "intensity": 0.8, "label": "Enterprise Inquiry" }
    ]
  },
  "cursor": "scan_002"
}
```

### Endpoint 4: GET /api/v1/startups/{startup_id}/tracking?cursor={cursor}
**Purpose:** Poll incremental updates (deltas only) since cursor
**Called by:** SignalRadarPage.tsx tracking mode heartbeat
**Query Params:**
- `startup_id`: UUID (path)
- `cursor`: opaque string (query) — return only changes since this cursor
**Response (200):**
```json
{
  "ok": true,
  "channels": {
    "delta": [
      { "name": "Talent", "value_change": 2, "direction": "accelerating" },
      { "name": "Velocity", "value_change": -1, "direction": "stable" }
    ]
  },
  "feed": [
    {
      "id": "event_001",
      "text": "Senior Engineering Hire announced",
      "confidence": 0.92,
      "timestamp": "2026-01-26T14:23:00Z",
      "source": "twitter"
    }
  ],
  "radar": {
    "new_events": [
      { "x": 45, "y": 67, "intensity": 0.85, "label": "Senior Hire" }
    ]
  },
  "cursor": "scan_003"
}
```

### Endpoint 5: POST /api/v1/alerts/subscribe
**Purpose:** Email subscription for startup signals
**Called by:** RightRail email capture (tracking mode)
**Request:**
```json
{
  "startup_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "founder@example.com"
}
```
**Response (200):**
```json
{
  "ok": true,
  "subscription_id": "sub_001",
  "message": "Subscribed! You'll receive daily signal updates."
}
```

### Endpoint 6: GET /api/v1/health
**Purpose:** Health check for runtime auto-detection
**Called by:** getRuntimeConfig() in runtimeConfig.ts
**Timeout:** 2 seconds
**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T14:23:00Z"
}
```

---

## Critical Constraints (MUST BE EXACT)

### Constraint 1: Cursor Monotonicity
**MUST:** Cursor never regresses or duplicates
**Test:** Poll `/api/v1/startups/{id}/tracking?cursor=...` 50+ times
**Verify:** Each response has a new, higher cursor value
**Why:** If cursor ever goes backwards, merge will create duplicates

### Constraint 2: Status FSM
**MUST:** Status only transitions: building → ready (never backward)
**Test:** Poll `/api/v1/scans/{id}` until status = "ready"
**Verify:** Status never goes from "ready" back to "building"
**Why:** Frontend mode machine depends on this guarantee

### Constraint 3: Delta Schema
**MUST:** All responses match types.ts exactly
**Response must have:**
- `ok: boolean` (always present)
- `reason?: string` (if `ok === false`)
- `status?: number` (HTTP status, optional)
- Specific channel/panel/radar shapes (locked)
**Why:** Frontend merge validation will reject mismatched deltas

### Constraint 4: Feed Ordering
**MUST:** Feed items always newest-first
**Test:** Verify `feed[0].timestamp > feed[1].timestamp > ...`
**Why:** Frontend assumes prepend-only (new events go first)

### Constraint 5: Latency SLA
**MUST:** P95 latency < 200ms per endpoint
**Test:** Measure response time over 100 requests
**Verify:** 95th percentile < 200ms (not average, percentile)
**Why:** UI choreography depends on sub-200ms responses

### Constraint 6: Error Shapes
**MUST:** All errors return normalized shape
```json
{
  "ok": false,
  "reason": "descriptive_reason_code",
  "status": 404
}
```
**Valid reason codes:**
- `"startup_not_found"` (404)
- `"scan_not_found"` (404)
- `"scan_building"` (202 Accepted, not an error)
- `"invalid_cursor"` (400)
- `"permission_denied"` (403)
- `"server_error"` (500)

---

## Testing Checklist

### Before Deploying to Production

- [ ] **Resolve endpoint**
  - [ ] Resolves real startup URL
  - [ ] Returns 404 for unknown URL
  - [ ] Response time < 100ms (P95)

- [ ] **Scan creation**
  - [ ] Creates scan for valid startup_id
  - [ ] Returns scan_id + "building" status
  - [ ] Subsequent polls show progress

- [ ] **Scan polling**
  - [ ] Polls transition: building → ready
  - [ ] Never regress from ready → building
  - [ ] Returns valid channels, panels, radar shape
  - [ ] Response time < 200ms (P95)

- [ ] **Tracking polling**
  - [ ] Cursor never regresses (50+ polls)
  - [ ] Each poll returns new cursor value
  - [ ] Feed always newest-first
  - [ ] Channels delta matches expected shape
  - [ ] Response time < 100ms (P95)

- [ ] **Cursor semantics**
  - [ ] First poll with cursor=null returns all data
  - [ ] Second poll with cursor=A returns only deltas since A
  - [ ] Third poll with cursor=B returns only deltas since B
  - [ ] Never duplicate events across polls

- [ ] **Error handling**
  - [ ] Invalid startup_id → { ok: false, reason: "startup_not_found" }
  - [ ] Invalid scan_id → { ok: false, reason: "scan_not_found" }
  - [ ] Invalid cursor → { ok: false, reason: "invalid_cursor" }
  - [ ] Network timeout → client-side AbortController fires (10s limit)

- [ ] **Health check**
  - [ ] Returns 200 within 2 seconds
  - [ ] Frontend auto-detects: healthy → use API, unhealthy → use fake

---

## Implementation Order (Recommended)

### Phase 1: Core (2-3 days)
1. Implement `/api/v1/health` (simplest, required for auto-detection)
2. Implement `/api/v1/startups/resolve` (resolve URL → startup)
3. Implement `/api/v1/scans` (create scan job)

### Phase 2: Polling (3-4 days)
4. Implement `/api/v1/scans/{id}` (poll scan status)
5. Implement `/api/v1/startups/{id}/tracking?cursor=...` (poll deltas)
   - This is the most complex (cursor model, delta merging)

### Phase 3: Features (1-2 days)
6. Implement `/api/v1/alerts/subscribe` (email capture)

### Phase 4: Verification (1 day)
7. Run all tests from checklist above
8. Verify cursor monotonicity (50+ polls)
9. Verify latency SLA (P95 < 200ms)
10. Load test (concurrent requests, spike handling)

**Total Timeline:** 7-10 days

---

## Data Requirements

### Startup Data
For each startup, you need:
- `id` (UUID)
- `name` (string)
- `category` (string: "AI", "Biotech", "Climate", etc.)
- `stage` (string: "Seed", "Series A", "Series B")
- `value_proposition` (string)

### Channel Data (18 channels)
For each startup, you need realtime/updatable:
- `Talent`, `Velocity`, `Opportunity`
- `Scalability`, `Market Fit`, `Product Quality`
- `Traction`, `Financials`, `Team Strength`
- `Technology`, `Runway`, `Unit Economics`
- `Growth Rate`, `Retention`, `NPS`
- `Contract Value`, `Enterprise Adoption`, `Competitive Position`

Each channel needs:
- `current_value` (0-100)
- `direction` ("accelerating" | "stable" | "decelerating")
- `recent_deltas` (array of { value_change, narrative })

### Panel Data
- `power.score` (0-100)
- `fundraisingWindow.state` ("opening" | "peak" | "closing")
- `alignment.count` (number of aligned investors)
- `nextMoves` (array of { title, impact })

### Event Data (for feed)
- `text` (narrative)
- `confidence` (0-1)
- `timestamp` (ISO string)
- `source` ("twitter", "crunchbase", "our_enrichment", etc.)

---

## Runtime Mode Switch

When backend is ready:

```bash
# Stop using fake data
VITE_PYTHH_DATASOURCE=api

# Point to your backend
VITE_PYTHH_API_BASE=https://api.yourdomain.com

# Rebuild and deploy
npm run build
npm run preview
```

Frontend will:
1. Call `GET /api/v1/health` at startup
2. If healthy → use real API for all subsequent calls
3. If unhealthy → fall back to fake data (user sees notice)
4. All calls go through ApiDataSource (safe parsing, timeouts, error recovery)

---

## Deployment Sequence

### Step 1: Develop Locally
```bash
# Backend running on localhost:3000
VITE_PYTHH_DATASOURCE=api \
VITE_PYTHH_API_BASE=http://localhost:3000 \
npm run dev
```

### Step 2: Test End-to-End
1. Load `http://localhost:5173/signals-radar`
2. Submit a startup URL
3. Verify injecting → reveal → tracking transitions
4. Click "Why did my odds move?"
5. Verify context layer loads with real data
6. Return to Radar
7. All data should match

### Step 3: Staging Deployment
- Deploy backend to staging
- Deploy frontend to staging
- Run all tests from checklist
- Monitor System Guardian alerts

### Step 4: Production Rollout
```bash
# Canary: 10% of users
VITE_PYTHH_DATASOURCE=api npm run build

# Monitor for 1 hour:
# - Error rates (should be < 0.5%)
# - Latency (should be < 200ms P95)
# - Cursor monotonicity (should be 100%)

# If healthy → 50% → 100%
```

---

## Success Criteria

When backend is live and properly wired:

✅ User submits URL → `POST /api/v1/startups/resolve` called
✅ Frontend shows "We found you: [Name]" (T=420ms)
✅ Halo pulse animates (T=620ms)
✅ Panels reveal (T=1200ms)
✅ Tracking mode begins (T=2200ms)
✅ Feed shows real events (from `/tracking` deltas)
✅ Channels update in real-time (from `/tracking` deltas)
✅ Clicking "Why did my odds move?" navigates to context layer
✅ Context layer shows causal belief shifts (derived from deltas)
✅ Clicking "← Back to my signal" returns to Radar
✅ All operations < 200ms (P95)
✅ Cursor never regresses (50+ polls verified)
✅ Zero broken pages, zero console errors

---

## Questions to Answer Before Deploying

1. **Data source:** Where is startup/channel/event data coming from?
2. **Realtime:** How are channel updates generated? (ML scoring, manual, webhooks?)
3. **Event source:** Where do feed events come from? (news APIs, webhooks, manual?)
4. **Cursor storage:** How are cursors persisted? (Redis, PostgreSQL, in-memory?)
5. **Scale:** How many concurrent users can backend support? (load test: 1000+ concurrent?)
6. **SLA:** What's your uptime guarantee? (99.5%? 99.9%?)
7. **Monitoring:** What alerts are configured? (latency, cursor regression, error rate?)
8. **Rollback:** If API breaks, can frontend fall back to fake seamlessly? (Yes, built-in)

---

## Contact Points

When you get stuck or need clarification:

1. **API contracts:** See [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md)
2. **Type definitions:** See [src/pithh/types.ts](../src/pithh/types.ts)
3. **Frontend expectations:** See [API_WIRING_GUIDE.md](./API_WIRING_GUIDE.md)
4. **Error handling:** See [errorStates.ts](../src/pithh/errorStates.ts)
5. **Polling logic:** See [pollingOrchestra.ts](../src/pithh/pollingOrchestra.ts)
6. **Build status:** `npm run build` (should take ~11s)

---

## Final Thought

The frontend is ready. The architecture is locked. The contracts are documented.

Your job is to build the 6 endpoints, verify cursor monotonicity, hit the latency SLA, and deploy.

When it's live: One of the best fintech product experiences ever built.

🚀

---

*Timeline: 7-10 days to full production readiness*
*Risk: Minimal (frontend handles all errors gracefully)*
*Impact: Real data flowing through a battle-tested signal radar*
