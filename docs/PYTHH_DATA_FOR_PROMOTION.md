# Pythh Data for Promotion

> **Purpose:** Catalog all data collected by Pythh (startups, investors, matches, ML) and how to use it for marketing and promotion.  
> **Refresh numbers:** Run `node scripts/check-status.js` and `node scripts/enrichment-status.js` for live counts.

---

## 1. Executive Summary

| Asset | Scale | Marketing Angle |
|-------|-------|-----------------|
| **Startups scored** | 10,000+ approved | "Pre-scored pipeline at scale" |
| **Investors profiled** | 5,500+ | "Thesis-aligned investor network" |
| **Precomputed matches** | Millions | "Instant matching in seconds" |
| **GOD Score distribution** | 8 tiers, 0–100 | "Objective, comparable quality signal" |
| **Signal types** | 10+ (funding, hiring, press, etc.) | "Real-time momentum intelligence" |
| **ML + matching engine** | 23 algorithms, multi-layer | "Depth of analysis, not vanity metrics" |

---

## 2. Startup Data

### Tables & What They Store

| Table | Key Fields | Use for Promotion |
|-------|------------|-------------------|
| **startup_uploads** | 12,000+ rows | Core pipeline; identity, pitch, stage, sectors, GOD score, evidence |
| **discovered_startups** | RSS-discovered | "Live deal flow from 100+ sources" |
| **startup_signals** | funding, hiring, product_launch, press_mention, partnership, market_expansion, github_activity, regulatory, executive_hire, award | "10+ signal types per startup" |
| **startup_momentum_snapshots** | 30-day aggregates, is_trending, is_raising, is_hiring | "Momentum and velocity scores" |
| **psychological_signals** | oversubscription, followon, competitive, bridge, sector_pivot | "FOMO and conviction indicators" |
| **score_history** | old/new score, reason | "Score evolution over time" |
| **evidence** (JSONB on startup_uploads) | founder-submitted press, deck | "Evidence-backed scoring" |

### GOD Score Distribution (Latest)

From `enrichment-status.js`:

| Bucket | Count | % | Bar |
|--------|-------|---|-----|
| 40-49 | ~4,200 | 38% | Fair |
| 50-59 | ~3,000 | 28% | Good |
| 60-69 | ~1,900 | 18% | Strong |
| 70-79 | ~1,200 | 11% | Excellent |
| 80-89 | ~425 | 4% | Elite |
| 90+ | ~85 | 0.8% | Top tier |

**Promotion angles:**
- "10,000+ startups scored 0–100 on the same criteria VCs use"
- "Top 5% at 80+; top 20% at 70+"
- "Distribution calibrated to real VC selection rates"

### Enrichment & Evidence

- **Enrichment backlog:** ~1,600–1,800 startups (phase≥2, score<70) eligible for more data
- **Evidence:** Deck uploads, founder-submitted press URLs → accomplishment bonus in GOD
- **Sources:** Website scrape, RSS/news, funding mentions, investor names

---

## 3. Investor Data

### Tables & What They Store

| Table | Key Fields | Use for Promotion |
|-------|------------|-------------------|
| **investors** | 5,500+ | Name, type, thesis, stage, sectors, portfolio_count, check_size |
| **investor_behavior_patterns** | fast_mover, herd_follower, contrarian, thesis_driven | "Behavior classification" |
| **investor_portfolio_adjacency** | Portfolio overlap | "Co-investor and adjacency analysis" |
| **vc_portfolio_exhaust** | SEC Form D, actual investments | "What VCs actually back" |
| **vc_faith_signals** | Thesis, interviews, blogs | "What VCs say" |
| **faith_alignment_matches** | Psychology-based matches | "Thesis–psychology alignment" |
| **investor_curated_lists** | Named lists | "Curated investor segments" |

**Promotion angles:**
- "5,500+ investors profiled by thesis, stage, and sector"
- "Faith vs. exhaust: we compare what VCs say with what they do"
- "Behavior patterns: fast movers, contrarians, thesis-driven"

---

## 4. Match System

### Core Tables

| Table | Key Fields | Use for Promotion |
|-------|------------|-------------------|
| **startup_investor_matches** | match_score, reasoning, why_you_match, fit_analysis | "Precomputed, explainable matches" |
| **match_generation_queue** | Status, priority | "Controlled match pipeline" |

### Match Data Captured

- **Scores:** 0–100 match_score, confidence_level, similarity_score
- **Reasoning:** `reasoning` (text), `why_you_match` (array), `fit_analysis` (JSONB)
- **Status funnel:** suggested → viewed → saved → contacted → meeting_scheduled → funded
- **Engagement:** viewed_at, intro_requested_at, contacted_at, last_interaction

**Promotion angles:**
- "Millions of precomputed matches, ranked by fit + momentum"
- "Explainable: every match has a reason"
- "Funnel visibility: viewed → saved → contacted → funded"
- "Sub-2-second match generation for new startups"

---

## 5. ML Agent & Matching Engine

### Scoring Stack

| Layer | What It Does | Promotion Angle |
|-------|--------------|-----------------|
| **GOD (23 algorithms)** | Team, traction, market, product, vision | "23 algorithms, 8 components" |
| **Signals bonus** | Market intelligence layer | "Real-time signal overlay" |
| **Momentum** | Forward movement | "Momentum recognition" |
| **AP/Promising** | Tier detection | "Premium startup detection" |
| **Elite + Spiky** | Quality spikes | "Excellence rewards" |
| **Investor pedigree** | Backer confidence | "305+ startups with pedigree bonus" |
| **Accomplishment evidence** | Deck, press | "Evidence-backed boost" |

### ML Infrastructure

- **god_algorithm_config** – Weights, divisors
- **ml_recommendations** – ML-suggested weight changes with approval workflow
- **ai_logs** – Match queue, GOD monitoring, scraper, ML training, URL processing

**Promotion angles:**
- "Multi-layer scoring: GOD base + 6 bonus layers"
- "ML-driven calibration with human approval"
- "Auditable: every score change has a reason"

---

## 6. Other Rich Data

| Area | Data | Promotion Angle |
|------|------|-----------------|
| **Ontology** | phrase_ontology, accelerator_cohorts, force_factors | "Structured market taxonomy" |
| **Oracle** | Sessions, steps, cohorts, signal actions, insights | "Founder coaching and playbooks" |
| **Verification** | action_events_v2, evidence_artifacts_v2, score_deltas_v2 | "Verified actions, not just claims" |
| **Virtual portfolio** | YC-style picks, MOIC, IRR | "Portfolio simulation and outcomes" |
| **Industry rankings** | Sector-level GOD averages | "Benchmark by industry" |

---

## 7. Scripts to Refresh Numbers

```bash
# Core counts (startups, investors, matches, discoveries)
node scripts/check-status.js

# GOD distribution + enrichment backlog
node scripts/enrichment-status.js

# Full system health (KPIs, scrapers, scores)
node scripts/daily-health-report.js

# Promotion snapshot (key metrics for marketing)
npm run analyze:promo

# Seed-stage & sector analysis (funded %, breakdown by sector, hottest categories, leading startups)
npm run analyze:seed
```

---

## 8. One-Liners for Marketing

| Audience | One-liner |
|----------|-----------|
| **VCs** | "10,000+ startups scored and matched to your thesis in seconds." |
| **Founders** | "See your GOD score, add evidence, and get ranked matches to investors." |
| **LPs** | "Faith vs. exhaust: we track what VCs say vs. what they back." |
| **Press** | "Pythh uses 23 algorithms and 10+ signal types to score startups and match them to investors." |
| **Partners** | "Millions of precomputed matches; sub-2-second generation for new startups." |

---

## 9. Suggested Next Steps

1. **Run scripts** → Update this doc with live numbers.
2. **Add conversion stats** → When available: % of top matches → meeting, % → funded.
3. **Industry breakdown** → Per-sector startup counts and avg GOD (Industry Rankings page).
4. **Investor thesis drill-down** → "N companies in [sector/stage] at 60+" per fund.
5. **Case study** → One funded company from a Pythh match (with permission).

---

## 10. Latest Analysis Summary

> Run `npm run analyze:promo` and `npm run analyze:seed` to refresh.

### Promotion Snapshot (Core Counts)

| Metric | Value |
|--------|-------|
| Startup uploads (total) | ~22K |
| Startups (approved) | ~11K |
| Investors | ~5.5K |
| Matches | ~1.2M |

### GOD Score Distribution (Approved)

| Bucket | Count | % |
|--------|-------|---|
| 40-49 | ~4,600 | 42% |
| 50-59 | ~3,400 | 31% |
| 60-69 | ~2,000 | 19% |
| 70-79 | ~740 | 7% |
| 80-89 | ~136 | 1% |
| 90+ | ~5 | <1% |

### Seed Stage & Sector Analysis

| Metric | Value |
|--------|-------|
| Seed-stage (total) | ~1,200 |
| Seed-stage (funded) | ~450 (37%) |
| Stage mix | 86% pre-seed, 11% seed, 2% series-a |

**Top sectors by seed count:** Technology, AI/ML, SaaS, Developer Tools, Gaming, Fintech, HealthTech, Climate Tech, Enterprise.

**Hottest by avg GOD:** climate tech (73), B2B SaaS (72), Enterprise (69).

**Leading startups (examples):** Upscale AI (90), Alt-qq (89), IO River (86), Resolve AI (85), Hebbia (82).

*Note: Full output with all sectors and leading startups is printed by `npm run analyze:seed`.*

---

## 11. Sector Normalization

Sector names in the database have case and spelling variants that split counts (e.g. Fintech vs FinTech, Climate vs Climate Tech). Use the normalization script to consolidate.

### Proposed Canonical Mapping

| Variants | → Canonical |
|----------|-------------|
| Fintech, FinTech | Fintech |
| Climate, Climate Tech | Climate |
| HealthTech, Healthtech, Healthcare | HealthTech |
| CleanTech, Cleantech | CleanTech |
| B2B SaaS, SaaS | SaaS |
| Energy, Energy Tech | CleanTech or Energy (via taxonomy) |

### Script

```bash
# Dry run: show what would change (no DB writes)
npm run normalize:sectors -- --dry-run

# Apply normalization to startup_uploads (and optionally investors)
npm run normalize:sectors
```

The script uses `server/lib/sectorTaxonomy.js` (`normalizeSectors`) and updates `startup_uploads.sectors` (and `investors.sectors` if desired). After running, re-run `npm run analyze:seed` for clean sector totals.

📊 SEED STAGE & SECTOR ANALYSIS
══════════════════════════════════════════════════════════════════════
Run at: 2026-03-23T23:38:29.452Z

1. SEED STAGE OVERVIEW
──────────────────────────────────────────────────
  Seed-stage (total):       1,166
  Seed-stage (funded):      411 (35.2% of seed)
  Seed-stage (unfunded):    755

  Stage breakdown (all approved):
    seed          1,166 (10.7%)
    pre-seed      9,383 (86.3%)
    series-a        244 (2.2%)
    series-b         82 (0.8%)

2. SEED STAGE BY SECTOR (top 20 by count)
──────────────────────────────────────────────────
  Sector                           Count  Funded   %Fund  AvgGOD
Fintech                              496     163   32.9%    63.5
AI/ML                                184      64   34.8%    73.1
SaaS                                 127      43   33.9%    73.2
HealthTech                           124      59   47.6%    62.4
Developer Tools                      120      49   40.8%    66.9
Gaming                                93      57   61.3%    52.2
Climate                               88      39   44.3%    62.1
Consumer                              75      20   26.7%    70.4
Enterprise                            57      11   19.3%    74.9
Robotics                              37      10   27.0%    67.2
CleanTech                             33      13   39.4%    70.0
DeepTech                              29       6   20.7%    68.2
Defense                               27       3   11.1%    70.6
Cybersecurity                         22      16   72.7%    52.6
FoodTech                              20      11   55.0%    53.5
PropTech                              14       9   64.3%    63.9
(no sector)                           14       6   42.9%    44.5
SpaceTech                             13       3   23.1%    68.8
Logistics                             12       8   66.7%    56.3
EdTech                                12       5   41.7%    65.8

3. HOTTEST CATEGORIES (all approved)
──────────────────────────────────────────────────
  By startup count (top 15):
     1. Fintech                               3,716 startups
     2. Gaming                                2,215 startups
     3. Climate                               1,460 startups
     4. Developer Tools                       1,324 startups
     5. AI/ML                                 1,241 startups
     6. HealthTech                              965 startups
     7. SaaS                                    859 startups
     8. PropTech                                383 startups
     9. Cybersecurity                           378 startups
    10. Media                                   303 startups
    11. Consumer                                290 startups
    12. EdTech                                  260 startups
    13. E-commerce                              239 startups
    14. Robotics                                225 startups
    15. Logistics                               207 startups

  By avg GOD score (sectors with 20+ startups, top 15):
     1. Enterprise                            76.3 avg
     2. Crypto/Web3                           72.0 avg
     3. Defense                               68.8 avg
     4. Biotech                               66.7 avg
     5. Marketing                             65.8 avg
     6. CleanTech                             64.8 avg
     7. SaaS                                  64.3 avg
     8. AI/ML                                 62.8 avg
     9. Consumer                              62.2 avg
    10. HR                                    62.1 avg
    11. Travel                                61.8 avg
    12. LegalTech                             60.1 avg
    13. ConTech                               59.4 avg
    14. DeepTech                              58.5 avg
    15. Robotics                              58.2 avg

4. LEADING STARTUPS (top 5 by GOD, per top 8 sectors)
──────────────────────────────────────────────────

  Fintech:
     1. 💰 Pluto                                  GOD 94
     2. 💰 GridPlatform                           GOD 93
     3.    Catalio                                GOD 93
     4.    Addi                                   GOD 93
     5. 💰 Aave                                   GOD 92

  Gaming:
     1. 💰 Hebbia                                 GOD 92
     2. 💰 Applied Intuition                      GOD 91
     3. 💰 RISA Labs                              GOD 90
     4. 💰 Branch.io                              GOD 88
     5. 💰 Azra Games                             GOD 85

  Climate:
     1. 💰 Aspen Power                            GOD 96
     2. 💰 IO River                               GOD 95
     3. 💰 CAPTCHA                                GOD 95
     4.    Levels                                 GOD 94
     5.    LLM Gateway                            GOD 93

  Developer Tools:
     1. 💰 Ultra                                  GOD 98
     2. 💰 Aspen Power                            GOD 96
     3. 💰 IO River                               GOD 95
     4. 💰 Nango                                  GOD 95
     5. 💰 Resolve AI                             GOD 94

  AI/ML:
     1. 💰 Upscale AI                             GOD 100
     2. 💰 Alt-qq                                 GOD 99
     3. 💰 Powerapply                             GOD 97
     4.    Kanu AI                                GOD 97
     5.    Shockwave                              GOD 95

  HealthTech:
     1.    Levels                                 GOD 94
     2.    Catalio                                GOD 93
     3.    Less Is More                           GOD 93
     4. 💰 Opengenepool                           GOD 91
     5. 💰 Syneron Bio                            GOD 91

  SaaS:
     1.    Odoo                                   GOD 100
     2. 💰 Alt-qq                                 GOD 99
     3. 💰 Housetrak                              GOD 99
     4. 💰 Ultra                                  GOD 98
     5. 💰 Powerapply                             GOD 97

  PropTech:
     1. 💰 Housetrak                              GOD 99
     2. 💰 Resolve AI                             GOD 94
     3. 💰 Bedrock                                GOD 94
     4. 💰 Kilo                                   GOD 89
     5. 💰 Tailscale                              GOD 89

══════════════════════════════════════════════════════════════════════
Note: "Funded" = has last_round_amount_usd, total_funding_usd, raise_amount, raise_type, or funding_mentions
---

*See also: [PYTHH_VC_ONE_PAGER.md](./PYTHH_VC_ONE_PAGER.md), [GOD-SCORE-V3-SUMMARY.md](./GOD-SCORE-V3-SUMMARY.md), [SIGNAL_SYSTEM_ROADMAP.md](./SIGNAL_SYSTEM_ROADMAP.md)*
