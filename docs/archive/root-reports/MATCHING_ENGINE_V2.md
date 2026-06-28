# 🛡️ Bulletproof Matching Engine V2

**The rebuilt matching system with deterministic lifecycle, full observability, and zero "pulse-of-doom".**

---

## What Changed (and Why)

### Before: State Machine Hell
- Frontend guessed states (`idle | resolving | loading | ready`)
- Race conditions from multiple `useEffect` loops
- "Pulsing" visual glitches from re-render storms
- No way to debug "why is it stuck?"
- Duplicate startups from non-canonical URLs

### After: Backend-Driven Determinism
- **One canonical URL** → one startup_id (no drift)
- **Job orchestration table** (`match_runs`) as single source of truth
- **Two endpoints only**: POST to start, GET to poll
- **Worker state machine** with lease-based locking (survives crashes)
- **Frontend as dumb renderer** (just displays what backend says)
- **Debug endpoint** answers "why is it pulsing?" in 10 seconds

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. User enters URL                                  │   │
│  │  2. POST /api/match/run → get runId                  │   │
│  │  3. Poll GET /api/match/run/:runId every 2s          │   │
│  │  4. Render based on status only:                     │   │
│  │     - queued/processing → show loading + step        │   │
│  │     - ready → show matches                           │   │
│  │     - error → show error + retry                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Express API)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /api/match/run                                 │   │
│  │  - Canonicalize URL → find/create startup           │   │
│  │  - get_or_create_match_run() → runId (idempotent)   │   │
│  │  - Queue for worker if new                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  GET /api/match/run/:runId                           │   │
│  │  - Return { status, progressStep, matchCount, ... } │   │
│  │  - Include matches if status = ready                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  GET /api/match/run/:runId/debug                     │   │
│  │  - Full observability: logs, stats, diagnostics      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (Supabase)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  match_runs (orchestration table - SSOT)            │   │
│  │  - run_id, startup_id, status, progress_step        │   │
│  │  - locked_by_worker, lock_expires_at (leases)       │   │
│  │  - match_count, error_code, debug_context           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  startup_uploads (canonical identity)               │   │
│  │  - canonical_url, domain_key (unique index)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     WORKER (PM2 Process)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Pure state machine:                                 │   │
│  │  1. Claim run (acquire lease)                        │   │
│  │  2. resolve → extract → parse → match → rank        │   │
│  │  3. Update progress_step at each stage               │   │
│  │  4. Complete with match_count or fail with error     │   │
│  │  5. Release lease                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│  Guarantees:                                                │
│  - Lease expiration → another worker can take over          │
│  - Idempotent (can resume from any step)                    │
│  - Full debug_context logged                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup

### 1. Run Migrations

```bash
./setup-matching-engine.sh
```

This will:
- Create `match_runs` table with helper functions
- Add `canonical_url` and `domain_key` to `startup_uploads`
- Prepare TypeScript files

### 2. Start Worker

```bash
pm2 start server/matchWorker.ts --name match-worker --interpreter tsx
```

Or add to `ecosystem.config.js`:

```javascript
{
  name: 'match-worker',
  script: 'npx',
  args: 'tsx server/matchWorker.ts',
  instances: 1,
  autorestart: true,
  max_memory_restart: '500M'
}
```

### 3. Start API Server

```bash
npm run dev
```

### 4. Use New Frontend Component

Replace `MatchingEngine.tsx` with `MatchingEngineV2.tsx`:

```tsx
import MatchingEngineV2 from './components/MatchingEngineV2';

// In your route
<Route path="/match" element={<MatchingEngineV2 />} />
```

---

## Key Files

| File | Purpose |
|------|---------|
| `migrations/create-match-runs-table.sql` | Orchestration table + helper functions |
| `migrations/add-canonical-url-columns.sql` | Canonical URL identity |
| `server/utils/urlCanonicalizer.ts` | URL normalization (SSOT) |
| `server/routes/matchRunRoutes.ts` | Two API endpoints |
| `server/matchWorker.ts` | Worker state machine |
| `src/components/MatchingEngineV2.tsx` | Frontend renderer |
| `tests/matching-engine.test.ts` | Regression tests |
| `setup-matching-engine.sh` | Setup script |

---

## API Contract

### POST /api/match/run

**Start or get existing run (idempotent)**

**Request:**
```json
{
  "url": "example.com"
}
```

**Response:**
```json
{
  "runId": "uuid",
  "startupId": "uuid",
  "status": "queued",
  "progressStep": null,
  "matchCount": 0,
  "createdAt": "2026-01-28T...",
  "updatedAt": "2026-01-28T..."
}
```

### GET /api/match/run/:runId

**Poll for status and results**

**Response (processing):**
```json
{
  "runId": "uuid",
  "startupId": "uuid",
  "status": "processing",
  "progressStep": "match",
  "matchCount": 0,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Response (ready):**
```json
{
  "runId": "uuid",
  "startupId": "uuid",
  "status": "ready",
  "matchCount": 42,
  "matches": [
    {
      "id": "uuid",
      "match_score": 87,
      "match_reasoning": "...",
      "investors": { ... }
    }
  ],
  ...
}
```

### GET /api/match/run/:runId/debug

**Debug info (dev/admin only)**

**Response:**
```json
{
  "run": { ... },
  "startup": { ... },
  "logs": [ ... ],
  "diagnostics": {
    "hasExtractedData": true,
    "matchStatusBreakdown": { "suggested": 42 },
    "leaseExpired": false,
    "isStuck": false,
    "timeSinceUpdate": 1234
  },
  "debugContext": {
    "steps": [ ... ],
    "candidateCount": 150,
    "rankedCount": 42
  }
}
```

---

## State Flow

```
User submits URL
       ↓
POST /api/match/run
       ↓
URL canonicalized → startup found/created
       ↓
get_or_create_match_run() → runId
       ↓
status = 'created' → 'queued'
       ↓
Worker claims run (acquires lease)
       ↓
status = 'processing'
progress_step = 'resolve' → 'extract' → 'parse' → 'match' → 'rank' → 'finalize'
       ↓
Matches saved to startup_investor_matches
       ↓
status = 'ready', match_count = N
       ↓
Frontend displays matches
```

**Error path:**
```
Any step fails
       ↓
status = 'error'
error_code = 'PARSE_FAILED'
error_message = 'Missing sectors'
       ↓
Frontend shows retry button
```

**Stuck worker:**
```
Worker crashes mid-processing
       ↓
lease expires (60s)
       ↓
Another worker claims run
       ↓
Resumes from progress_step
```

---

## Debugging

### Why is it pulsing?

1. Check debug banner (dev mode automatically shows it)
2. Look at `status` and `progressStep`
3. Check `/api/match/run/:runId/debug` endpoint

**Common issues:**

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Stuck on "queued" | Worker not running | `pm2 start match-worker` |
| Stuck on "processing" | Worker crashed + lease not expired | Wait 60s or restart worker |
| status=error, code=PARSE_FAILED | Startup data missing required fields | Check `debugContext.steps` for details |
| matchCount=0 on ready | No sector overlap with investors | Normal (show "no matches") |

### View worker logs

```bash
pm2 logs match-worker
```

### Check database state

```sql
-- Active runs
SELECT * FROM match_runs 
WHERE status IN ('queued', 'processing') 
ORDER BY created_at DESC;

-- Stuck runs (lease expired)
SELECT * FROM match_runs 
WHERE status = 'processing' 
  AND lock_expires_at < NOW();

-- Recent errors
SELECT * FROM match_runs 
WHERE status = 'error' 
ORDER BY updated_at DESC 
LIMIT 10;
```

---

## Testing

### Run regression tests

```bash
npm test tests/matching-engine.test.ts
```

**Tests cover:**
1. ✅ Idempotent run creation (20 clicks → 1 job)
2. ✅ Worker death recovery (lease expiration → takeover)
3. ✅ Empty state only on ready+0
4. ✅ Loading state on processing+0 (never shows empty)
5. ✅ Stale response protection (old runId ignored)

### Manual testing

```bash
# Start a run
curl -X POST http://localhost:3002/api/match/run \
  -H 'Content-Type: application/json' \
  -d '{"url":"example.com"}'

# Poll status (repeat until ready)
curl http://localhost:3002/api/match/run/<runId>

# View debug info
curl http://localhost:3002/api/match/run/<runId>/debug
```

---

## Operational Checklist

**Daily:**
- [ ] Check `pm2 status` - worker running?
- [ ] Check `pm2 logs match-worker --lines 50` - any errors?

**Weekly:**
- [ ] Review stuck runs: `SELECT * FROM match_runs WHERE status='processing' AND updated_at < NOW() - INTERVAL '1 hour'`
- [ ] Check error patterns: `SELECT error_code, COUNT(*) FROM match_runs WHERE status='error' GROUP BY error_code`

**Monthly:**
- [ ] Run regression tests
- [ ] Review canonical URL collisions (multiple startups with same domain_key)
- [ ] Archive old completed runs (status=ready, updated_at > 30 days ago)

---

## Guarantees

✅ **One canonical startup identity per URL** - `domain_key` unique index  
✅ **Idempotent job orchestration** - `get_or_create_match_run()` SQL function  
✅ **Authoritative pipeline state** - `match_runs.status` is SSOT  
✅ **Eventual consistency tolerant UI** - Only shows empty on `ready+0`  
✅ **Full observability** - Debug endpoint + `debug_context` JSONB field  
✅ **Stale response immunity** - Client-side sequence tracking (`clientRunSeq`)

---

## Migration from V1

**If you have existing matching code:**

1. Keep old endpoints running temporarily
2. Deploy V2 components alongside V1
3. Test V2 with new URLs
4. Gradually migrate users to V2 frontend
5. Deprecate V1 after 2 weeks of V2 stability

**Rollback plan:**

```bash
# Stop worker
pm2 stop match-worker

# Revert frontend
git checkout <previous-commit> -- src/components/MatchingEngine.tsx

# Keep match_runs table (doesn't interfere with V1)
```

---

## Future Enhancements

- [ ] Priority queue (VIP users jump to front)
- [ ] Scheduled re-runs (update matches monthly)
- [ ] Bulk URL submission (batch API)
- [ ] Webhook notifications (POST to user URL when ready)
- [ ] Multiple workers (horizontal scaling)
- [ ] A/B test match algorithms (version field in match_runs)

---

**Questions?** Check `/api/match/run/:runId/debug` first. 90% of issues are visible there.

**Still stuck?** Search `ai_logs` table for `output->>'runId' = '<your-run-id>'`.
