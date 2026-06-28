# Phase Change Engine (PCE) - Complete Documentation

## 🎯 Purpose

The Phase Change Engine is **not a feature**—it's a **core inference layer** that detects, scores, and compounds multidimensional phase transitions to surface Goldilocks startups before consensus.

**Core Insight:** Most systems ask "How good is this startup?" This system asks "How fast is this system changing state—and in the right direction?"

That's how:
- Okay becomes amazing
- Messy becomes inevitable  
- Weird becomes obvious later

---

## 📐 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    PHASE CHANGE ENGINE                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUTS (Detection Layer)                                        │
│  ├─ RSS/Scraper signals                                         │
│  ├─ GitHub activity                                             │
│  ├─ LinkedIn/Team changes                                       │
│  ├─ Crunchbase/Funding data                                     │
│  └─ Inference enrichment                                        │
│                    ↓                                            │
│  PHASE DETECTION (5 Domains)                                    │
│  ├─ Product: Pivots, feature collapse, usage concentration     │
│  ├─ Capital: Institutional leads, conviction rounds            │
│  ├─ Human: Cofounder joins, domain experts (HIGHEST ALPHA)     │
│  ├─ Customer: First dependency, expansions, workflow lock-in   │
│  └─ Market: Regulation unlocks, cost curve flips               │
│                    ↓                                            │
│  PHYSICS SCORING                                                │
│  ├─ Magnitude: How much future expanded?                       │
│  ├─ Irreversibility: Can they go back?                         │
│  ├─ Velocity: Speed of execution                               │
│  ├─ Coupling: Downstream activations                           │
│  ├─ Confidence: Signal quality                                 │
│  └─ Directionality: Positive or negative? (-1 to +1)           │
│                    ↓                                            │
│  PHASE VELOCITY INDEX (PVI)                                     │
│  ├─ PVI_24h: Short-term acceleration                           │
│  ├─ PVI_7d: Medium-term momentum                               │
│  ├─ Domains activated: Multidimensionality                     │
│  ├─ Irreversibility average: Commitment depth                  │
│  └─ Acceleration ratio: Is velocity increasing?                │
│                    ↓                                            │
│  GOLDILOCKS STATE MACHINE                                       │
│  ├─ quiet: Baseline                                            │
│  ├─ watch: Early signals                                       │
│  ├─ warming: Multiple domains firing                           │
│  ├─ surge: High velocity + irreversibility                     │
│  └─ breakout: 3+ domains, accelerating, high PVI               │
│                    ↓                                            │
│  PHASE CHANGE MULTIPLIER (PCM)                                  │
│  └─ Adjusted_GOD = Base_GOD × PCM (1.0 - 3.1x)                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Core Tables

#### `startup_phase_changes`
The canonical state transition ledger.

```sql
CREATE TABLE startup_phase_changes (
  id uuid PRIMARY KEY,
  startup_id uuid REFERENCES startup_uploads(id),
  
  -- Classification
  domain phase_domain NOT NULL,  -- 'product'|'capital'|'human'|'customer'|'market'
  subtype text NOT NULL,         -- e.g. 'technical_cofounder_joined'
  
  -- Temporal
  detected_at timestamptz,       -- When we detected it
  effective_at timestamptz,      -- When it actually happened
  
  -- Physics (0.0-1.0 unless noted)
  magnitude numeric,             -- Future expansion
  irreversibility numeric,       -- Can they reverse?
  velocity numeric,              -- Execution speed
  coupling numeric,              -- Downstream effects
  confidence numeric,            -- Signal quality
  directionality numeric,        -- Direction (-1 to +1)
  
  -- Evidence
  evidence jsonb,                -- Sources, artifacts, signals
  fingerprint text,              -- Deduplication
  is_active boolean DEFAULT true
);
```

#### `phase_detection_queue`
Async processing queue for detection jobs.

```sql
CREATE TABLE phase_detection_queue (
  id uuid PRIMARY KEY,
  startup_id uuid REFERENCES startup_uploads(id),
  trigger_source text,           -- 'rss_update', 'github_commit', etc.
  trigger_data jsonb,
  status text DEFAULT 'pending', -- 'pending'|'processing'|'completed'|'failed'
  priority integer CHECK (priority BETWEEN 1 AND 10),
  attempts integer DEFAULT 0,
  error_message text
);
```

### Views & Functions

#### `startup_phase_ledger`
Clean timeline view of all active phase changes with calculated scores.

#### `startup_phase_velocity`
Rolling PVI calculations (24h and 7d windows):
- `pvi_24h`: Short-term acceleration
- `pvi_7d`: Primary momentum metric
- `domains_7d`: Multidimensionality (max 5)
- `avg_irrev_7d`: Average irreversibility
- `pvi_accel_ratio`: Acceleration trend

#### `startup_goldilocks_phase_triggers`
State classification based on PVI thresholds:

| State | Criteria |
|-------|----------|
| **breakout** | domains_7d ≥ 3, avg_irrev ≥ 0.55, accel ≥ 2.5, pvi_7d ≥ 3.5 |
| **surge** | domains_7d ≥ 2, avg_irrev ≥ 0.45, accel ≥ 1.8, pvi_7d ≥ 2.3 |
| **warming** | domains_7d ≥ 2, pvi_7d ≥ 1.3 |
| **watch** | pvi_7d ≥ 0.6 |
| **quiet** | Below watch threshold |

#### `startup_phase_multiplier`
Calculates Phase Change Multiplier (PCM) per startup:

```sql
PCM = 1.0 
    + min(0.85, pvi_7d × 0.12)           -- PVI lift
    + min(0.40, (domains_7d - 1) × 0.15) -- Multidomain bonus
    + min(0.35, avg_irrev × 0.35)        -- Irreversibility bonus
    + min(0.50, (accel - 1) × 0.12)      -- Acceleration bonus
```

**Range:** 1.0 (no phase activity) to ~3.1 (extreme breakout)

#### `calculate_phase_adjusted_god(startup_id)`
Function to get phase-adjusted GOD score:

```
Adjusted_GOD = Base_GOD × PCM
```

---

## 🔍 Phase Domains

### 1. Product Phase Changes
**State transitions in problem/solution alignment**

Subtypes:
- `pivot_icp_narrowed`: Narrower targeting
- `feature_collapse`: Simplification to core
- `architecture_simplification`: Technical streamlining
- `usage_concentration_spike`: PMF signal
- `viral_loop_activation`: Growth mechanism engaged

**Detection Sources:**
- Website copy diffs
- Docs/README changes
- Changelog entropy
- Git graph topology

### 2. Capital Phase Changes
**Entropy extension + market belief shift**

⚠️ **Key Rule:** Capital is only a phase change if it buys new futures, not just time.

Subtypes:
- `first_institutional_lead`: First VC backing
- `conviction_round`: Strategic capital
- `valuation_discontinuity`: >3x step-up
- `strategic_capital`: Operator investor

**Detection Sources:**
- Crunchbase/SEC filings
- Press releases
- Investor announcements

### 3. Human Phase Changes (HIGHEST ALPHA 🔥)
**Multiplicative capability shifts**

**Why This Matters:** Humans are constraint-destroyers. One person can change the entire phase space.

Subtypes:
- `technical_cofounder_joined`: Engineering capability unlocked
- `operator_joins_visionary`: Execution acceleration
- `domain_expert_joined`: Category knowledge acquired
- `high_reputation_advisor_engaged`: Network + validation

**Detection Sources:**
- LinkedIn job changes
- GitHub contributor activity
- Team page updates
- Equity filing signals

### 4. Customer Phase Changes
**Irreversibility begins here**

⚠️ **Key Rule:** Revenue is optional. Dependence is not.

Subtypes:
- `first_non_friendly_customer`: Organic validation
- `first_workflow_dependency`: Can't live without it
- `first_expansion_within_account`: Deeper integration
- `first_customer_led_referral`: Organic virality

**Detection Sources:**
- Case studies
- Testimonials
- Logo pages
- Usage analytics

### 5. Market Phase Changes
**Exogenous constraint shifts**

Subtypes:
- `regulation_unlocks`: Policy changes
- `cost_curve_flip`: Infrastructure becomes viable
- `infrastructure_arrives`: New primitives available
- `cultural_adoption_threshold`: Mainstream acceptance

**Detection Sources:**
- News feeds
- Industry reports
- Regulation databases

---

## 📊 Physics Scoring (The Secret Sauce)

Each phase change is scored on **6 physical properties**:

### 1. Magnitude (0.0 - 1.0)
**How much did the reachable future expand?**
- 0.1-0.3: Minor optimization
- 0.4-0.6: Strategy-altering shift
- 0.7-0.9: Category-defining shift
- 1.0: Market-creating shift

### 2. Irreversibility (0.0 - 1.0)
**Can the startup go back?**
- 0.0-0.3: Cosmetic, easily reversed
- 0.4-0.6: Costly to reverse
- 0.7-0.9: Reputation-locking, structural
- 1.0: Regulations, hard commitments

**Goldilocks startups cross irreversible boundaries early.**

### 3. Velocity (0.0 - 1.0)
**How fast did signal → decision → outcome occur?**
- 0.0-0.3: Slow, hesitant
- 0.4-0.6: Normal pace
- 0.7-0.9: Rapid adaptation
- 1.0: Near-instant execution

### 4. Coupling (0.0 - 1.0)
**Did this phase change trigger others?**

Examples:
- Cofounder join → product acceleration → capital interest
- Customer win → investor inbound → hiring burst

**This is where nonlinearity emerges.**

### 5. Confidence (0.0 - 1.0)
**Signal quality & verification strength**
- 0.0-0.3: Single soft signal
- 0.4-0.6: Multiple corroborating signals
- 0.7-0.9: Hard artifacts (code, filings)
- 1.0: Official announcements, verified

### 6. Directionality (-1.0 - +1.0)
**Did it improve odds?**
- -1.0 to -0.5: Negative transition (cofounder exit, pivot away from PMF)
- -0.5 to 0.0: Uncertain direction
- 0.0 to 0.5: Mildly positive
- 0.5 to 1.0: Strongly positive

**Directionality Gates the Score:**
```
Final Score = Base Physics Score × Directionality Multiplier

Where directionality multiplier:
  dir ≤ -0.50 → 0.10x (severe penalty)
  dir ≤  0.00 → 0.60x (mild penalty)
  dir ≤  0.50 → 1.00x (neutral)
  dir >  0.50 → 1.25x (amplification)
```

### Combined Phase Score

```sql
phase_score = 
  (magnitude × 0.30 +
   irreversibility × 0.25 +
   velocity × 0.20 +
   coupling × 0.15 +
   confidence × 0.10)
  × directionality_multiplier
```

---

## 🚀 Installation & Setup

### 1. Run Database Migration

```bash
# In Supabase SQL Editor, run:
/migrations/create_phase_change_engine.sql
```

### 2. Verify Installation

```sql
-- Check tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%phase%';

-- Check views exist
SELECT viewname FROM pg_views WHERE schemaname = 'public' AND viewname LIKE '%phase%';

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE '%phase%';
```

### 3. Insert Test Data

```bash
# Get a real startup ID from your database first
psql -d your_database -c "SELECT id, name FROM startup_uploads LIMIT 5;"

# Edit test script and replace UUIDs
nano scripts/test-phase-change-engine.sql

# Run test script
psql -d your_database -f scripts/test-phase-change-engine.sql
```

### 4. Run Phase-GOD Integration

```bash
# Recalculate phase-adjusted GOD scores
node server/services/phaseGodIntegration.js update

# View top startups by phase-adjusted score
node server/services/phaseGodIntegration.js top 50

# View Goldilocks candidates
node server/services/phaseGodIntegration.js goldilocks
```

---

## 🔧 Usage Examples

### Insert a Phase Change

```javascript
const phaseChange = {
  startup_id: '550e8400-e29b-41d4-a716-446655440000',
  domain: 'human',
  subtype: 'technical_cofounder_joined',
  magnitude: 0.85,
  irreversibility: 0.75,
  velocity: 0.80,
  coupling: 0.45,
  confidence: 0.85,
  directionality: 0.70,
  evidence: {
    sources: ['linkedin', 'github'],
    artifacts: ['https://linkedin.com/in/cto', 'https://github.com/...'],
    signals: ['Former Stripe senior eng', '50+ commits in first week']
  },
  fingerprint: 'human:technical_cofounder:v1'
};

await supabase.from('startup_phase_changes').insert(phaseChange);
```

### Query Phase Velocity

```sql
SELECT 
  su.name,
  spv.pvi_7d,
  spv.domains_7d,
  spv.pvi_accel_ratio,
  sgpt.goldilocks_phase_state
FROM startup_uploads su
JOIN startup_phase_velocity spv ON su.id = spv.startup_id
JOIN startup_goldilocks_phase_triggers sgpt ON su.id = sgpt.startup_id
WHERE sgpt.goldilocks_phase_state IN ('surge', 'breakout')
ORDER BY spv.pvi_7d DESC
LIMIT 20;
```

### Get Phase Timeline

```sql
SELECT * FROM get_phase_timeline('550e8400-e29b-41d4-a716-446655440000');
```

### Calculate Phase-Adjusted GOD

```sql
SELECT calculate_phase_adjusted_god('550e8400-e29b-41d4-a716-446655440000');
```

---

## 🎨 Frontend Integration (Next Steps)

### Phase Timeline Component

Location: `src/components/PhaseTimeline.tsx`

**Features:**
- Visual timeline of phase changes
- Domain color-coding
- Phase score indicators
- Evidence tooltips
- Goldilocks state badge

### PVI Dashboard Widget

Location: `src/components/PhaseVelocityWidget.tsx`

**Displays:**
- Current PVI (7d)
- Goldilocks state (quiet → breakout)
- Domains activated (pie chart)
- Acceleration trend (sparkline)

### Goldilocks Candidate List

Location: `src/pages/GoldilocksCandidates.tsx`

**Table columns:**
- Startup name
- Phase-adjusted GOD score
- Goldilocks state
- PVI_7d
- Domains active
- Recent phase changes

---

## 🔬 Next Detectors to Build

### Priority 1: Website Diff Detector
**Triggers:** Product pivots, ICP narrowing, pricing changes

```javascript
// Pseudo-code
async function detectWebsiteDiff(startup_id, old_html, new_html) {
  const diff = calculateDiff(old_html, new_html);
  
  if (diff.messaging_change > 0.6) {
    return createPhaseChange({
      domain: 'product',
      subtype: 'pivot_icp_narrowed',
      magnitude: 0.65,
      evidence: { signals: diff.key_changes }
    });
  }
}
```

### Priority 2: Human/Team Detector
**Triggers:** Cofounder joins, advisor engagement, key hires

```javascript
async function detectTeamChange(startup_id, linkedin_event) {
  if (linkedin_event.title.includes('Co-Founder') && 
      linkedin_event.background.includes('technical')) {
    return createPhaseChange({
      domain: 'human',
      subtype: 'technical_cofounder_joined',
      magnitude: 0.85,
      irreversibility: 0.75
    });
  }
}
```

### Priority 3: Customer Proof Detector
**Triggers:** Case studies, logos, testimonials, expansions

### Priority 4: Capital Events Detector
**Triggers:** Funding rounds, valuation changes, strategic investors

---

## 📈 Tuning Thresholds

Current Goldilocks thresholds are **starter defaults**. Tune based on backtests:

```sql
-- In startup_goldilocks_phase_triggers view
CASE
  WHEN domains_7d >= 3          -- Adjust: 2-4
   AND avg_irrev_7d >= 0.55     -- Adjust: 0.45-0.65
   AND pvi_accel_ratio >= 2.5   -- Adjust: 2.0-3.0
   AND pvi_7d >= 3.5            -- Adjust: 3.0-4.0
  THEN 'breakout'
  ...
```

**Tuning Process:**
1. Backtest on known breakout startups
2. Calculate precision/recall for each state
3. Adjust thresholds to maximize signal/noise
4. Document threshold reasoning

---

## 🧪 Testing & Validation

### Unit Tests
```bash
npm test -- phaseDetectionService.test.ts
npm test -- phaseVelocityIndex.test.ts
```

### Integration Tests
```bash
# Run full detection cycle
node scripts/test-phase-detection-cycle.js

# Expected output:
# ✅ 7 phases detected
# ✅ PVI calculated
# ✅ Goldilocks state: 'surge'
# ✅ PCM: 1.67x
```

### Backtest Against Known Cohorts
```bash
# Test against known breakout startups
node scripts/backtest-phase-engine.js --cohort=yc_w23_breakouts

# Expected:
# Precision: >80%
# Recall: >70%
# Lead time: 3-12 months before consensus
```

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| [migrations/create_phase_change_engine.sql](../migrations/create_phase_change_engine.sql) | Core database schema |
| [scripts/test-phase-change-engine.sql](../scripts/test-phase-change-engine.sql) | Test data insertion |
| [src/types/phaseChange.ts](../src/types/phaseChange.ts) | TypeScript type definitions |
| [src/services/phaseDetectionService.ts](../src/services/phaseDetectionService.ts) | Detection heuristics |
| [server/services/phaseGodIntegration.js](../server/services/phaseGodIntegration.js) | GOD score integration |

---

## 🎯 Success Metrics

### Leading Indicators
- Phase changes detected per week
- Detection latency (event → detection time)
- Goldilocks candidate precision

### Lagging Indicators
- Goldilocks → Funding conversion rate (should be >40%)
- Lead time vs consensus (should be 3-12 months)
- Phase-adjusted GOD score predictive power

---

## ⚠️ Important Notes

1. **This is not event tracking.** We're capturing state transitions with physical properties.

2. **Directionality matters.** Not all changes are positive. Cofounder exits, failed pivots, and customer churn are negative phase changes.

3. **Coupling is nonlinear.** One phase change can trigger cascades. This is where alpha hides.

4. **The discomfort is the signal.** PCE will surface startups that look "too early" or "too weird." That's the point.

5. **Humans are highest alpha.** Human phase changes (domain 'human') are the most predictive. One great hire changes everything.

---

## 🚀 Roadmap

### ✅ Phase 1: Foundation (Complete)
- [x] Database schema
- [x] Type definitions
- [x] Physics scoring function
- [x] PVI calculation
- [x] Goldilocks state machine
- [x] PCM calculation
- [x] Test data scripts

### 🔄 Phase 2: Detection Layer (In Progress)
- [ ] Website diff detector
- [ ] Human/team detector
- [ ] Customer proof detector
- [ ] Capital events detector
- [ ] Market signals detector

### 📅 Phase 3: Integration
- [ ] Phase Timeline UI component
- [ ] PVI dashboard widget
- [ ] Goldilocks candidate page
- [ ] Admin detection testing tools
- [ ] PM2 background processor

### 📅 Phase 4: Optimization
- [ ] Backtest against known cohorts
- [ ] Threshold tuning
- [ ] Coupling detection refinement
- [ ] ML-enhanced detection
- [ ] Real-time alerting

---

## 💡 Key Insights

### Why This Works

Most systems ask: **"How good is this startup?"**

This system asks: **"How fast is this system changing state—and in the right direction?"**

That's the difference between:
- Static assessment → Dynamic trajectory
- Current quality → Future potential
- Observable → Leading indicator

### The Goldilocks Zone

Goldilocks startups are in a specific state:
1. ✅ Multiple phase domains activated
2. ✅ Irreversible transitions present
3. ✅ Phase velocity accelerating
4. ✅ External validation (sophisticated actors involved)
5. ✅ **Still pre-consensus** (valuation/visibility lagging)

This is the moment to surface them.

### The Physics Metaphor

Phase transitions in physics:
- Water → steam (energy input + temperature threshold)
- Startup → breakout (capability unlocks + momentum)

Both exhibit:
- Threshold effects (nonlinear)
- Irreversibility (hard to reverse)
- Energy concentration (focused effort)
- State change (qualitatively different)

We're detecting the startup equivalent of "water about to boil."

---

**Status:** ✅ Core engine complete. Ready for detector implementation and UI integration.

**Next Action:** Build Website Diff Detector or run test data insertion.

**Questions?** Check the SQL comments or TypeScript types for implementation details.
