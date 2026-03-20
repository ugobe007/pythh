# Signal System Roadmap

> Vision for automated signal intelligence: scraping, parsing, correlation, and LP/cohort mapping.

---

## 1. Automatic Scraping

**Goal:** Fully automated, scheduled data collection—no manual runs.

| Current State | Target State |
|---------------|--------------|
| Manual `enrich-from-rss-news.js`, `recalculate-scores.ts` | Cron/scheduler runs pipelines on schedule |
| Ad-hoc RSS scraping | Continuous ingestion with retry, backoff |
| Match generation on URL submit | Batch + real-time pipelines |

**Implementation ideas:**
- Cron jobs (e.g. `node-cron` in server) or Fly.io machines with schedules
- PM2/cron for: RSS scraper → enrich-from-rss-news → recalculate-scores
- Event-driven: new startup created → trigger enrichment pipeline

---

## 2. Funding News, Investor News, Startup News

**Goal:** Three distinct news streams, each with dedicated parsing and signal extraction.

| Stream | Source Types | Signals |
|--------|--------------|---------|
| **Funding news** | Crunchbase, TechCrunch funding rounds, PR wires | Amount, stage, lead investor, round type |
| **Investor news** | Partner moves, fund closes, thesis shifts, portfolio updates | Activity, check size, sector focus |
| **Startup news** | Product launches, milestones, partnerships, hires | Traction, execution, momentum |

**Implementation ideas:**
- Separate RSS feeds / API sources per stream
- `startup_events` + `investor_events` + `funding_events` (or tagged `event_type`)
- Unified event schema with `stream: 'funding' | 'investor' | 'startup'`

---

## 3. Identification and Numeration of Signals

**Goal:** Every signal has a unique ID and is countable/queryable.

| Concept | Implementation |
|---------|----------------|
| **Signal ID** | UUID or composite key (source + timestamp + entity) |
| **Signal type** | Enum: `funding_round`, `partner_join`, `thesis_shift`, `portfolio_add`, etc. |
| **Numeration** | Aggregate counts per startup/investor: `signal_count`, `signal_strength_score` |

**Implementation ideas:**
- `signal_events` table with `event_type`, `signal_id`, `magnitude`
- Indexed by startup_id, investor_id, event_type for fast aggregation

---

## 4. Correlation of Signals to Underlying Forces

**Goal:** Understand *why* signals move—tie them to macro/sector/structural drivers.

| Force Type | Examples |
|------------|----------|
| **Macro** | Interest rates, IPO window, recession |
| **Sector** | AI hype, climate regulation, fintech maturity |
| **Structural** | Fund vintage, dry powder, LP rebalancing |

**Implementation ideas:**
- `force_factors` table: (force_id, name, type, description, time_range)
- `signal_force_correlation`: (signal_id, force_id, correlation_score, confidence)
- ML or rule-based: "Series A in AI up 40% → correlate to AI sector force"

---

## 5. Reverse Logic Lookup

**Goal:** Contrarian check—"If X is true, is ¬X also true?"

| Example | Question |
|---------|----------|
| "AI is hot" | Is non-AI / adjacent (e.g. infra) also getting funded? |
| "Seed is frothy" | Are later stages actually tightening? |
| "VC X is active" | Where is VC X *not* investing? |

**Implementation ideas:**
- Query layer: `get_contrarian_signals(hypothesis)` 
- Store inverses: e.g. `sector_active` vs `sector_cold`
- Dashboard: "If [hypothesis], then [inverse] holds in N% of cases"

---

## 6. Ontological Advanced Parsing

**Goal:** Extract and cluster the language founders and investors use.

| Output | Use |
|--------|-----|
| **Founder phrases** | "we're building the X for Y", "pre-product", "stealth" |
| **Investor phrases** | "conviction", "contrarian", "founder-market fit" |
| **Common expressions** | Top N phrases by cohort, sector, stage |

**Implementation ideas:**
- NLP pipeline: extract n-grams, phrases from pitch/description/thesis
- `phrase_ontology` table: (phrase, context, frequency, cohort, sector)
- Use for: matching, clustering, trend detection

---

## 7. Surface Level Mapping

**Goal:** Where are hotspots? Who is funding what? Visual + queryable.

| Map Type | Data |
|----------|------|
| **Geographic** | Funding by city/region, investor HQ |
| **Sector** | Hot sectors, cold sectors, emerging |
| **Investor→Startup** | Who invested in what (portfolio mapping) |
| **Stage** | Seed vs A vs B activity over time |

**Implementation ideas:**
- Aggregation queries: `get_sector_heat`, `get_geo_funding`, `get_investor_portfolio_density`
- Precomputed materialized views for dashboard speed
- Export for mapping tools (e.g. Mapbox, D3)

---

## 8. LP (Limited Partner) Lookup

**Goal:** Who invests *in* VC funds, and how much?

| Data Point | Source / Challenge |
|------------|-------------------|
| LP name | SEC filings (Form D, ADV), fund announcements |
| Commitment amount | Often undisclosed; sometimes in press |
| Fund vintage | Fund documents, press |

**Implementation ideas:**
- `lps` table: (lp_id, name, type, known_commitments[])
- `lp_fund_commitments`: (lp_id, fund_id, amount_estimate, source, confidence)
- Scrape: SEC EDGAR, Preqin (if licensed), fund press releases
- **Note:** User flagged this as very important; data is sparse and sensitive

---

## 9. Cohort Activity & Portfolio

**Goal:** Which accelerator cohorts are active now? What's in their portfolio?

| Cohort | Examples |
|--------|----------|
| YC batches | W25, S25, etc. |
| Other accelerators | Techstars, 500 Global, etc. |
| VC scout programs | a16z scout, etc. |

**Implementation ideas:**
- `cohorts` table: (cohort_id, program, batch, start_date, company_count)
- `cohort_companies`: (cohort_id, startup_id, status)
- **User offer:** Help scrape VC portfolio pages (many are JS-heavy, gated)
- Crawl: YC directory, VC portfolio pages, Crunchbase cohort tags

---

## Suggested Phasing

| Phase | Scope | Effort | Status |
|-------|-------|--------|--------|
| **P1** | (1) Automatic scraping, (2) News stream separation | Medium | ✅ Done |
| **P2** | (3) Signal ID/numeration, (7) Surface mapping | Medium | ✅ Done |
| **P3** | (6) Ontological parsing, (9) Cohort scraping | High | ✅ Done |
| **P4** | (4) Force correlation, (5) Reverse logic | High | ✅ Done |
| **P5** | (8) LP lookup | Very high (data scarcity) | Pending |

---

## Implementation (P3/P4 — March 2026)

### P3: Ontological parsing + Cohort scraping
- **phrase_ontology** — Extracts founder/investor phrases (e.g. "pre-product", "conviction", "founder-market fit")
- **accelerator_cohorts** + **cohort_companies** — YC batches (W25, S24, etc.), Techstars, etc.
- Scripts: `npm run extract-phrases`, `npm run cohort-scrape`

### P4: Force correlation + Reverse logic
- **force_factors** — Macro/sector/structural drivers (AI momentum, interest rates, dry powder, etc.)
- **signal_force_correlation** — Links signals to forces
- **get_contrarian_signals(p_hypothesis, p_sector, p_days)** — e.g. "AI is hot" → non-AI deals? "Seed frothy" → later stages?

### Next Steps
1. **P5** — LP lookup (SEC filings, fund announcements)
2. **Cohort scraping** — Add more accelerators (Techstars, 500 Global); VC portfolio pages with your help

---

*Last updated: March 2026*
