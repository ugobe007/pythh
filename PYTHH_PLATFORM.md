# Pythh Signal Intelligence Platform
## Canonical Architecture Reference — v2

> **Purpose:** This document is the single source of truth for the Pythh platform architecture.  
> It describes every layer of the system, how they connect, and what each component produces.  
> Use this for onboarding, engineering decisions, product design, and investor communication.

---

## Table of Contents

1. [What Pythh Is](#1-what-pythh-is)
2. [The Core Insight](#2-the-core-insight)
3. [Full Architecture Stack](#3-full-architecture-stack)
4. [Layer 1 — Data Ingestion & Name Validation](#4-layer-1--data-ingestion--name-validation)
5. [Layer 2 — Signal Parsing](#5-layer-2--signal-parsing)
6. [Layer 3 — Trajectory Engine](#6-layer-3--trajectory-engine)
7. [Layer 4 — Needs Inference Engine](#7-layer-4--needs-inference-engine)
8. [Layer 5 — Match Engine](#8-layer-5--match-engine)
9. [Scoring Model Reference](#9-scoring-model-reference)
10. [Database Schema](#10-database-schema)
11. [Signal Grammar Reference](#11-signal-grammar-reference)
12. [Canonical Trajectory Types](#12-canonical-trajectory-types)
13. [Canonical Need Classes](#13-canonical-need-classes)
14. [Platform Applications](#14-platform-applications)
15. [Key Files Reference](#15-key-files-reference)

---

## 1. What Pythh Is

Pythh is an **intent detection platform**, not a database.

Most competitive data tools (Crunchbase, ZoomInfo, 6sense) track *static data*:
- company name
- funding round
- headcount
- valuation

Pythh tracks *language → intent → action*:
- what companies **say** in the wild (news, LinkedIn, press releases, job posts, podcasts)
- what those words **signal** about their next strategic move
- who should **care** about that signal, and **why now**

That language appears **6–18 months before** major events: fundraising rounds, acquisitions, enterprise deals, vendor purchases, and distress situations.

The result is a platform that answers:
> "Who is about to do what — and who should they talk to?"

---

## 2. The Core Insight

Most people think the valuable data is:
- revenue
- headcount
- valuation
- funding

The real early signal data is language:

| What they say | What it means |
|---|---|
| "we're thinking about…" | intent, 12–18 months before action |
| "we're evaluating…" | buying signal, 6–9 months out |
| "we're piloting…" | procurement, 3–6 months out |
| "we're hiring for…" | growth, hiring, GTM signal |
| "data room" | investor in serious diligence |
| "strategic alternatives" | possible sale or exit |
| "extending runway" | distress, bridge needed |
| "we closed…" | event confirmed |

**A single signal is interesting. A sequence of signals is predictive.**

Pythh is built to detect sequences — not individual words.

---

## 3. Full Architecture Stack

```
Internet (news, LinkedIn, press releases, job posts, podcasts)
        ↓
  ┌─────────────────────────────────────────────┐
  │  Scrapers (RSS + structured sources)         │
  │  ssot-rss-scraper.js / simple-rss-scraper.js│
  └─────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────┐
  │  LAYER 1: Name Validation                    │
  │  lib/startupNameValidator.js                 │
  │  → Is this string a real company name?       │
  └─────────────────────────────────────────────┘
        ↓ (valid names only)
  ┌─────────────────────────────────────────────┐
  │  Sentence Extraction                         │
  │  lib/sentenceExtractor.js                    │
  │  lib/headlineExtractor.js                    │
  └─────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────┐
  │  LAYER 2: Signal Parsing                     │
  │  lib/signalParser.js + lib/signalOntology.js │
  │  → What does this sentence mean?             │
  │  → How confident are we? (6D model)          │
  │  → Is this a costly action?                  │
  │  → Are there multiple signals in one sent.?  │
  └─────────────────────────────────────────────┘
        ↓ (SignalObject[])
  ┌─────────────────────────────────────────────┐
  │  LAYER 3: Trajectory Engine                  │
  │  lib/trajectoryEngine.js                     │
  │  → What pattern is forming over time?        │
  │  → How fast (velocity)? How aligned (cons.)? │
  │  → What stage transition is occurring?       │
  │  → What anomalies exist?                     │
  └─────────────────────────────────────────────┘
        ↓ (TrajectoryReport)
  ┌─────────────────────────────────────────────┐
  │  LAYER 4: Needs Inference Engine             │
  │  lib/needsInference.js                       │
  │  → What does this company actually need?     │
  │  → Capital? GTM support? Vendor? Advisor?    │
  └─────────────────────────────────────────────┘
        ↓ (NeedObject[])
  ┌─────────────────────────────────────────────┐
  │  LAYER 5: Match Engine                       │
  │  lib/matchEngine.js                          │
  │  → Who fits this need, and when?             │
  │  → 6-dimension fit score                     │
  │  → Plain-English explanation                 │
  │  → Recommended action                        │
  └─────────────────────────────────────────────┘
        ↓ (MatchObject[])
  ┌─────────────────────────────────────────────┐
  │  Database (Supabase / PostgreSQL)             │
  │  pythh_signal_events                         │
  │  pythh_trajectories                          │
  │  pythh_entity_needs                          │
  │  pythh_candidates                            │
  │  pythh_matches                               │
  └─────────────────────────────────────────────┘
        ↓
  ┌─────────────────────────────────────────────┐
  │  Product Surface                             │
  │  Signal Feed / Investor Dashboard            │
  │  Trajectory View / Match Recommendations     │
  └─────────────────────────────────────────────┘
```

---

## 4. Layer 1 — Data Ingestion & Name Validation

**File:** `lib/startupNameValidator.js`

### Purpose

Every scraped name passes through the validator before entering the system. A name that fails is never stored, never scored, and never matched. This is the first and most important data quality gate.

### Rule Categories (in order of evaluation)

| Rule | Examples blocked | Mechanism |
|---|---|---|
| Empty / too short / too long | `""`, `"X"`, 80+ chars | Length check |
| Headline salvage | `"Stripe Announces"` → try `"Stripe"` | `stripAnnounceHeadlineTail()` |
| Known non-company names | Politicians, world leaders, SCOTUS, media pundits, institutions | `NON_COMPANY_EXACT_NAMES` blocklist |
| Likely person name | `"Chris Murphy"`, `"Jennifer Lopez"` | Given name + surname overlap |
| Political title prefix | `"Senator Warren"` → strip → blocklist | `LEADING_POLITICAL_TITLE_RE` |
| Junk patterns | `"Breaking:"`, `"How to"`, `"[Video]"`, `"raising $5M"` in name | `JUNK_PATTERNS` regex array |
| YC batch seasons | `"W24"`, `"Summer 2023"` | `BATCH_SEASONS_RE` |
| Location-based prefix | `"Boston-based"`, `"US-based"` | `LOCATION_BASED_RE` |
| **192 countries (full UN list)** | `"Pakistan"`, `"Egypt"`, `"France"`, `"Vietnam"` | `COUNTRY_SINGLE_WORDS` set |
| Multi-country compound | `"Egypt Saudi Arabia"`, `"Dar Pakistan"` | `MULTI_COUNTRY_RE` + count |
| Geographic descriptors | `"Cambodian"`, `"Singaporean"`, demonyms | `GEO_SINGLE_WORDS` set |
| English adverbs | `"Ridiculously"`, `"Painfully"` | `ADVERB_RE` |
| Hyphenated descriptors | `"Cloud-native"`, `"Go-to-market"`, `"AI-powered"` | `HYPHENATED_DESCRIPTOR_RE` |
| Compound descriptor exact | `"Community-powered"`, `"Record-setting"`, `"Decision-making"` | `COMPOUND_DESCRIPTOR_EXACT` |
| Generic single words | `"Platform"`, `"Enterprise"`, `"Crypto"`, `"Healthcare"` | `GENERIC_SINGLE_WORDS` |
| **Quoted phrase fragments** | `"'Leverage the local'"`, `""We are building…"` | `LEADING_QUOTE_RE` |
| **Slash attributions** | `"Mario Tama/Getty Images"`, `"AP/Reuters"` | `SLASH_ATTRIBUTION_RE` |
| **Alum descriptors** | `"Microsoft and Uber alum"` | `ALUM_DESCRIPTOR_RE` |
| **Crypto slang compounds** | `"TGE Pump"`, `"FDV Crypto"`, `"Ethereum Steak"`, `"ZEC How"` | `CRYPTO_SLANG_RE` |
| Nationality/demonym | `"Indonesian"`, `"Cambodian"` | Regex |
| Article verb chain | `"Stripe Raises $500M"`, `"Anduril Acquires"` | `ARTICLE_VERB_CHAIN_RE` |
| Starts with number | `"5 Ways"`, `"10 Startups"` | Regex |
| City-suffix artifact | `"CompanyNameSan Francisco"` | `COMMON_CITIES` |
| Excessive camelCase | `"thisIsGarbage"` (3+ boundaries) | Regex |
| Minister title fragments | `"Foreign Minister Mohammad"` | `JUNK_PATTERNS` |

### Safe Overrides

Some rules have intentional exceptions:
- `"Egypt Ventures"` → **VALID** (geo word + company suffix = legitimate VC name)
- `"Ethereum Labs"` → **VALID** (coin name + `labs/foundation/protocol` = legitimate project)
- `"Ghana Health Services"` → **VALID** (geo + company-type suffix)

### GOD Score Relationship

The validator runs **upstream** of GOD scoring. Names that fail never reach GOD.  
GOD scoring handles a different failure mode: names that ARE structurally valid companies but have poor data quality (no signals, low confidence, promotional language only).

---

## 5. Layer 2 — Signal Parsing

**Files:** `lib/signalParser.js`, `lib/signalOntology.js`

### Purpose

Takes a sentence of text and produces a structured `SignalObject` — the atomic unit of intelligence in the Pythh system.

### Signal Object Schema

```json
{
  "signal_id": "sig_abc123",
  "source": "TechCrunch",
  "source_type": "news",
  "source_url": "https://...",
  "date_detected": "2026-03-27",
  "raw_text": "We're aggressively hiring enterprise sales reps this quarter to expand into Europe.",
  "actor": {
    "entity_name": "StartupX",
    "entity_type": "startup"
  },
  "signal_grammar": {
    "action": "hiring",
    "object": "enterprise sales reps",
    "modifiers": ["enterprise"],
    "intensity": ["aggressively"],
    "modality": "active",
    "time_reference": "this quarter",
    "intent": "expand",
    "context": ["Europe", "enterprise"],
    "posture": "confident"
  },
  "primary_signal": "hiring_signal",
  "signal_class": ["growth_signal", "gtm_signal", "expansion_signal", "enterprise_signal"],
  "signal_strength": 0.82,
  "confidence": 0.91,
  "evidence_quality": "confirmed",
  "costly_action": true,
  "is_ambiguous": false,
  "inference": {
    "likely_stage": "Series A/B",
    "likely_need": ["CRM", "sales tools", "lead gen", "localization"],
    "likely_budget": "medium-high",
    "urgency": "high",
    "strategic_direction": "enterprise expansion"
  },
  "who_cares": {
    "investors": true,
    "vendors": true,
    "acquirers": false,
    "recruiters": true,
    "partners": true
  }
}
```

### 6-Dimensional Confidence Model

Confidence is not a keyword count. It is a composite score across six dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| Linguistic clarity | High | Is the sentence direct or hedged? (`"we are hiring"` vs `"we may consider hiring"`) |
| Actor clarity | Medium | Do we know WHO is taking the action? |
| Object clarity | Medium | Do we know WHAT the action is directed at? |
| Modality certainty | High | `active` > `planned` > `exploratory` > `hedged` > `negative` |
| Negation / hedging | Penalty | Does the sentence undermine its own claim? |
| Source reliability | Blended | Platform type + textual source signals |

```
confidence = (clarity × 0.25) + (actor × 0.15) + (object × 0.15)
           + (modality × 0.20) + (source × 0.25)
           - hedge_penalty
           + intensity_adjustment
           + posture_mod
           + costly_action_bonus (+0.15)
```

### Source Reliability Scale

| Source Type | Score |
|---|---|
| SEC filing | 1.00 |
| Earnings call | 0.95 |
| Press release | 0.90 |
| Verified news | 0.80 |
| LinkedIn post | 0.70 |
| Blog / opinion | 0.55 |
| Podcast mention | 0.50 |
| Social media | 0.40 |
| Rumor site | 0.30 |

### Costly Action Bonus (+0.15)

Actions that imply real financial commitment get a confidence boost:
- Hiring a VP / C-suite
- Opening a new office or facility
- Issuing an RFP or signing a contract
- Acquiring a company
- Closing a funding round

These are costly actions — they cost real money, which means the signal is almost certainly genuine.

### Multi-Signal Detection

A single compound sentence may contain multiple distinct signals:

> "We are aggressively hiring enterprise sales reps **and also** expanding into Europe."

The engine splits this into:
1. `hiring enterprise sales reps` → `hiring_signal` + `enterprise_signal`
2. `expanding into Europe` → `expansion_signal` + `gtm_signal`

Each sub-signal is scored independently and stored with a reference to the parent sentence.

### Ambiguity Layer

Not all language can be forced into a single hard classification. The engine flags:
- **Hedged intent**: `"we're thinking about…"`, `"we may…"`, `"we're exploring…"`
- **Promotional / hype-only**: `"we're crushing it"`, `"huge things coming"`
- **Conflicting signals**: positive and negative language in same sentence
- **Vague objects**: action without a clear target

Ambiguous signals get: `is_ambiguous: true` + a lower confidence score + an alternate interpretation stored alongside the primary.

### Signal Classes

| Class | Meaning |
|---|---|
| `hiring_signal` | Team growth, headcount expansion |
| `gtm_signal` | Sales motion, commercial buildout |
| `enterprise_signal` | Enterprise-tier product or sales |
| `expansion_signal` | New geographies, verticals, markets |
| `growth_signal` | General growth language |
| `fundraising_signal` | Active or planned capital raise |
| `investor_interest_signal` | Investor diligence or engagement |
| `revenue_signal` | Revenue, traction, customer wins |
| `demand_signal` | Customer pull, inbound demand |
| `product_signal` | Product launches, features, milestones |
| `regulatory_signal` | Compliance, certifications, approvals |
| `partnership_signal` | Strategic partnerships, alliances |
| `buyer_pain_signal` | Operational pain driving a purchase |
| `buyer_signal` | Active vendor evaluation or POC |
| `buyer_budget_signal` | Budget approved, RFP, procurement |
| `distress_signal` | Layoffs, burn, restructuring, runway |
| `efficiency_signal` | Cost reduction, burn control, profitability |
| `exit_signal` | Strategic review, banker activity |
| `acquisition_signal` | M&A activity, being acquired |
| `market_position_signal` | Competitive positioning language |
| `exploratory_signal` | Early, low-conviction exploration |
| `unclassified_signal` | Did not match any known class |

---

## 6. Layer 3 — Trajectory Engine

**File:** `lib/trajectoryEngine.js`

### Purpose

Takes a company's chronological signal history and produces a `TrajectoryReport` — a compressed interpretation of **where the company is headed and how fast**.

A single signal is interesting. A **sequence** of signals is predictive.

### The Five Questions Answered

| Question | Output field | Example |
|---|---|---|
| **A. Direction** | `dominant_trajectory` | `"fundraising_active"` |
| **B. Velocity** | `velocity_score` (0–1) | `0.78` = very active |
| **C. Consistency** | `consistency_score` (0–1) | `0.88` = signals well aligned |
| **D. Stage** | `stage_transition` | `market_validation → fundraising_active` |
| **E. Next move** | `predicted_next_moves` | `["close_round", "hire_vp_sales", "buy_crm"]` |

### Trajectory Object Schema

```json
{
  "entity_id": "startup_123",
  "window_start": "2026-01-01",
  "window_end": "2026-03-27",
  "time_window_days": 90,
  "dominant_trajectory": "fundraising_active",
  "trajectory_label": "Active Fundraising",
  "trajectory_confidence": 0.85,
  "velocity_score": 0.74,
  "momentum": 0.71,
  "acceleration": "accelerating",
  "consistency_score": 0.88,
  "current_stage": "fundraising_active",
  "stage_transition": {
    "from": "market_validation",
    "to": "fundraising_active",
    "transition_detected": true
  },
  "dominant_signal": "fundraising_signal",
  "supporting_signals": ["hiring_signal", "enterprise_signal", "investor_interest_signal"],
  "contradictory_signals": [],
  "predicted_next_moves": ["close_funding_round", "hire_vp_sales", "build_enterprise_pipeline"],
  "who_cares": { "investors": true, "vendors": true, "recruiters": true },
  "anomalies": [],
  "rolling_windows": {
    "immediate":   { "window_days": 30,  "velocity": 0.82, "acceleration": "accelerating" },
    "operational": { "window_days": 90,  "velocity": 0.74, "acceleration": "accelerating" },
    "strategic":   { "window_days": 180, "velocity": 0.61, "acceleration": "stable" },
    "evolution":   { "window_days": 365, "velocity": 0.44, "acceleration": "stable" }
  }
}
```

### Velocity Score

Velocity answers: **how actively are signals firing?**

```
velocity = sum(
  signal_class_weight × confidence × e^(-decay_rate × age_days) + costly_action_bonus
)
```

Signals are weighted by importance. Costly actions add a +0.15 bonus. Older signals decay exponentially (half-life: 30 days). Normalized to 0–1.

| Velocity | Interpretation |
|---|---|
| 0.0–0.25 | Dormant — very little recent activity |
| 0.25–0.50 | Low — occasional signals, watch and wait |
| 0.50–0.70 | Moderate — active company, some momentum |
| 0.70–0.85 | High — company is actively moving |
| 0.85–1.00 | Very high — something significant is happening |

### Consistency Score

Consistency answers: **do the signals tell the same story?**

Uses Herfindahl–Hirschman Index (HHI) concentration across signal domains.

- `1.0` = all signals in one domain (e.g., all fundraising) = perfectly consistent narrative
- `0.0` = signals evenly spread across all domains = no clear story

> **Important:** Low consistency is not always bad. `layoffs in ops + hiring in sales` = inconsistent signal domains but it is informative — it means strategic reprioritization, not noise.

### Stage Transitions

The engine splits a company's signal history in half (early vs. recent) and detects what stage it was in each period:

| Stage | Key signals present |
|---|---|
| `ideation` | exploratory_signal |
| `product_build` | product_signal |
| `market_validation` | product_signal + demand_signal |
| `pilot` | buyer_signal + demand_signal |
| `go_to_market` | gtm_signal + hiring_signal |
| `enterprise_scale` | enterprise_signal + revenue_signal |
| `fundraising_active` | fundraising_signal + investor_interest_signal |
| `efficiency_mode` | efficiency_signal + distress_signal |
| `buyer_evaluation` | buyer_pain_signal + buyer_signal |
| `procurement` | buyer_budget_signal + buyer_signal |
| `exit_prep` | exit_signal + acquisition_signal |

### Anomaly Detection

The engine flags unusual patterns that often indicate hidden stress, hype inflation, or stealth strategy changes:

| Anomaly | Description |
|---|---|
| `sudden_spike` | Signal density tripled vs. historical baseline |
| `abrupt_domain_reversal` | Growth signals → distress signals (or vice versa) |
| `domain_transition` | Shift in dominant signal type |
| `hype_without_action` | 3+ promotional signals, 0 confirmed concrete actions |
| `investor_without_traction` | Investor diligence signals without visible revenue/demand |
| `stalled_pilot_conversion` | Pilot signals in prior period, no procurement follow-through |

### Rolling Windows

Every trajectory is computed at four time horizons:

| Window | Label | Purpose |
|---|---|---|
| 30 days | `immediate` | What is happening right now? |
| 90 days | `operational` | What is the active operating trajectory? |
| 180 days | `strategic` | What is the strategic direction? |
| 365 days | `evolution` | How has the company evolved over a year? |

A signal from 11 months ago should not dominate the current trajectory. Rolling windows prevent this.

---

## 7. Layer 4 — Needs Inference Engine

**File:** `lib/needsInference.js`

### Purpose

Translates signals and trajectory into **canonical need classes** — the critical middle layer between "what is happening" and "who should care."

```
Signal + Trajectory → Need → Match Candidate
```

Without this step, the system does pattern matching.  
With this step, the system generates actionable recommendations.

### Need Object Schema

```json
{
  "need_class": "series_a_capital",
  "label": "Series A Capital",
  "category": "capital",
  "description": "Series A institutional financing; growth and GTM buildout",
  "confidence": 0.85,
  "urgency": "high",
  "who_provides": ["series_a_fund", "venture_capital"],
  "signal_sources": ["fundraising_signal", "investor_interest_signal"],
  "trajectory_boost": true,
  "evidence_count": 4
}
```

### The 27 Canonical Need Classes

#### Capital
| Need Class | Label |
|---|---|
| `seed_capital` | Seed Capital |
| `bridge_capital` | Bridge Capital |
| `series_a_capital` | Series A Capital |
| `series_b_capital` | Series B Capital |
| `growth_capital` | Growth Capital |
| `strategic_capital` | Strategic Capital |

#### GTM
| Need Class | Label |
|---|---|
| `enterprise_sales_support` | Enterprise Sales Support |
| `channel_partners` | Channel & Distribution Partners |
| `revops_tools` | Revenue Operations Tooling |
| `lead_generation` | Lead Generation & Demand Generation |
| `localization_support` | Localization & Market Entry Support |

#### Product / Technical
| Need Class | Label |
|---|---|
| `infra_tools` | Infrastructure & Cloud Tools |
| `dev_tools` | Developer Tools |
| `compliance_tools` | Compliance & Security Tooling |
| `data_tools` | Data & Analytics Tools |
| `implementation_support` | Implementation & Integration Support |

#### Buying / Operations
| Need Class | Label |
|---|---|
| `automation_vendor` | Automation Vendor |
| `robotics_vendor` | Robotics Vendor |
| `systems_integrator` | Systems Integrator |
| `procurement_support` | Procurement Support |
| `pilot_partner` | Pilot Partner |
| `energy_vendor` | Energy / Utilities Vendor |

#### Strategic
| Need Class | Label |
|---|---|
| `acquirer_interest` | Acquirer or Strategic Buyer |
| `strategic_partner` | Strategic Partner |
| `banker_advisor` | Investment Banker / M&A Advisor |
| `turnaround_support` | Turnaround Advisor |
| `executive_search` | Executive Search |

#### Talent
| Need Class | Label |
|---|---|
| `engineering_talent` | Engineering Talent |
| `sales_talent` | Sales & GTM Talent |
| `operations_talent` | Operations & General Talent |

### Urgency Model

```
urgency_score = base_hint × velocity × acceleration_bonus × confidence
```

| Urgency | Description |
|---|---|
| `high` | Need this now. Signals accelerating. High confidence. |
| `medium` | Likely need within 60–90 days. Moderate velocity. |
| `low` | Probable future need. Low velocity or early stage. |

---

## 8. Layer 5 — Match Engine

**File:** `lib/matchEngine.js`

### Purpose

Scores every candidate (investor, vendor, partner, recruiter, acquirer, advisor) against an entity's trajectory and needs. Returns ranked matches with explanations and recommended actions.

### Match Score Formula

```
match_score =
  need_fit        × 0.25
+ signal_alignment × 0.20
+ sector_fit      × 0.15
+ stage_fit       × 0.15
+ trajectory_fit  × 0.15
+ geography_fit   × 0.10
- mismatch_penalty
```

All dimensions normalized to 0–1.

### The Six Scoring Dimensions

| Dimension | Weight | What it asks |
|---|---|---|
| **Need fit** | 25% | Does this candidate solve the inferred high-urgency needs? |
| **Signal alignment** | 20% | Do observed signal classes match what this candidate engages with? |
| **Sector fit** | 15% | Does the candidate focus on this vertical? |
| **Stage fit** | 15% | Is this the right candidate for the company's current stage? |
| **Trajectory fit** | 15% | Does the candidate type match the trajectory direction? |
| **Geography fit** | 10% | Do they operate in the same market? |

### Timing Score (separate from match score)

Timing answers: **is now the right moment to engage?**

Two firms can have identical match scores but different timing scores. An accelerating Series A trajectory makes an early-stage VC highly urgent right now. The same company 18 months from now needs a different fund.

```
timing_score = (stage_fit × 0.60) + (velocity × 0.20) + accel_bonus + urgency_bonus
```

### Match Types

| Match Type | When used |
|---|---|
| `capital_match` | Company showing fundraising or investor interest signals |
| `vendor_match` | Company showing buyer pain, evaluation, or procurement signals |
| `buyer_match` | Company is an active purchasing target for a vendor |
| `partner_match` | Company showing expansion or partnership signals |
| `talent_match` | Company aggressively hiring |
| `acquirer_match` | Company showing exit or distress signals |
| `advisor_match` | Company needing strategic, financial, or operational advisory |

### Match Object Schema

```json
{
  "match_id": "match_startup_123_vc_456",
  "entity_id": "startup_123",
  "candidate_id": "vc_456",
  "candidate_name": "Accel Growth Fund",
  "candidate_type": "investor",
  "match_type": "capital_match",
  "match_score": 0.82,
  "timing_score": 0.91,
  "confidence": 0.87,
  "urgency": "high",
  "trajectory_used": "fundraising_active",
  "predicted_need": ["series_a_capital", "growth_capital"],
  "supporting_signals": ["hiring_signal", "enterprise_signal", "investor_interest_signal"],
  "explanation": [
    "Company is on a 'Active Fundraising' trajectory.",
    "Candidate focuses on enterprise software — matching entity sector.",
    "Candidate is ideal for current stage (fundraising_active).",
    "Signal velocity is accelerating — timing window is opening now.",
    "Predicted next moves: close_funding_round, hire_vp_sales."
  ],
  "recommended_action": "Prioritize outreach now — company is in active financing cycle.",
  "status": "active"
}
```

### Recommended Actions by Match Type and Urgency

| Match Type | High | Medium | Low |
|---|---|---|---|
| `capital_match` | Prioritize outreach now — active financing cycle | Initiate conversation; ask for intro call | Monitor — not yet in financing window |
| `vendor_match` | Reach out this quarter — buyer in evaluation or procurement | Enter with low-commitment pilot / POC | Monitor — buying intent signals present but early |
| `partner_match` | Propose partnership conversation now | Warm introduction via mutual contact | Monitor and initiate when signals intensify |
| `talent_match` | Company is hiring aggressively — submit proposals now | Reach out with relevant candidate profiles | Monitor hiring signals |
| `acquirer_match` | Exit signals present — request warm intro via advisor | Monitor closely — position for strategic conversation | Track; not yet actionable |

---

## 9. Scoring Model Reference

### Three Different Scores — Not Interchangeable

| Score | What it measures | Where it lives | Who sets it |
|---|---|---|---|
| **GOD Score** | Data quality and richness of a startup record | `startup_uploads.total_god_score` | `recalculate-scores.ts` |
| **Signal Confidence** | Credibility of a specific sentence/signal | `pythh_signal_events.confidence` | `signalParser.js` |
| **Trajectory Confidence** | Clarity of pattern match to a known trajectory | `pythh_trajectories.trajectory_confidence` | `trajectoryEngine.js` |
| **Match Score** | Fit between a company and a candidate right now | `pythh_matches.match_score` | `matchEngine.js` |

### GOD Score Adjustments (reference)

The GOD score penalizes records that fail quality gates after entering the system:

| Condition | Adjustment |
|---|---|
| Name is a country / geography | −0.90 |
| Name is a political figure | −0.90 |
| Name is a photo credit / attribution | −0.90 |
| Name is crypto slang compound | −0.90 |
| No website URL | −0.20 |
| No signal data | −0.15 |
| Low-confidence signals only | −0.10 |
| Verified costly action | +0.15 |
| Elite boost (top cohort) | +0.10 |
| Hot startup bonus | Variable |
| Investor pedigree bonus | Variable |

> The validator prevents most junk names from ever reaching GOD scoring. GOD then handles quality within the valid name population.

### Signal Strength Weights by Action Class

| Action | Base Signal Strength |
|---|---|
| Data room requested | 1.00 |
| RFP issued | 0.95 |
| Round closed | 0.90 |
| Restructuring | 0.88 |
| Strategic alternatives announced | 0.85 |
| Fundraising (active) | 0.85 |
| Launching product | 0.75 |
| Expanding geographies | 0.70 |
| Hiring (general) | 0.65 |
| Evaluating vendors | 0.55 |
| Piloting | 0.55 |
| Exploring options | 0.30 |

---

## 10. Database Schema

**Migration:** `supabase/migrations/20260327120000_signal_intelligence_schema.sql`

### Tables

| Table | Purpose | Key columns |
|---|---|---|
| `pythh_entities` | Companies, investors, buyers as intelligence subjects | `name`, `entity_type`, `sectors`, `stage`, `signal_velocity` |
| `pythh_signal_events` | Every parsed signal object | `primary_signal`, `confidence`, `signal_strength`, `costly_action`, `who_cares` |
| `pythh_trajectories` | Trajectory snapshots per entity per time window | `dominant_trajectory`, `velocity_score`, `consistency_score`, `stage_transition` |
| `pythh_entity_needs` | Inferred need objects per entity | `need_class`, `confidence`, `urgency`, `valid_until` |
| `pythh_candidates` | Investor / vendor / partner / acquirer profiles | `candidate_type`, `sectors`, `stages`, `need_classes_supported` |
| `pythh_matches` | Ranked match results with lifecycle tracking | `match_score`, `timing_score`, `urgency`, `status`, `explanation` |
| `pythh_signal_timeline` | Lightweight append-only signal time series | `event_date`, `signal_class`, `signal_strength` |

### Views

| View | Purpose |
|---|---|
| `pythh_top_matches` | Active high-confidence matches ranked by score |
| `pythh_active_trajectories` | Live trajectory snapshots at 90-day window |
| `pythh_signal_feed` | High-confidence recent signals across all entities |
| `pythh_urgent_needs` | Active needs with urgency = 'high' |

---

## 11. Signal Grammar Reference

Every sentence follows a pattern. Pythh decomposes it into:

| Element | Description | Example |
|---|---|---|
| **Actor** | Who is doing this | `startup`, `investor`, `buyer` |
| **Action** | What they are doing | `hiring`, `raising`, `evaluating`, `restructuring` |
| **Object** | What the action is directed at | `enterprise sales reps`, `Series A round`, `automation vendor` |
| **Modality** | How certain/committed | `active`, `planned`, `exploratory`, `hedged`, `negative` |
| **Intensity** | How strongly expressed | `aggressively`, `quickly`, `cautiously`, `quietly` |
| **Time** | When | `this quarter`, `next year`, `in 2026` |
| **Intent** | Why / purpose | `to expand into Europe`, `to extend runway` |
| **Context** | What domain / geography | `healthcare`, `enterprise`, `Europe` |
| **Posture** | Overall company stance | `confident`, `cautious`, `distressed` |

### Speaker Dictionaries

The platform understands that different actors speak differently:

**Founder / Startup language:**
- `"we're hiring"` → `growth_signal`
- `"aggressively hiring enterprise sales"` → `gtm_signal` + `enterprise_signal` (high intensity)
- `"raising our Series A"` → `fundraising_signal`
- `"extending our runway"` → `distress_signal`
- `"strategic alternatives"` → `exit_signal`

**Investor language (coded):**
- `"very interesting"` → weak interest, not a signal
- `"send the deck"` → early interest
- `"send the data room"` → serious diligence signal
- `"partner discussion"` → serious signal
- `"we're in diligence"` → very serious
- `"not a fit right now"` → soft rejection (still a signal)
- `"circle back later"` → soft rejection

**Buyer / Customer language:**
- `"looking for a solution"` → `buyer_pain_signal`
- `"evaluating vendors"` → `buyer_signal`
- `"running a POC"` → `buyer_signal` (high confidence)
- `"RFP issued"` → `buyer_budget_signal` (very high confidence)
- `"budget approved"` → `buyer_budget_signal`
- `"deploying across sites"` → confirmed event, not intent

---

## 12. Canonical Trajectory Types

| ID | Label | Description | Who Cares |
|---|---|---|---|
| `fundraising_active` | Active Fundraising | Company in or entering a financing cycle | Investors, Vendors, Recruiters |
| `gtm_expansion` | GTM Expansion | Commercial expansion — enterprise sales, new markets | Investors, Vendors, Partners, Recruiters |
| `product_maturation` | Product Maturation | Product moving from pilot toward GA and enterprise readiness | Investors, Vendors, Partners |
| `buyer_procurement` | Buyer Procurement Funnel | Organization moving through structured vendor selection | Vendors, Partners |
| `distress_survival` | Distress / Survival Mode | Company under financial or operational pressure | Investors, Acquirers |
| `exit_preparation` | Exit Preparation | Company preparing for sale, acquisition, or IPO | Investors, Acquirers |
| `repositioning` | Strategic Repositioning | Company pivoting market focus or customer segment | Investors, Vendors |
| `investor_diligence` | Investor Diligence Funnel | Investor advancing toward term sheet | Investors |
| `expansion_acceleration` | Expansion Acceleration | Opening new markets and geographies at pace | Investors, Vendors, Partners |
| `regulatory_enterprise` | Regulatory Clearance → Enterprise | Compliance milestone unlocking enterprise adoption | Investors, Vendors, Partners |
| `sustained_hiring` | Sustained Hiring | Consistent team growth — fundraising approaching | Investors, Recruiters, Vendors |

---

## 13. Canonical Need Classes

### Signal → Need Mapping (abbreviated)

| Signal Class | Top Needs Inferred |
|---|---|
| `hiring_signal` | engineering_talent, sales_talent, revops_tools |
| `gtm_signal` | enterprise_sales_support, revops_tools, sales_talent, lead_generation |
| `enterprise_signal` | enterprise_sales_support, compliance_tools, revops_tools, series_a_capital |
| `expansion_signal` | localization_support, channel_partners, growth_capital |
| `fundraising_signal` | series_a_capital, banker_advisor |
| `investor_interest_signal` | series_a_capital, series_b_capital |
| `distress_signal` | bridge_capital, turnaround_support, banker_advisor, acquirer_interest |
| `exit_signal` | acquirer_interest, banker_advisor |
| `buyer_pain_signal` | automation_vendor, robotics_vendor, pilot_partner |
| `buyer_signal` | pilot_partner, systems_integrator, automation_vendor |
| `buyer_budget_signal` | pilot_partner, systems_integrator, implementation_support |

### Trajectory → Need Overlay

| Trajectory Type | Additional Needs Injected |
|---|---|
| `fundraising` | series_a_capital (0.90), growth_capital (0.75), banker_advisor (0.60) |
| `expansion` | growth_capital (0.80), channel_partners (0.75), localization_support (0.70) |
| `distress` | bridge_capital (0.90), turnaround_support (0.80), banker_advisor (0.70) |
| `exit` | acquirer_interest (0.95), banker_advisor (0.90) |
| `buying` | pilot_partner (0.90), systems_integrator (0.85), procurement_support (0.75) |

---

## 14. Platform Applications

The same signal engine powers three distinct product surfaces:

### Pythh — Startup + Investor Intelligence
- Detects: startup fundraising intent, enterprise motion, distress, exit prep
- Matches: startups ↔ investors (by stage, sector, trajectory, timing)
- Output: investor deal flow, ranked by signal quality and timing

### Ready for Robots — Buyer Intent Detection
- Detects: operational pain, vendor evaluation, POC, RFP, deployment
- Matches: buyers ↔ robotics / automation vendors (by pain type, site count, geography)
- Output: vendor outreach targets ranked by procurement proximity

### Merlin — Energy & Infrastructure
- Detects: energy procurement signals, facility expansion, sustainability mandates
- Matches: facilities ↔ energy vendors / grid operators
- Output: energy vendor pipeline from building-level signals

**Same engine. Different signal dictionaries. Different candidate pools.**

---

## 15. Key Files Reference

| File | Purpose |
|---|---|
| `lib/startupNameValidator.js` | Name quality gate — 192 countries, person names, junk patterns |
| `lib/signalOntology.js` | Lexicons, action maps, source reliability, costly actions |
| `lib/signalParser.js` | Signal grammar extraction, 6D confidence model, multi-signal splitting |
| `lib/trajectoryEngine.js` | Velocity, consistency, stage transitions, anomalies, rolling windows |
| `lib/needsInference.js` | Signal + trajectory → canonical need classes |
| `lib/matchEngine.js` | Fit scoring, timing score, explanation layer, recommended actions |
| `lib/inferenceExtractor.js` | Inference layer for enrichment pipeline |
| `lib/sentenceExtractor.js` | Extract candidate sentences from article body text |
| `lib/headlineExtractor.js` | Extract startup names from headlines |
| `scripts/backfill-pythh-signals.js` | Backfill signal data on existing discovered_startups records |
| `scripts/enrich-from-rss-news.js` | Enrich startup_uploads from RSS signal data |
| `scripts/purge-junk-names.js` | Clean junk entries from startup_uploads using validator |
| `scripts/validate-enrich-pipeline.js` | Three-pass validation pipeline (P1→P2→P3) |
| `scripts/recalculate-scores.ts` | Recompute GOD scores across all startup_uploads |
| `scripts/check-signal-data.js` | Verify signal capture in database |
| `supabase/migrations/20260327120000_signal_intelligence_schema.sql` | Full signal intelligence DB schema |

---

*Last updated: March 2026*  
*Version: Platform v2 — Signal Intelligence Stack*
