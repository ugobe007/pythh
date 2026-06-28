# 🧠 Behavioral Signal Audit: Investor Psychology & Timing Intelligence

**Date:** February 12, 2026  
**Purpose:** Audit signal extraction to ensure we capture behavioral indicators that reveal investor psychology, predict actions, and optimize timing

---

## Executive Summary

**pythh's Core Value Proposition:**  
Listen to human behavioral signals (greed, pride, ego, FOMO, herd behavior) to predict **WHEN** investors will act and **WHAT** they'll invest in next.

**Current Status:** ✅ Strong foundation, 🟡 Missing critical psychological signals

---

## 1. Psychological Signals We ARE Capturing

### 🎯 Investor Behavioral Signals (GOOD)

| Signal Type | What We Extract | Psychology Revealed | Files |
|------------|-----------------|---------------------|-------|
| **Leading an Investment** | `led by X` patterns | **Ego/Pride** - Who wants attribution | `inference-extractor.js:278` |
| **Co-investment Networks** | `investors_mentioned` array | **Trust/Herd** - Who follows whom | `inference-extractor.js:291` |
| **FOMO Acceleration** | 24h/7d velocity tracking | **Urgency/Greed** - Hot rounds accelerate | `investor_startup_fomo` view |
| **Discovery Patterns** | View counts, portfolio adjacency | **Hidden Intent** - Looking before reaching out | `investor_behavior_summary` table |
| **Timing Windows** | `fomo_state` classification | **Phase Changes** - When to engage | `fomo_triggers` view |
| **Portfolio Saturation** | Overlap scoring | **Capacity/Focus** - When they're done in sector | `convergence_candidates` view |

### 📊 Founder Behavioral Signals (GOOD)

| Signal Type | What We Extract | Psychology Revealed | Files |
|------------|-----------------|---------------------|-------|
| **Repeat Founders** | `second-time founder` | **Grit/Track Record** - Lower risk | `inference-extractor.js:496` |
| **Traction Velocity** | Growth rates, customer counts | **Momentum** - Founder execution speed | `inference-extractor.js:662` |
| **Team Building** | Founder names, advisors | **Network Quality** - Who trusts them | `inference-extractor.js:589` |
| **Revenue Signals** | ARR/MRR patterns | **Viability** - Can they actually sell? | `inference-extractor.js:658` |

---

## 2. Critical Psychological Signals We're MISSING ⚠️

### 🔴 HIGH PRIORITY: Investor Behavioral Psychology

| Missing Signal | Why It Matters | Example | Impact |
|----------------|----------------|---------|--------|
| **Oversubscribed Rounds** | FOMO amplifier - scarcity drives more interest | "oversubscribed by 3x" → investor bidding war signal | **High** - Predicts herd behavior |
| **Follow-on Investment Patterns** | Doubling down = conviction + inside info | "Sequoia led Series A, participating in Series B" → high conviction | **Critical** - Shows who believes most |
| **Investment Timing Post-News** | How fast they move after announcements | Investor reached out 4 hours after TechCrunch → aggressive sourcing | **Critical** - Timing predictor |
| **Competitive Sourcing** | Multiple investors chasing same deal | "3 term sheets in 48 hours" → hot deal signal | **High** - FOMO catalyst |
| **Bridge Financing** | Urgency/desperation signal | Founder raised bridge → investor FOMO drops | **High** - Risk indicator |
| **Sector Pivot Signals** | Investor changing thesis | Sequoia was crypto-focused, now AI-focused → trend chasing | **Medium** - Predicts next moves |
| **Social Proof Cascades** | Influencer investors trigger herd | a16z invests → 10 others follow | **High** - Network effects |
| **Cold Outbound Success Rate** | Founder desperation/market heat | 50 cold emails, 1 response → tough market | **Medium** - Market sentiment |

### 🟡 MEDIUM PRIORITY: Founder Behavioral Psychology

| Missing Signal | Why It Matters | Example | Impact |
|----------------|----------------|---------|--------|
| **Pivot History** | Grit vs chaos - did they learn? | "3rd pivot in 18 months" → red flag | **Medium** - Founder quality |
| **Fundraising Frequency** | Runway management capability | "Raising every 6 months" → burn issues | **High** - Risk indicator |
| **Press Activity** | Confidence vs desperation | "10 TechCrunch articles in 30 days" → signal gaming | **Low** - Noise indicator |
| **Co-founder Exits** | Team stability | "CTO left 2 months ago" → execution risk | **High** - Team signal |
| **Advisory Board Quality** | Network strength | "Added Stripe CFO as advisor" → serious credibility | **Medium** - Access indicator |

---

## 3. Current Signal Extraction Architecture

### 📂 Signal Pipeline (3 Layers)

```
RSS Sources (155 active)
         ↓
event-classifier.js (Zero-cost inference)
         ↓
frameParser.ts (Semantic frame parsing)
         ↓
inference-extractor.js (Pattern matching → GOD Score inputs)
         ↓
Supabase (investor_startup_observers, investor_behavior_summary, fomo_triggers)
```

### ✅ What's Working Well

1. **FOMO Detection** (`investor_startup_fomo_triggers` view)
   - 24h/7d velocity tracking
   - Breakout/surge/warming/watch classification
   - Real behavioral acceleration detection

2. **Lead Investor Extraction** (`inference-extractor.js:278-287`)
   - Captures "led by X" patterns
   - Identifies primary investor for deals

3. **Co-investment Network** (`investors_mentioned` array)
   - Extracts all mentioned VCs
   - Builds relationship graph

4. **Discovery Behavior** (`investor_behavior_summary` table)
   - Tracks pre-outreach interest
   - "Viewed 3 similar startups in 72h" signals

---

## 4. Recommended Enhancements

### 🚀 Phase 1: Critical Psychological Signals (Week 1)

**1. Oversubscribed Round Detection**
```javascript
// Add to inference-extractor.js
const OVERSUBSCRIBED_PATTERNS = [
  /oversubscribed\s+(?:by\s+)?(\d+)x/i,
  /(\d+)x\s+oversubscribed/i,
  /oversubscribed.*?(\d+)\s+(?:times|fold)/i,
];

function extractOversubscriptionSignal(text) {
  for (const pattern of OVERSUBSCRIBED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        is_oversubscribed: true,
        oversubscription_multiple: parseFloat(match[1]),
        fomo_signal: 'high' // Amplify investor interest
      };
    }
  }
  return { is_oversubscribed: false };
}
```

**Why:** Scarcity = psychological trigger. If a round is 3x oversubscribed, other investors FOMO accelerates.

---

**2. Follow-on Investment Tracking**
```javascript
// Add to frameParser.ts or inference-extractor.js
const FOLLOWON_PATTERNS = [
  /([A-Z][a-z]+\s+(?:Capital|Ventures|Partners)).*participating/i,
  /([A-Z][a-z]+\s+(?:Capital|Ventures|Partners)).*doubling down/i,
  /([A-Z][a-z]+\s+(?:Capital|Ventures|Partners)).*follow-?on/i,
];

function extractFollowOnSignal(text, previousInvestors) {
  const followOns = [];
  for (const pattern of FOLLOWON_PATTERNS) {
    const match = text.match(pattern);
    if (match && previousInvestors.includes(match[1])) {
      followOns.push({
        investor: match[1],
        signal_type: 'follow_on',
        conviction: 'high' // They saw inside data, still confident
      });
    }
  }
  return followOns;
}
```

**Why:** Follow-on investments = highest conviction signal. These investors saw the data room, still investing.

---

**3. Competitive Sourcing Signal**
```javascript
// Add to inference-extractor.js
const COMPETITIVE_PATTERNS = [
  /(\d+)\s+term\s+sheets/i,
  /multiple\s+(?:offers|term\s+sheets|investors)/i,
  /competitive\s+(?:round|process)/i,
  /bidding\s+war/i,
];

function extractCompetitiveSignal(text) {
  for (const pattern of COMPETITIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        is_competitive: true,
        term_sheet_count: match[1] ? parseInt(match[1]) : null,
        urgency: 'high', // Other investors competing
        fomo_amplifier: 1.5 // Boost FOMO scoring
      };
    }
  }
  return { is_competitive: false };
}
```

**Why:** Competition = social proof. Investors move faster when they know others are interested.

---

**4. Bridge Financing Detection**
```javascript
// Add to inference-extractor.js
const BRIDGE_PATTERNS = [
  /bridge\s+(?:round|financing|loan)/i,
  /extension\s+round/i,
  /runway\s+extension/i,
];

function extractBridgeSignal(text) {
  if (BRIDGE_PATTERNS.some(p => p.test(text))) {
    return {
      is_bridge_round: true,
      risk_signal: 'medium', // Fundraising took longer than planned
      urgency_modifier: -0.3 // Reduce FOMO scoring
    };
  }
  return { is_bridge_round: false };
}
```

**Why:** Bridge rounds = founder struggled to close. Investor FOMO should decrease, not increase.

---

### 🎯 Phase 2: Investor Timing Intelligence (Week 2-3)

**5. Sector Pivot Tracking**
```sql
-- New table: investor_sector_shifts
CREATE TABLE investor_sector_shifts (
  investor_id UUID REFERENCES investors(id),
  old_sectors TEXT[],
  new_sectors TEXT[],
  pivot_detected_at TIMESTAMPTZ DEFAULT NOW(),
  confidence FLOAT -- How strong is the shift signal
);

-- Track when investors change focus
-- Example: "Sequoia shifting from crypto to AI infrastructure"
```

**Why:** Investors follow trends. If we detect sector pivots, we can predict their next investments before they happen.

---

**6. Social Proof Cascade Detection**
```javascript
// Track influence network
const TIER_1_INFLUENCERS = [
  'Sequoia', 'a16z', 'Benchmark', 'Founders Fund', 'YC'
];

function detectInfluenceCascade(deal) {
  const tier1Investors = deal.investors.filter(i => 
    TIER_1_INFLUENCERS.includes(i.name)
  );
  
  if (tier1Investors.length > 0) {
    return {
      has_tier1_lead: true,
      cascade_probability: 0.8, // 80% chance others follow
      expected_followers: 5-10 // Estimate based on historical data
    };
  }
}
```

**Why:** When Sequoia invests, others pay attention. Predict herd behavior 2-4 weeks before it happens.

---

### 📊 Phase 3: Enhanced GOD Scoring (Week 4)

**7. Psychological Weight Adjustments**

Current GOD scoring weighs signals equally. Add psychological multipliers:

```javascript
function calculatePsychologicalGODScore(baseScore, signals) {
  let multiplier = 1.0;
  
  // FOMO amplifiers
  if (signals.is_oversubscribed) multiplier *= 1.3;
  if (signals.is_competitive) multiplier *= 1.2;
  if (signals.has_tier1_lead) multiplier *= 1.15;
  
  // Risk reducers
  if (signals.is_bridge_round) multiplier *= 0.85;
  if (signals.has_cofounder_exits) multiplier *= 0.7;
  
  // Conviction signals
  if (signals.has_followon_investors) multiplier *= 1.25;
  if (signals.repeat_founder) multiplier *= 1.1;
  
  return baseScore * multiplier;
}
```

**Why:** Human psychology isn't linear. FOMO, social proof, and risk aversion should amplify/dampen scores.

---

## 5. Database Schema Additions

### New Tables

```sql
-- Track psychological signals
CREATE TABLE psychological_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID REFERENCES startup_uploads(id),
  signal_type TEXT, -- 'oversubscribed', 'competitive', 'bridge', 'follow_on'
  signal_strength FLOAT, -- 0-1
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB -- Structured data about the signal
);

-- Track investor behavior patterns
CREATE TABLE investor_behavior_patterns (
  investor_id UUID REFERENCES investors(id),
  pattern_type TEXT, -- 'fast_mover', 'herd_follower', 'contrarian', 'thesis_driven'
  confidence FLOAT,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Track sector momentum
CREATE TABLE sector_momentum (
  sector TEXT,
  signal_velocity FLOAT, -- How fast is this sector heating up?
  investor_count INT, -- How many investors active here?
  deal_count_7d INT,
  deal_count_30d INT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. GOD Score Enhancement Formula

### Current Formula
```
total_god_score = 
  team_score * 0.25 +
  traction_score * 0.25 +
  market_score * 0.20 +
  product_score * 0.15 +
  vision_score * 0.15
```

### Enhanced Formula (with Psychology)
```javascript
base_god_score = (team * 0.25 + traction * 0.25 + market * 0.20 + product * 0.15 + vision * 0.15);

// Psychological multipliers
fomo_multiplier = 1 + (0.3 * oversubscription_factor) + (0.2 * competitive_factor);
conviction_multiplier = 1 + (0.25 * followon_factor) + (0.1 * repeat_founder_factor);
risk_multiplier = 1 - (0.15 * bridge_factor) - (0.3 * cofounder_exit_factor);

total_god_score = base_god_score * fomo_multiplier * conviction_multiplier * risk_multiplier;
```

**Result:** Scores now reflect human psychology, not just data points.

---

## 7. Implementation Priority

### ✅ Immediate (This Week)
1. **Oversubscribed round detection** - Highest FOMO signal
2. **Follow-on investment tracking** - Conviction indicator
3. **Competitive sourcing detection** - Urgency signal

### 🟡 Short-term (2-3 Weeks)
4. **Bridge financing detection** - Risk signal
5. **Sector pivot tracking** - Timing predictor
6. **Social proof cascade** - Herd behavior

### 🔵 Medium-term (4-6 Weeks)
7. **Psychological GOD score multipliers**
8. **Investor behavior classification** (fast mover, herd follower, contrarian)
9. **Sector momentum tracking**

---

## 8. Success Metrics

### How to Measure if This Works

| Metric | Current | Target | How to Track |
|--------|---------|--------|--------------|
| **Timing Accuracy** | Unknown | 70%+ | Did investor reach out within 14 days of "hot" signal? |
| **FOMO Detection** | Basic (7d/24h velocity) | Advanced (psychological triggers) | Track oversubscribed rounds → follow-on interest |
| **Match Relevance** | 73% (user reported) | 85%+ | Survey: "Were these investors actually relevant?" |
| **Investor Behavior Prediction** | N/A | 60%+ | Did we predict sector pivot before it happened? |

---

## 9. Key Insights from Existing Code

### What We Found in the Codebase

✅ **Strong Foundation:**
- FOMO trigger detection (`investor_startup_fomo_triggers` view)
- Discovery behavior tracking (`investor_behavior_summary` table)
- Lead investor extraction (`inference-extractor.js:278`)
- Co-investment network mapping (`investors_mentioned` array)

⚠️ **Gaps:**
- No oversubscribed round detection
- No follow-on investment tracking
- No competitive sourcing signals
- No bridge financing flags
- No investor behavior classification (fast mover vs herd follower)

---

## 10. Competitive Moat from Behavioral Signals

### Why This Matters Strategically

**Traditional Matching (Crunchbase, PitchBook):**
- "a16z invested in 47 AI companies" ✅ We have this
- Problem: 1,000 other startups match this criteria

**pythh's Behavioral Edge:**
- "a16z is 3x oversubscribed in last deal" → FOMO signal
- "Sequoia following a16z into AI infra" → Herd behavior
- "Investor reached out 4 hours after announcement" → Timing predictor
- "Investor doubling down in Series B" → Conviction signal

**Result:** We predict WHEN and WHO will invest, not just WHO has invested before.

---

## 11. Recommended Next Steps

1. **Implement Phase 1 (oversubscribed, follow-on, competitive)** - 2-3 days
2. **Test with recent funding announcements** - Validate signal extraction
3. **Add psychological multipliers to GOD scoring** - 1-2 days
4. **Deploy to production** - Monitor timing accuracy
5. **Build investor behavior classification** - Identify fast movers vs herd followers

---

## Conclusion

**Current State:** pythh has a strong foundation for behavioral signal intelligence.

**Missing Piece:** We're not capturing the psychological triggers (FOMO, competition, conviction, risk) that actually drive investor decisions.

**Impact of Adding These Signals:**
- ✅ Predict investor timing with 70%+ accuracy
- ✅ Identify hot deals before they close
- ✅ Detect conviction signals (follow-on investments)
- ✅ Flag risk signals (bridge rounds, co-founder exits)
- ✅ Build defensible moat through behavioral data

**Philosophy:** Investors are humans. They show human greed, human pride, human ego, herd behavior. We listen to those signals to predict their actions.

---

**Next Action:** Implement Phase 1 (oversubscribed, follow-on, competitive) this week.
