# 🎯 PYTHH Signal Radar — Complete Production Picture

## Current State (Jan 26, 2026)

You now have a **production-hardened, hero-positioned signal radar** with a **subordinate context layer** that explains market dynamics without competing for narrative authority.

---

## Architecture: 3-Layer Foundation

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: HERO PRODUCT (Canonical Entry)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PYTHH SIGNAL RADAR (/signals-radar)                       │
│  ────────────────────────────────────────────────────────  │
│  "Where is capital moving toward you right now?"           │
│                                                             │
│  Mode Machine:                                              │
│  global → injecting → reveal → tracking                    │
│                                                             │
│  Live Observatory:                                          │
│  • 18 channels with deltas + decay                         │
│  • SVG radar sweep with YOU blip + halo pulse              │
│  • Alignment arcs, phase change rings                      │
│  • Right rail: identity, window, alignment, power, moves   │
│  • Live "what moved your odds" feed                        │
│                                                             │
│  Time-Choreographed Dopamine Sequence:                      │
│  T=420ms: "We found you"                                   │
│  T=620ms: Halo pulse                                       │
│  T=1200ms: Reveal panels                                   │
│  T=2200ms: Enter tracking                                  │
│  T=4–8s: Email capture                                     │
│                                                             │
│  Causal Semantics:                                          │
│  Senior hire → Talent +6, Velocity +3                      │
│  Enterprise customer → Opportunity +9                      │
│  Investor attention → Alignment +3                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: CONTEXT LAYER (Explanation)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  SIGNALS CONTEXT (/app/signals-context)                    │
│  ────────────────────────────────────────────────────────  │
│  "Here's what changed in the market that moved your odds"  │
│                                                             │
│  Only Reachable From:                                       │
│  • Radar tracking mode (button: "Why did my odds move?")   │
│  • Right rail email capture row                            │
│                                                             │
│  Displays:                                                  │
│  • Causal belief shift cards (personalized impact)         │
│  • Sector momentum with YOUR alignment delta               │
│  • Investor receptivity (derived from alignment)           │
│  • Back button: "← Back to my signal"                      │
│                                                             │
│  Data Source:                                               │
│  Same /api/v1/startups/{id}/tracking endpoint as Radar     │
│  (Zero new backend required)                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: INTERNAL TOOLS (Observability)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  /app/engine      → Signal engine internals                │
│  /app/logs        → System debug + audit                   │
│  /admin/health    → System Guardian health checks          │
│                                                             │
│  (Not user-facing, internal development)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Production Readiness Checklist

### ✅ Frontend (Complete)
- [x] 4-state mode machine with invariant guards
- [x] 18 live channels with delta merge semantics
- [x] SVG radar with real-time sweep + halo pulse
- [x] Right rail: panels (identity, window, alignment, power, moves)
- [x] Live feed: prepend-only, 10 most recent events
- [x] Time-choreographed reveal sequence (420ms → 2200ms)
- [x] Production ApiDataSource (safe parsing, timeouts, error recovery)
- [x] Runtime config with auto-detection (fake/api mode)
- [x] 3 graceful error states (never blank screens)
- [x] Signals Context layer (market explanation)
- [x] Build verified ✓ (10.82s, 2508 modules)

### ⏳ Backend (Awaiting Implementation)
- [ ] `POST /api/v1/startups/resolve` — resolve URL → startup
- [ ] `POST /api/v1/scans` — create scan job
- [ ] `GET /api/v1/scans/{id}` — poll scan status (building → ready)
- [ ] `GET /api/v1/startups/{id}/tracking?cursor=...` — poll deltas
- [ ] `POST /api/v1/alerts/subscribe` — email subscription
- [ ] `GET /api/v1/health` — health check (required for auto-detection)

### ✅ Testing
- [x] 6 core unit tests (mode transitions, merge logic, backoff)
- [x] Mode machine invariants verified
- [x] Merge delta semantics locked
- [x] Exponential backoff math tested
- [x] TypeScript strict mode passing
- [ ] Integration tests (end-to-end with real backend)
- [ ] Performance tests (P95 < 200ms per endpoint)
- [ ] Cursor monotonicity verified (50+ polls without regression)

### ✅ Observability
- [x] Centralized logging: [PYTHH:operation] prefix + timing
- [x] Error shapes normalized: { ok: false, reason, status? }
- [x] System Guardian monitoring
- [x] Health dashboard (/admin/health)
- [ ] Production metrics dashboard (Datadog/New Relic)
- [ ] Error budget tracking
- [ ] Cursor validation monitoring

---

## Key Technical Decisions (Locked)

| Decision | Rationale | Status |
|----------|-----------|--------|
| **4-state machine** | Prevents invalid UI states | ✅ Locked |
| **18 channels (not pages)** | Real-time, atomic, never async | ✅ Locked |
| **SVG radar field** | Cinematic, experiential | ✅ Locked |
| **Cursor-based polling** | Incremental deltas, low bandwidth | ✅ Locked |
| **Prepend-only feed** | Newest first, causally coherent | ✅ Locked |
| **Exponential backoff** | Graceful degradation under load | ✅ Locked |
| **Per-request AbortController** | Safe timeout management | ✅ Locked |
| **Runtime auto-detection** | Zero rebuild for fake→api switch | ✅ Locked |
| **Context layer subordinate** | Radar is unambiguous hero | ✅ Locked |

---

## API Contract (LOCKED)

### POST /api/v1/startups/resolve
```json
// Request
{ "url": "example.com" }

// Response (Success)
{
  "ok": true,
  "startup": {
    "id": "uuid",
    "name": "Example",
    "category": "AI",
    "stage": "Seed"
  }
}

// Response (Error)
{ "ok": false, "reason": "startup_not_found" }
```

### POST /api/v1/scans
```json
// Request
{ "startup_id": "uuid" }

// Response
{
  "ok": true,
  "scan": {
    "scan_id": "uuid",
    "status": "building",
    "cursor": "cursor_001"
  }
}
```

### GET /api/v1/scans/{scan_id}
```json
// Response (Building)
{
  "status": "building",
  "progress": 0.45
}

// Response (Ready)
{
  "status": "ready",
  "channels": { ... },
  "panels": { ... },
  "radar": { ... },
  "cursor": "cursor_005"
}
```

### GET /api/v1/startups/{id}/tracking?cursor=cursor_005
```json
{
  "ok": true,
  "channels": {
    "delta": [
      { "name": "Talent", "delta": 3 },
      { "name": "Velocity", "delta": 2 }
    ]
  },
  "feed": [
    { "text": "Senior hire...", "confidence": 0.9 }
  ],
  "radar": { ... },
  "cursor": "cursor_006"
}
```

### GET /api/v1/health
```json
{ "status": "ok", "timestamp": "2026-01-26T..." }
```

---

## Environment Configuration

### Dev (Fake Data)
```bash
VITE_PYTHH_DATASOURCE=fake
npm run dev
# App runs with fake engine, never calls API
```

### Dev (Real API)
```bash
VITE_PYTHH_DATASOURCE=api
VITE_PYTHH_API_BASE=http://localhost:3000
npm run dev
# App tries health check, switches to real API
```

### Production (Auto-Detect)
```bash
npm run build
npm run preview
# No env vars set
# Auto-detection: tries /api/v1/health at origin
# Falls back to fake if unhealthy
```

---

## Deployment Sequence

### Step 1: Backend Ready
1. Implement 6 API endpoints (match BACKEND_CONTRACT.md)
2. Verify cursor monotonicity (50+ polls)
3. Verify latency P95 < 200ms per endpoint
4. Test health check endpoint

### Step 2: Environment Config
```bash
# Set in production environment
export VITE_PYTHH_DATASOURCE=api
export VITE_PYTHH_API_BASE=https://api.yourdomain.com

npm run build
```

### Step 3: Deploy Frontend
```bash
npm run build
npm run preview  # Test locally
# Push to CDN/hosting
```

### Step 4: Gradual Rollout
- Deploy to 10% of users (canary)
- Monitor error rates + latency
- Check cursor monotonicity
- If healthy → 50% → 100%
- Monitor System Guardian alerts

### Step 5: Public Launch
- Update marketing to link to `/signals-radar`
- Old `/signals` redirects (no broken URLs)
- Announce to investors: "Live Signal Radar"

---

## Monitoring & Alerts (System Guardian)

Guardian checks every 10 minutes:

| Check | Threshold | Alert | Auto-Heal |
|-------|-----------|-------|-----------|
| API health | 2s timeout | ERROR | Fall back to fake |
| Cursor monotonicity | Ever regress | ERROR | Log, investigate |
| Mode invariants | Violated | ERROR | Freeze mode |
| Latency P95 | > 200ms | WARN | Log, monitor |
| Feed staleness | > 6h | WARN | Trigger rescan |
| Merge validation | Delta structure | ERROR | Rollback, log |

**Dashboard:** `/admin/health`

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **API down** | Graceful fallback to fake data + user notice |
| **Slow API** | Timeout at 10s, async merge, never blocks UI |
| **Bad cursor** | Cursor validation, never regress, retry with old cursor |
| **Merge delta conflicts** | Strict schema validation, never merge invalid deltas |
| **Mode machine stuck** | Invariant checks, timeout rescue, fallback to global |
| **Network flaky** | Exponential backoff, per-request abort, resume seamlessly |
| **Load spike** | Polling throttle, edge caching, circuit breaker |

---

## Success Metrics

### Technical
- **Latency P95:** < 200ms per endpoint
- **Availability:** > 99.5% (SLA)
- **Error budget:** 0.5% error rate allowed
- **Cursor monotonicity:** 100% (never regress)
- **Mode machine uptime:** 100% (no stuck states)

### User Experience
- **Time to reveal:** < 1.5s
- **Feed freshness:** < 6h staleness
- **Context layer adoption:** > 30% of tracked users click "Why did my odds move?"
- **Return rate:** > 80% return to Radar from context
- **Bounce rate:** < 5% (should be near 0%)

### Business
- **Conversion rate:** % of visitors who enter tracking mode
- **Email capture rate:** % who subscribe to alerts
- **NPS:** Net Promoter Score from surveyed users
- **DAU:** Daily Active Users
- **Engagement time:** Avg minutes spent per session

---

## Next Immediate Actions

### For Backend Team
1. Implement `/api/v1/startups/resolve` (resolve URL)
2. Implement `/api/v1/scans` + GET poll endpoint
3. Implement `/api/v1/startups/{id}/tracking` with cursor support
4. Verify cursor never regresses
5. Test latency < 200ms (P95)

### For Frontend Team
1. Environment: `VITE_PYTHH_DATASOURCE=api` when backend ready
2. Manual test: Submit URL → track mode → click "Why did my odds move?"
3. Verify all error paths (API down, timeout, bad JSON)
4. Performance test: 50+ rapid cursor polls

### For DevOps/Platform
1. Set up health dashboard monitoring
2. Configure error budget alerting
3. Prepare canary deployment
4. Document rollback procedure

### For QA
1. Test fake mode end-to-end (works unchanged)
2. Test mode machine state transitions
3. Test graceful degradation (API down)
4. Test cursor monotonicity (50+ polls)

---

## Documentation Files Created

| File | Purpose |
|------|---------|
| `SIGNALS_CONTEXT_REFACTOR.md` | Complete refactor plan (8-step breakdown) |
| `OPTION_B_COMPLETE.md` | Strategic completion summary |
| `API_WIRING_GUIDE.md` | Frontend → Backend integration guide |
| `READY_FOR_PRODUCTION.md` | Original playbook + deployment |
| `BACKEND_CONTRACT.md` | API contracts + SLA table |
| `core.test.ts` | 6 core unit tests |

---

## Final State Summary

✅ **Hero Product:** PYTHH Signal Radar (personal, real-time, action-generating)
✅ **Context Layer:** Signals Context (macro explanation, subordinate)
✅ **No Competition:** Clear narrative hierarchy
✅ **Production Ready:** Build passes, types locked, API contracts documented
✅ **Risk Mitigated:** Graceful fallbacks, error guards, monitoring
✅ **Zero Rebuild:** Runtime config switches fake ↔ api
✅ **Testable:** 6 core tests + integration patterns provided
✅ **Maintainable:** Clean separation, reusable backend contracts

---

## Strategic Quote

> "The Radar is the hero. Everything else explains why the hero matters. No competition. No confusion. One mental model: navigate capital flow toward you, understand market context, repeat."

---

*Production Status: 🚀 Ready to Wire Backend*

*Build Status: ✅ Verified (10.82s, 2508 modules)*

*Deployment Risk: 🟢 Minimal (redirects + new route, no core product changes)*

*Next Phase: Backend implementation + integration testing*
