# 🚀 Matching Engine V2 - Quick Start

## Prerequisites
- ✅ Supabase credentials in `.env`
- ✅ Node.js & npm installed
- ✅ PM2 installed globally (`npm install -g pm2`)

---

## Step-by-Step Setup (5 minutes)

### 1. Run Setup Script
```bash
chmod +x setup-matching-engine.sh
./setup-matching-engine.sh
```

**What it does:**
- Creates `match_runs` table with orchestration logic
- Adds `canonical_url` and `domain_key` columns to `startup_uploads`
- Prepares TypeScript files

---

### 2. Start Match Worker
```bash
pm2 start server/matchWorker.ts --name match-worker --interpreter tsx
```

**Verify it's running:**
```bash
pm2 status
# Should show "match-worker" in "online" status
```

**View logs:**
```bash
pm2 logs match-worker
# Should see: "[Worker worker-<pid>-<timestamp>] Starting..."
```

---

### 3. Start API Server
```bash
npm run dev
```

**Verify endpoints:**
```bash
# Test POST /api/match/run
curl -X POST http://localhost:3002/api/match/run \
  -H 'Content-Type: application/json' \
  -d '{"url":"openai.com"}'

# Should return: { "runId": "...", "startupId": "...", "status": "queued", ... }
```

---

### 4. Update Frontend Route

In your routing file (e.g., `App.tsx` or `main.tsx`):

```tsx
// Replace old import
// import MatchingEngine from './components/MatchingEngine';
import MatchingEngineV2 from './components/MatchingEngineV2';

// In your routes
<Route path="/match" element={<MatchingEngineV2 />} />
```

---

### 5. Test End-to-End

1. Navigate to `/match` in your browser
2. Enter a startup URL (e.g., `openai.com`)
3. Click "Get Matches"
4. Watch the progress steps:
   - "Waiting in queue..."
   - "Resolving startup..."
   - "Finding investors..."
   - etc.
5. See matches appear when status = ready

**Debug panel (dev mode):**
- Automatically shows at bottom of screen
- Click to expand and see full state
- Check `runId`, `status`, `progressStep`, `matchCount`

---

## Verification Checklist

- [ ] Setup script ran without errors
- [ ] `pm2 status` shows match-worker as "online"
- [ ] `pm2 logs match-worker` shows "Starting..." message
- [ ] API server running on port 3002 (or your configured port)
- [ ] POST /api/match/run returns valid JSON with runId
- [ ] Frontend shows new MatchingEngineV2 component
- [ ] Entering URL and clicking "Get Matches" shows loading state
- [ ] Debug panel visible in dev mode (bottom of screen)

---

## Troubleshooting

### Worker not starting
```bash
# Check logs
pm2 logs match-worker --err

# Common issues:
# - Missing .env file → copy .env.example to .env
# - Supabase credentials wrong → check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# - TypeScript errors → run: npx tsx server/matchWorker.ts directly to see error
```

### API returns 500 errors
```bash
# Check server logs
npm run dev
# Look for errors in terminal

# Common issues:
# - Routes not registered → check server/index.js has: app.use('/api/match', matchRunRoutes)
# - Supabase RPC functions missing → re-run setup script
```

### Frontend shows "Starting match run..." forever
```bash
# Check if POST succeeded
curl -X POST http://localhost:3002/api/match/run \
  -H 'Content-Type: application/json' \
  -d '{"url":"test.com"}'

# Check worker status
pm2 status
pm2 logs match-worker

# Check database
psql <your-db-url> -c "SELECT * FROM match_runs ORDER BY created_at DESC LIMIT 5;"
```

### Stuck on "Waiting in queue..."
```bash
# Worker not processing → restart it
pm2 restart match-worker

# Check for runs waiting in queue
psql <your-db-url> -c "SELECT run_id, status, created_at FROM match_runs WHERE status='queued';"
```

---

## Quick Commands Reference

```bash
# Worker management
pm2 start match-worker        # Start
pm2 stop match-worker         # Stop
pm2 restart match-worker      # Restart
pm2 logs match-worker         # View logs
pm2 logs match-worker --err   # View errors only

# Check database state
psql <db-url> -c "SELECT * FROM match_runs ORDER BY created_at DESC LIMIT 5;"

# Test API directly
curl -X POST http://localhost:3002/api/match/run -H 'Content-Type: application/json' -d '{"url":"test.com"}'
curl http://localhost:3002/api/match/run/<runId>
curl http://localhost:3002/api/match/run/<runId>/debug

# Run tests
npm test tests/matching-engine.test.ts
```

---

## Next Steps

- [ ] Read [MATCHING_ENGINE_V2.md](MATCHING_ENGINE_V2.md) for full architecture
- [ ] Check debug endpoint: `/api/match/run/:runId/debug`
- [ ] Run regression tests: `npm test`
- [ ] Set up monitoring (PM2 ecosystem, Supabase dashboard)
- [ ] Plan migration from V1 (if applicable)

---

## Success Criteria

✅ No more "pulsing" visual glitches  
✅ Can click "Get Matches" 20 times → still one job  
✅ Worker can crash and another takes over (via lease expiration)  
✅ "No matches" only shows when backend confirms ready+0  
✅ Full observability via debug endpoint  

---

**Still having issues?** 

1. Check `/api/match/run/:runId/debug` endpoint
2. Review `pm2 logs match-worker`
3. Check `ai_logs` table in Supabase
4. See "Debugging" section in [MATCHING_ENGINE_V2.md](MATCHING_ENGINE_V2.md)
