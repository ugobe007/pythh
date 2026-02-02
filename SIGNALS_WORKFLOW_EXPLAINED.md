# 🧠 SIGNALS SYSTEM EXPLAINED - Complete Workflow & Implementation Status

**Date:** January 29, 2026  
**Status:** PARTIALLY IMPLEMENTED - Guardrails ready, dimension calculators NOT DEFINED

---

## 🚨 CRITICAL UNDERSTANDING

**You asked how signal categories are weighted and what variables calculate scores from 0.1 to 2.5.**

**The truth is: THE CALCULATION LOGIC DOESN'T EXIST YET.**

What exists:
- ✅ Max points allocated per dimension (2.0, 2.5, 1.5, 2.0, 2.0)
- ✅ Signal names (founder_language_shift, investor_receptivity, etc.)
- ✅ Raw signal data in `startup_signals` table (67,986 signals)
- ❌ **Dimension calculation functions** (HOW to convert raw signals → [0..1] dimension scores)
- ❌ **Signal semantic definitions** (WHAT each dimension actually measures)
- ❌ **Update frequency/recency logic** (WHEN signals decay)
- ❌ **ML agent integration** (ML doesn't read signals yet)

---

## 📊 WHAT THE WEIGHTS MEAN

### The Numbers in Your Selection

From `SIGNALS_STATUS_CLARIFICATION.md`:

```json
{
  "signalMaxPoints": {
    "founder_language_shift": 2.0,      // Max contribution: 2.0 points
    "investor_receptivity": 2.5,        // Max contribution: 2.5 points
    "news_momentum": 1.5,               // Max contribution: 1.5 points
    "capital_convergence": 2.0,         // Max contribution: 2.0 points
    "execution_velocity": 2.0           // Max contribution: 2.0 points
  }
}
```

**These are MAX POINTS, not calculation weights.**

### How They Work (Once Implemented)

Each dimension will be calculated as a **normalized score [0..1]**, then multiplied by its max points:

```typescript
// STEP 1: Calculate dimension (0-1 normalized) - NOT IMPLEMENTED
const founderLanguage = calculateFounderLanguageShift(startup); // Returns 0.0 to 1.0

// STEP 2: Convert to points contribution
const founderPoints = 2.0 * founderLanguage; // 0.0 to 2.0 points

// STEP 3: Sum all dimensions
const signalsBonus = 
  2.0 * founderLanguage +      // 0-2.0 points
  2.5 * investorReceptivity +  // 0-2.5 points
  1.5 * newsMomentum +         // 0-1.5 points
  2.0 * capitalConvergence +   // 0-2.0 points
  2.0 * executionVelocity;     // 0-2.0 points
  // Total: 0-10.0 points

// STEP 4: Clamp and validate
signalsBonus = Math.max(0, Math.min(10, signalsBonus));
```

**The question you're asking is: HOW is `founderLanguage` calculated from raw signals?**

**Answer: UNDEFINED YET.**

---

## 🔍 WHAT EACH SIGNAL DIMENSION MEANS (Proposed Semantics)

### 1. founder_language_shift (2.0 points max)

**Definition:** Changes in how founders position their startup, narrative evolution, messaging clarity.

**Proposed calculation variables (NOT IMPLEMENTED):**
- Frequency of `value_proposition` updates in database
- Sentiment shift in founder statements (requires NLP)
- Clarity/coherence scores from text analysis
- Pivots detected in problem/solution fields
- YC-style clarity ("We are X for Y" format)

**Placeholder implementation:**
```typescript
function calculateFounderLanguageShift(startup) {
  // TODO: Implement actual logic
  return 0.5; // Placeholder - everyone gets 1.0 point (50% of 2.0)
}
```

**What drives this number:**
- Number of text edits to pitch/positioning (higher = more iteration)
- Semantic distance between old/new messaging (bigger shift = higher score)
- Presence of power words ("validated", "traction", "funded")
- Clarity metrics (Flesch reading score, sentence structure)

---

### 2. investor_receptivity (2.5 points max)

**Definition:** VC opinions revealed through writing, investor sentiment, capital market appetite.

**Proposed calculation variables (NOT IMPLEMENTED):**
- Mentions in VC blog posts, tweets, podcasts
- Investor follow-ups tracked in `investor_startup_observers` table
- "Interested" signals from investor interactions
- Sector sentiment from market analysis
- VC firm activity in startup's category

**Placeholder implementation:**
```typescript
function calculateInvestorReceptivity(startup) {
  // TODO: Query investor_startup_observers, vc_faith_signals, etc.
  return 0.5; // Placeholder - everyone gets 1.25 points (50% of 2.5)
}
```

**What drives this number:**
- Count of investors viewing startup profile (from analytics)
- Investor "interest" signals (emails, meetings, intros)
- VC blog mentions of startup or category
- Sector hotness (how many VCs are funding similar companies)
- Faith alignment scores (from `vc_faith_signals` table)

---

### 3. news_momentum (1.5 points max)

**Definition:** External press coverage velocity, media mentions, attention trajectory.

**Proposed calculation variables (NOT IMPLEMENTED):**
- RSS feed mentions (startup name appears in news)
- TechCrunch, The Information, Axios coverage
- Twitter/X mentions and engagement
- Press release recency
- Media source tier (TC = higher weight than random blog)

**Placeholder implementation:**
```typescript
function calculateNewsMomentum(startup) {
  // TODO: Query rss_sources, media mentions, social signals
  return 0.5; // Placeholder - everyone gets 0.75 points (50% of 1.5)
}
```

**What drives this number:**
- Count of news mentions in last 30 days
- Tier of media source (TC = 1.0x, niche blog = 0.3x)
- Recency decay (mentions from yesterday > mentions from 3 weeks ago)
- Sentiment of coverage (positive coverage weighted higher)
- Social amplification (retweets, shares of articles)

---

### 4. capital_convergence (2.0 points max)

**Definition:** Clustering of investor interest signals, multiple VCs circling simultaneously.

**Proposed calculation variables (NOT IMPLEMENTED):**
- Number of unique investors viewing startup in same week
- "FOMO triggers" from `investor_startup_fomo_triggers` view
- Simultaneous intro requests from multiple VCs
- Funding round proximity indicators
- VC firm co-occurrence patterns (Sequoia + a16z both looking = high signal)

**Placeholder implementation:**
```typescript
function calculateCapitalConvergence(startup) {
  // TODO: Query investor_startup_fomo, observers, convergence views
  return 0.5; // Placeholder - everyone gets 1.0 point (50% of 2.0)
}
```

**What drives this number:**
- Unique investor count in 7-day window (5+ = high convergence)
- FOMO ratio from `investor_startup_fomo_triggers` view (signal_24h / signal_7d)
- Simultaneous activity spikes across multiple VCs
- "Hot deal" indicators (multiple term sheets, bidding war signals)
- Sector convergence (many VCs funding similar startups recently)

---

### 5. execution_velocity (2.0 points max)

**Definition:** Development pace, product iteration speed, shipping cadence, momentum.

**Proposed calculation variables (NOT IMPLEMENTED):**
- Product launch frequency (from signals: "launched_feature", "new_product")
- GitHub commit activity (if linked)
- Hiring velocity (team growth rate from `team_signals`)
- Revenue growth trajectory (from `traction_signals`)
- Fundraising velocity (time between rounds)

**Placeholder implementation:**
```typescript
function calculateExecutionVelocity(startup) {
  // TODO: Query startup_signals for launch/hire/growth events
  return 0.5; // Placeholder - everyone gets 1.0 point (50% of 2.0)
}
```

**What drives this number:**
- Signal count in last 30 days (more events = higher velocity)
- Event type diversity (launches + hires + revenue > just hires)
- Acceleration (10 signals this month vs 5 last month = growing velocity)
- Time between key milestones (beta → launch → customers → revenue)
- Team scaling rate (5 → 15 employees in 6 months = high velocity)

---

## 🗄️ SIGNAL DATA SOURCES

### Where Signal Data Lives NOW

**1. startup_signals Table (67,986 signals)**

From `BACKFILL_AND_SCORING_ANALYSIS.md`:
- **Created by:** `scripts/backfill-startup-signals.js` using SignalCascade
- **Coverage:** 5,436 / 5,458 startups (99.6%)
- **Average:** 12.5 signals per startup
- **Signal types extracted:**
  - `funding_*`: amounts, rounds, investors, valuations
  - `traction_*`: users, revenue, growth, customers
  - `team_*`: founders, employees, credentials
  - `product_*`: launches, features, tech stack
  - `market_*`: TAM, competitors, positioning
  - `momentum_*`: press, awards, partnerships

**Schema:**
```sql
CREATE TABLE startup_signals (
  id uuid PRIMARY KEY,
  startup_id uuid REFERENCES startup_uploads(id),
  signal_type text NOT NULL,           -- e.g., "funding_amount", "traction_users"
  weight numeric DEFAULT 1.0,          -- Confidence/importance [0..1]
  occurred_at timestamptz DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb,      -- Additional context
  created_at timestamptz DEFAULT now()
);
```

**Example rows:**
```json
[
  {
    "startup_id": "abc-123",
    "signal_type": "funding_amount",
    "weight": 0.9,
    "occurred_at": "2025-12-15T10:00:00Z",
    "meta": {"value": "$5M", "round": "Series A", "investor": "Sequoia"}
  },
  {
    "startup_id": "abc-123",
    "signal_type": "traction_users",
    "weight": 0.8,
    "occurred_at": "2026-01-10T14:30:00Z",
    "meta": {"value": "10K users", "growth": "2x MoM"}
  }
]
```

**CRITICAL:** This data exists but is **NOT used in GOD scoring yet**.

---

### How Signals Are Updated (Current Workflow)

**Scraping → Parsing → Signal Extraction**

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: RSS/HTML Scraping (Continuous)                     │
│ - mega-scraper.js (PM2 process, runs every 10 min)         │
│ - Discovers startups from TechCrunch, Product Hunt, etc.   │
│ - Stores in: discovered_startups table                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Admin Approval                                      │
│ - Admin reviews discovered_startups                         │
│ - Approves → moves to startup_uploads (status='approved')  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Signal Extraction (SignalCascade)                   │
│ - signalCascade.js processes startup text                   │
│ - Extracts 500+ patterns (funding, traction, team, etc.)   │
│ - Stores in: startup_signals table                         │
│ - Also populates: extracted_data JSONB field              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: GOD Score Calculation (Current - NO SIGNALS)        │
│ - scripts/recalculate-scores.ts (runs hourly via PM2)      │
│ - Uses: startupScoringService.ts (calculateHotScore)       │
│ - Inputs: team_score, traction_score, market_score, etc.   │
│ - Does NOT read startup_signals table                      │
│ - Stores: total_god_score in startup_uploads              │
└─────────────────────────────────────────────────────────────┘
```

**Signal update frequency:**
- **RSS scraping:** Every 10 minutes (mega-scraper PM2 process)
- **Signal extraction:** On-demand when startup approved or re-scraped
- **GOD score calculation:** Every 60 minutes (recalculate-scores PM2 process)

**PROBLEM:** GOD scoring doesn't read `startup_signals` table, so signals don't affect scores yet.

---

## 🤖 ML AGENT STATUS

### Does ML Use Signals?

**SHORT ANSWER: NO (not yet)**

**Current ML Agent Workflow:**

From `DATA_TO_GOD_SCORE_FLOW.md` and `mlTrainingService.ts`:

```
┌─────────────────────────────────────────────────────────────┐
│ ML AGENT (server/services/mlTrainingService.ts)             │
│                                                             │
│ EXPECTED DATA SOURCE:                                       │
│ - match_feedback table (invested, passed, interested)      │
│ - Match outcome predictions                                 │
│                                                             │
│ ACTUAL DATA SOURCE:                                         │
│ - NOTHING - match_feedback table is EMPTY                  │
│ - No training data available                                │
│                                                             │
│ CURRENT STATUS:                                             │
│ - Not making recommendations (confidence 0%)                │
│ - Not adjusting GOD weights                                 │
│ - Not using startup_signals table                          │
└─────────────────────────────────────────────────────────────┘
```

**Relevant code from `mlTrainingService.ts`:**

```typescript
// CURRENT: ML tries to learn from match outcomes (but table is empty)
export async function collectTrainingData(): Promise<SignalTrainingData[]> {
  const { data: matches } = await supabase
    .from('match_feedback')  // ❌ EMPTY TABLE
    .select('*')
    .in('outcome', ['invested', 'interested']);
  
  // No data → no training → no recommendations
  return [];
}
```

**What ML SHOULD do (proposed):**

```typescript
// PROPOSED: ML learns from signal quality, not match outcomes
export async function collectTrainingDataFromSignals(): Promise<SignalTrainingData[]> {
  // Option 1: High-signal startups that got funded
  const { data: fundedStartups } = await supabase
    .from('startup_uploads')
    .select('*, startup_signals(*)')
    .contains('funding_signals', ['series_a', 'series_b']);
  
  // Option 2: High GOD score + high signal count correlation
  const { data: highQuality } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .gte('total_god_score', 80);
  
  // Analyze: Do certain signal types predict high GOD scores?
  // Adjust signalMaxPoints weights based on correlation
}
```

**Bottom line:** ML agent doesn't currently use signals because:
1. It's designed to learn from match feedback (which doesn't exist)
2. No integration with `startup_signals` table yet
3. No training pipeline for signal-based learning

---

## 🔄 COMPLETE WORKFLOW (Current vs Proposed)

### CURRENT WORKFLOW (As of Jan 29, 2026)

```
RSS Sources → mega-scraper.js (every 10 min)
                    ↓
          discovered_startups table
                    ↓
            Admin Approval
                    ↓
          startup_uploads (status='approved')
                    ↓
     ┌──────────────┴──────────────┐
     │                             │
     ▼                             ▼
signalCascade.js          recalculate-scores.ts (every 60 min)
     │                             │
     ▼                             ▼
startup_signals table      total_god_score field
(67,986 signals)           (uses calculateHotScore)
     │                             │
     └─────────────────────────────┘
              NOT CONNECTED

ML Agent (mlTrainingService.ts)
     │
     ▼
match_feedback table (EMPTY)
     │
     ▼
No training → No recommendations
```

**Key issues:**
- ✅ Signals are extracted and stored
- ❌ GOD scoring doesn't read signals
- ❌ ML agent doesn't train on signals
- ❌ No signal decay/recency logic
- ❌ No dimension calculators

---

### PROPOSED WORKFLOW (After Implementation)

```
RSS Sources → mega-scraper.js (every 10 min)
                    ↓
          discovered_startups table
                    ↓
            Admin Approval
                    ↓
          startup_uploads (status='approved')
                    ↓
     ┌──────────────┴──────────────┐
     │                             │
     ▼                             ▼
signalCascade.js          recalculate-scores.ts (every 60 min)
     │                             │
     ▼                             │
startup_signals table             │
(continuously updated)            │
     │                             │
     ├─────────────────────────────┤
     │                             │
     ▼                             ▼
Signal Dimension Calculators  Load runtime weights from DB
     │                             │
     ├→ founder_language_shift     │
     ├→ investor_receptivity       │
     ├→ news_momentum              │
     ├→ capital_convergence        │
     └→ execution_velocity         │
             │                     │
             └──────────┬──────────┘
                        ▼
              Compute signals_bonus (0-10)
                        │
                        ├→ base_god_score (fundamentals)
                        ├→ signals_bonus (psychology)
                        └→ total_score (clamped 0-100)
                        │
                        ▼
              Store in god_score_explanations
                        │
                        ├→ base_total_score
                        ├→ signals_bonus
                        ├→ signals_dimensions (raw [0..1] values)
                        ├→ signals_weights_used (max points)
                        └→ signals_contract_version: "signals_v1"
                        │
                        ▼
          Update startup_uploads.total_god_score
                        │
                        ▼
              Regenerate investor matches
                        │
                        ▼
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
ML Agent (NEW data source)    Admin Health Dashboard
        │                               │
        ├→ Train on signal quality      ├→ Monitor signal distribution
        ├→ Correlate signals → funding  ├→ Check bonus cap (<=10)
        ├→ Adjust signalMaxPoints       └→ Audit score explanations
        └→ Recommend weight changes
```

**New components needed:**
1. ✅ Database guardrails (ready to deploy)
2. ❌ Signal dimension calculators (5 functions)
3. ❌ Scorer integration (update recalculate-scores.ts)
4. ❌ ML agent retargeting (use signals instead of match feedback)
5. ❌ Recency/confidence gating logic
6. ❌ Admin dashboard for signal monitoring

---

## 🛠️ IMPLEMENTATION CHECKLIST

### PHASE 1: Database Guardrails (READY)
- ✅ Migration: `server/migrations/20260129_god_guardrails.sql`
- ✅ Seed data: `server/migrations/20260129_god_guardrails_seed.sql`
- ✅ API routes: `server/routes/god.js`
- ✅ Rollback script: `scripts/god-rollback.js`
- ✅ Freeze script: `scripts/god-freeze.js`
- ✅ Golden tests: `scripts/test-god-golden.js`
- ✅ CI workflow: `.github/workflows/god-golden.yml`

**User action:** Run migrations in Supabase SQL Editor

---

### PHASE 2: Signal Dimension Calculators (NOT STARTED)

**What needs to be built:**

```typescript
// FILE: server/services/signalDimensionCalculators.ts

import { supabase } from '../config/supabase';

/**
 * Calculate founder_language_shift dimension [0..1]
 * 
 * Variables:
 * - Frequency of value_proposition updates
 * - Sentiment clarity (NLP if available)
 * - Presence of power words
 * - Pivot detection
 * 
 * @param startup - Startup object with history
 * @returns Normalized score [0..1]
 */
export function calculateFounderLanguageShift(startup: any): number {
  // TODO: Implement actual logic
  
  // Example pseudocode:
  // 1. Count edits to value_proposition, problem, solution fields
  // 2. Analyze semantic distance between versions
  // 3. Detect power words ("validated", "traction", "funded")
  // 4. Score clarity (Flesch reading ease, sentence structure)
  // 5. Normalize to [0..1]
  
  return 0.5; // Placeholder
}

/**
 * Calculate investor_receptivity dimension [0..1]
 * 
 * Variables:
 * - investor_startup_observers activity
 * - vc_faith_signals matches
 * - Sector sentiment
 * - VC blog/tweet mentions
 * 
 * @param startup - Startup object
 * @returns Normalized score [0..1]
 */
export async function calculateInvestorReceptivity(startup: any): Promise<number> {
  // TODO: Query investor activity
  
  // Example pseudocode:
  // 1. Query investor_startup_observers for this startup
  // 2. Count unique investors viewing in last 30 days
  // 3. Check vc_faith_signals for alignment matches
  // 4. Normalize to [0..1] based on investor count thresholds
  
  return 0.5; // Placeholder
}

/**
 * Calculate news_momentum dimension [0..1]
 * 
 * Variables:
 * - RSS feed mentions
 * - Media source tier (TC > blog)
 * - Recency decay
 * - Social amplification
 * 
 * @param startup - Startup object
 * @returns Normalized score [0..1]
 */
export async function calculateNewsMomentum(startup: any): Promise<number> {
  // TODO: Query news mentions
  
  // Example pseudocode:
  // 1. Search rss_sources for startup name mentions
  // 2. Weight by source tier (TechCrunch = 1.0x, blog = 0.3x)
  // 3. Apply recency decay (exponential, half-life ~14 days)
  // 4. Normalize to [0..1]
  
  return 0.5; // Placeholder
}

/**
 * Calculate capital_convergence dimension [0..1]
 * 
 * Variables:
 * - investor_startup_fomo_triggers
 * - Unique investor count in time window
 * - FOMO ratio (24h / 7d signal strength)
 * - Co-occurrence patterns
 * 
 * @param startup - Startup object
 * @returns Normalized score [0..1]
 */
export async function calculateCapitalConvergence(startup: any): Promise<number> {
  // TODO: Query convergence views
  
  // Example pseudocode:
  // 1. Query investor_startup_fomo_triggers for FOMO ratio
  // 2. Count unique investors in 7-day window
  // 3. Check for simultaneous activity spikes
  // 4. Normalize to [0..1] (5+ investors = high convergence)
  
  return 0.5; // Placeholder
}

/**
 * Calculate execution_velocity dimension [0..1]
 * 
 * Variables:
 * - startup_signals event count
 * - Event type diversity
 * - Acceleration (current vs previous period)
 * - Milestone velocity
 * 
 * @param startup - Startup object
 * @returns Normalized score [0..1]
 */
export async function calculateExecutionVelocity(startup: any): Promise<number> {
  // TODO: Query startup_signals
  
  // Example pseudocode:
  // 1. Count signals in last 30 days (launches, hires, revenue events)
  // 2. Calculate diversity (how many different signal types?)
  // 3. Compare to previous 30 days (acceleration factor)
  // 4. Normalize to [0..1] (10+ signals = high velocity)
  
  const { data: signals } = await supabase
    .from('startup_signals')
    .select('*')
    .eq('startup_id', startup.id)
    .gte('occurred_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  const signalCount = signals?.length || 0;
  const velocity = Math.min(signalCount / 10, 1.0); // Normalize: 10+ signals = 1.0
  
  return velocity;
}

/**
 * Calculate recency multiplier for signal gating
 * Decays stale signals exponentially (half-life ~30 days)
 */
export function calculateRecencyMultiplier(startup: any): number {
  // TODO: Implement recency decay
  // Example: If most recent signal was 60 days ago, multiply by ~0.25
  return 1.0; // Placeholder (no decay)
}

/**
 * Calculate confidence multiplier for signal gating
 * Reduces contribution from low-confidence signals
 */
export function calculateConfidenceMultiplier(startup: any): number {
  // TODO: Aggregate confidence from startup_signals.weight
  // Average weight across all signals for this startup
  return 1.0; // Placeholder (no confidence adjustment)
}
```

**User action:** Implement these 7 functions with actual logic

---

### PHASE 3: Scorer Integration (NOT STARTED)

**What needs to be modified:**

```typescript
// FILE: scripts/recalculate-scores.ts

// ADD: Import signal dimension calculators
import {
  calculateFounderLanguageShift,
  calculateInvestorReceptivity,
  calculateNewsMomentum,
  calculateCapitalConvergence,
  calculateExecutionVelocity,
  calculateRecencyMultiplier,
  calculateConfidenceMultiplier
} from '../server/services/signalDimensionCalculators';

// MODIFY: scoreStartup function to include signals
async function scoreStartup(startup) {
  // STEP 1: Load runtime weights from DB
  const { data: runtime } = await supabase.rpc('get_god_runtime');
  const effectiveVersion = runtime.effective_weights_version;
  
  // Check freeze status
  if (runtime.freeze) {
    console.log('⚠️  GOD scoring is FROZEN - skipping recalculation');
    return null; // Skip scoring
  }
  
  // Load weights blob
  const { data: version } = await supabase
    .from('god_weight_versions')
    .select('weights')
    .eq('weights_version', effectiveVersion)
    .single();
  
  const weights = version.weights;
  
  // STEP 2: Compute BASE GOD (fundamentals only, no signals)
  const baseGodScore = computeBaseGOD(startup, weights);
  
  // STEP 3: Compute SIGNALS BONUS (market psychology, capped at 10)
  const signalDimensions = {
    founderLanguage: calculateFounderLanguageShift(startup),
    investorReceptivity: await calculateInvestorReceptivity(startup),
    newsMomentum: await calculateNewsMomentum(startup),
    capitalConvergence: await calculateCapitalConvergence(startup),
    executionVelocity: await calculateExecutionVelocity(startup)
  };
  
  // Apply recency and confidence gating
  const recencyMultiplier = calculateRecencyMultiplier(startup);
  const confidenceMultiplier = calculateConfidenceMultiplier(startup);
  
  // Compute signals_bonus (each dimension contributes up to its max points)
  let signalsBonus =
    weights.signalMaxPoints.founder_language_shift * signalDimensions.founderLanguage +
    weights.signalMaxPoints.investor_receptivity * signalDimensions.investorReceptivity +
    weights.signalMaxPoints.news_momentum * signalDimensions.newsMomentum +
    weights.signalMaxPoints.capital_convergence * signalDimensions.capitalConvergence +
    weights.signalMaxPoints.execution_velocity * signalDimensions.executionVelocity;
  
  // Apply gating multipliers
  signalsBonus = signalsBonus * recencyMultiplier * confidenceMultiplier;
  
  // Round to 1 decimal
  signalsBonus = Math.round(signalsBonus * 10) / 10;
  
  // HARD CLAMP (defensive programming)
  signalsBonus = Math.max(0, Math.min(10, signalsBonus));
  
  // RUNTIME INVARIANT (copilot-proof)
  if (signalsBonus < 0 || signalsBonus > 10) {
    throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signalsBonus}`);
  }
  
  // STEP 4: Final GOD score
  const totalScore = Math.min(100, baseGodScore + signalsBonus);
  
  // STEP 5: Store explanation
  await supabase.from('god_score_explanations').insert({
    startup_id: startup.id,
    weights_version: effectiveVersion,
    base_total_score: baseGodScore,
    signals_bonus: signalsBonus,
    total_score: totalScore,
    component_scores: {
      team: startup.team_score,
      traction: startup.traction_score,
      market: startup.market_score,
      product: startup.product_score,
      vision: startup.vision_score
    },
    signals_dimensions: {
      founder_language_shift: signalDimensions.founderLanguage,
      investor_receptivity: signalDimensions.investorReceptivity,
      news_momentum: signalDimensions.newsMomentum,
      capital_convergence: signalDimensions.capitalConvergence,
      execution_velocity: signalDimensions.executionVelocity
    },
    signals_weights_used: weights.signalMaxPoints,
    signals_contract_version: weights.signals_contract_version
  });
  
  // STEP 6: Update startup_uploads.total_god_score
  await supabase
    .from('startup_uploads')
    .update({ total_god_score: totalScore })
    .eq('id', startup.id);
  
  return { baseGodScore, signalsBonus, totalScore };
}
```

**User action:** Integrate template code into `scripts/recalculate-scores.ts`

---

### PHASE 4: ML Agent Retargeting (NOT STARTED)

**What needs to be changed:**

```typescript
// FILE: server/services/mlTrainingService.ts

// OLD: Train on match feedback (doesn't exist)
export async function collectTrainingData(): Promise<SignalTrainingData[]> {
  const { data: matches } = await supabase
    .from('match_feedback')  // ❌ EMPTY
    .select('*');
  // ...
}

// NEW: Train on signal quality and funding outcomes
export async function collectTrainingDataFromSignals(): Promise<SignalTrainingData[]> {
  // Get startups with high signal quality that got funded
  const { data: fundedStartups } = await supabase
    .from('startup_uploads')
    .select(`
      id,
      name,
      total_god_score,
      team_score,
      traction_score,
      market_score,
      product_score,
      vision_score,
      startup_signals!inner (
        signal_type,
        weight,
        occurred_at
      )
    `)
    .contains('funding_signals', ['series_a', 'series_b', 'series_c']);
  
  // Analyze: Which signal types correlate with funding success?
  // Recommend: Adjust signalMaxPoints based on correlation
  
  return fundedStartups.map(startup => ({
    startup_id: startup.id,
    signal_count: startup.startup_signals.length,
    avg_signal_weight: startup.startup_signals.reduce((sum, s) => sum + s.weight, 0) / startup.startup_signals.length,
    god_score: startup.total_god_score,
    funded: true
  }));
}

// NEW: Generate weight recommendations based on signal correlation
export async function generateSignalWeightRecommendations() {
  const trainingData = await collectTrainingDataFromSignals();
  
  // Analyze which dimensions correlate with success
  // Example: If high news_momentum correlates with funding, increase its max points
  
  // Return recommendations for admin review
  return {
    recommended_weights: {
      founder_language_shift: 2.0,
      investor_receptivity: 2.5,
      news_momentum: 2.0,  // Increased from 1.5
      capital_convergence: 2.0,
      execution_velocity: 1.5  // Decreased from 2.0
    },
    confidence: 0.75,
    reasoning: 'News momentum correlates strongly with Series A funding (r=0.68)'
  };
}
```

**User action:** Retarget ML agent to use signals instead of match feedback

---

## 📋 SUMMARY ANSWERS TO YOUR QUESTIONS

### 1. How are we weighing signal categories?

**Answer:** We've allocated MAX POINTS per category (2.0, 2.5, 1.5, 2.0, 2.0), but the **calculation logic doesn't exist yet**. Each category will be normalized to [0..1], then multiplied by its max points.

---

### 2. What variables calculate scores from 0.1 to 2.5?

**Answer:** UNDEFINED. The dimension calculator functions are placeholders returning 0.5. You need to define:
- How to measure founder_language_shift (text edits, clarity metrics, power words)
- How to measure investor_receptivity (investor views, faith alignment, VC mentions)
- How to measure news_momentum (RSS mentions, media tier, recency decay)
- How to measure capital_convergence (investor clustering, FOMO triggers)
- How to measure execution_velocity (signal count, milestone velocity, acceleration)

---

### 3. What are the factors driving these numbers?

**Answer:** Proposed factors (NOT IMPLEMENTED):
- **founder_language_shift:** Value prop updates, semantic shifts, clarity scores, pivots
- **investor_receptivity:** Investor views, faith signals, VC blog mentions, sector sentiment
- **news_momentum:** RSS mentions, media tier weights, recency decay, social amplification
- **capital_convergence:** Unique investor count, FOMO ratio, simultaneous activity, co-occurrence
- **execution_velocity:** Signal count (launches, hires), event diversity, acceleration, milestone pace

---

### 4. Do I understand what these signals mean?

**Answer:** I understand the **proposed semantics** (definitions above), but the **implementation doesn't exist**. The meanings are defined in documentation (SIGNALS CONTRACT v1), but the code to measure them is placeholder.

---

### 5. Are signals updated frequently based on new scraper data?

**Answer:** YES for extraction, NO for scoring:
- ✅ `startup_signals` table is updated whenever new data is scraped (every 10 min via mega-scraper)
- ✅ SignalCascade extracts signals and stores them (67,986 signals exist)
- ❌ GOD scoring doesn't read `startup_signals` yet, so scores don't update based on new signals
- ❌ No recency decay implemented (stale signals don't lose weight)

---

### 6. How does ML agent read signals?

**Answer:** IT DOESN'T (yet). ML agent (`mlTrainingService.ts`) is designed to learn from match feedback, which doesn't exist. Needs to be retargeted to learn from signal quality and funding outcomes.

---

### 7. What is the workflow?

**CURRENT (No signals in scoring):**
```
Scraper → Parsing → Signal Extraction → startup_signals table (67,986 signals)
                                                   ↓ (NOT CONNECTED)
                     GOD Scoring ← recalculate-scores.ts (no signals)
```

**PROPOSED (After implementation):**
```
Scraper → Parsing → Signal Extraction → startup_signals table
                              ↓
                   Dimension Calculators (5 functions)
                              ↓
                   signals_bonus [0..10]
                              ↓
                   base_god + signals_bonus = total_god
                              ↓
                   Store explanation (with dimensions, weights, contract version)
                              ↓
                   ML Agent learns from signal quality
```

---

## 🚦 NEXT STEPS

**To make signals actually work:**

1. ✅ **Deploy guardrails** - Run migrations (you can do this now)
2. ❌ **Define dimension calculators** - Implement 5 calculation functions (requires domain knowledge)
3. ❌ **Integrate scorer** - Update `recalculate-scores.ts` with signals logic
4. ❌ **Test on subset** - Run on 10-20 startups, review explanation payloads
5. ❌ **Retarget ML agent** - Train on signal quality instead of match feedback
6. ❌ **Full recalculation** - Apply to all 5,458 startups
7. ❌ **Monitor via Guardian** - System Guardian will enforce 0-10 cap

**Critical decision needed:** How do you want to define each dimension calculator? What data sources should each one use?

---

*Created: January 29, 2026*  
*Status: Guardrails ready, dimension calculators NOT IMPLEMENTED*
