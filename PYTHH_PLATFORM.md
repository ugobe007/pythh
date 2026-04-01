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
4. [Pipeline Execution Layer](#4-pipeline-execution-layer)
5. [Layer 1 — Data Ingestion & Name Validation](#5-layer-1--data-ingestion--name-validation)
6. [Layer 2 — Signal Parsing](#6-layer-2--signal-parsing)
7. [Shared Library Contracts](#7-shared-library-contracts)
8. [Signal Reconciliation Engine](#8-signal-reconciliation-engine)
9. [Layer 3 — Trajectory Engine](#9-layer-3--trajectory-engine)
10. [Layer 4 — Needs Inference Engine](#10-layer-4--needs-inference-engine)
11. [Layer 5 — Match Engine](#11-layer-5--match-engine)
12. [Scoring Model Reference](#12-scoring-model-reference)
13. [Database Schema](#13-database-schema)
14. [Signal Grammar Reference](#14-signal-grammar-reference)
15. [Canonical Trajectory Types](#15-canonical-trajectory-types)
16. [Canonical Need Classes](#16-canonical-need-classes)
17. [Platform Applications](#17-platform-applications)
18. [Known Silent Failure Modes & Defenses](#18-known-silent-failure-modes--defenses)
19. [Key Files Reference](#19-key-files-reference)

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

## 4. Pipeline Execution Layer

**File:** `scripts/run-pipeline.sh`

The pipeline is a 10-step shell script run on a cron schedule. Each step depends on the previous. Running steps out of order will produce inconsistent results.

### The 10 Steps

| Step | Script | What it does |
|------|--------|--------------|
| 0 | `scripts/fetch-rss-signals.js` | Scrape RSS feeds → `discovered_startups` |
| 1a | `scripts/ingest-pythh-signals.js` | Parse `startup_uploads` text → `pythh_signal_events` |
| 1b | `scripts/ingest-metrics-signals.js` | Convert numeric fields (ARR, MRR, headcount) → `pythh_signal_events` |
| 2 | `scripts/ingest-discovered-signals.js` | Parse `discovered_startups` text → `pythh_signal_events` |
| 2b | `scripts/fetch-sec-signals.js` | Fetch SEC EDGAR Atom feeds → `pythh_signal_events` |
| 3 | `scripts/enrich-signals-llm.js` | GPT-4o-mini enrichment for sparse entity descriptions |
| 4 | `scripts/fetch-realtime-signals.js` | Premium API hooks (Crunchbase, PitchBook, LinkedIn) |
| 5 | `scripts/reconcile-signals.js` | 6-phase reconciliation: stamp → dedup → conflict → orphan → timeline → metadata |
| 6 | `scripts/compute-trajectories.js` | Build trajectory snapshots per entity per time window |
| 7 | `scripts/compute-needs.js` | Infer canonical need classes from trajectories |
| 8 | `scripts/compute-matches.js` | Score entities against candidates → ranked match objects |

### Signal Flow

```
startup_uploads (text fields)     ─────► ingest-pythh-signals.js  ──┐
startup_uploads (numeric fields)  ─────► ingest-metrics-signals.js ──┤
discovered_startups               ─────► ingest-discovered-signals.js►├──► pythh_signal_events
SEC EDGAR feeds                   ─────► fetch-sec-signals.js      ──┤
Premium APIs                      ─────► fetch-realtime-signals.js ──┘
                                                                      │
                                              reconcile-signals.js ◄──┘
                                                        │
                                                        ▼
                                            pythh_signal_events (clean)
                                                        │
                                          ┌─────────────┼─────────────┐
                                          ▼             ▼             ▼
                               compute-trajectories  compute-needs  compute-matches
                                          │             │             │
                                          ▼             ▼             ▼
                               pythh_trajectories  pythh_entity_needs  pythh_matches
```

### Dependency Rules

- Steps 1–4 can all run before step 5 (reconciliation requires complete ingestion)
- Step 5 (reconcile) must complete before step 6 (trajectories are built on clean signals)
- Step 6 must complete before steps 7 and 8 (needs and matches depend on trajectories)
- All 10 steps must complete before any product surfaces re-query

### Source Type Taxonomy

Every signal event has a `source_type` that maps to a reliability score in `lib/signalOntology.js`. This determines how signals are weighted in confidence scoring and reconciliation.

| source_type | Reliability | Origin |
|-------------|-------------|--------|
| `sec_filing` | 1.00 | SEC EDGAR |
| `structured_metrics` | 0.95 | `startup_uploads` numeric fields (ARR, MRR, headcount) |
| `earnings_call` | 0.95 | Earnings call transcripts |
| `execution_signals` | 0.88 | Founder-reported milestones in submission form |
| `press_release` | 0.90 | Official press releases |
| `llm_enrichment` | 0.72 | GPT-4o-mini interpretation of sparse descriptions |
| `rss_scrape` | 0.65 | RSS feed article text |
| `description` | 0.60 | Unstructured startup submission text |
| `linkedin` | 0.70 | LinkedIn posts (founder-attributed) |
| `social_media` | 0.40 | Twitter / general social |
| `rumor_site` | 0.30 | Unverified sources |

---

## 5. Layer 1 — Data Ingestion & Name Validation

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

## 6. Layer 2 — Signal Parsing

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

### Signal Class Priority

When multiple patterns match the same sentence, the class with the highest priority wins as `primary_signal`. Current order (highest → lowest):

```
acquisition_signal → exit_signal → distress_signal → exploratory_signal
→ fundraising_signal → revenue_signal → buyer_budget_signal → buyer_signal
→ buyer_pain_signal → investor_interest_signal → investor_rejection_signal
→ regulatory_signal → market_position_signal → product_signal → hiring_signal
→ enterprise_signal → expansion_signal → gtm_signal → demand_signal
→ growth_signal → partnership_signal → efficiency_signal → infrastructure_signal
```

**`exploratory_signal` is ranked above `fundraising_signal`.** This is intentional. Modal-past language ("had planned to raise", "was hoping to launch") is more specific and must take priority over a generic raise/hire pattern.

### Gate Semantics

Gate semantics prevent suppressed patterns from leaking into `alternate_signals`.

When a **modal-past** pattern fires, it carries a `gates` array. `detectActions()` removes all gated classes from the result set entirely — not just from the primary position.

```
"We had planned to raise a Series B last year."
  ✓ exploratory_signal fires
  ✗ fundraising_signal suppressed (gated)

Without gates: primary=exploratory_signal, alts=[fundraising_signal]  ← wrong
With gates:    primary=exploratory_signal, alts=[]                    ← correct
```

Currently gated by modal-past patterns: `fundraising_signal`, `hiring_signal`, `acquisition_signal`, `expansion_signal`, `product_signal`. Negated signals additionally produce empty `alternate_signals`.

---

## 7. Shared Library Contracts

These two files are the architectural foundation that prevents silent drift between scripts.

### `lib/signalEventBuilder.js`

**Problem it solves:** Multiple ingest scripts each had their own `parseSignal()` → DB row translation. Each was wrong in a different way (`sig._intensity` vs `sig.intensity`, `sig.is_ambiguous` vs `sig.ambiguity_flags.length > 0`). Schema changes required updating every script independently.

**What it does:** Single function `buildSignalEvent(sig, meta)` — the canonical translator from `parseSignal()` output to a `pythh_signal_events` row.

```js
const row = buildSignalEvent(sig, {
  entityId:    'uuid',
  rawSentence: 'original text',
  sourceType:  'rss_scrape',            // controls source_reliability lookup
  source:      'TechCrunch',
  sourceUrl:   'https://...',
  detectedAt:  '2026-03-30T12:00:00Z',
});
```

**The canonical field mapping — source of truth:**

| DB Column | Maps from | Common wrong name (now banned) |
|-----------|-----------|-------------------------------|
| `is_ambiguous` | `sig.ambiguity_flags.length > 0` | `sig.is_ambiguous` |
| `has_negation` | `sig.negation_detected` | `sig.has_negation` |
| `intensity` | `sig.intensity` | `sig._intensity` |
| `sub_signals` | `sig.alternate_signals` | `sig._sub_signals` |
| `is_multi_signal` | `sig.alternate_signals.length > 0` | — |
| `action_tag` | `sig._actions[0].action_tag` | — |
| `modality` | `sig.modality.class` (string) | `sig.modality` (object) |
| `posture` | `sig.posture[0].posture` (string) | `sig.posture` (array) |

Also exports `buildTimelineEvent(sig, meta)` for `pythh_signal_timeline` rows.

**Rule:** All ingest scripts that call `parseSignal()` must use `buildSignalEvent()`. Manual field mapping is prohibited. When the schema changes, update only this file.

---

### `lib/supabaseUtils.js`

**Problem it solves:** Every script independently implemented batching, pagination, and chunked `.in()` queries with different (often wrong) constants. The PostgREST URL length limit was independently re-discovered and re-patched in 6+ places over multiple sessions.

**What it does:** Shared Supabase infrastructure with documented, enforced constants.

```js
const {
  fetchAll,               // paginate through all rows — bypasses Supabase 1,000-row cap
  fetchByIds,             // safe chunked .in() queries (100 IDs per request)
  deleteByIds,            // safe chunked .delete() (100 IDs per request)
  insertInBatches,        // batched inserts (200 rows per request)
  upsertInBatches,        // batched upserts with conflict resolution (50 rows)
  getAlreadyIngestedToday // idempotency check: entity + source_type + today
} = require('../lib/supabaseUtils');
```

**The enforced constants:**

| Constant | Value | Why |
|----------|-------|-----|
| `IN_CHUNK_SIZE` | `100` | 100 UUIDs ≈ 3.6KB URL. 200 ≈ 7.2KB — intermittently fails. 500 — reliably fails silently. |
| `INSERT_BATCH` | `200` | Optimal insert throughput against Supabase |
| `UPSERT_BATCH` | `50` | Smaller — each upsert row is a full read+write |

**Rule:** No script should pass more than `IN_CHUNK_SIZE` IDs to a `.in()` clause directly. Use `fetchByIds` or `deleteByIds` from this file instead.

---

## 8. Signal Reconciliation Engine

**File:** `scripts/reconcile-signals.js`

Runs after all ingestion (steps 1–4b), before intelligence recompute (steps 5–8). Cleans, deduplicates, and enriches signal data across all sources.

### The 6 Phases

| Phase | Scope | What it does |
|-------|-------|-------------|
| 1 — Reliability Stamping | **All-time** | Stamps `source_reliability` on any signal missing it, using `SOURCE_RELIABILITY` from `signalOntology.js` |
| 3 — Orphan Cleanup | **All-time** | Removes signals whose `entity_id` no longer has an active entity in `pythh_entities` |
| 4 — Deduplication | Windowed | Clusters signals by `(entity_id, primary_signal, 7-day bucket)`, merges duplicates, boosts confidence via ensemble: `1 - (1 - base)^N` |
| 5 — Conflict Detection | 30-day window | Flags opposing signals (e.g., `fundraising_signal` + `distress_signal` within 30 days) as `is_ambiguous: true` |
| 6 — Entity Metadata Refresh | **All-time** | Recomputes `total_signals`, `signal_velocity`, `decayed_signal_velocity` for all touched entities |

### Phase Scoping Rules

**Why some phases are all-time:** Applying a date filter to orphan cleanup or reliability stamping means historical problems are never fixed. The date filter is only appropriate for deduplication (where historical dedup was already done in prior runs).

| Phase | Date Filter | Reason |
|-------|------------|--------|
| 1 (Reliability) | None | Signals ingested before reliability stamping was added need retroactive stamping |
| 3 (Orphan Cleanup) | None | Orphans accumulate over all time |
| 4 (Dedup) | `--days` window | New signals only; prior dedup already ran |
| 5 (Conflict) | 30 days | Conflicts only meaningful in temporal proximity |
| 6 (Metadata) | None | Velocity must reflect full signal history |

### Signal Decay

Signals lose influence over time via exponential half-life decay. This is calculated in Phase 6 and stored in entity metadata as `decayed_signal_velocity`.

| Signal Class | Half-life (days) |
|---|---|
| `distress_signal` | 14 |
| `exit_signal` | 30 |
| `investor_interest_signal` | 30 |
| `fundraising_signal` | 45 |
| `hiring_signal` | 60 |
| `product_signal` | 60 |
| `revenue_signal` | 90 |
| `growth_signal` | 90 |
| `expansion_signal` | 90 |
| `partnership_signal` | 90 |
| All others | 120 |

---

## 9. Layer 3 — Trajectory Engine

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

## 10. Layer 4 — Needs Inference Engine

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

## 11. Layer 5 — Match Engine

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

## 12. Scoring Model Reference

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

## 13. Database Schema

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

## 14. Signal Grammar Reference

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

## 15. Canonical Trajectory Types

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

## 16. Canonical Need Classes

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

## 17. Platform Applications

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

## 18. Known Silent Failure Modes & Defenses

This section documents every class of failure that has recurred in this system — failures that do not raise exceptions, produce no error output, and silently corrupt data or return wrong results. The pattern is: fix gets applied → works for a while → something changes → breaks silently again.

**The root cause of recurrence is always the same: the fix was local (one script) and the constraint was not enforced globally.**

---

### Failure Mode 1: PostgREST URL Length Limit

**What happens:** Supabase's PostgREST API silently truncates or returns empty results when a `.in()` filter contains too many IDs. The URL becomes too long (>8KB). No error is raised. Queries return empty data, which is treated as "no results found" — causing valid signals to be deleted as orphans, or valid entities to be skipped.

**Observed history:**
- Chunk size 500 → failure
- Chunk size 200 → intermittent failure
- Chunk size 100 → safe

**Current defense:** All `.in()` queries use `fetchByIds()` or `deleteByIds()` from `lib/supabaseUtils.js`. `IN_CHUNK_SIZE = 100` is documented with the reason in the constant definition.

**How it silently breaks again:** A new script is written that directly calls `.in()` with a large list of IDs, bypassing `supabaseUtils.js`. The fix is architectural enforcement, not documentation: **all DB access must go through `supabaseUtils.js`**.

---

### Failure Mode 2: Field Name Drift Between Parser and DB Schema

**What happens:** `signalParser.js` returns fields with one set of names. Ingest scripts map them to DB columns with different names. The wrong field is written (usually `false` or `[]`) to the DB. No error. Signals are stored with `is_ambiguous: false` even when they are genuinely ambiguous.

**Observed history:**
- `sig.is_ambiguous` (doesn't exist) → DB column `is_ambiguous` always `false`
- `sig.has_negation` (doesn't exist) → DB column `has_negation` always `false`
- `sig._intensity` (doesn't exist) → DB column `intensity` always `[]`
- `sig._sub_signals` (doesn't exist) → DB column `sub_signals` always `[]`

**Current defense:** `lib/signalEventBuilder.js` owns the sole field mapping. All ingest scripts call `buildSignalEvent()`. Manual field mapping is prohibited.

**How it silently breaks again:** A new ingest script is added that builds the event row manually. Or `signalParser.js` renames an output field without updating `signalEventBuilder.js`. The fix is: **`signalEventBuilder.js` must be the only place this mapping exists, and any rename to `signalParser.js` output must be reflected here first.**

---

### Failure Mode 3: Supabase 1,000-Row `max_rows` Cap

**What happens:** Supabase PostgREST enforces a server-side `max_rows` limit (often 1,000). Scripts that read all signals without pagination silently receive only the first 1,000 rows. The reconciler processed 1,000 signals when the table had 13,000+. Deduplication and orphan cleanup appeared to complete successfully but only ran on a fraction of the data.

**Current defense:** All paginated queries use `fetchAll()` from `lib/supabaseUtils.js`, which loops until `data.length < pageSize`.

**How it silently breaks again:** A new script reads from a large table with `.select()` and no pagination. Always use `fetchAll()` for any table that could exceed 1,000 rows. As a rule of thumb: `pythh_signal_events`, `startup_uploads`, `discovered_startups`, `pythh_entities`, `pythh_trajectories` all require pagination.

---

### Failure Mode 4: Modal-Past Language Misclassified as Active Intent

**What happens:** "We had planned to raise a Series B" is classified as `fundraising_signal` (active) instead of `exploratory_signal` (abandoned/deferred intent). The company is shown to investors as actively fundraising when it explicitly said it is not.

**Current defense:** Modal-past patterns carry a `gates` array in `signalOntology.js`. `detectActions()` removes gated classes entirely from results. `exploratory_signal` is ranked above `fundraising_signal` in `SIGNAL_CLASS_PRIORITY`.

**How it silently breaks again:** A new pattern is added to `ACTION_MAP` for a raise/hire/launch verb without checking whether a modal-past guard covers it. Or `SIGNAL_CLASS_PRIORITY` is reordered and `exploratory_signal` drops below `fundraising_signal`. The fix: **before adding any action pattern for a major signal class, check whether it could co-fire with a modal-past pattern and add it to the `gates` array if needed.**

---

### Failure Mode 5: Reconciler Phase 3 Deleting Valid Signals as Orphans

**What happens:** Phase 3 queries `pythh_entities` with `.in('id', entityIds).eq('is_active', true)`. When `entityIds` exceeds the PostgREST URL limit, the query returns 0 rows. All signals are treated as orphaned and deleted. This silently destroyed 11,000+ valid signals in one run.

**Current defense:** Phase 3 uses `fetchByIds()` with chunks of 100 IDs. Phase 3 now scans all signals (no date filter) to catch historical orphans.

**How it silently breaks again:** The chunk size in `fetchByIds()` is changed, or Phase 3 is refactored to use a direct `.in()` call. **Never bypass `supabaseUtils` functions for entity validation lookups in the reconciler.**

---

### Failure Mode 6: Idempotency — Duplicate Metric Signals on Re-run

**What happens:** `ingest-metrics-signals.js` inserts new metric signals every time it runs. Re-running the pipeline inserts duplicate `structured_metrics` signals for the same entity on the same day. The reconciler eventually deduplicates them, but between the ingest run and the reconciliation run, data is inflated.

**Current defense:** `getAlreadyIngestedToday()` from `supabaseUtils.js` checks for existing `structured_metrics` signals per entity per UTC day before inserting.

**How it silently breaks again:** The idempotency guard only checks `source_type = 'structured_metrics'`. Other ingest scripts (`ingest-pythh-signals.js`, `ingest-discovered-signals.js`) do not have per-day idempotency guards — they rely on `--skip-existing` flag and the reconciler. If `--skip-existing` is not passed on a re-run, duplicates accumulate. **The reconciler must always run after re-ingestion.**

---

### What Is Still Not Defended Against

These are known gaps that do not yet have a programmatic defense:

| Gap | Risk | Proposed fix |
|-----|------|-------------|
| No regression test suite | Any script change could break parsing silently | `scripts/test-signal-parsing.js` with ~50 canonical cases and expected outputs |
| `decayed_signal_velocity` stored in JSONB metadata | Can't be indexed or queried efficiently; upsert overwrites entire metadata object | Add `decayed_signal_velocity FLOAT` column via Supabase migration |
| No pipeline health check script | Can't tell if a run produced the expected number of signals without manual inspection | `scripts/check-pipeline-health.js` that asserts signal counts, orphan rates, and velocity distributions |
| `enrich-signals-llm.js` timestamps all LLM signals as `now()` | Historical content gets a current timestamp, distorting velocity calculations | Pass original `detected_at` from source content where available |
| `ingest-pythh-signals.js` has no per-entity idempotency guard | If `--skip-existing` is forgotten, every entity gets re-parsed and re-inserted | Add a daily idempotency check using `getAlreadyIngestedToday('startup_submission')` |

---

## 19. Key Files Reference

### Core Libraries (never import DB logic directly — use these)

| File | Purpose |
|---|---|
| `lib/supabaseUtils.js` | **Shared DB infrastructure.** `fetchAll`, `fetchByIds`, `deleteByIds`, `insertInBatches`, `upsertInBatches`, `getAlreadyIngestedToday`. All scripts use this. No script should implement its own batching or chunking. |
| `lib/signalEventBuilder.js` | **Canonical field mapper.** `buildSignalEvent(sig, meta)` and `buildTimelineEvent(sig, meta)`. The only place the `parseSignal() output → DB column` mapping exists. |
| `lib/signalOntology.js` | Lexicons, `ACTION_MAP` (with `gates` arrays), `SIGNAL_CLASS_PRIORITY`, `SOURCE_RELIABILITY`, `INTENSITY_MAP`, `POSTURE_MAP`, costly actions |
| `lib/signalParser.js` | Signal grammar extraction, 6D confidence model, multi-signal splitting, gate enforcement in `detectActions()` |
| `lib/startupNameValidator.js` | Name quality gate — 192 countries, person names, junk patterns, safe overrides |
| `lib/trajectoryEngine.js` | Velocity, consistency, stage transitions, anomaly detection, rolling windows |
| `lib/needsInference.js` | Signal + trajectory → 27 canonical need classes |
| `lib/matchEngine.js` | 6-dimension fit scoring, timing score, explanation layer, recommended actions |
| `lib/sentenceExtractor.js` | Extract candidate sentences from article body text |
| `lib/headlineExtractor.js` | Extract startup names from headlines |

### Pipeline Scripts (execution order matters)

| File | Step | Purpose |
|---|---|---|
| `scripts/fetch-rss-signals.js` | 0 | Scrape RSS feeds → `discovered_startups` |
| `scripts/ingest-pythh-signals.js` | 1a | Parse `startup_uploads` text → signals |
| `scripts/ingest-metrics-signals.js` | 1b | Convert ARR/MRR/headcount → signals |
| `scripts/ingest-discovered-signals.js` | 2 | Parse `discovered_startups` text → signals |
| `scripts/fetch-sec-signals.js` | 2b | SEC EDGAR Atom feed → signals |
| `scripts/enrich-signals-llm.js` | 3 | GPT-4o-mini enrichment for sparse descriptions |
| `scripts/fetch-realtime-signals.js` | 4 | Premium API hooks (Crunchbase, PitchBook, LinkedIn) |
| `scripts/reconcile-signals.js` | 5 | 6-phase reconciliation: stamp → dedup → conflict → orphan → timeline → metadata |
| `scripts/compute-trajectories.js` | 6 | Build trajectory snapshots per entity per window |
| `scripts/compute-needs.js` | 7 | Infer canonical need classes from trajectories |
| `scripts/compute-matches.js` | 8 | Score entities against candidates → ranked matches |
| `scripts/sync-signal-scores.js` | 9 | Bridge pythh_signal_events → startup_signal_scores (5 dimensions) |
| `scripts/run-pipeline.sh` | — | Master orchestration script (cron-scheduled) |

### Other Scripts

| File | Purpose |
|---|---|
| `scripts/purge-junk-names.js` | Clean junk entries from startup_uploads using validator |
| `scripts/recalculate-scores.ts` | Recompute GOD scores across all startup_uploads |
| `scripts/check-signal-data.js` | Verify signal capture in database |
| `scripts/setup-cron.sh` | Install daily (6am) + weekly (Sun 2am) pipeline cron jobs |
| `supabase/migrations/20260327120000_signal_intelligence_schema.sql` | Full signal intelligence DB schema |

---

## Signal Score Bridge: sync-signal-scores.js

**Problem (discovered March 31 2026):**
`get_startup_context` RPC reads `startup_signal_scores` table for the 5 signal dimension scores
shown in `SignalHealthHexagon`. This table was populated only at submission time by the old backend
scoring system. The new `pythh_signal_events` pipeline (steps 1–8) **never wrote back to it**,
meaning every founder saw 0 on their Signal Health chart.

**Fix:**
`scripts/sync-signal-scores.js` (step 9 in pipeline) aggregates `pythh_signal_events` per entity
and maps signal classes to the 5 dimensions:

| Dimension | Max | Contributing Signal Classes |
|---|---|---|
| `founder_language_shift` | 2.0 | exploratory, product, market_position, gtm, expansion |
| `investor_receptivity` | 2.5 | fundraising, revenue, growth, acquisition, enterprise, demand |
| `news_momentum` | 1.5 | source_type = rss_scrape / execution_signals / web_signals (recency-weighted) |
| `capital_convergence` | 2.0 | fundraising, acquisition, exit, revenue, growth (recency-weighted) |
| `execution_velocity` | 2.0 | product, hiring, growth, expansion, partnership, gtm (recency-weighted) |

Score formula per dimension: `Σ(confidence × signal_strength × class_weight × recency_mult)`, clamped to cap.

**Result:** 2,605 `startup_signal_scores` rows upserted. SignalHealthHexagon now shows real data.

**Recency multiplier:**
- < 7 days old → 1.5×
- < 30 days → 1.0×
- < 90 days → 0.7×
- older → 0.4×

**Cron:** Runs as step 9 after matches. Scheduled daily (signals-only mode) at 6am + weekly full run Sunday 2am via `setup-cron.sh`.

---

## Trajectory Engine: TYPE_MAP Expansion (March 31 2026)

**Problem:** `getDominantType()` in `lib/trajectoryEngine.js` had an incomplete TYPE_MAP.
Any entity whose dominant signal was `revenue_signal`, `market_position_signal`,
`demand_signal`, `partnership_signal`, `exploratory_signal`, `regulatory_signal`, etc.
would receive trajectory = `'unknown'` even when there was a clear story.

**Fix:** Expanded TYPE_MAP to cover all signal classes:
- `revenue_signal`, `demand_signal` → `growth`
- `market_position_signal`, `partnership_signal` → `expansion`
- `exploratory_signal` → `fundraising`
- `regulatory_signal`, `infrastructure_signal`, `grant_signal`, `patent_signal`, `university_signal` → `product`
- `investor_rejection_signal` → `fundraising`

**Result:** Unknown trajectories reduced from 1,939 → 1,243 (36% reduction).
Remaining unknowns are genuinely ambiguous: signals fully decayed past the 90-day window,
or entities whose dominant signal is `negated_signal` / `unclassified_signal`.

---

---

---

## Canonical Column Deduplication (March 31 2026)

### Problem
Scrapers and enrichment scripts wrote financial data to three separate locations:
- `extracted_data.funding_amount` (JSONB object `{raw, value, currency, magnitude}`)
- `startup_metrics.best_mentions.last_round_amount.amount_usd` (text-mined JSONB)
- Root numeric columns (`latest_funding_amount`, `arr_usd`, etc.)

`ingest-metrics-signals.js` only reads root columns. Result: data existed in the database but was invisible to the signal pipeline. `latest_funding_amount` appeared to have ~411 rows populated; it actually had 11,728 — just stranded in JSONB.

### Design Rule (enforced from this point forward)
**No aliases. No bridge tables. Scrapers write directly to the canonical root column.**
JSONB blobs (`extracted_data`, `startup_metrics`) are for raw provenance/audit only.

### What Was Promoted (`scripts/promote-extracted-fields.js`)

| Source | Target Root Column | Rows Promoted |
|---|---|---|
| `startup_metrics.best_mentions.last_round_amount.amount_usd` | `latest_funding_amount` | 943 |
| `extracted_data.funding_amount` (JSONB object) | `latest_funding_amount` | 2,961 |
| `extracted_data.growth_rate` | `growth_rate` | 184 |
| `extracted_data.customer_count` | `customer_count` | 25 |
| `revenue_annual` (legacy dup) | `revenue_usd` | 6 |
| **Total** | | **4,119** |

### Deprecated Columns (still present, do not write to)

| Deprecated | Canonical | Status |
|---|---|---|
| `arr` | `arr_usd` | Stop writing to `arr`; future migration will DROP |
| `revenue_annual` | `revenue_usd` | Stop writing; future migration will DROP |

### Impact
- `latest_funding_amount > 0`: 411 → **11,728** rows (+2,753%)
- `growth_rate > 0`: 0 → **184** rows
- `fundraising_signal` events: 465 → **625** (+34%)
- `startup_signal_scores` upserted: 2,605 → **2,756**

### Migration
`supabase/migrations/20260331300000_canonical_column_dedup.sql` — applies `arr → arr_usd`
and `revenue_annual → revenue_usd` promotions at the DB level and creates covering indexes
on all metric columns used by the signal pipeline.

### Idempotency
`promote-extracted-fields.js` is safe to re-run: it never overwrites a non-null root value.
On the next daily cron run, `ingest-metrics-signals.js` will see all newly promoted data
and generate fresh metric signals for the newly populated rows.

---

*Last updated: March 31 2026*  
*Version: Platform v5 — Canonical Column Deduplication + Field Promotion Pipeline*
