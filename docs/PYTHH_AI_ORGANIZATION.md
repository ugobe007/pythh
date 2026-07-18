# Pythh AI Organization — Agent Map & Codebase

> **Companion to:** [PYTHH_VISION.md](./PYTHH_VISION.md)  
> **Purpose:** Map existing systems and agents to the six operating groups; define the agent loop graph; identify build gaps.  
> **Last updated:** 2026-07-18

---

## Organization model

Pythh is an **organization of AI agents**, not a single agent (Peter or PYTHIA alone).

```mermaid
flowchart TB
  O[ORACLE<br/>Chief Strategy + Orchestrator]

  subgraph G1["1 · Company Intelligence"]
    G1A[URL Scraper Agent]
    G1B[Signal Parser Agent]
    G1C[GOD Scorer Agent]
    G1D[Trajectory Agent]
    G1E[Needs Inference Agent]
  end

  subgraph G2["2 · Company Builder"]
    G2A[Gap Analyst Agent]
    G2B[Task Planner Agent]
    G2C[Proof Verifier Agent]
    G2D[Advisor Finder Agent]
    G2E[Positioning Agent]
  end

  subgraph G3["3 · Capital Intelligence"]
    G3A[Investor Profiler Agent]
    G3B[Thesis Extractor Agent]
    G3C[Portfolio Signal Agent]
    G3D[Match Ranker Agent]
    G3E[Timing Agent]
  end

  subgraph G4["4 · Fundraising Studio"]
    G4A[Narrative Agent]
    G4B[Deck Builder Agent]
    G4C[Memo Writer Agent]
    G4D[Outreach Drafter Agent]
    G4E[Meeting Prep Agent]
  end

  subgraph G5["5 · Campaign Operations"]
    G5A[Segmentation Agent]
    G5B[Sequence Agent]
    G5C[Outreach Sender Agent]
    G5D[Reply Classifier Agent]
    G5E[Calendar Agent]
    G5F[Peter · Human Specialist]
  end

  subgraph G6["6 · Learning & Optimization"]
    G6A[Funnel Analyst Agent]
    G6B[Growth Experiment Agent]
    G6C[Product Agent]
    G6D[Research Agent]
    G6E[Match Feedback Agent]
    G6F[Campaign Analyst Agent]
  end

  O --> G1 & G2 & G3 & G4 & G5 & G6
  G6 -.->|feedback weights| G1 & G3 & G4 & G5
```

---

## Agent loop graph (master)

The master loop connects all groups through the three graphs:

```mermaid
flowchart TB
  subgraph INPUT["Founder input"]
    URL[Company URL]
    GOALS[Goals + constraints]
    DEC[Occasional decisions]
  end

  subgraph GRAPHS["Three graphs"]
    CG[(Company Graph)]
    KG[(Capital Graph)]
    EG[(Execution Graph)]
  end

  subgraph LOOP["Continuous agent loop"]
    direction TB
    L1[CI: Ingest + score company] --> L2[CI+CB: Identify gaps]
    L2 --> L3[CB+FS: Improve materials]
    L3 --> L4[CI+CAP: Qualify investors]
    L4 --> L5[FS: Build campaign]
    L5 --> L6[CO: Execute outreach]
    L6 --> L7[CO: Follow-up + schedule]
    L7 --> L8[LO: Measure outcomes]
    L8 --> L9[Oracle: Replan]
    L9 --> L1
  end

  URL & GOALS --> L1
  DEC --> L5 & L6
  L1 --> CG
  L4 --> KG
  L6 & L7 --> EG
  CG & KG & EG --> L9

  OUT[Qualified investor meetings] --> L8
  L7 --> OUT
```

---

## Internal agent roster (current + planned)

### Tier 0 — Orchestrator

| Agent | Status | Path | Role |
|-------|--------|------|------|
| **Oracle** | Partial | `server/routes/oracle.js`, `server/lib/oracleMemoryStore.js` | Founder-facing strategy; needs unification with wizard |
| **Scout (Orchestrator)** | Exists | `agents/ORCHESTRATOR.md`, `scripts/orchestrator-brief.mjs`, `scripts/agents-autopilot.mjs` | Internal ops — funnel weakest-stage focus |

### Tier 1 — Specialist agents (by operating group)

#### 1. Company Intelligence

| Agent | Status | Implementation |
|-------|--------|----------------|
| URL Scraper | ✅ Exists | `server/services/urlScrapingService.ts`, `server/services/submitUrlIntelligence.js` |
| Signal Parser | ✅ Exists | `lib/signalParser.js`, `lib/signalOntology.js` |
| GOD Scorer | ✅ Exists | `server/services/startupScoringService.ts`, `server/routes/god.js` |
| Trajectory | ✅ Exists | `lib/trajectoryEngine.js` |
| Needs Inference | ✅ Exists | `lib/needsInference.js` |
| PYTHIA Collectors | ✅ Exists | `scripts/pythia/` (RSS, podcasts, LinkedIn) |
| Data Completeness | ✅ Exists | `server/services/dataCompletenessService.js` |
| Company Graph API | ❌ Missing | Data in `startup_uploads`, `pythh_entities`, `startup_signals` — no unified graph service |

#### 2. Company Builder

| Agent | Status | Implementation |
|-------|--------|----------------|
| Gap Analyst | ✅ Exists | `server/lib/gapTaskDerivation.js`, `server/routes/wizardRoute.js` |
| Task Planner | ✅ Exists | `server/lib/taskUnlockCatalog.js`, `founder_commitment_tasks` table |
| Proof Verifier | ✅ Partial | Wizard task complete → rescore; no automated proof validation |
| Advisor Finder | ❌ Missing | Vision spec only |
| Positioning Rewriter | ❌ Missing | Oracle coaching partial (`server/routes/oracle.js`) |
| Customer Pilot Builder | ❌ Missing | Vision spec only |
| Builder Orchestrator | ❌ Missing | Wizard + Oracle are parallel tracks, not unified |

#### 3. Capital Intelligence

| Agent | Status | Implementation |
|-------|--------|----------------|
| Investor Profiler | ✅ Exists | `scripts/pipeline-investor-intelligence.mjs`, `server/services/investorInferenceService.js` |
| Thesis Extractor | ✅ Exists | `investor_signal_events`, `vc_faith_signals` |
| Portfolio Signal | ✅ Exists | `server/lib/portfolioAnalytics.js`, `virtual_portfolio` |
| Match Ranker | ✅ Exists | `lib/matchEngine.js`, `server/services/investorMatching.ts` |
| Email Inference | ✅ Exists | `20260515120000_investor_email_inference.sql` |
| Timing Agent | ⚠️ Partial | Match engine timing dimension; no dedicated timing service |
| Capital Graph API | ❌ Missing | Fragmented across `investors`, `vc_intelligence`, `pythh_candidates` |

#### 4. Fundraising Studio

| Agent | Status | Implementation |
|-------|--------|----------------|
| Match Explainer | ✅ Exists | `site/components/MatchExplainBlock.tsx`, `lib/normalizeWhyYouMatch.js` |
| Investor Read | ✅ Exists | `server/lib/investorReadService.js`, `site/components/InvestorReadStep.tsx` |
| Outreach Drafter | ✅ Exists | `server/routes/outreachDraft.js`, `site/outreachRouter.ts` |
| Commitment Doc | ✅ Exists | `server/routes/wizardRoute.js` (document generation) |
| Narrative Agent | ⚠️ Partial | LLM prompts in outreach; no standalone narrative service |
| Deck Builder | ❌ Missing | Vision spec only |
| Segment Deck Variants | ❌ Missing | Vision spec only |
| Meeting Prep / Brief | ⚠️ Partial | UI in `Activate.tsx` demo; not fully backend-driven |
| Fundraising Studio workspace | ❌ Missing | Preview, wizard, drafts, pipeline are separate surfaces |

#### 5. Campaign Operations

| Agent | Status | Implementation |
|-------|--------|----------------|
| Outreach Agent (VC) | ✅ Exists | `scripts/outreach-agent.js`, `docs/OUTREACH_AGENT.md` |
| Peter Founder Outreach | ✅ Exists | `scripts/peter-founder-outreach.mjs`, `lib/pythiaVoice.js` |
| Peter Intro Concierge | ✅ Exists | `server/lib/peterIntroConcierge.js`, `site/components/PeterIntroPanel.tsx` |
| Outreach Scheduler | ✅ Exists | `scripts/cron/outreach-scheduler.js` |
| Reply Handler | ⚠️ Partial | `pythh_outreach_replies` table; no full classifier agent |
| Segmentation / Sequence | ❌ Missing | No campaign object model |
| Calendar / Scheduling | ⚠️ Partial | `site/components/MeetingScheduler.tsx` — UI only |
| PYTHIA Round Automation | ⚠️ Partial | `site/components/wizard/RoundAutomation.tsx`, wizard activate-round |
| Campaign Orchestrator | ❌ Missing | Scripts are siloed; no unified control plane |

#### 6. Learning & Optimization

| Agent | Status | Implementation |
|-------|--------|----------------|
| Growth Agent | ✅ Exists | `scripts/growth-agent-loop.mjs`, `agents/growth/` |
| Product Agent | ✅ Exists | `scripts/product-agent-loop.mjs`, `agents/product/` |
| Research Agent | ✅ Exists | `scripts/research-agent-loop.mjs`, `agents/research/` |
| Funnel Heartbeat | ✅ Exists | `scripts/funnel-heartbeat-probe.mjs`, `server/lib/funnelTelemetry.js` |
| Match Feedback Trainer | ⚠️ Partial | `scripts/train-match-feedback-baseline.js` — offline only |
| GOD Audit | ✅ Exists | `scripts/god-score-audit.js` |
| Campaign Analyst | ❌ Missing | No closed loop from outreach → match weights |
| Unified Experiment Registry | ❌ Missing | Growth, product, research registries separate |
| Learning → Engine feedback | ❌ Missing | Agents ship UX; engines not auto-tuned |

---

## Agent interaction loops (detailed)

### Loop A — Company readiness

```mermaid
sequenceDiagram
  participant F as Founder
  participant O as Oracle
  participant CI as Company Intelligence
  participant CB as Company Builder
  participant CG as Company Graph

  F->>O: Submit URL
  O->>CI: Scrape + score + signal
  CI->>CG: Update company model
  CI->>O: GOD + gaps + evidence
  O->>F: Analysis + plan
  F->>O: Authorize builder tasks
  O->>CB: Queue gap closures
  CB->>CG: Update evidence
  CB->>O: Readiness delta
  O->>F: Weekly progress update
```

**Code path today:** URL → `instantSubmit` → GOD → `wizardRoute/gaps` → gap cards → task ack/skip → rescore (partial).

---

### Loop B — Capital matching

```mermaid
sequenceDiagram
  participant O as Oracle
  participant CI as Company Intelligence
  participant CAP as Capital Intelligence
  participant KG as Capital Graph
  participant FS as Fundraising Studio

  O->>CI: Get company profile
  CI->>CAP: Match request
  CAP->>KG: Query investor conviction
  CAP->>CAP: Rank + explain
  CAP->>FS: Qualified investor set
  FS->>O: Campaign targets
  O->>O: Segment by thesis
```

**Code path today:** `lib/matchEngine.js` → `startup_investor_matches` → preview UI → explain blocks.

---

### Loop C — Campaign execution

```mermaid
sequenceDiagram
  participant F as Founder
  participant O as Oracle
  participant FS as Fundraising Studio
  participant CO as Campaign Operations
  participant EG as Execution Graph
  participant LO as Learning

  O->>FS: Generate drafts + memo
  FS->>O: Campaign package
  O->>F: Decision card — authorize batch
  F->>O: Approve
  O->>CO: Execute sequence
  CO->>EG: Log sends + replies
  CO->>O: Meeting request ready
  O->>F: Approve meeting
  CO->>EG: Meeting scheduled
  EG->>LO: Outcome signals
  LO->>O: Replan recommendations
```

**Code path today:** `outreachDraft.js` → `outreach-agent.js` / Peter scripts → demo meeting UI in Activate (not fully wired).

---

### Loop D — Internal optimization (existing)

```mermaid
flowchart LR
  HB[Funnel Heartbeat] --> OB[Orchestrator Brief]
  OB --> GA[Growth Agent]
  OB --> PA[Product Agent]
  OB --> RA[Research Agent]
  GA & PA & RA --> SHIP[Autopilot Ship]
  SHIP --> HB
```

**Code path today:** `.github/workflows/agents-autopilot-daily.yml` → `scripts/agents-autopilot.mjs`.

**Gap:** Optimizes signup funnel, not meeting outcomes. Must align with [PYTHH_VISION.md](./PYTHH_VISION.md) metric hierarchy.

---

## Three graphs — data store mapping

### Company Graph

| Node / edge | Primary tables | Service paths |
|-------------|----------------|---------------|
| Company | `startup_uploads` | `instantSubmit`, `urlScrapingService` |
| Signals | `startup_signals`, `pythh_signal_events` | `signalParser`, `scripts/pythia/` |
| Trajectories | `pythh_trajectories` | `trajectoryEngine.js` |
| Needs | `pythh_entity_needs` | `needsInference.js` |
| Scores | GOD columns, `score_snapshots_v2` | `startupScoringService.ts` |
| Gaps | Derived + `founder_commitment_tasks` | `gapTaskDerivation.js` |
| Evidence | `evidence_artifacts_v2` | Verification v2 migration |

**Build:** `GET /api/graph/company/:startupId` — unified query layer.

---

### Capital Graph

| Node / edge | Primary tables | Service paths |
|-------------|----------------|---------------|
| Investor | `investors` | `investors.js`, `investorLookupService` |
| Thesis | `investor_signal_events`, `vc_faith_signals` | `pipeline-investor-intelligence.mjs` |
| Portfolio | `virtual_portfolio`, `portfolio_events` | `portfolioAnalytics.js` |
| Conviction | `vc_intelligence`, match scores | `matchEngine.js` |
| Contacts | `investor_outreach`, email inference cols | `outreachDraft.js` |
| Timing | Partial — match timing dimension | `lib/matchEngine.js` |

**Build:** `GET /api/graph/capital/:investorId` + `POST /api/graph/capital/match/:startupId`.

---

### Execution Graph

| Node / edge | Primary tables | Service paths |
|-------------|----------------|---------------|
| Campaign | ❌ no table yet | — |
| Message | `investor_outreach`, `pythh_outreach_emails` | `outreachDraft.js`, `outreach-agent.js` |
| Reply | `pythh_outreach_replies` | `outreachWebhook.js` |
| Wizard task | `founder_commitment_tasks` | `wizardRoute.js` |
| Funnel event | `ai_logs` | `funnelTelemetry.js` |
| Meeting | ❌ no table yet | Activate UI demo only |
| Agent run | `growth_agent_runs`, `product_agent_runs` | agent loops |
| Decision | ❌ no table yet | Oracle UX spec |

**Build:** `execution_campaigns`, `execution_meetings`, `oracle_decisions` tables + `GET /api/graph/execution/:startupId`.

---

## Maturity matrix

| Operating group | Maturity | Headline gap |
|-----------------|----------|--------------|
| **Company Intelligence** | 🟢 Strong | Unified Company Graph API |
| **Company Builder** | 🟡 Partial | Advisor/positioning agents; unified orchestrator |
| **Capital Intelligence** | 🟢 Strong | Unified Capital Graph API; timing agent |
| **Fundraising Studio** | 🟡 Partial | Deck builder; single workspace |
| **Campaign Operations** | 🟡 Partial | Campaign orchestrator; reply classifier; real scheduling |
| **Learning & Optimization** | 🟡 Partial | Close loop into engines; meeting metrics |

```mermaid
quadrantChart
  title Agent Organization Maturity
  x-axis Low Integration --> High Integration
  y-axis Low Capability --> High Capability
  quadrant-1 Scale + integrate
  quadrant-2 Build integration
  quadrant-3 Deprioritize
  quadrant-4 Build capability
  Company Intelligence: [0.75, 0.85]
  Capital Intelligence: [0.70, 0.80]
  Company Builder: [0.35, 0.55]
  Fundraising Studio: [0.45, 0.65]
  Campaign Operations: [0.40, 0.60]
  Learning: [0.50, 0.55]
```

---

## Build roadmap (agent organization)

### Phase 1 — Unify the Oracle surface (weeks 1–2)

- [ ] Oracle Analysis screen (preview reframe)
- [ ] Raise Plan screen (post-signup)
- [ ] Meeting funnel telemetry
- [ ] Copy pass per [PYTHH_FUNNEL_AUDIT.md](./PYTHH_FUNNEL_AUDIT.md)

### Phase 2 — Graph foundations (weeks 3–6)

- [ ] Company Graph read API
- [ ] Capital Graph read API
- [ ] Execution Graph schema (`campaigns`, `meetings`, `decisions`)
- [ ] Oracle reads all three for plan generation

### Phase 3 — Close the execution loop (weeks 7–12)

- [ ] Campaign Orchestrator agent (unify outreach scripts)
- [ ] Reply Classifier agent
- [ ] Decision card system
- [ ] Meeting pipeline (real, not demo)
- [ ] Learning agent feeds match/GOD weights

### Phase 4 — Company Builder expansion (weeks 13+)

- [ ] Advisor Finder agent
- [ ] Positioning Agent
- [ ] Deck Builder agent (segment variants)
- [ ] Customer Pilot Builder agent

```mermaid
gantt
  title AI Organization Build Roadmap
  dateFormat YYYY-MM-DD
  section Phase 1
  Oracle surface + copy        :p1, 2026-07-19, 14d
  section Phase 2
  Three graph APIs             :p2, after p1, 28d
  section Phase 3
  Campaign + meeting loop      :p3, after p2, 35d
  section Phase 4
  Company Builder agents       :p4, after p3, 42d
```

---

## Persona clarification (engineering)

From `lib/pythiaVoice.js`:

| Name | Layer | Audience |
|------|-------|----------|
| **Oracle** | Product relationship + strategy | Founder |
| **PYTHIA** | In-app execution engine | Founder (named in updates) |
| **Peter** | Outbound human voice | External (investors, founders in email) |
| **Scout** | Internal orchestrator | Engineering/ops agents |

Do not conflate Oracle (founder partner) with Oracle tier (pricing) or Oracle scoreboard (portfolio marketing). Long-term: **Oracle** is both the relationship and the paid autonomy tier.

---

## Key file index (quick reference)

| Group | Start here |
|-------|------------|
| Company Intelligence | `server/services/startupScoringService.ts`, `lib/signalParser.js`, `PYTHH_PLATFORM.md` |
| Company Builder | `server/routes/wizardRoute.js`, `site/pages/Wizard.tsx` |
| Capital Intelligence | `lib/matchEngine.js`, `scripts/pipeline-investor-intelligence.mjs` |
| Fundraising Studio | `server/routes/outreachDraft.js`, `server/routes/previewRoute.js` |
| Campaign Operations | `scripts/outreach-agent.js`, `scripts/peter-founder-outreach.mjs` |
| Learning | `scripts/agents-autopilot.mjs`, `agents/growth/`, `server/lib/funnelTelemetry.js` |
| Oracle (strategy) | `server/routes/oracle.js`, `docs/PYTHH_ORACLE_UX.md` |
| Internal orchestrator | `agents/ORCHESTRATOR.md`, `scripts/orchestrator-brief.mjs` |

---

## Related documents

| Document | Purpose |
|----------|---------|
| [PYTHH_VISION.md](./PYTHH_VISION.md) | Product north star |
| [PYTHH_FUNNEL_AUDIT.md](./PYTHH_FUNNEL_AUDIT.md) | Current funnel vs vision |
| [PYTHH_ORACLE_UX.md](./PYTHH_ORACLE_UX.md) | Founder experience spec |
| `agents/ORCHESTRATOR.md` | Internal agent ops (needs metric realignment) |
| `agents/north-star.json` | Current north star (needs meeting outcome) |

---

*This document should be updated when new agents ship or graph APIs land.*
