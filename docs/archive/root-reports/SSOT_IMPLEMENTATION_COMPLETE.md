# ✅ SSOT Implementation Complete

## What We Built

Implemented **Single Source of Truth (SSOT)** architecture for the Pythh Dashboard to eliminate data drift and prepare for real backend integration.

## Architecture Overview

```
┌────────────────────────────────────────────────────┐
│                   Dashboard                        │
│                                                    │
│  useSignalSnapshot() ← One hook, one source      │
│         ↓                                          │
│    SignalSnapshot (SSOT)                          │
│         ↓                                          │
│  ┌──────────────────────────────────────┐        │
│  │  All tabs consume snapshot           │        │
│  │  • SignalBar (snapshot)              │        │
│  │  • OverviewTab (snapshot)            │        │
│  │  • SignalsTab (snapshot)             │        │
│  │  • OddsTab (snapshot)                │        │
│  │  • ActionsTab (snapshot)             │        │
│  └──────────────────────────────────────┘        │
└────────────────────────────────────────────────────┘

BEFORE (Drift-Prone):
Each tab had its own mock data → different truths

AFTER (SSOT):
One snapshot → all tabs render the same truth
```

## Files Created

### 1. **Type Definitions** - [src/types/snapshot.ts](src/types/snapshot.ts) (182 lines)
Complete TypeScript type system for the entire dashboard:

```typescript
export type Mode = "Estimate" | "Verified";
export type Momentum = "Cooling" | "Stable" | "Warming" | "Surge";
export type SignalStrength = "Low" | "Medium" | "High";
export type TimingWindow = "Closed" | "Opening" | "Active" | "Closing";

export interface SignalSnapshot {
  startupId?: string;
  startupUrl?: string;
  computedAt: string;
  
  // Signal bar state
  stage: string;
  momentum: Momentum;
  signalStrength: SignalStrength;
  category: string;
  timingWindow: TimingWindow;
  mode: Mode;
  
  // Signal data
  startupSignals: StartupSignal[];
  investorSignals: InvestorSignal[];
  marketSignals: MarketSignal[];
  
  // Probability engine
  odds: Odds;
  
  // Actions
  actions: {
    priority: ActionItem[];
    attenuation: AttenuationControls;
    unlockPreview: UnlockPreview;
  };
}
```

**Key types:**
- `EvidenceItem` - Provenance tracking for signals
- `StartupSignal` - Product, traction, team signals
- `InvestorSignal` - Thesis alignment, deployment phase
- `MarketSignal` - Category momentum, capital rotation
- `Odds` - Probability calculations (readiness, alignment, objections, timing)
- `ActionItem` - Actions with probability deltas and investor unlocks
- `UnlockPreview` - Future state projection

### 2. **Mock Data Builder** - [src/services/snapshot/mock.ts](src/services/snapshot/mock.ts) (130 lines)
Generates sample SignalSnapshot for development:

```typescript
export function buildMockSnapshot(): SignalSnapshot {
  return {
    stage: "Seed",
    momentum: "Warming",
    signalStrength: "High",
    category: "Energy Infra",
    timingWindow: "Opening",
    mode: "Estimate",
    
    startupSignals: [
      { kind: "Product", name: "Product Velocity", strength: "Strong", trend: "↑", ... },
      // 7 total signals
    ],
    
    investorSignals: [
      { kind: "Thesis", name: "Thesis Alignment", status: "Favorable", trend: "↑", ... },
      // 5 total signals
    ],
    
    marketSignals: [
      { kind: "Category", name: "Category Momentum", status: "Rising", trend: "↑", ... },
      // 5 total signals
    ],
    
    odds: {
      readinessScore: 72,
      readinessTrendDelta7d: 6,
      breakdown: { execution: 82, traction: 61, narrative: 68, marketTiming: 77 },
      alignment: { thesis: 78, stage: 71, signal: 64, timing: 81, overall: 74 },
      objections: [...],
      timing: { status: "Opening", etaText: "4-8 weeks", progressPct: 45 }
    },
    
    actions: {
      priority: [
        {
          id: 1,
          title: "Strengthen customer proof",
          probabilityDeltaPct: 14,
          investorsUnlocked: 12,
          objectionsReduced: 2,
          // ... full action data
        },
        // 4 total priority actions
      ],
      attenuation: { narrative: [...], traction: [...], team: [...] },
      unlockPreview: {
        alignmentStrengthPct: 82,
        alignmentDeltaPct: 8,
        timingWindowAfter: "Active",
        investorsUnlockedTotal: 27,
        leadProbabilityDeltaPct: 19
      }
    }
  };
}
```

### 3. **API Client** - [src/services/snapshot/client.ts](src/services/snapshot/client.ts) (18 lines)
Abstraction layer for snapshot computation:

```typescript
export async function computeSnapshot(input: {
  startupUrl?: string;
  startupId?: string;
  mode: Mode;
}): Promise<SignalSnapshot> {
  // v0: Returns mock data
  const snapshot = buildMockSnapshot();
  return {
    ...snapshot,
    startupUrl: input.startupUrl,
    startupId: input.startupId,
    mode: input.mode,
    computedAt: new Date().toISOString(),
  };
  
  // Future: POST to /api/snapshot/compute
  // const res = await fetch('/api/snapshot/compute', {
  //   method: 'POST',
  //   body: JSON.stringify(input),
  // });
  // return res.json();
}
```

### 4. **React Hook** - [src/hooks/useSignalSnapshot.ts](src/hooks/useSignalSnapshot.ts) (35 lines)
React integration for snapshot consumption:

```typescript
export function useSignalSnapshot(params: {
  startupUrl?: string;
  startupId?: string;
  mode: Mode;
}) {
  const [snapshot, setSnapshot] = useState<SignalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    async function compute() {
      try {
        setLoading(true);
        setError(null);
        const result = await computeSnapshot(params);
        if (!cancelled) setSnapshot(result);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    
    compute();
    return () => { cancelled = true; };
  }, [JSON.stringify(params)]);

  return { snapshot, loading, error };
}
```

## Files Updated

### Components Migrated to SSOT

1. **[src/pages/Dashboard/SignalBar.tsx](src/pages/Dashboard/SignalBar.tsx)** (95 lines) ✅
   - Now accepts: `snapshot: Pick<SignalSnapshot, 'stage' | 'momentum' | 'signalStrength' | 'category' | 'timingWindow' | 'mode'>`
   - Removed: Individual prop drilling

2. **[src/pages/Dashboard/tabs/SignalsTab.tsx](src/pages/Dashboard/tabs/SignalsTab.tsx)** (167 lines) ✅
   - Now accepts: `snapshot: SignalSnapshot`
   - Consumes: `snapshot.startupSignals`, `snapshot.investorSignals`, `snapshot.marketSignals`
   - Removed: Local mock data

3. **[src/pages/Dashboard/tabs/OddsTab.tsx](src/pages/Dashboard/tabs/OddsTab.tsx)** (183 lines) ✅
   - Now accepts: `snapshot: SignalSnapshot`
   - Consumes: `snapshot.odds.readinessScore`, `snapshot.odds.breakdown`, `snapshot.odds.alignment`
   - Removed: Hardcoded scores (72, 82, 61, etc.)

4. **[src/pages/Dashboard/tabs/ActionsTab.tsx](src/pages/Dashboard/tabs/ActionsTab.tsx)** (171 lines) ✅
   - Now accepts: `snapshot: SignalSnapshot`
   - Consumes: `snapshot.actions.priority`, `snapshot.actions.attenuation`, `snapshot.actions.unlockPreview`
   - Uses: `probabilityDeltaPct` instead of hardcoded `impact` strings
   - Removed: 70+ lines of local mock data

5. **[src/pages/Dashboard/tabs/OverviewTab.tsx](src/pages/Dashboard/tabs/OverviewTab.tsx)** (138 lines) ✅
   - Now accepts: `snapshot: SignalSnapshot`
   - Consumes: `snapshot.stage`, `snapshot.momentum`, `snapshot.odds.alignment.overall`
   - Removed: Hardcoded "Seed", "Warming", "74%" values

6. **[src/pages/Dashboard/index.tsx](src/pages/Dashboard/index.tsx)** (137 lines) ✅
   - Added: `useSignalSnapshot()` hook call
   - Added: Loading and error states
   - Passes: `snapshot` prop to all tabs
   - Removed: `signalBarData` mock object

## Key Benefits

### ✅ No More Drift
**Before:** Each tab computed its own truth → divergent data  
**After:** One snapshot → guaranteed consistency

### ✅ Easy Data Refresh
**Before:** Update 5 files to change one number  
**After:** Change `buildMockSnapshot()` once → all tabs update

### ✅ Clear Data Flow
```
useSignalSnapshot() → snapshot → tabs (pure renderers)
```
No ambiguity about where data comes from.

### ✅ Testable
Mock snapshot in one place, test all tabs with known data.

### ✅ Backend-Ready
To integrate real backend:
1. Implement `POST /api/snapshot/compute` endpoint
2. Update `computeSnapshot()` in [client.ts](src/services/snapshot/client.ts)
3. Done. No tab changes needed.

## Build Verification

```bash
✓ 3140 modules transformed
dist/index.html                     1.61 kB │ gzip:   0.59 kB
dist/assets/index-T1EpDn7a.css    231.16 kB │ gzip:  28.53 kB
dist/assets/index-Bmyw2QnK.js   3,506.83 kB │ gzip: 817.03 kB
✓ built in 5.03s
```

**Status:** ✅ All components compile successfully  
**Bundle size:** 3.5MB (similar to pre-SSOT build)

## SSOT Rules (Enforced)

1. **SSOT Rule:** Only `SignalSnapshot` is truth. No tab computes.
2. **Evidence Rule:** Key signals/actions include `evidence[]` array (even if light v0).
3. **Probability Delta Rule:** Every action shows `probabilityDeltaPct`, `timeToImpact`, `investorsUnlocked`, `objectionsReduced`.

## What's Next (Week 1 Priorities)

### 1. **InvestorsTab** (THE VALUE UNLOCK)
Create alignment-first investor list:
- Default sort: `alignment_score × timing_score × conviction_score`
- Each row shows: alignment score + "why", stage fit, timing, likely objections, best narrative angle
- Expandable drawer: why aligned, signals they respond to, what they'll challenge, unlocks if you fix X, warm intro paths
- **Goal:** "This understands motives, not just lists names"

### 2. **OpportunitiesTab** (THE DIFFERENTIATOR)
Create timing-aware opportunity feed:
- Sections: Opening windows (30 days), New thesis entrants, Portfolio gaps, Category momentum spikes
- Each card: Trigger signal(s), Cause, Expected duration, Recommended action
- **Goal:** "Not reactive fundraising — timed fundraising"

### 3. **HistoryTab** (THE PROOF)
Create signal memory timeline:
- Signal trends over time
- Odds trend over time
- Actions completed + resulting deltas
- When the window opened
- **Goal:** "Defensibility + trust. It's real."

### 4. **Demo Mode** (THE MOMENT)
Implement before/after animation:
- User pastes URL → snapshot computes
- Show "Before" Odds
- Click one Action ("Reframe narrative toward infra thesis")
- UI animates: Alignment ↑, Timing Window → Opening, Investors unlocked +X
- Show 3 investors appear that were hidden
- **Goal:** Concrete before/after demonstration

### 5. **Real Backend Endpoint**
Implement `POST /api/snapshot/compute`:
- Input: `{ startup_url | startup_id, mode }`
- Output: `SignalSnapshot`
- Start v0 with deterministic heuristics + existing DB artifacts
- Include clear "confidence" flags
- **Rule:** Keep the UI dumb. UI renders; backend decides.

## Code Architecture

```
src/
├── types/
│   └── snapshot.ts              # All SSOT types (Mode, Momentum, SignalSnapshot, etc.)
│
├── services/snapshot/
│   ├── mock.ts                  # buildMockSnapshot() - dev/demo data
│   └── client.ts                # computeSnapshot() - API abstraction
│
├── hooks/
│   └── useSignalSnapshot.ts     # React hook with loading/error states
│
└── pages/Dashboard/
    ├── index.tsx                # Calls useSignalSnapshot(), passes to tabs
    ├── SignalBar.tsx            # Consumes snapshot (stage, momentum, etc.)
    └── tabs/
        ├── OverviewTab.tsx      # Consumes snapshot (odds, timing)
        ├── SignalsTab.tsx       # Consumes snapshot (startup/investor/market signals)
        ├── OddsTab.tsx          # Consumes snapshot (odds.readinessScore, breakdown)
        └── ActionsTab.tsx       # Consumes snapshot (actions.priority, attenuation, unlockPreview)
```

## Usage Example

```typescript
// Dashboard component
const { snapshot, loading, error } = useSignalSnapshot({
  startupUrl: "https://acme.com",
  mode: "Estimate"
});

if (loading) return <div>Computing signals...</div>;
if (error) return <div>Error: {error}</div>;

return (
  <>
    <SignalBar snapshot={snapshot} />
    <OverviewTab snapshot={snapshot} />
    <SignalsTab snapshot={snapshot} />
    <OddsTab snapshot={snapshot} />
    <ActionsTab snapshot={snapshot} />
  </>
);

// Tab component (pure renderer)
function OddsTab({ snapshot }: { snapshot: SignalSnapshot }) {
  return (
    <div>
      <h1>Readiness: {snapshot.odds.readinessScore}/100</h1>
      <p>Alignment: {snapshot.odds.alignment.overall}%</p>
    </div>
  );
}
```

## Migration Summary

**Before:**
- 5 tabs with independent mock data
- ~150 lines of duplicate data definitions
- Drift risk as features evolve
- Hard to test (each tab needs mocking)

**After:**
- 5 tabs consuming one snapshot
- 1 source of truth (buildMockSnapshot)
- Zero drift (one object, all tabs read it)
- Easy to test (mock snapshot once)

**Lines Changed:**
- Created: 365 lines (types, services, hook)
- Updated: 714 lines (6 component files)
- Removed: ~150 lines (duplicate mock data)
- **Net:** +929 lines (architecture investment)

**Build Time:** 5.03s (no performance impact)

## Developer Experience

### To add a new signal:
1. Add to `StartupSignal` type in [snapshot.ts](src/types/snapshot.ts)
2. Add to `buildMockSnapshot()` in [mock.ts](src/services/snapshot/mock.ts)
3. UI automatically renders it (no tab changes needed)

### To update dashboard data:
1. Change `buildMockSnapshot()` once
2. All tabs update automatically
3. No drift possible

### To integrate backend:
1. Implement `/api/snapshot/compute` endpoint
2. Update `computeSnapshot()` to POST instead of returning mock
3. Done. Zero UI changes.

---

**Status:** ✅ SSOT Implementation Complete  
**Build:** ✅ Passing (5.03s)  
**Drift Risk:** ❌ Eliminated  
**Backend-Ready:** ✅ Yes (swap computeSnapshot implementation)

**Next Step:** Build InvestorsTab (Week 1 priority)
