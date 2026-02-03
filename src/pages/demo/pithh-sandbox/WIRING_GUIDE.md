/**
 * PYTHH SIGNAL RADAR — REAL API WIRING GUIDE
 * ===========================================
 *
 * Current State (Fake Engine):
 * - All data is generated in fakeEngine.ts
 * - Mode machine choreography in SignalRadarPage.tsx
 * - Every heartbeat (~1.8s) calls tick() which generates new events
 * - Frontend available at: http://localhost:5173/signals-radar
 *
 * Next Phase: Replace fake data with real API calls
 *
 * ============================================================================
 * STEP 1: Implement Backend Endpoints
 * ============================================================================
 *
 * POST /api/v1/startups/resolve
 * - Input: URL (hostname extracted, domain normalized)
 * - Output: { ok: bool, startup?: StartupIdentity }
 * - Replaces: fakeResolveStartup() in fakeEngine.ts
 * - Called: Line 98 in SignalRadarPage.tsx (beginInjection)
 *
 * POST /api/v1/scans
 * - Input: { startup_id: UUID }
 * - Output: { ok: bool, scan: { scan_id: UUID, status: "building" | "ready" } }
 * - Replaces: Direct mode transition in fake engine
 * - Called: Line 105 in SignalRadarPage.tsx
 *
 * GET /api/v1/scans/{scan_id}
 * - Input: scan_id (URL param)
 * - Output: { status: "building" | "ready", channels, panels, nextMoves, etc. }
 * - Replaces: tick() event generation
 * - Called: Polling loop in beginInjection (line 125)
 *
 * GET /api/v1/startups/{startup_id}/observatory
 * - Input: startup_id (URL param)
 * - Output: { channels, radar: { events }, feed }
 * - Replaces: Global observatory from makeInitialVM()
 * - Called: Initial load and global mode heartbeat
 *
 * GET /api/v1/startups/{startup_id}/tracking
 * - Input: startup_id, cursor (for incremental updates)
 * - Output: { channels, panels, feed, radar events, arcs, phase_change }
 * - Replaces: tick() in tracking mode
 * - Called: Continuous polling loop in enterTrackingMode
 *
 * POST /api/v1/alerts/subscribe
 * - Input: { startup_id, email }
 * - Output: { ok: bool, subscription_id: UUID }
 * - Replaces: Mock subscription in RightRail.tsx
 * - Called: Email capture button in RightRail (line 142)
 *
 * ============================================================================
 * STEP 2: Remove Fake Engine Calls, Insert Real API Calls
 * ============================================================================
 *
 * Location 1: SignalRadarPage.tsx::beginInjection()
 *
 *   // BEFORE (fake)
 *   const startup = fakeResolveStartup(normalizedUrl);
 *
 *   // AFTER (real)
 *   const resolveRes = await fetch('/api/v1/startups/resolve', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ url: normalizedUrl }),
 *   });
 *   const { startup } = await resolveRes.json();
 *
 * Location 2: SignalRadarPage.tsx::beginInjection() (polling)
 *
 *   // BEFORE (fake)
 *   const scanRes = fakeCreateScan();
 *   const scanId = scanRes.scan.scan_id;
 *
 *   // AFTER (real)
 *   const scanRes = await fetch('/api/v1/scans', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ startup_id: startup.id }),
 *   });
 *   const { scan } = await scanRes.json();
 *   const scanId = scan.scan_id;
 *
 * Location 3: SignalRadarPage.tsx::heartbeat interval
 *
 *   // BEFORE (fake)
 *   setVm((prev) => tick({ ...prev }));
 *
 *   // AFTER (real - depends on mode)
 *   if (vm.mode === 'global' && vm.startup) {
 *     // Fetch live observatory deltas
 *     const obsRes = await fetch(`/api/v1/startups/${vm.startup.id}/observatory?cursor=${cursor}`);
 *     const deltas = await obsRes.json();
 *     // Merge into vm.channels, vm.feed, vm.radar
 *   } else if (vm.mode === 'tracking') {
 *     // Fetch live tracking deltas
 *     const trackRes = await fetch(`/api/v1/startups/${vm.startup.id}/tracking?cursor=${cursor}`);
 *     const deltas = await trackRes.json();
 *     // Merge into vm.panels, vm.channels, vm.feed, vm.radar
 *   }
 *
 * ============================================================================
 * STEP 3: Implement Cursor-Based Incremental Updates
 * ============================================================================
 *
 * Backend should support:
 * - cursor (opaque string, e.g., ISO timestamp or sequence ID)
 * - Returns only events/changes since cursor
 * - This reduces payload + network overhead
 *
 * Frontend tracking (in PageState):
 * - global_cursor: For observatory polling
 * - tracking_cursor: For tracking polling (set in GetScanResponse)
 *
 * Update logic:
 *   const { feed, channels, radar } = trackingDelta;
 *   setVm(prev => ({
 *     ...prev,
 *     feed: [feedDelta, ...prev.feed].slice(0, 50),
 *     channels: mergeChannelDeltas(prev.channels, channels),
 *     radar: mergeRadarDeltas(prev.radar, radar),
 *   }));
 *   setPageState(prev => ({
 *     ...prev,
 *     tracking_cursor: trackingDelta.cursor,
 *   }));
 *
 * ============================================================================
 * STEP 4: Wiring Checklist
 * ============================================================================
 *
 * [ ] Create resolveStartup endpoint
 * [ ] Create createScan endpoint
 * [ ] Create getScan polling endpoint
 * [ ] Create observatory polling endpoint
 * [ ] Create tracking polling endpoint
 * [ ] Create alertSubscribe endpoint
 * [ ] Update SignalRadarPage.tsx to call real APIs
 * [ ] Test mode machine choreography with real data
 * [ ] Verify cursor-based incremental updates work
 * [ ] Add error handling (retry logic, timeouts)
 * [ ] Test email capture flow end-to-end
 * [ ] Measure latency, optimize query performance
 * [ ] Deploy and monitor /signals-radar in production
 *
 * ============================================================================
 * OPTIONAL: SSE Upgrade (Phase B)
 * ============================================================================
 *
 * Current polling strategy works well for low-latency MVP.
 * If real-time push needed later:
 *
 * - Convert tracking polling → SSE /api/v1/startups/{id}/tracking-stream
 * - EventSource API: new EventSource(url)
 * - Handler: event.addEventListener('delta', (e) => mergeDeltas(JSON.parse(e.data)))
 * - Advantage: Server pushes deltas instantly, no polling overhead
 * - Disadvantage: WebSocket complexity, connection mgmt
 *
 * Code change is minimal (replace polling interval with EventSource listener).
 *
 */
