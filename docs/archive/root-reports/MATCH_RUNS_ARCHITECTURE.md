# Bulletproof Matching Engine V1 - Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React)                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  useMatchRun() Hook                                               │  │
│  │  • State: idle → loading → polling → ready/error                  │  │
│  │  • Polls every 2s until ready                                     │  │
│  │  • Failsafe timeout: 30 polls (1 min)                             │  │
│  │  • Can't pulse incorrectly (deterministic)                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                           ↓ POST /api/match/run                         │
│                           ↓ GET /api/match/run/:runId (every 2s)        │
└─────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXPRESS API (server/routes/)                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  matchRun.js                                                      │  │
│  │  • POST /run  → supabase.rpc('start_match_run', {url})           │  │
│  │  • GET /run/:id → supabase.rpc('get_match_run', {run_id})        │  │
│  │  • Thin wrappers (no business logic)                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (PostgreSQL)                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ENUMS                                                          │   │
│  │  • match_run_status: created, queued, processing, ready, error  │   │
│  │  • match_run_step: resolve, extract, parse, match, rank, final │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TABLE: match_runs (Orchestration SSOT)                        │   │
│  │  ┌──────────────┬──────────────┬──────────────┬───────────┐   │   │
│  │  │ run_id (PK)  │ startup_id   │ status       │ step      │   │   │
│  │  │ input_url    │ canonical_url│ match_count  │ error_*   │   │   │
│  │  │ locked_by    │ lock_expires │ created_at   │ updated_at│   │   │
│  │  └──────────────┴──────────────┴──────────────┴───────────┘   │   │
│  │  Indexes:                                                      │   │
│  │  • idx_match_runs_startup (startup_id)                         │   │
│  │  • idx_match_runs_status (status)                              │   │
│  │  • idx_match_runs_lease (status, lock_expires_at)              │   │
│  │  • idx_match_runs_active_url (UNIQUE on input_url)             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  RPC FUNCTIONS (PL/pgSQL)                                      │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  start_match_run(url)                                   │   │   │
│  │  │  1. Canonicalize URL                                    │   │   │
│  │  │  2. Check for existing active run (IDEMPOTENT)          │   │   │
│  │  │  3. Resolve URL → startup_id (existing RPC)             │   │   │
│  │  │  4. INSERT new run (status='queued')                    │   │   │
│  │  │  5. RETURN run details                                  │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  get_match_run(run_id)                                  │   │   │
│  │  │  1. SELECT from match_runs                              │   │   │
│  │  │  2. IF status='ready':                                  │   │   │
│  │  │     → Call get_top_matches(startup_id, 200)             │   │   │
│  │  │     → Build JSONB array                                 │   │   │
│  │  │  3. RETURN run + matches                                │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  claim_next_match_run(worker_id)                        │   │   │
│  │  │  1. SELECT ... WHERE status='queued'                    │   │   │
│  │  │     ORDER BY created_at FOR UPDATE SKIP LOCKED          │   │   │
│  │  │  2. UPDATE: status='processing', locked_by=worker_id    │   │   │
│  │  │     lock_expires_at = now() + 5 minutes                 │   │   │
│  │  │  3. RETURN claimed run                                  │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  complete_match_run(run_id, status, count, error_*)     │   │   │
│  │  │  1. UPDATE match_runs SET:                              │   │   │
│  │  │     status=final_status, match_count=count              │   │   │
│  │  │     locked_by=NULL, lock_expires_at=NULL                │   │   │
│  │  │  2. RETURN success                                      │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  EXISTING TABLES (READ-ONLY)                                   │   │
│  │  • startup_uploads (4.1M rows) ─────────────────┐              │   │
│  │  • startup_investor_matches (4.1M rows) ◄───────┘ NEVER WRITE  │   │
│  │  • investors                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  EXISTING RPCS (REUSED)                                        │   │
│  │  • resolve_startup_by_url(url) → {startup_id, name, ...}       │   │
│  │  • count_matches(startup_id) → {count}                          │   │
│  │  • get_top_matches(startup_id, limit) → [{investor, score}]    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                      ↑
┌─────────────────────────────────────────────────────────────────────────┐
│                    WORKER (PM2 Cron - Every 10s)                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  matchRunWorker.js (Pattern A: Read-only)                        │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  LOOP:                                                     │  │  │
│  │  │  1. Claim next run (lease-based)                           │  │  │
│  │  │     → supabase.rpc('claim_next_match_run', {worker_id})   │  │  │
│  │  │  2. Count matches (existing RPC)                           │  │  │
│  │  │     → supabase.rpc('count_matches', {startup_id})         │  │  │
│  │  │  3. Complete run                                           │  │  │
│  │  │     → supabase.rpc('complete_match_run', {                │  │  │
│  │  │         run_id, status='ready', count                     │  │  │
│  │  │       })                                                   │  │  │
│  │  │  4. Process up to 10 runs per batch                        │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                        STATE MACHINE (Frontend)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────┐  startMatch()  ┌─────────┐  POST success  ┌─────────────┐  │
│   │ idle │ ─────────────→ │ loading │ ──────────────→ │  polling    │  │
│   └──────┘                └─────────┘                 └─────────────┘  │
│      ↑                         │                            │   ↓      │
│      │                         │                            │   │      │
│      │                         ↓ POST error                 │   │      │
│      │                     ┌───────┐                        │   │      │
│      │     reset()         │ error │ ←──────────────────────┘   │      │
│      └─────────────────────└───────┘       timeout (30 polls)   │      │
│                                 ↑                               │      │
│                                 │                               │      │
│                                 │                  status='ready'│      │
│                                 │                               ↓      │
│                                 │   status='error'        ┌───────┐   │
│                                 └─────────────────────────│ ready │   │
│                                                           └───────┘   │
│                                                                │       │
│                                                                │       │
│                                                        reset() │       │
│                                                                ↓       │
│                                                           back to idle │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                      IDEMPOTENCY GUARANTEE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  User clicks "Get Matches" for https://anthropic.com                   │
│                                                                         │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐          │
│  │ Click 1│  │ Click 2│  │ Click 3│  │ ...    │  │ Click 20│          │
│  └────────┘  └────────┘  └────────┘  └────────┘  └────────┘          │
│      │            │            │            │            │             │
│      └────────────┴────────────┴────────────┴────────────┘             │
│                                │                                        │
│                                ↓                                        │
│             POST /api/match/run {"url": "https://anthropic.com"}       │
│                                │                                        │
│                                ↓                                        │
│                   start_match_run('https://anthropic.com')             │
│                                │                                        │
│                                ↓                                        │
│      CHECK: Existing active run for this URL? ──┐                      │
│                                                  │                      │
│                         YES (found) ─────────────┤                      │
│                                                  │                      │
│              ┌───────────────────────────────────┘                      │
│              │                                                          │
│              ↓                                                          │
│      RETURN existing run_id: abc123...                                 │
│                                                                         │
│  Result: ALL 20 clicks return SAME run_id                              │
│          Frontend shows SAME matches                                   │
│          Database has ONLY 1 row in match_runs                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                     WORKER LEASE MECHANISM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Scenario: 3 workers competing for 5 queued runs                       │
│                                                                         │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐                              │
│  │ Worker A│   │ Worker B│   │ Worker C│                              │
│  └─────────┘   └─────────┘   └─────────┘                              │
│       │             │             │                                     │
│       └─────────────┴─────────────┘                                     │
│                     │                                                   │
│                     ↓                                                   │
│          claim_next_match_run(worker_id)                               │
│                     │                                                   │
│                     ↓                                                   │
│   SELECT ... FOR UPDATE SKIP LOCKED  (PostgreSQL concurrency)          │
│                     │                                                   │
│            ┌────────┴────────┬────────┐                                │
│            │                 │        │                                 │
│      Worker A gets      Worker B gets Worker C gets                    │
│       run_id: 001        run_id: 002  run_id: 003                      │
│            │                 │        │                                 │
│            └─────────────────┴────────┘                                │
│                     │                                                   │
│              Each run is LOCKED:                                       │
│              • locked_by = worker_id                                   │
│              • lock_expires_at = now() + 5 minutes                     │
│                     │                                                   │
│                     ↓                                                   │
│              Workers process in parallel                               │
│              (no race conditions)                                      │
│                     │                                                   │
│                     ↓                                                   │
│          On completion: UPDATE status='ready'                          │
│                         SET locked_by=NULL                             │
│                             lock_expires_at=NULL                       │
│                                                                         │
│  If worker DIES before completing:                                     │
│    → lock_expires_at passes                                            │
│    → Cron runs: release_expired_leases()                               │
│    → Run goes back to 'queued' status                                  │
│    → Another worker can claim it                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                    PATTERN A: READ-ONLY EXPLAINED                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Traditional Approach (Pattern B - Generate on demand):                │
│  ┌────────────────────────────────────────────────────────┐            │
│  │ 1. User requests matches                               │            │
│  │ 2. Worker WRITES new rows to startup_investor_matches  │            │
│  │ 3. Worker calculates GOD scores on the fly             │            │
│  │ 4. Worker runs matching algorithm                      │            │
│  │ 5. Worker inserts results (4.1M rows touched)          │            │
│  │ 6. Return matches                                      │            │
│  └────────────────────────────────────────────────────────┘            │
│  ❌ Problems:                                                           │
│     • Slow (generates every time)                                      │
│     • Can corrupt 4.1M corpus                                          │
│     • Race conditions on writes                                        │
│                                                                         │
│  Our Approach (Pattern A - Read-only):                                 │
│  ┌────────────────────────────────────────────────────────┐            │
│  │ 1. User requests matches                               │            │
│  │ 2. Worker READS from startup_investor_matches          │            │
│  │ 3. Worker calls: count_matches(startup_id)             │            │
│  │ 4. Worker calls: get_top_matches(startup_id, 200)      │            │
│  │ 5. Worker updates ONLY match_runs table:               │            │
│  │    SET status='ready', match_count=N                   │            │
│  │ 6. Return matches                                      │            │
│  └────────────────────────────────────────────────────────┘            │
│  ✅ Benefits:                                                           │
│     • Fast (just queries existing data)                                │
│     • Safe (never touches 4.1M corpus)                                 │
│     • No race conditions (reads are safe)                              │
│     • Idempotent (same query → same results)                           │
│                                                                         │
│  The 4.1M matches are pre-generated by:                                │
│  • match-regenerator.js (nightly cron)                                 │
│  • GOD score recalculation (scripts/recalculate-scores.ts)            │
│  • System Guardian (monitors quality)                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Architectural Principles:**

1. **Idempotency**: Unique index on `(input_url)` WHERE status IN ('created','queued','processing','ready')
2. **Determinism**: State machine can only move forward (no guessing)
3. **Lease-based**: 5-minute timeout + `FOR UPDATE SKIP LOCKED`
4. **Read-only**: Never writes to `startup_investor_matches` (Pattern A)
5. **RPC-first**: All business logic in PostgreSQL functions
6. **Add-only**: No ALTER TABLE on existing tables

**Technologies:**
- **Database**: Supabase (PostgreSQL 14+)
- **Language**: PL/pgSQL (functions), JavaScript (worker, API)
- **Frontend**: React 19 + TypeScript
- **Backend**: Express.js + Supabase client
- **Queue**: PM2 cron (every 10 seconds)
