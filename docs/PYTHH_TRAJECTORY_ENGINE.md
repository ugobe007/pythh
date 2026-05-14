# Pythh — Company Trajectory Engine

**Purpose:** Describe how Pythh turns **time-ordered signals** into **trajectory prediction** (where a company is heading, what may happen next). For product, engineering, and IP documentation.

**Implementation:** `lib/trajectoryEngine.js` (`buildTrajectory`, `matchTrajectoryPatterns`). Signals are produced by `lib/signalParser.js` and related ingest (RSS, enrichment). UI surfaces include trajectory fields on signal/startup views (e.g. `SignalFeedPage`, `InvestorStartupDetailPage`).

---

## 1. Product concept: patterns, not isolated pings

Instead of treating each headline or event as a one-off, the engine looks for **ordered sequences** over a time window. Example **storylines** the product is designed to recognize:

| Narrative (human) | Why it matters |
|-------------------|----------------|
| Hiring → sales/GTM hiring → enterprise motion → diligence → fundraising | Classic path to a financing event |
| Pilot / demand → RFP → vendor selection → deployment | Buyer-side procurement funnel |
| Restructuring / cost pressure → bridge financing → sale | Distress-to-exit arc |
| Hiring → new footprint → expansion → growth round (e.g. Series B) | Scale-up and geographic growth |

When enough signals align **in order** within **max gap** days, the system labels a **trajectory**, scores **confidence**, and emits **predicted next moves** for investors, vendors, recruiters, or acquirers.

---

## 2. How the engine works (technical)

1. **Input:** Chronological list `{ date, signal }` where `signal` is a parsed object (`primary_signal`, confidence, etc.).
2. **Velocity:** Weighted, recency-decayed activity score (`VELOCITY_WEIGHTS`).
3. **Consistency:** Domain clustering (e.g. growth vs distress) via `SIGNAL_DOMAIN` and concentration scoring.
4. **Pattern match:** `TRAJECTORY_PATTERNS` each define:
   - `sequence`: ordered steps; each step accepts **one of** several `signal` classes and a `max_gap_days` limit to the previous matched step.
   - `predicted_next_moves`, `who_cares`, `strength`, `type`, `label`, `description`.
5. **Output:** Dominant trajectory, confidence, stage hints, timeline rollup, matched patterns (for debugging and UI).

Pattern matching today uses **`primary_signal` only** (not alternate sub-signals). Longer chains need **distinct events** in history with those primaries.

---

## 3. Narrative → pattern IDs (as implemented)

These four patterns encode the storylines above using the **current** coarse signal ontology (`hiring_signal`, `gtm_signal`, `enterprise_signal`, …):

| Pattern ID | Maps to narrative |
|------------|-------------------|
| `hiring_ladder_to_finance` | Hiring → sales/GTM → enterprise → investor interest → fundraising |
| `pilot_rfp_deploy` | Pilot/demand → pain/RFP → vendor eval → deployment-scale signals |
| `restructure_bridge_sale` | Restructuring/efficiency → sustained distress → bridge-like financing → exit/M&A |
| `hiring_office_expansion_series_b` | Hiring → expansion footprint → scale → growth financing |

Older patterns (`fundraising_active`, `buyer_procurement`, `distress_survival`, `expansion_acceleration`, …) remain for overlapping but shorter sequences.

---

## 4. Typed hiring and diligence (implemented)

**Ontology** (`lib/signalOntology.js`) now includes:

| Class | Role |
|-------|------|
| `gtm_hiring_signal` | Sales / GTM / marketing leadership or IC roles (AE, SDR, CRO, CMO, “sales team is hiring”, …) |
| `engineering_hiring_signal` | Engineering / platform / security hires (engineers, CTO, VP Eng, SRE, …) |
| `diligence_signal` | Data room, VDR, formal due diligence phrasing (distinct from deck requests / generic investor interest) |

The **`hiring_ladder_to_finance`** trajectory uses `gtm_hiring_signal` in the sales-build step and **`diligence_signal`** before `fundraising_signal` (with `investor_interest_signal` as fallback).

**Still roadmap:** `pilot_signal`, `bridge_financing_signal`, matching **`alternate_signals`** in `matchTrajectoryPatterns`, and frame-parser role tags for even finer chains.

---

## 5. Related files

| File | Role |
|------|------|
| `lib/trajectoryEngine.js` | Patterns, scoring, `buildTrajectory` |
| `lib/signalParser.js` | Signal classes and parsing |
| `lib/event-classifier.js` | Fast headline classification |
| `docs/PYTHH_SCRAPERS_PARSERS_WORKFLOW.md` | Ingest path into signals |

---

## 6. Document control

When adding a new **named storyline**, add a `TRAJECTORY_PATTERNS` entry (with tests or fixture history if possible) and a row in section 3 of this doc.
