# 🔄 Matching Engine: V1 vs V2 Comparison

## The Problems V2 Solves

| Issue | V1 Behavior | V2 Solution |
|-------|-------------|-------------|
| **"Pulse of Doom"** | UI continuously pulsating due to re-render loops | Frontend is pure renderer - only re-renders on backend state change |
| **Duplicate Startups** | Same URL creates multiple startups (non-canonical URLs) | URL canonicalization → unique `domain_key` → one startup per URL |
| **Race Conditions** | Multiple `useEffect` loops competing, stale responses overwriting current state | Single poll loop, client-side sequence tracking (`clientRunSeq`) |
| **Stuck Processing** | "Loading..." forever with no way to know why | Progress steps (`resolve → extract → parse → match`) + debug endpoint |
| **Worker Crashes** | Processing state stuck forever if worker dies | Lease-based locking: lease expires → another worker takes over |
| **False "No Matches"** | Shows "no matches" during processing (UI guessing) | Only shows empty on backend-confirmed `ready+0` |
| **Idempotency Fails** | Clicking "Get Matches" repeatedly creates duplicate jobs | `get_or_create_match_run()` SQL function ensures one active run per startup |
| **No Observability** | Can't answer "why is it stuck?" | Debug endpoint shows: logs, steps, extractor counts, parser rejections, lease status |
| **State Drift** | Frontend state machine doesn't match backend reality | Backend `match_runs` table is single source of truth |

---

## Architecture Comparison

### V1: Frontend-Heavy State Machine

```
┌─────────────────────────────────┐
│  Frontend (React)               │
│  ├── useMatchState hook         │
│  ├── Multiple useEffect loops   │
│  ├── Local state management     │
│  ├── Guesses "empty" vs "loading"│
│  └── Auto-refresh timers        │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  Backend (Express)              │
│  ├── POST /api/match (complex)  │
│  ├── Inline processing          │
│  ├── No job queue               │
│  └── No orchestration           │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  Database (Supabase)            │
│  ├── startup_uploads            │
│  ├── startup_investor_matches   │
│  └── No orchestration table     │
└─────────────────────────────────┘
```

**Problems:**
- Frontend doesn't know true backend state
- No way to resume after crash
- Race conditions from concurrent requests
- No job queue → inline processing blocks API

---

### V2: Backend-Driven Orchestration

```
┌─────────────────────────────────┐
│  Frontend (React)               │
│  ├── Pure renderer              │
│  ├── Single poll loop           │
│  ├── Renders only backend state │
│  ├── Client sequence tracking   │
│  └── Debug banner UI            │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  Backend (Express API)          │
│  ├── POST /api/match/run        │
│  │   (idempotent, fast return) │
│  ├── GET /api/match/run/:runId  │
│  ├── GET .../debug (observability)│
│  └── URL canonicalization       │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  Database (Supabase)            │
│  ├── match_runs (orchestration) │
│  │   - status, progress_step    │
│  │   - lease locking            │
│  │   - debug_context            │
│  ├── startup_uploads            │
│  │   - canonical_url            │
│  │   - domain_key (unique)      │
│  └── startup_investor_matches   │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│  Worker (PM2 Background)        │
│  ├── Claims runs from queue     │
│  ├── Pure state machine         │
│  ├── Lease-based coordination   │
│  ├── Progress tracking          │
│  └── Survives crashes           │
└─────────────────────────────────┘
```

**Benefits:**
- Frontend always reflects true state
- Worker crashes don't break system
- Multiple workers can scale horizontally
- Full observability built-in

---

## Code Comparison

### URL Handling

**V1: Non-canonical**
```typescript
// Different URLs create different startups
"https://example.com"   → startup 1
"http://example.com"    → startup 2
"www.example.com"       → startup 3
"example.com/"          → startup 4
```

**V2: Canonical**
```typescript
// All map to same startup
canonicalizeUrl("https://example.com")  → "example.com"
canonicalizeUrl("http://example.com")   → "example.com"
canonicalizeUrl("www.example.com")      → "example.com"
canonicalizeUrl("example.com/")         → "example.com"

extractDomainKey(all above) → "example.com" → startup_uploads.domain_key (unique)
```

---

### Job Creation

**V1: Direct processing**
```typescript
// In API endpoint
app.post('/api/match', async (req, res) => {
  const startup = await createStartup(url);
  const matches = await findMatches(startup); // Blocks!
  res.json({ matches });
});

// Frontend calls this repeatedly → duplicate processing
```

**V2: Queue + orchestration**
```typescript
// In API endpoint
app.post('/api/match/run', async (req, res) => {
  const startup = await findOrCreateStartup(url);
  const runId = await getOrCreateMatchRun(startup.id); // Idempotent!
  res.json({ runId, status: 'queued' }); // Returns immediately
});

// Worker processes asynchronously
// Frontend calls repeatedly → same runId returned
```

---

### Frontend State

**V1: Local state machine**
```typescript
const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
const [matches, setMatches] = useState([]);

// Multiple useEffect loops
useEffect(() => {
  // Auto-refresh every 10 minutes
}, []);

useEffect(() => {
  // Load matches when startupId changes
}, [startupId]);

useEffect(() => {
  // Handle URL param
}, [urlParam]);

// UI guesses state
{state === 'loading' && matches.length === 0 ? 
  <Loading /> : 
  <Empty />  // ❌ Wrong! Might still be loading
}
```

**V2: Backend-driven**
```typescript
const [currentRun, setCurrentRun] = useState<MatchRunStatus | null>(null);

// Single poll loop (only when needed)
const pollInterval = setInterval(() => {
  const run = await fetch(`/api/match/run/${runId}`);
  setCurrentRun(run);
  if (run.status === 'ready' || run.status === 'error') {
    clearInterval(pollInterval);
  }
}, 2000);

// UI renders ONLY what backend says
{currentRun.status === 'ready' && currentRun.matchCount === 0 ? 
  <Empty /> :  // ✅ Only shows empty when backend confirms
  currentRun.status === 'processing' ?
  <Loading step={currentRun.progressStep} /> :
  <Matches data={currentRun.matches} />
}
```

---

### Debugging

**V1: Console.log archaeology**
```typescript
console.log('[MatchEngine] State:', state);
console.log('[useMatchState] Loading:', isLoading);
console.log('[loadMatches] Called, requestId:', requestId);

// No way to correlate logs
// No structured debug info
// Can't inspect after the fact
```

**V2: Structured observability**
```typescript
// Every run has debug endpoint
GET /api/match/run/:runId/debug

// Returns:
{
  "run": { /* full run state */ },
  "diagnostics": {
    "hasExtractedData": true,
    "matchStatusBreakdown": { "suggested": 42 },
    "leaseExpired": false,
    "isStuck": false,
    "timeSinceUpdate": 1234
  },
  "debugContext": {
    "steps": [
      { "step": "resolve", "startupFound": true },
      { "step": "extract", "fieldCount": 12 },
      { "step": "parse", "valid": true },
      { "step": "match", "candidateCount": 150 },
      { "step": "rank", "qualifiedMatches": 42 }
    ]
  }
}

// Plus: Debug banner in UI (dev mode)
```

---

## Performance Comparison

| Metric | V1 | V2 |
|--------|----|----|
| **Time to first response** | 5-30s (blocking) | < 100ms (returns runId) |
| **Duplicate job prevention** | ❌ None | ✅ SQL-enforced uniqueness |
| **Worker failure recovery** | ❌ Stuck forever | ✅ Lease expires → takeover |
| **Concurrent requests** | ⚠️ Race conditions | ✅ Idempotent, safe |
| **Scalability** | Single-threaded | Multi-worker ready |
| **Observability** | ❌ Console logs only | ✅ Debug endpoint + logs |

---

## Migration Path

### Phase 1: Deploy V2 alongside V1 (Week 1)
- Run migrations (adds new tables/columns)
- Deploy V2 endpoints (`/api/match/*` routes)
- Start worker process
- Keep V1 frontend active

### Phase 2: Test V2 (Week 2)
- Deploy V2 frontend to `/match-v2` route
- Internal testing
- Monitor worker logs and debug endpoints
- Run regression tests

### Phase 3: Gradual rollout (Week 3)
- 10% traffic to V2
- 50% traffic to V2
- 100% traffic to V2

### Phase 4: Deprecate V1 (Week 4)
- Remove V1 frontend component
- Archive V1 endpoints (mark deprecated)
- Keep both tables (no breaking changes)

---

## Guarantees V2 Provides

✅ **One canonical startup per URL** - `domain_key` unique index prevents duplicates  
✅ **Idempotent job creation** - Click "Get Matches" 100 times → one job  
✅ **Worker crash resilience** - Lease expires → another worker continues  
✅ **No false empty states** - Only shows "no matches" when backend confirms  
✅ **Full observability** - Debug endpoint answers "why stuck?" in seconds  
✅ **Stale response immunity** - Old responses can't overwrite new runs  
✅ **Deterministic lifecycle** - Every run follows same path: queue → process → ready/error  

---

## When to Use V1 vs V2

### Use V1 if:
- You need it working RIGHT NOW (no migration time)
- Single user, low traffic
- Don't care about duplicate startups

### Use V2 if:
- You're tired of debugging "pulse-of-doom"
- Multiple users clicking simultaneously
- Need to scale (multiple workers)
- Want to understand WHY something broke
- Need production reliability

**Recommendation:** Migrate to V2. The setup takes 5 minutes, prevents weeks of debugging.

---

## Decision Matrix

| Feature | V1 | V2 | Winner |
|---------|----|----|--------|
| Setup complexity | Easy | Medium | V1 |
| Runtime reliability | Low | High | **V2** |
| Debugging time | Hours | Minutes | **V2** |
| Duplicate prevention | ❌ | ✅ | **V2** |
| Crash recovery | ❌ | ✅ | **V2** |
| Observability | ❌ | ✅ | **V2** |
| Scalability | Single | Multi | **V2** |
| Race conditions | ⚠️ | ✅ | **V2** |

**Verdict:** V2 wins 7/8 categories. Initial setup cost pays off immediately.
