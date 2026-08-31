# Pythh Funding Source Ontology + Source Map

**Status:** architecture spec for implementation (not a live schema migration)  
**Audience:** coding agents extending matching, evidence ingestion, and Hit@5  
**Companion docs:** [`funding-evidence-ledger.md`](./funding-evidence-ledger.md), [`funding-participation-ontology.md`](./funding-participation-ontology.md), [`ONTOLOGY_REASONING_ROADMAP.md`](./ONTOLOGY_REASONING_ROADMAP.md), [`HIT5_IMPROVEMENT_ROADMAP.md`](./HIT5_IMPROVEMENT_ROADMAP.md)

---

## 1. Product frame

Pythh is **funding-source intelligence**, not a clone of Crunchbase / Dealroom / PitchBook / OpenVC.

| Framing | Meaning |
| --- | --- |
| Wrong | Search a static investor database and return a score |
| Right | Discover **capital that can actually fund this company**, with an **evidence trail** |

Canonical reasoning chain:

```text
STARTUP → FUNDING_NEED → FUNDING_SOURCE → INVESTMENT_THESIS → EVIDENCE → PYTHH_MATCH
```

**No single commercial database is the foundation.** External datasets are **evidence channels** that feed Pythh’s graph. Prefer **observed behavior** (deals, awards, co-investors) over self-reported thesis alone.

Differentiation target:

> Don’t only ask investors what they invest in. Infer what they invest in from what they actually do.  
> Then: `stated thesis + observed investments + current signals + startup characteristics → Pythh Match`.

---

## 2. Entity catalog

Entities below are the ontology’s nouns. Many already have tables; others are logical types to materialize later.

### 2.1 Core capital graph

| Entity | Purpose | Existing / proposed storage |
| --- | --- | --- |
| **Startup** | Company seeking capital | `startup_uploads`, match snapshots |
| **FundingNeed** | Normalized raise intent (instrument, stage, check band, geo, sector tags) | Derived from startup profile + wizard / instant submit; not a first-class table yet |
| **FundingSource** | Any capital provider (dilutive or not) | `investors`, `investor_organizations`, future grant/program rows |
| **Fund** | Vehicle under a firm (Fund IV, etc.) | Soft field on investor / org today; promote when SEC / fund announcements justify |
| **Person** | Partner, angel, GP | `investors` with `is_individual`, membership via `investor_organization_memberships` |
| **FundingEvent** | One announced / observed financing or award | `funding_evidence_events` (+ outcomes join) |
| **FundingParticipation** | Actor ↔ event edge with role | `funding_evidence_participants` (+ role ontology) |
| **InvestmentThesis** | Stated *and/or* inferred preferences | Investor profile JSON / features; split `stated_*` vs `observed_*` |
| **EvidenceArtifact** | One URL / filing / export row | `funding_evidence_sources`, validation evidence rows |
| **MatchExplanation** | Defensible “why this source” payload | Serve path / admin outcomes; not fully schema’d |

### 2.2 Capital provider types (`FundingSource.provider_type`)

Use a closed enum for matching filters; map free text at ingest:

| `provider_type` | Notes |
| --- | --- |
| `vc` | Institutional venture |
| `cvc` | Corporate venture |
| `angel` | Individual angel |
| `angel_group` | Organized angels |
| `family_office` | FO / multi-family |
| `accelerator` | Accelerator / incubator |
| `government_grant` | SBIR/STTR, agency awards |
| `strategic` | Strategic / corporate (non-fund) |
| `venture_debt` | Debt / growth credit |
| `crowdfunding` | Reg CF / equity crowdfunding |
| `pe` | PE / growth equity |
| `sovereign` | SWF / public capital |
| `unknown` | Unresolved; do not invent |

Participation **roles** on equity rounds stay in [`funding-participation-ontology.md`](./funding-participation-ontology.md): `lead`, `co_lead`, `participant`, `follow_on`, `strategic`, `unknown`.

### 2.2.1 Discover missing VCs & Family Offices from funding news

Family offices are increasingly active in equity rounds alongside VCs. Many names appear in `funding_evidence_participants` with `investor_id = null` and are not yet in `investors`.

```bash
# All missing capital providers (90d window)
npm run funding:discover:missing-providers

# Family offices only
npm run funding:discover:missing-fos

# Institutional VCs only (firm-suffix / high confidence)
npm run funding:discover:missing-vcs -- --days=60 --min-events=2
```

Classifier: `lib/capitalProviderClassifier.js` (name + evidence phrase → `provider_type`).  
Report JSON: `reports/missing-capital-providers-YYYY-MM-DD.json`.

**Next ops steps (do not auto-insert junk):**

1. Review `family_offices` + `high_confidence_vcs` in the report  
2. Seed curated profiles (`scripts/seed-missing-funding-investor-profiles.mjs`) with `type: 'Family Office'` or `'VC'`  
3. `npm run funding:coverage:investors:resolve:apply` to link ledger participants  

### 2.3 FundingNeed attributes (normalized)

| Field | Example |
| --- | --- |
| `instrument` | `equity` \| `grant` \| `debt` \| `convertible` \| `unknown` |
| `stage` | `pre_seed` … `growth` |
| `check_min_usd` / `check_max_usd` | Raise band the startup can absorb |
| `geography` | Country / region codes |
| `sectors` / `subsectors` | Crosswalk via `lib/ontologyCrosswalk.js` where possible |
| `business_model` | `saas`, `hardware`, `marketplace`, … |
| `technology` | Tags: robotics, AI, deeptech, … |
| `dilution_ok` | Boolean — gates grant vs equity paths |
| `revenue_stage` | `pre_revenue`, `early_revenue`, … |

### 2.4 InvestmentThesis attributes

Split every thesis field into:

- **`stated_*`** — from OpenVC, firm site, partner posts  
- **`observed_*`** — from ledger / outcomes / news graph  
- **`confidence`**, **`as_of`**, **`evidence_ids[]`**

Priority fields (OpenVC-shaped + inferred):

| Attribute | Source bias |
| --- | --- |
| `investment_stage[]` | Stated + observed stages on participations |
| `industry[]` / `subindustry[]` | Stated verticals + portfolio sectors |
| `geography[]` | Stated HQ focus + deal geos |
| `check_min` / `check_max` | Stated + inferred from round sizes / role |
| `lead_or_follow` | Stated + observed roles |
| `company_stage` / `business_model` / `technology` | Same |
| `portfolio[]` | Observed investments |
| `application_url` / `contact_method` | Stated (OpenVC / site) |
| **Inferred:** `hardware_friendly`, `deeptech_friendly`, `robotics_experience`, `first_check_size`, `follow_on_behavior`, `lead_probability`, `recent_activity`, `portfolio_similarity`, `competitive_conflict`, `thesis_alignment` | Observed + scoring layer |

---

## 3. Relationship catalog (edges)

| Edge | From → To | Meaning | Provenance rule |
| --- | --- | --- | --- |
| `HAS_NEED` | Startup → FundingNeed | Current raise framing | Profile / wizard |
| `CAN_FUND` | FundingSource → FundingNeed | Soft eligibility (filters) | Thesis + activity |
| `INVESTS_IN` | FundingSource → Startup | Historical / current investment | Event + participation |
| `PARTICIPATES_IN` | FundingSource → FundingEvent | Round / award membership | Ledger participants |
| `HAS_ROLE` | Participation → role enum | lead / participant / … | Ontology normalize |
| `CO_INVESTS_WITH` | Source ↔ Source | Same verified round | **Only** verified same-event participants ([participation ontology](./funding-participation-ontology.md)) |
| `STATES_THESIS` | Source → InvestmentThesis | Self-reported | OpenVC / site / interview |
| `OBSERVED_THESIS` | Source → InvestmentThesis | Behavior-derived | Aggregated events |
| `EVIDENCED_BY` | Event / Participation / Thesis → EvidenceArtifact | Support | Sources table |
| `MATCHES` | Startup → FundingSource | Pythh recommendation | Matching service + explanation |
| `AWARDED_BY` | Startup → government_grant source | Non-dilutive | SBIR / agency datasets |
| `TOPICAL_FOR` | Startup tech → grant topic | SBIR topic match | Topic ingest |
| `MEMBER_OF` | Person → Organization | Firm identity | Memberships table |

Graph sketch for a news announcement:

```text
Company X raises $8M Seed, led by A, with B + C, warehouse robotics, Aug 2026

Investor A ─INVESTS_IN→ Company X
          ─PARTICIPATES_IN→ Event (role=lead)
          ─OBSERVED→ stage=seed, sector=robotics, geo=…, date=2026
          ─CO_INVESTS_WITH→ B, C   (only after verification)

Company X ─sector→ robotics; application→ warehouse; stage→ seed; raised→ $8M
```

---

## 4. Evidence hierarchy

Align with [`server/lib/fundingSourceTrust.js`](../server/lib/fundingSourceTrust.js) and [`funding-evidence-ledger.md`](./funding-evidence-ledger.md).

### 4.1 Trust tiers (ingest ranking)

| Tier | Examples | Use |
| --- | --- | --- |
| **T0 — Primary issuer** | Company IR, investor portfolio page naming the deal, SEC filing, SBIR award record | Strongest single source for that claim type |
| **T1 — Wire / major editorial** | Business Wire, GlobeNewswire, PR Newswire; Reuters, Bloomberg, FT, WSJ | Single-source **verify** allowed for Hit@5 when identity + temporal gates pass |
| **T2 — Specialist editorial** | TechCrunch, PitchBook.com articles, Crunchbase news, TNW, Tech.eu, SiliconANGLE | Single-source verify allowed (same gates) |
| **T3 — Trade / aggregator** | Pulse2, FinSMEs, many Google News RSS hosts | **Corroboration required** (≥2 independent domains) before promote / verify |
| **T4 — Stated preference only** | OpenVC row, thesis page with no deal | Useful for recall; **never** alone for Hit@5 hit |
| **T5 — Low / hostile** | SEO farms, junk hosts | Park / reject |

### 4.2 Evidence types (artifact taxonomy)

| `evidence_type` | Typical claim |
| --- | --- |
| `funding_announcement` | Round, amount, investors, date |
| `portfolio_listing` | Firm lists company as investment |
| `partner_statement` | Partner blog / podcast “we led …” |
| `sec_filing` | Fund formation, Form D, etc. |
| `grant_award` | SBIR/agency award to company |
| `grant_solicitation` | Topic / eligibility (match path, not hit proof) |
| `accelerator_cohort` | Program participation / investment |
| `co_investor_list` | Full cap table / syndicate |
| `stated_thesis` | OpenVC / website criteria |
| `activity_signal` | New fund raise, hiring partners, “what we’re looking for” |

### 4.3 Promotion rules (Hit@5-safe)

1. **Hit:** ≥1 T0–T2 source **or** ≥2 independent T3+ domains, after **prediction timestamp**, with resolved investor identity.  
2. **Miss:** Complete or explicitly audited participant list (see claim readiness).  
3. **Debt / grant / non-equity** instruments must not inflate equity Hit@5 ([ledger](./funding-evidence-ledger.md)).  
4. Aggregators alone do not verify.

---

## 5. Inference rules

Rules are **deterministic preferences** for agents; ML can score but must cite evidence IDs.

### 5.1 Thesis inference

| Rule ID | Input | Output |
| --- | --- | --- |
| `INF-STAGE` | ≥N verified participations at stage S in last W months | Boost `observed.investment_stage` includes S |
| `INF-SECTOR` | Portfolio / event sectors | `observed.industry` / tech flags (`robotics_experience`, …) |
| `INF-CHECK` | Round sizes + role (lead vs participant) | Estimate `first_check_size`, `check_min/max` |
| `INF-LEAD` | Role frequency | `lead_probability` |
| `INF-FOLLOW` | Repeat investments in same startup | `follow_on_behavior` |
| `INF-GEO` | Deal geos vs stated geos | `observed.geography`; flag mismatch |
| `INF-ACTIVITY` | Deals in last 12 months | `recent_activity` score |
| `INF-ALIGN` | Startup FundingNeed ∩ (stated ∪ observed) | `thesis_alignment` for ranking |
| `INF-CONFLICT` | Overlapping competitive portfolio | `competitive_conflict` penalty |
| `INF-HARDWARE` | Hardware / robotics / deeptech deal density | `hardware_friendly` / `deeptech_friendly` |

**Precedence:** when stated and observed conflict, **ranking uses observed for “will they fund?”** and surfaces stated as explanatory context (“says seed software; 70% of recent checks are Series A hardware”).

### 5.2 Matching path selection

```text
if FundingNeed.instrument includes grant OR deeptech/defense/health/climate hardware:
  explore government_grant + accelerator + vc paths in parallel
else:
  primary equity path (vc/cvc/angel/…)
always attach EvidenceArtifact[] to each PYTHH_MATCH
```

### 5.3 Explanation contract (serve / admin)

Replace bare scores with structured reasons:

```text
XYZ Ventures — score 92
Invests Seed–Series A
Typical check: $1M–$5M
Robotics + industrial AI thesis (stated + observed)
7 relevant investments; 3 in last 12 months
Partner Jane Smith leads robotics (stated)
Recently raised Fund IV (activity_signal)
Why: industrial manipulation overlaps 4 portfolio cos; fits $1M–$4M seed band
Evidence: [urls / event ids]
```

---

## 6. Source map (what to ingest)

Priority: ★★★★★ = build / wire soon; ★★★★ = valuable; commercial = license-gated.

| Source | What Pythh learns | Access / use | Priority | Channel |
| --- | --- | --- | --- | --- |
| **Dealroom** | Companies, investors, rounds, valuations, sectors, people, signals | REST / bulk / MCP (commercial) | ★★★★★ | Transaction + Investor |
| **OpenVC** | Thesis, stage, geo, check size, verticals, submission links (~16k early-stage) | Web / CRM export / partnership | ★★★★★ | Investor + Intent |
| **Crunchbase** | Rounds, companies, investors, acquisitions, activity | Commercial API | ★★★★★ | Transaction |
| **PitchBook** | Deep VC/PE, funds, deals, valuations, executives | Commercial | ★★★★ | Transaction |
| **SBIR / America’s Seed Fund** | Solicitations, awards, funded companies (~4k/yr, ~$4B, non-dilutive) | API + JSON/XML/XLS — [sbir.gov data](https://www.sbir.gov/sbirsearch/award/all) / agency open data | ★★★★★ | Non-dilutive |
| **VC / CVC websites** | Thesis, portfolio, stage, partners, current interests | Public web crawl | ★★★★★ | Investor + Intent |
| **Accelerator websites** | Cohorts, terms, sectors, applications | Public web | ★★★★ | Investor |
| **Government grant sites** | Grants, awards, eligibility, deadlines (NSF, NIH, DOE, DOD, NASA, state) | Public / API | ★★★★★ | Non-dilutive |
| **SEC filings** | Fund formation, size, managers, Form D evidence | EDGAR public | ★★★★ | Transaction + Intent |
| **Startup funding announcements** | Round, amount, investors, date, sector | News / RSS / Gemini search | ★★★★★ | Transaction (**live today**) |
| **Investor portfolio pages** | Actual investment evidence | Public web | ★★★★★ | Transaction / Evidence |
| **Angel groups** | Criteria, geo, check size | Public web | ★★★★ | Investor |

### 6.1 Five ingestion channels

| Channel | Sources | Primary writes |
| --- | --- | --- |
| **1. Investor Sources** | VC/CVC sites, angels, FOs, accelerators, OpenVC | `investors`, orgs, memberships, `stated_*` thesis |
| **2. Transaction Sources** | Announcements, CB/Dealroom, SEC, portfolios, press | `funding_evidence_events`, participants, sources |
| **3. Non-dilutive Sources** | SBIR/STTR, NSF, NIH, DOE, DOD, NASA, state/ED programs | Grant events + `provider_type=government_grant` |
| **4. Investor Intent Sources** | Partner interviews, blogs, podcasts, thesis pages, new fund announcements, **operator-founder LinkedIn/blog posts** | `activity_signal`, `stated_*` refresh, `investors.signals.top_themes` |
| **5. Company Evidence Sources** | Startup site, founders, product, customers, patents, jobs, news, prior financing | Startup features → FundingNeed |

Continuous discovery loop (channel 2): every announcement becomes graph edges (see §3). Scale across many events → **observable** thesis.

**Operator / successful-founder intent (channel 4):** Hot startups are often shared among operators who already built winners (Altman, Chesky, Dorsey, Zuckerberg, Gil, …). They invest personally, write public thesis posts, and co-invest with friends. Pythh encodes this as:

| Layer | Behavior |
| --- | --- |
| Detection | `lib/operatorFounderInvestors.js` — known aliases + `operator_angel` type + founder-exit bio + faith themes |
| Investor GOD | `lib/investorGodScore.js` — public thesis themes / blog content fold into profile+focus+track (bucket caps unchanged) |
| Match fit | `lib/stageInvestorFit.js` — early-stage boost for operator founders (alongside partner-angel) |
| Still missing | LinkedIn post scrape into faith backfill (today: blog_url / site / thesis only via `backfill-faith-signals.ts`) |

Do **not** fold operator-founder network into **startup** GOD — that score is company fundability. This signal is investor quality + match affinity.

### 6.2 Exact entry points (implementer checklist)

| Source | Concrete starting URLs / APIs |
| --- | --- |
| OpenVC | [openvc.app/investor-database](https://www.openvc.app/investor-database) — web directory; CRM export CSV of synced contacts (fields: geo, check, stage, industries). Prefer partnership/API over wholesale scrape. |
| SBIR | [sbir.gov](https://www.sbir.gov/) awards/solicitations downloads + API docs on site |
| America’s Seed Fund | [seedfund.nsf.gov](https://seedfund.nsf.gov/) / NSF SBIR portals |
| SEC EDGAR | [sec.gov/edgar](https://www.sec.gov/edgar) — company + fund filings |
| Dealroom | Commercial API (companies, investors, rounds, valuations, signals) — treat as **enrichment**, not SoT |
| Crunchbase / PitchBook | Commercial APIs — same: enrichment + news domain trust only until licensed |
| Pythh live news | Existing RSS / Gemini / inference paths → ledger ([`funding-evidence-ledger.md`](./funding-evidence-ledger.md)) |

---

## 7. Mapping onto today’s Pythh stack

### Already aligned

| Capability | Location |
| --- | --- |
| Multi-source funding events + participants | `funding_evidence_*` tables, `server/lib/fundingEvidenceLedger.js` |
| Source trust tiers | `server/lib/fundingSourceTrust.js` |
| Participation roles + CO_INVESTED_WITH rule | `server/lib/fundingParticipationOntology.js`, docs |
| Discovery from web/news | `scripts/search-startup-funding-evidence.mjs`, promote/corroborate/triage scripts |
| Ontology public lookup (SEC Form D, NSF/SBIR, USASpending) | `server/lib/fundingSourceLookup.js`, `npm run funding:lookup-sources`, `--provider=ontology` |
| Hit@5 temporal + claim gates | prediction snapshots, claim-readiness reports |
| Firm vs individual identity | `investor_organizations`, canonicalize / repair scripts |
| Sector / signal ontology (adjacent) | `lib/signalOntology.js`, `lib/ontologyCrosswalk.js`, `/api/ontology/infer` |

### Gaps (ontology-driven backlog)

| Gap | Suggested next build |
| --- | --- |
| No first-class **FundingNeed** object | Normalize from startup + wizard into a JSON column or table |
| No **OpenVC** ingest | CRM CSV / licensed dump → `stated_*` thesis fields on investors |
| ~~No **SBIR** ingest~~ **Partial** | `fundingSourceLookup` + NSF awardee awards (SBIR.gov API often egress-blocked); grants stay `financing_type=grant` |
| ~~No SEC Form D company lookup~~ **Shipped** | Issuer Form D via EDGAR full-text → ledger `observed` equity events (roster incomplete) |
| No Dealroom/CB as structured graph import | Optional connectors behind license; never replace ledger SoT |
| Stated vs observed thesis not split in schema | Add `thesis_stated` / `thesis_observed` JSONB + evidence refs |
| Match explanations not standardized | Shared `MatchExplanation` DTO on serve + admin |
| Continuous announcement → edge materialization | Batch job over verified events → investor feature refresh |

### What not to do

- Do not make Dealroom (or any one DB) the system of record.  
- Do not treat OpenVC stated fields as Hit@5 proof.  
- Do not emit `CO_INVESTED_WITH` from unverified co-mentions.  
- Do not count grants as equity hits.

---

## 8. Suggested implementation phases

| Phase | Deliverable | Success signal |
| --- | --- | --- |
| **P0** | This ontology + keep ledger / trust / participation as SoT | Agents cite this doc |
| **P1** | OpenVC CRM/partnership → stated thesis on investor profiles | Filterable stage/geo/check in matching features |
| **P2** | SBIR/NSF awards + SEC Form D lookup (`fundingSourceLookup`, `--provider=ontology`) | Grant + Form D events on ledger for matched startups |
| **P3** | Observed thesis rollup job from verified participations | `recent_activity`, sector affinity on profiles |
| **P4** | MatchExplanation payload on serve path | UI shows evidence trail, not score alone |
| **P5** | Optional Dealroom/CB connectors | Enrichment only; ledger remains authoritative for Hit@5 |

---

## 9. Worked example (robotics Seed, Nevada, $2M)

```text
STARTUP: robotics, Nevada, seed, $2M, hardware+AI, pre-revenue, prototype
    ↓
FUNDING_NEED: equity + optional grant; checks $500K–$3M; seed; US; robotics/deeptech; hardware-friendly
    ↓
CANDIDATE SOURCES:
  - VCs with observed robotics seed + stated deeptech
  - SBIR topics matching manipulation / autonomy
  - Hardware-friendly accelerators
    ↓
EVIDENCE: portfolio cos, announcements, SBIR awards, thesis pages
    ↓
PYTHH_MATCH: ranked sources with explanation + evidence_ids
```

---

## 10. Agent checklist

When adding a source or matcher:

1. Classify **channel** (§6.1) and **provider_type** (§2.2).  
2. Map fields into **stated vs observed** thesis (§2.4).  
3. Attach **evidence_type** + trust tier (§4).  
4. Never bypass Hit@5 temporal / corroboration rules.  
5. Prefer updating the **ledger graph** over scraping into ad-hoc JSON dumps.  
6. If both a commercial API and public evidence exist, **public verified evidence wins for claims**.

---

*Last updated: P2 public-source lookup (SEC Form D, NSF/SBIR, USASpending) productionized via `fundingSourceLookup` + `--provider=ontology`. Update this file when a new channel or entity is productionized.*
