# 🔄 Signals Context Layer — Option B Refactor Plan

## Strategic Intent

**Current State:**
- `/signals` is a generic macro dashboard (competing narrative)
- Explains sector trends at the market level
- Implies: "Signals = market trends product"

**After Refactor:**
- `/signals-context` becomes a post-Radar subordinate layer
- Answers: "What changed in the market that moved your odds?"
- Implies: "Signals = personal capital navigation (with market context)"
- Radar remains the hero product

---

## Product IA: Navigation Hierarchy

```
Radar (canonical entry)
  ↓
  [Startup scans → reveal → tracking]
  ├─ User clicks "Why did my odds move?" → /signals-context?startup_id={id}
  └─ Right rail → "Explain my alignment" → /signals-context
     ↓
     Signals Context (post-Radar, subordinate)
     ├─ Hero: "Here's what changed in the market..."
     ├─ Causal cards: Sector belief shifts (with YOUR impact)
     ├─ Investor receptivity: Derived from same sources as Radar
     └─ CTA: "← Back to my signal"
```

**Hard rule:**
- `/signals-context` is only reachable FROM Radar
- Not a primary navigation destination
- Not a public "marketing" surface
- Not discoverable from homepage

---

## Step 1: Rename Route + Redirect Legacy Traffic

### In `src/App.tsx`:

```typescript
// OLD
<Route path="/signals" element={<Signals />} />

// NEW
<Route path="/signals-context" element={<SignalsContext />} />

// LEGACY: Redirect old /signals → /signals-radar (Radar is the new hero)
<Route path="/signals" element={<Navigate to="/signals-radar" replace />} />
```

### Update import:
```typescript
import SignalsContext from './pages/app/SignalsContext';
```

---

## Step 2: Rewrite Component (`src/pages/app/SignalsContext.tsx`)

### New semantic structure:

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { createApiDataSource } from '../../pithh/dataSource';
import { getRuntimeConfig } from '../../pithh/runtimeConfig';

export default function SignalsContext() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract startup_id + state from navigation
  const { startup_id, cursor, power, window } = location.state || {};
  
  // ✅ If user landed here without Radar context, bounce back
  if (!startup_id) {
    return (
      <div className="... text-center">
        <h2>This view requires a startup scan.</h2>
        <button onClick={() => navigate('/signals-radar')}>
          Start your signal scan
        </button>
      </div>
    );
  }

  // Hero section (new copy)
  const heroSection = (
    <section className="...">
      <h1>Here's what changed in the market that moved your odds.</h1>
      <p>We decode belief shifts that altered your fundraising window and investor alignment.</p>
      <button onClick={() => navigate(-1)}>← Back to my signal</button>
    </section>
  );

  // Causal contributor cards (replaces static trend cards)
  // Each card now shows impact ON THIS STARTUP
  
  return (
    <PageShell>
      {heroSection}
      {causalContributorCards}
      {investorReceptivityDerived}
      {backLink}
    </PageShell>
  );
}
```

---

## Step 3: Replace Static Trend Cards with Causal Contributors

### Design Pattern:

**Before (static):**
```
Vertical AI
Accelerating
GOD: 82, Align: 87%, Window: Opening
```

**After (causal, personalized):**
```
VERTICAL AI
Market belief shift: Accelerating

Impact on you:
  Alignment +4
  Velocity +3
  Opportunity +2

Why:
  • 3 new funds added AI Ops to mandate
  • Two comparables raised seed extensions
  • Enterprise adoption accelerating
```

### Code structure:

```tsx
interface CausalContributor {
  sector: string;
  belief_shift: string;        // "Accelerating" | "Peak window" | etc.
  impact_on_you: {
    alignment_delta: number;
    velocity_delta: number;
    opportunity_delta: number;
  };
  contributed_by: string[];     // List of evidence items
}

function CausalContributorCard({ contributor, onExplain }) {
  return (
    <div className="...">
      <h3>{contributor.sector}</h3>
      <p>Market belief shift: {contributor.belief_shift}</p>
      <div>
        <strong>Impact on you:</strong>
        <li>Alignment {contributor.impact_on_you.alignment_delta > 0 ? '+' : ''}{contributor.impact_on_you.alignment_delta}</li>
        <li>Velocity +{contributor.impact_on_you.velocity_delta}</li>
      </div>
      <small>Why: {contributor.contributed_by.join('; ')}</small>
    </div>
  );
}
```

---

## Step 4: Wire Backend (Reuse Existing Contracts)

### Key insight:
This screen **does NOT need new backend endpoints**.
It consumes the same data source as Radar:

```typescript
// In SignalsContext.tsx

async function loadMarketContext() {
  const cfg = await getRuntimeConfig();
  const dataSource = createApiDataSource(cfg.apiBase);
  
  // Use same endpoint as Radar tracking
  const trackingDelta = await dataSource.pollTracking({
    startup_id,
    cursor,  // Get deltas since last Radar update
  });
  
  // Extract causal contributors from channels + deltas
  const contributors = deriveCausalContributors(
    trackingDelta.channels,
    trackingDelta.feed,
    trackingDelta.radar
  );
  
  return {
    contributors,
    investor_receptivity: deriveReceptivity(trackingDelta),
    power_change: calculatePowerDelta(power, trackingDelta),
  };
}

// Helper: extract causal narrative from deltas
function deriveCausalContributors(channels, feed, radar) {
  // For each channel with recent deltas
  // Construct: "X sector belief shift moved you +N"
  
  const contributors = [];
  
  Object.entries(channels).forEach(([sector, channelData]) => {
    if (channelData.recent_deltas.length > 0) {
      contributors.push({
        sector,
        belief_shift: channelData.direction,  // "Accelerating" etc.
        impact_on_you: {
          alignment_delta: channelData.recent_deltas.reduce((sum, d) => sum + (d.alignment_change || 0), 0),
          velocity_delta: channelData.recent_deltas.reduce((sum, d) => sum + (d.velocity_change || 0), 0),
          opportunity_delta: channelData.recent_deltas.reduce((sum, d) => sum + (d.opportunity_change || 0), 0),
        },
        contributed_by: channelData.recent_deltas.map(d => d.narrative),
      });
    }
  });
  
  return contributors;
}
```

---

## Step 5: Investor Receptivity (Now Derived, Not Static)

### Current behavior:
```
Investor Receptivity
73%
Funds currently warming up to new deals.
```

### New behavior:
This is **derived from the same features** used to compute Radar alignment:

```typescript
function deriveReceptivity(trackingDelta) {
  // Receptivity = average alignment of target investors
  const alignmentScores = trackingDelta.channels.map(ch => ch.alignment);
  const avgAlignment = alignmentScores.reduce((a, b) => a + b, 0) / alignmentScores.length;
  
  // Normalize to 0–100%
  const receptivity = Math.round(avgAlignment);
  
  return {
    percentage: receptivity,
    narrative: describeReceptivity(receptivity),
    derived_from: 'Same investor alignment features as your Power Score',
  };
}

function describeReceptivity(pct) {
  if (pct >= 80) return "🔥 Funds actively seeking your category";
  if (pct >= 60) return "✅ Strong receptivity to your thesis";
  if (pct >= 40) return "⏳ Growing interest, but not yet peak";
  return "🚧 Low current receptivity—timing matters";
}
```

---

## Step 6: Add Backlink to Radar State

### Pass state from Radar → SignalsContext:

```typescript
// In SignalRadarPage.tsx (tracking mode)

function handleExplainOddsMoved() {
  navigate('/signals-context', {
    state: {
      startup_id: vm.startup.id,
      cursor: pageState.tracking_cursor,
      power: vm.panels.power?.score,
      window: vm.panels.fundraisingWindow?.status,
      last_scan_time: new Date().toISOString(),
    },
  });
}

// Add button in RightRail or Hero
<button onClick={handleExplainOddsMoved}>
  Explain my alignment changes
</button>
```

### Display in SignalsContext header:

```tsx
<div className="text-xs text-white/60">
  Since your last scan ({formatTimeAgo(last_scan_time)}),
  these market shifts contributed {power.delta > 0 ? '+' : ''}{power.delta} to your Power Score.
</div>
```

---

## Step 7: Update Navigation in RightRail + Hero

### In `SignalRadarPage.tsx` (right rail):

```tsx
<button
  onClick={() => navigate('/signals-context', { state: radarState })}
  className="... text-sm"
>
  Why did my odds move?
</button>
```

### In hero (if user asks for context):

```tsx
const contextButtonVisible = vm.mode === 'tracking' || vm.mode === 'reveal';

{contextButtonVisible && (
  <button onClick={handleExplainOddsMoved}>
    Understand these signals
  </button>
)}
```

---

## Step 8: Enforce Radar-First Entry

### In SignalsContext.tsx:

```tsx
useEffect(() => {
  // If landing here without startup_id, redirect
  if (!startup_id) {
    const timer = setTimeout(() => {
      navigate('/signals-radar', {
        replace: true,
        state: { reason: 'signals_context_requires_radar' },
      });
    }, 3000);
    
    return () => clearTimeout(timer);
  }
}, [startup_id, navigate]);
```

---

## Implementation Checklist

- [ ] Rename `/signals` → `/signals-context` route
- [ ] Redirect old `/signals` → `/signals-radar`
- [ ] Create `src/pages/app/SignalsContext.tsx` (new component)
- [ ] Rewrite hero section copy
- [ ] Implement `deriveCausalContributors()` helper
- [ ] Implement `deriveReceptivity()` helper
- [ ] Add Radar → SignalsContext navigation in RightRail
- [ ] Add backlink in hero: "← Back to my signal"
- [ ] Pass startup state through navigation
- [ ] Test: Cannot reach `/signals-context` without startup_id
- [ ] Test: Data flows correctly from Radar tracking deltas
- [ ] Test: Causal cards update when channels change
- [ ] Update any other navigation links to `/signals` (→ `/signals-radar`)

---

## API Integration (Zero New Endpoints)

| Endpoint | Used By | Purpose |
|----------|---------|---------|
| `GET /api/v1/startups/{id}/tracking` | SignalsContext | Fetch deltas since last cursor |
| (derived) | SignalsContext | Extract causal contributors |
| (derived) | SignalsContext | Calculate investor receptivity |

**No new backend work required.** Reuses Radar's polling contract exactly.

---

## Copy & Messaging

### Hero Section

**Before:**
> "Signals show where capital is going next."
> "We decode investor belief shifts before deal flow follows."

**After:**
> "Here's what changed in the market that moved your odds."
> "We decode belief shifts that altered your fundraising window and investor alignment."

### CTA Buttons

**Before:**
- "View live signals"
- "How this predicts funding"

**After:**
- "← Back to my signal"
- "Explain my alignment changes" (in Radar)

### Card Copy

**Before (generic):**
```
Vertical AI
Accelerating
GOD: 82, Align: 87%, Window: Opening
```

**After (personalized):**
```
VERTICAL AI
Market belief shift: Accelerating

Impact on you:
  Alignment +4
  Velocity +3
  Opportunity +2
```

---

## Strategic Outcome

✅ **Radar remains the hero** (canonical entry, personal, action-generating)
✅ **SignalsContext becomes subordinate** (post-Radar, explanatory, contextual)
✅ **No narrative competition** (clear hierarchy, consistent messaging)
✅ **Same backend** (zero new API work, reuses tracking deltas)
✅ **No user confusion** (can only reach from Radar, contextually relevant)

---

*Ready to execute. No deferral. No documentation-only patch.*
