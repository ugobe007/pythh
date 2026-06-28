# 🚀 Bulletproof Matching Engine V1 - Quick Reference

## One-Command Deploy

```bash
# 1. Open Supabase Dashboard SQL Editor
# 2. Copy/paste: migrations/001-match-runs-orchestration.sql
# 3. Click RUN
# 4. Restart server:
pm2 restart api-server
```

---

## API Endpoints

```bash
# Start match run (idempotent)
POST /api/match/run
Body: {"url": "https://example.com"}
Returns: {"run_id": "uuid", "status": "queued", ...}

# Poll status (every 2s until ready, then 10s)
GET /api/match/run/:runId
Returns: {"status": "ready", "matches": [...], ...}

# Debug info (dev only - age, stuck detection)
GET /api/match/run/:runId/debug
Returns: {"age_seconds": 45, "is_stuck": false, ...}

# List recent runs (admin)
GET /api/match/runs?limit=50
```

---

## Frontend Hook

```typescript
import { useMatchRun } from './hooks/useMatchRun';

const { startMatch, matches, isLoading, isReady, error } = useMatchRun();

<button onClick={() => startMatch(url)} disabled={isLoading}>
  {isLoading ? 'Matching...' : 'Get Matches'}
</button>

{isReady && matches.map(m => <div key={m.investor_id}>{m.investor_name}</div>)}
{error && <div className="error">{error}</div>}
```

---

## Worker (Optional)

```bash
# Start worker (processes queue every 10s)
pm2 start server/matchRunWorker.js --name match-worker --cron "*/10 * * * * *"

# Manual run (testing)
node server/matchRunWorker.js

# Check logs
pm2 logs match-worker
```

---

## Testing

```bash
# Test idempotency (5 calls → same run_id)
for i in {1..5}; do
  curl -s -X POST http://localhost:3002/api/match/run \
    -H 'Content-Type: application/json' \
    -d '{"url":"https://anthropic.com"}' | jq -r .run_id
done

# Test status polling
RUN_ID=$(curl -s -X POST http://localhost:3002/api/match/run \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://anthropic.com"}' | jq -r .run_id)

curl http://localhost:3002/api/match/run/$RUN_ID | jq '{status, match_count}'
```

---

## Monitoring SQL

```sql
-- Recent runs
SELECT run_id, input_url, status, match_count, created_at
FROM match_runs
ORDER BY created_at DESC
LIMIT 20;

-- Queue depth
SELECT status, COUNT(*) FROM match_runs GROUP BY status;

-- Release stuck runs
SELECT release_expired_leases();
```

---

## State Machine

```
idle → loading → polling → ready ✅
                         → error ❌
```

- **idle**: Initial state
- **loading**: POST /api/match/run called
- **polling**: GET /api/match/run/:runId every 2s
- **ready**: Matches available
- **error**: Failed or timeout

---

## Files

| File | Purpose |
|------|---------|
| `migrations/001-match-runs-orchestration.sql` | Database (enums, table, RPCs) |
| `server/routes/matchRun.js` | API routes |
| `server/matchRunWorker.js` | Worker processor |
| `src/hooks/useMatchRun.ts` | Frontend hook |

---

## Key Features

✅ **Idempotent** - Same canonical URL → same run_id (for active runs)  
✅ **Pattern A** - Read-only (never writes to 4.1M matches)  
✅ **Deterministic** - Can't pulse incorrectly  
✅ **Lease-based** - Handles worker failures (5min timeout)  
✅ **PostgreSQL** - Enums + PL/pgSQL functions  
✅ **Rerunnable** - Completed runs don't block new runs  
✅ **Time-capped** - Worker stops after 8s to avoid cron overlap  
✅ **Soft timeout** - UI slows polling, doesn't error prematurely  

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API 404 | `pm2 restart api-server` |
| Worker not processing | `pm2 start server/matchRunWorker.js --name match-worker --cron "*/10 * * * * *"` |
| Frontend pulsates | Use `useMatchRun()` hook |
| Stuck runs | `SELECT release_expired_leases();` |

---

**Full Docs:**
- [MATCH_RUNS_SUMMARY.md](MATCH_RUNS_SUMMARY.md) - Complete documentation
- [MATCH_RUNS_DEPLOYMENT.md](MATCH_RUNS_DEPLOYMENT.md) - Step-by-step deployment

**Architecture:** Supabase RPC-first, Pattern A (read-only), add-only migrations
