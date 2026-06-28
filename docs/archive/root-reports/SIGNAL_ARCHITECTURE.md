# Signal Architecture - One Page, Evolving Sections

## The Rule: NO NEW PAGES

Everything happens on **DiscoveryResultsPage.tsx** (`/matches` route).

Sections appear/evolve based on:
- First visit: Minimal view (Phase 1-2 - CURRENT)
- Return visit: Signal evolution section appears (Phase 5 - FUTURE)
- Backend state: Different UI states based on job status (Phase 3-4)

---

## Page Structure (Current → Future)

```
┌─────────────────────────────────────────────────────────────┐
│ TopBar (navigation)                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECTION 1: Header                                           │
│ ─────────────────────────────────────────────────────────   │
│ pythh signals                                               │
│ [25] investors aligned with your signals                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECTION 2: Startup Signal Card (Instrument Panel)          │
│ ─────────────────────────────────────────────────────────   │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │   Phase     │ │    Band     │ │  Matches    │            │
│ │    59%      │ │    med      │ │     25      │            │
│ │   (cyan)    │ │   (cyan)    │ │  (orange)   │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                              │
│ Hover = tooltip (NOT clickable)                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECTION 3: Signal Evolution (Phase 5 - appears on return)  │
│ ─────────────────────────────────────────────────────────   │
│ 📊 Your Signal Movement (Last 7 Days)                       │
│                                                              │
│ Phase:   52% → 59%  (+7%)                                   │
│ Band:    med (stable)                                       │
│ Matches: 22 → 25    (+3)                                    │
│                                                              │
│ 🔺 2 new investors entered your range                        │
│ 🔻 1 investor dropped (requires traction boost)              │
│ ⚡ Alignment score increased 8%                              │
│                                                              │
│ [Only visible if founder has prior snapshot]                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECTION 4: Top 5 Investor Cards                            │
│ ─────────────────────────────────────────────────────────   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Investor 1 - Match 87/100                               │ │
│ │ Thesis: [details]                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Investor 2 - Match 84/100                               │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ... (3 more)                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECTION 5: Next Action Bar (What to do next)               │
│ ─────────────────────────────────────────────────────────   │
│ "Your weakest signal: Traction depth"                       │
│ "Do this: Add 2 customer testimonials to increase pull"     │
│ [Action button]                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECTION 6: Proof Panel                                     │
│ ─────────────────────────────────────────────────────────   │
│ Why this is real / Methodology                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Phase 3-4)

### New Tables Needed

#### 1. `startup_jobs` - Backend Job State Tracking
```sql
CREATE TABLE startup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id),
  url TEXT NOT NULL,
  status TEXT NOT NULL, -- 'queued' | 'building' | 'scoring' | 'matching' | 'ready' | 'failed'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  progress_percent INTEGER DEFAULT 0,
  error_message TEXT,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url)
);

CREATE INDEX idx_startup_jobs_status ON startup_jobs(status);
CREATE INDEX idx_startup_jobs_url ON startup_jobs(url);
```

#### 2. `startup_signal_snapshots` - Historical Signal State
```sql
CREATE TABLE startup_signal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Signal metrics
  phase_score NUMERIC(3,2), -- 0.00 to 1.00
  signal_band TEXT, -- 'low' | 'med' | 'high'
  signal_strength NUMERIC(4,1), -- e.g., 6.5
  match_count INTEGER,
  alignment_score NUMERIC(5,2), -- Overall alignment percentage
  
  -- Top 5 at this moment
  top_5_investor_ids UUID[],
  
  -- Context
  heat TEXT, -- 'cool' | 'warming' | 'hot'
  velocity_label TEXT,
  tier_label TEXT,
  observers_7d INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signal_snapshots_startup ON startup_signal_snapshots(startup_id, captured_at DESC);
CREATE INDEX idx_signal_snapshots_captured ON startup_signal_snapshots(captured_at);
```

#### 3. `startup_signal_deltas` - Computed Changes (Phase 5)
```sql
CREATE TABLE startup_signal_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID REFERENCES startup_uploads(id),
  snapshot_from_id UUID REFERENCES startup_signal_snapshots(id),
  snapshot_to_id UUID REFERENCES startup_signal_snapshots(id),
  
  -- Computed deltas
  phase_delta NUMERIC(3,2), -- e.g., +0.07 = +7%
  band_changed BOOLEAN DEFAULT FALSE,
  band_from TEXT,
  band_to TEXT,
  match_count_delta INTEGER, -- e.g., +3
  alignment_delta NUMERIC(5,2), -- e.g., +8.5%
  
  -- Narrative changes
  investors_gained UUID[],
  investors_lost UUID[],
  investors_gained_count INTEGER DEFAULT 0,
  investors_lost_count INTEGER DEFAULT 0,
  
  -- Auto-generated explanation
  narrative TEXT,
  
  compared_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signal_deltas_startup ON startup_signal_deltas(startup_id, compared_at DESC);
```

---

## API Contract Changes (Phase 3-4)

### Current API (Fragile)
```
GET /api/discovery/convergence?url=nucleoresearch.com&mode=fast
```

Returns:
```json
{
  "visible_investors": [...],
  "hidden_investors_total": 20,
  "debug": {
    "state": "ready",
    "totalMatches": 25
  }
}
```

**Problem**: No job tracking, race conditions, stale results

---

### New API (Robust)

#### 1. Submit URL for Processing
```
POST /api/discovery/submit
Body: { "url": "nucleoresearch.com" }
```

Returns:
```json
{
  "job_id": "uuid-123",
  "startup_id": "uuid-456",
  "status": "queued",
  "message": "Job queued. Poll /results for updates."
}
```

**Idempotent**: If URL already processed, returns existing job_id

---

#### 2. Get Results (with State)
```
GET /api/discovery/results?job_id=uuid-123
```

Returns one of:

**A) Building (no matches yet)**
```json
{
  "status": "building",
  "progress": 42,
  "message": "Reading signals...",
  "debug": {
    "state": "scoring",
    "startupId": "uuid-456",
    "updatedAt": "2026-01-23T10:30:00Z"
  }
}
```

**B) Ready (matches available)**
```json
{
  "status": "ready",
  "startup_id": "uuid-456",
  "matches": [...],
  "signal": {
    "phase": 0.59,
    "band": "med",
    "matchCount": 25,
    "signalStrength": 6.5
  },
  "debug": {
    "state": "ready",
    "finishedAt": "2026-01-23T10:31:00Z"
  }
}
```

**C) Failed (with explanation)**
```json
{
  "status": "failed",
  "error": "No investor corpus found for sector",
  "retryable": true,
  "debug": {
    "state": "failed",
    "reason": "sector_mismatch"
  }
}
```

**D) Unknown URL (never submitted)**
```json
{
  "status": "unknown",
  "message": "No job found. Submit URL first."
}
```

---

## Frontend State Machine (Phase 4)

### Current (Fragile)
```tsx
// Bad: Fire and hope
const [loading, setLoading] = useState(false);

// Polls randomly, can overwrite with stale data
```

### New (Robust)
```tsx
type JobState = 
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'building', progress: number, pollCount: number }
  | { status: 'ready', matches: InvestorMatch[], signal: StartupSignal }
  | { status: 'failed', error: string, retryable: boolean }
  | { status: 'unknown' };

const [jobState, setJobState] = useState<JobState>({ status: 'idle' });
const [jobId, setJobId] = useState<string | null>(null);
```

**UI Renders Based on State**:
- `idle`: Show home page
- `submitting`: "Submitting..." (brief)
- `building`: "Reading signals... (attempt 3/10)" with progress bar
- `ready`: Full results page with all sections
- `failed`: Error message with retry button
- `unknown`: "Something went wrong" with resubmit

**No More**:
- ❌ Implicit loading states
- ❌ Hidden fetch states
- ❌ Ghost errors
- ❌ Cached empties
- ❌ Stale overwrites

---

## Component Architecture (DiscoveryResultsPage.tsx)

### Current Structure (Lines 1-875)
```tsx
export default function DiscoveryResultsPage() {
  // URL parsing
  const [searchParams] = useSearchParams();
  const urlParam = searchParams.get('url');
  
  // State
  const [matches, setMatches] = useState<InvestorMatch[]>([]);
  const [startupSignal, setStartupSignal] = useState<StartupSignal | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch logic (currently fragile)
  useEffect(() => {
    // ... polling logic with race conditions
  }, [urlParam]);
  
  return (
    <PageShell>
      {/* Section 1: Header */}
      <h1>pythh signals</h1>
      <p>[{matches.length}] investors aligned with your signals</p>
      
      {/* Section 2: Signal Card */}
      {startupSignal && <StartupSignalCard s={startupSignal} />}
      
      {/* Section 4: Top 5 Matches */}
      {matches.slice(0, 5).map(m => <InvestorMatchCard key={m.id} match={m} />)}
      
      {/* Section 5: Next Action */}
      <NextActionBar />
      
      {/* Section 6: Proof */}
      <ProofPanel />
    </PageShell>
  );
}
```

### Phase 5 Addition (Signal Evolution Section)
```tsx
export default function DiscoveryResultsPage() {
  // ... existing state ...
  
  // NEW: Signal evolution state
  const [signalDelta, setSignalDelta] = useState<SignalDelta | null>(null);
  const [isReturningUser, setIsReturningUser] = useState(false);
  
  // NEW: Fetch signal delta if returning user
  useEffect(() => {
    if (!startupId) return;
    
    // Check if snapshot exists
    const checkPriorSnapshot = async () => {
      const { data } = await supabase
        .from('startup_signal_snapshots')
        .select('id, captured_at')
        .eq('startup_id', startupId)
        .order('captured_at', { ascending: false })
        .limit(2); // Get last 2
      
      if (data && data.length >= 2) {
        setIsReturningUser(true);
        // Fetch computed delta
        const deltaResult = await fetchSignalDelta(startupId);
        setSignalDelta(deltaResult);
      }
    };
    
    checkPriorSnapshot();
  }, [startupId]);
  
  return (
    <PageShell>
      {/* Section 1: Header */}
      <h1>pythh signals</h1>
      <p>[{matches.length}] investors aligned with your signals</p>
      
      {/* Section 2: Signal Card */}
      {startupSignal && <StartupSignalCard s={startupSignal} />}
      
      {/* Section 3: Signal Evolution (NEW - only for returning users) */}
      {isReturningUser && signalDelta && (
        <SignalEvolutionSection delta={signalDelta} />
      )}
      
      {/* Section 4: Top 5 Matches */}
      {matches.slice(0, 5).map(m => <InvestorMatchCard key={m.id} match={m} />)}
      
      {/* ... rest unchanged ... */}
    </PageShell>
  );
}
```

### NEW Component: SignalEvolutionSection.tsx (Phase 5)
```tsx
interface SignalDelta {
  phaseDelta: number; // e.g., +0.07 = +7%
  bandChanged: boolean;
  bandFrom: string;
  bandTo: string;
  matchCountDelta: number;
  alignmentDelta: number;
  investorsGained: number;
  investorsLost: number;
  narrative: string;
}

export function SignalEvolutionSection({ delta }: { delta: SignalDelta }) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 p-6 mb-8">
      <div className="flex items-center gap-3 mb-5">
        <TrendingUp className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-semibold text-white">
          Your Signal Movement (Last 7 Days)
        </h2>
      </div>
      
      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {/* Phase change */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60 mb-2">Phase</div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            {delta.phaseDelta > 0 ? (
              <>
                <span className="text-green-400">↑ {Math.abs(delta.phaseDelta * 100).toFixed(0)}%</span>
              </>
            ) : (
              <>
                <span className="text-orange-400">↓ {Math.abs(delta.phaseDelta * 100).toFixed(0)}%</span>
              </>
            )}
          </div>
        </div>
        
        {/* Band change */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60 mb-2">Band</div>
          {delta.bandChanged ? (
            <div className="text-2xl font-bold text-cyan-400">
              {delta.bandFrom} → {delta.bandTo}
            </div>
          ) : (
            <div className="text-2xl font-bold text-white/60">
              {delta.bandTo} (stable)
            </div>
          )}
        </div>
        
        {/* Match count change */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/60 mb-2">Matches</div>
          <div className="text-2xl font-bold text-white flex items-center gap-2">
            {delta.matchCountDelta > 0 ? (
              <span className="text-green-400">+{delta.matchCountDelta}</span>
            ) : delta.matchCountDelta < 0 ? (
              <span className="text-orange-400">{delta.matchCountDelta}</span>
            ) : (
              <span className="text-white/60">—</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Narrative bullets */}
      <div className="space-y-2">
        {delta.investorsGained > 0 && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <span>🔺</span>
            <span>{delta.investorsGained} new investors entered your range</span>
          </div>
        )}
        {delta.investorsLost > 0 && (
          <div className="flex items-center gap-2 text-sm text-orange-400">
            <span>🔻</span>
            <span>{delta.investorsLost} investors dropped (signals weakened)</span>
          </div>
        )}
        {delta.alignmentDelta !== 0 && (
          <div className="flex items-center gap-2 text-sm text-cyan-400">
            <span>⚡</span>
            <span>
              Alignment score {delta.alignmentDelta > 0 ? 'increased' : 'decreased'} {Math.abs(delta.alignmentDelta).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      
      {/* Auto-generated narrative */}
      {delta.narrative && (
        <div className="mt-4 pt-4 border-t border-white/10 text-sm text-white/70">
          {delta.narrative}
        </div>
      )}
    </div>
  );
}
```

---

## Implementation Timeline

### Phase 1-2: Lock Current State (Days 1-2) ✅
- [x] Make numbers big and colorful ✅ DONE
- [x] Add tooltips (not clickable) ✅ DONE
- [ ] Write Product Doctrine doc
- [ ] Freeze results page layout

### Phase 3: Backend Job Model (Days 3-4)
- [ ] Create `startup_jobs` table
- [ ] Refactor convergence to separate submit/results
- [ ] Add progress tracking
- [ ] Return `debug.state` always

### Phase 4: Frontend State Machine (Days 5-6)
- [ ] Convert to explicit JobState type
- [ ] Implement robust polling based on state
- [ ] Eliminate race conditions
- [ ] Add proper error states

### Phase 5: Signal Evolution (Days 7-10)
- [ ] Create `startup_signal_snapshots` table
- [ ] Capture snapshot on each successful match
- [ ] Create `startup_signal_deltas` table
- [ ] Build delta computation service
- [ ] Add SignalEvolutionSection component
- [ ] Show section only for returning users

---

## The Key Principle

**One page. Many sections. Conditional rendering based on:**
1. Backend job state (building vs ready vs failed)
2. User history (first visit vs returning)
3. Signal changes (delta exists vs no prior snapshot)

**NO NEW PAGES UNTIL PHASE 5 IS COMPLETE.**

Then maybe—MAYBE—you add:
- `/signals/history` - Deep dive into signal timeline
- `/signals/compare` - Compare current vs past state

But only after the core instrument is bulletproof.
