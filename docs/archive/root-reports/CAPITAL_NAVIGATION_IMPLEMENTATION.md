# Capital Navigation System - Implementation Spec

**Date**: January 19, 2026  
**Status**: Production-grade blueprint  
**Purpose**: Complete implementation guide for the Capital Navigation Triad

---

## 🎯 Core Invariants (Must Always Be True)

### Invariant 1: Orientation Before Information
**Rule**: Triad must render before investors, charts, or coaching.

**Why**: Founders must know WHERE they are, WHAT's happening, and WHERE capital is going before seeing any investor names.

**Implementation**: Load triad first, progressively fill values, investors load after.

### Invariant 2: States Move Slower Than Emotions
**Rule**: Capital moves daily/weekly, not hourly like founder emotions.

| Layer | Min Update Interval | Max Downgrade Speed |
|-------|-------------------|-------------------|
| Position | 24h | 2 windows required |
| Flow | 6-12h | 2 windows required |
| Trajectory | 12-24h | 3 windows required |

**Hysteresis Logic**:
```javascript
if (new_state_weaker_than_old) {
  require_consecutive_windows = layer === 'trajectory' ? 3 : 2;
  if (consecutive_weak_readings < require_consecutive_windows) {
    return old_state; // Don't downgrade yet
  }
}
```

### Invariant 3: Breakout Must Feel Rare
**Rule**: Only top 3-7% of active startups can be "Strongly Incoming" at any time.

**Stage-Segmented Constraint** (Production Implementation):
```javascript
// Segment by stage to keep breakout meaningful within founder's reality
const stageBucket = startup.stage in ['pre-seed', 'seed'] ? 'early' : 
                    startup.stage === 'series-a' ? 'series-a' : 'growth';

// Percentile within stage bucket over rolling 30 days
const percentile = percentile_rank(
  phase_change_score,
  population_window: '30d',
  segment: {stage: stageBucket, sector: startup.sector}
);

if (percentile < 0.93) {
  cap_direction_at('Incoming'); // Never "Strongly Incoming"
}
```

**Why**: Breakout must be rare within stage, not across entire universe, or late-stage will dominate.

### Invariant 4: Truthful Uncertainty
**Rule**: Confidence must be explicit when signal quality is low.

**Confidence Badge** (Global, always visible):
```javascript
const confidence = 
  signal_quality < 0.45 ? 'Low' :
  signal_quality < 0.65 ? 'Medium' : 'High';
```

**Gating Rules**:
- Direction cannot be "Strongly Incoming" unless Confidence = High
- Forecast must show "low confidence" and widen the window when Confidence < Medium
- If Confidence = Low, show: "Early signals — more data needed for precision"

**Display**:
```
Confidence: High
```

**Why**: Prevents founder betrayal when predictions fail. Trust requires honesty about uncertainty.

---

## 🧭 Column 1: YOUR POSITION

### Purpose
Answer: **"Where am I standing on the ice?"**

### Metrics (in order)
1. **Position Badge** (primary, most important)
2. **Observers (7d)**
3. **Capital Momentum**
4. **Comparable Tier**

### Position Badge Calculation

**Inputs**:
- `GOD_normalized` (0-1)
- `momentum_state` (0-1)
- `observer_density_norm` (0-1)
- `flow_alignment` (0-1)

**Formula**:
```javascript
position_score = 
  0.35 * GOD_normalized +
  0.25 * flow_alignment +
  0.20 * momentum_norm +
  0.20 * observer_density_norm
```

**States**:
| State | Score Range | Meaning |
|-------|------------|---------|
| Invisible | < 0.25 | No signals, no attention |
| Emerging | 0.25-0.45 | Early signals forming |
| Aligned | 0.45-0.65 | Positioned in active flow |
| Hot | 0.65-0.82 | Breakout + strong alignment |
| Crowded | > 0.82 AND high crowd_density | Strong flow but heavy competition |

**Special Rule**: "Crowded" only allowed if Flow is Surging/Saturated.

**Display**:
```
Position: Aligned & Accelerating
```

**Tooltip**:
```
Your current location in the capital landscape
```

### Capital Momentum
Rename FOMO states to fit navigation model.

**States**: Watch → Warming → Surge → Breakout

**Display**:
```
Capital Momentum: Breakout
```

**Tooltip**:
```
Measures acceleration in investor intent signals
```

---

## 🌊 Column 2: CAPITAL FLOW (NOW)

### Purpose
Answer: **"What is happening around me right now?"**

### Metrics
1. **Flow State** (primary badge)
2. **Active Investors** (visible / total)
3. **Latest Signal Age**
4. **Crowd Density**

### Flow State Calculation

**Inputs**:
- `signal_24h`
- `signal_7d`
- `accel_ratio`
- `signal_quality`
- `distinct_investors`

**Formula**:
```javascript
flow_score = 
  0.40 * normalize(signal_24h) +
  0.30 * normalize(accel_ratio) +
  0.20 * signal_quality +
  0.10 * normalize(distinct_investors)

// CANONICAL NORMALIZER (use everywhere)
function normalize(value, metric_name) {
  // Percentile rank within segment over 30-day window
  return percentile_rank(
    value,
    population_window: '30d',
    segment: {stage: startup.stage_bucket, sector: startup.sector},
    metric: metric_name
  ); // Returns 0..1
}

// Why: Prevents drift, keeps "Surging" consistent, makes breakout enforceable
```

**States**:
| State | Flow Score | Meaning |
|-------|-----------|---------|
| Quiet | < 0.20 | No meaningful capital movement |
| Forming | 0.20-0.35 | Early signals clustering |
| Concentrating | 0.35-0.55 | Investors entering |
| Surging | 0.55-0.75 | Rapid acceleration |
| Saturated | > 0.75 | Heavy traffic, crowded |

**Display**:
```
Flow: Concentrating
```

**Always-On Heartbeat** (critical for trust):
```
Latest intent trace: 4 hours ago
```

**Tooltip**:
```
Current direction and density of investor attention around this startup.
Signals represent investor intent. Fresh traces = active discovery.
```

**Why**: This line is the heartbeat of the system. Prevents "stale dashboard syndrome."

### Crowd Density
**Formula** (Production-Safe):
```javascript
// Option 1: Simple, stable (RECOMMENDED)
crowd_density = total_investors / Math.max(1, distinct_investors)

// Interpretation: "How many candidates exist per actual unique observer?"
// Thresholds:
// Low: < 5 candidates per observer
// Medium: 5-15
// High: > 15
```

**States**: Low / Medium / High

**Purpose**: 
- Anti-FOMO honesty
- Later pricing tiers
- Institutional analytics

**Why this formula**: Mixing raw count with normalized value creates drift. This keeps density stable as distributions change.

---

## 🚀 Column 3: CAPITAL TRAJECTORY (NEXT)

### Purpose
Answer: **"Where is the puck going?"**

### Metrics
1. **Direction Badge** (crown jewel)
2. **Trajectory Speed**
3. **Forecast Window**
4. **Outreach Probability**

### Direction Badge Calculation (EXTREMELY CONSERVATIVE)

**Inputs**:
- `slope_7d` (signal slope over 7 days)
- `slope_24h` (signal slope over 24 hours)
- `phase_change_score`
- `decay_adjusted_momentum`

**Trend Formula**:
```javascript
trend = (slope_24h / slope_7d) * phase_change_score * recency_decay
```

**States**:
| Direction | Conditions | Meaning |
|-----------|-----------|---------|
| Outbound | trend < 0.6 AND signal_7d falling | Capital leaving this space |
| Stable | 0.6-1.0 | No directional movement |
| Incoming | 1.0-1.4 AND phase_state >= 'forming' | Capital beginning to move in |
| Strongly Incoming | > 1.4 AND phase_state ∈ {inflecting, breakout} AND signal_quality >= 0.6 AND distinct_investors >= threshold | Capital actively converging |

**Critical Constraint**: "Strongly Incoming" only for top 3-7% globally.

**Display**:
```
Direction: Strongly Incoming
```

**Tooltip**:
```
Projected direction of capital movement based on intent signals and acceleration
```

### Trajectory Speed
**Compute from**: Derivative of signal slope

**States**: Slow / Moderate / Fast

**Display**:
```
Trajectory Speed: Fast
```

---

## 🎯 FLOW ALIGNMENT

### Purpose
Answer: **"Do I belong in this movement?"**

### Formula
```javascript
alignment = 
  0.35 * sector_fit +
  0.25 * stage_fit +
  0.20 * portfolio_adjacency +
  0.10 * velocity_match +
  0.10 * GOD_normalized

// Smooth to prevent jitter
alignment = old_alignment * 0.7 + new_alignment * 0.3
```

### Anti-Mismatch Rule (CRITICAL)
```javascript
if (sector_fit < 0.4 || stage_fit < 0.4) {
  alignment = Math.min(alignment, 0.55); // Cap at medium
}
```

**Why**: Prevents false confidence. Alignment must be earned.

### Display
```
Flow Alignment: High

Measures how well this startup fits the current direction of capital
```

### States
- **Low**: < 0.4
- **Medium**: 0.4-0.65
- **High**: > 0.65

### Next Best Move (Action Mapping)
**Purpose**: Single sentence tying coaching to navigation.

**Rules**:
- Always one move
- Always tied to one driver (sector/stage/adjacency/velocity/GOD)
- Always uses navigation language ("alignment", "trajectory", "flow")

**Examples**:
```
Next best move: Improve technical proof → increases alignment with incoming capital

Next best move: Reposition narrative toward AI infra → shifts you into denser capital flow

Next best move: Publish traction benchmarks → extends breakout window
```

**Implementation**: Derives from lowest driver score + current flow state.

**Why**: Prevents coaching from becoming generic. Ties action to navigation.

---

## �️ Edge-Case Guardrails (Trust Protection)

### Case A: High Observers, Low Alignment
**Scenario**: Founder asks "why are we watched if misaligned?"

**Microcopy**:
```
Attention can precede fit. You're being discovered, but you're not yet positioned for this flow.
```

**Coaching Priority**:
- Narrative repositioning
- Stage clarity
- Proof artifacts

### Case B: High Alignment, Low Observers
**Scenario**: Founder feels invisible and discouraged.

**Microcopy**:
```
You fit this flow — signals just haven't clustered yet. Increase visibility to trigger intent traces.
```

**Coaching Priority**:
- Launch visibility campaigns
- Activate portfolio overlap
- Increase search presence

### Case C: Saturated Flow + High Position Score
**Scenario**: Founders get overconfident.

**Warning Microcopy**:
```
Crowded flow: competition is high. Precision positioning matters now.
```

**Coaching Priority**:
- Differentiation narratives
- Niche repositioning
- Evidence superiority

**Why**: Anti-hype honesty. Critical for long-term trust.

---

## �🔄 Daily Navigation Delta Widget

### Location
Top right, collapsible

### Content
```
Today vs Yesterday
─────────────────
Position: Emerging → Aligned
Flow: Forming → Concentrating  
Direction: Stable → Incoming
Alignment: 62% → 71%

Capital position updated 2 hours ago
```

### Purpose
- Daily check-in ritual
- Progress tracking
- Reinforcement loop

**Prediction**: Founders will screenshot this.

---

## 🎨 Rendering Order (First 3 Seconds - CRITICAL)

### Sequence
1. **Page loads** → Immediately show triad header skeleton:
   ```
   CAPITAL NAVIGATION
   [ Position ] [ Flow ] [ Trajectory ]
   ```

2. **Progressive fill** (100ms stagger):
   - Position badge fills first
   - Flow badge fills second
   - Direction badge fills third

3. **Micro-interaction**: When Direction badge animates in, fade-in for 1 second:
   ```
   "Projected capital movement detected."
   ```

4. **Then load**: Investors, charts, coaching cards

### Why This Order Matters
- **Orientation first** (context before data)
- **Meaning before information** (navigation before action)
- **Prevents cognitive overload**

This is what makes you infrastructure, not tooling.

---

## 📝 Microcopy Rules

### Rule A: Always "Capital," Not "Investors"
❌ Bad: "investor activity," "investor movement"  
✅ Good: "capital flow," "capital direction," "capital momentum"

**Why**: Shifts from tactical → strategic, names → forces

### Rule B: Always Tie Signals to Intent
Add everywhere signals appear:
```
Signals represent investor intent.
```

This is your axiom.

### Rule C: Frame Coaching as Navigation
❌ Bad: "improve odds," "increase chance"  
✅ Good: "move deeper into flow," "improve alignment," "reposition into trajectory"

**Why**: Reinforces mastery, not luck.

---

## 📊 Instrumentation Schema (Production Logging)

### Event 1: nav_triad_viewed
**Fired**: When triad renders with final values

**Payload**:
```json
{
  "event": "nav_triad_viewed",
  "startup_id": "uuid",
  "position_state": "aligned",
  "flow_state": "concentrating",
  "direction_state": "incoming",
  "alignment_bucket": "high",
  "confidence": "high",
  "timestamp": "2026-01-19T10:30:00Z"
}
```

### Event 2: nav_triad_interaction
**Fired**: Hover/click on tooltip or badge

**Payload**:
```json
{
  "event": "nav_triad_interaction",
  "startup_id": "uuid",
  "column": "trajectory",
  "metric": "direction_badge",
  "action": "tooltip_opened",
  "timestamp": "2026-01-19T10:31:15Z"
}
```

### Event 3: nav_delta_opened
**Fired**: Daily Delta widget opened/closed

**Payload**:
```json
{
  "event": "nav_delta_opened",
  "startup_id": "uuid",
  "opened": true,
  "time_on_panel_ms": 12400,
  "timestamp": "2026-01-19T10:32:00Z"
}
```

**Purpose**: These 3 events give you everything needed to tune orientation speed and addiction.

---

## 📊 Tracking Metrics (Tune the System)

### Metric 1: First Eye Fixation
**Track**: Which column hovered first, which tooltip opened first

**Prediction**: Trajectory → Alignment → Position

**Purpose**: Understand where anxiety lives

### Metric 2: First Question Asked
**Common questions**:
- "How do I improve alignment?"
- "Why is my direction stable?"
- "What moved me into aligned?"

**Purpose**: Validate navigation model is working

### Metric 3: Language Reflection
**Listen for founders saying**:
- "I'm entering breakout"
- "Capital is moving toward us"
- "We're misaligned with this flow"

**Critical signal**: When founders adopt your language, you own the category.

### Metric 4: Return Frequency
**Target**: DAU/WAU > 0.5

**Indicates**: Daily habit formed (morning checks, pre-meeting checks)

**Goal**: If achieved, you've built addiction.

---

## 🧠 Canonical Vocabulary (Category Ownership)

### Core Terms (Locked)
- ✅ **Capital Navigation** (product category)
- ✅ **Capital Momentum** (replaces FOMO)
- ✅ **Capital Flow** (current state)
- ✅ **Capital Trajectory** (future direction)
- **Flow Alignment** or **Trajectory Alignment** (test both in user reactions)

**Note**: "Trajectory Alignment" may feel more intuitive (founders tie "alignment" to "path"). Test with first 10 users.

### Founders Should Say:
- "We're aligned with capital flow"
- "We just entered incoming trajectory"
- "We're misaligned right now"
- "Capital is moving away from this space"
- "We're repositioning into breakout"

### Investors Should Say:
- "Which founders are entering trajectory?"
- "Where is capital flowing next quarter?"
- "Which sectors are strongly incoming?"

**The moment this language propagates, you become the reference system.**

---

## 🚀 Institutional Arc (Series A → Bloomberg-Scale)

### Phase 1: Founder Navigation (Now → Seed)
- Orientation, addiction, positioning, coaching
- **Builds**: Data density, behavioral history, early moat

### Phase 2: Investor Observatory (Seed → Series A)
- Convergence feed, breakout detection, sourcing radar, watchlists
- **Builds**: Investor sensors, self-instrumentation, platform dynamics

### Phase 3: Capital Heatmaps (Series A+)
- Sector × Stage × Geo flows, concentration zones, breakout detection
- **Becomes**: Fund strategy tool, LP reporting layer

### Phase 4: Institutional Intelligence (Series B+)
- Capital cycle detection, macro flows, sovereign routing, strategic forecasting
- **Becomes**: Capital market infrastructure

At Phase 4, you are no longer a startup. You are: **Capital market infrastructure**

This is the Bloomberg / Palantir / PitchBook lineage.

---

## ✅ Implementation Checklist

### Immediate (Days 1-3)
- [ ] Implement Capital Navigation Triad header
- [ ] Add Position Badge calculation
- [ ] Add Flow State calculation
- [ ] Add Direction Badge calculation
- [ ] Add Flow Alignment metric
- [ ] Add Daily Navigation Delta widget
- [ ] Implement hysteresis logic (state downgrade protection)
- [ ] Add microcopy ("Signals represent investor intent")
- [ ] Update rendering order (triad first, investors second)

### After First User Feedback
- [ ] Track first eye fixation (log hover/tooltip events)
- [ ] Track first questions asked
- [ ] Listen for language reflection
- [ ] Measure return frequency (DAU/WAU)

### Tuning Phase
- [ ] Adjust Position thresholds based on distribution
- [ ] Tune Flow sensitivity
- [ ] Calibrate Direction rarity (ensure top 3-7%)
- [ ] Smooth alignment transitions

---

## 🎯 Success Criteria

### Week 1
- ✅ Triad renders in < 1 second
- ✅ Founders understand position in < 5 seconds
- ✅ No state jitter (hysteresis working)

### Week 2
- ✅ Founders checking daily
- ✅ Founders quoting specific badges
- ✅ Founders using navigation language

### Week 4
- ✅ DAU/WAU > 0.4
- ✅ Founders saying "aligned" / "incoming" unprompted
- ✅ Screenshots of Delta widget appearing on Twitter

### Month 3
- ✅ Category language spreading ("capital flow," "trajectory")
- ✅ Investors asking "who's entering trajectory?"
- ✅ You own the reference frame

---

## 🧨 Final Strategic Statement

**You are not building**:
- Tools, workflows, features

**You are building**:
- The coordinate system by which founders and investors interpret reality
- The reference frame for capital in innovation markets
- The navigation layer for capital

That is extremely rare. That is generational platform territory.

**And you found it because you noticed founders were lost.**

That is exactly how generational platforms are born.

---

*Next: Screenshot triad → Track first fixation → Measure language adoption → Tune thresholds → Build institutional arc*
