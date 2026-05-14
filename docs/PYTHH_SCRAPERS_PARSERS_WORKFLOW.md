# Pythh — scrapers, parsers, and ingestion workflow

**Purpose:** Technical description of how Pythh (product; repo may be `hot-honey`) acquires and structures startup-related signals from RSS and related pipelines. Intended for engineering review, operations, and **IP / patent documentation** (factual system behavior only; not legal advice).

**Related:** [ENV_SECRETS_GITHUB_FLY_SUPABASE.md](./ENV_SECRETS_GITHUB_FLY_SUPABASE.md), [SCRAPER_FUNDING_MA_CAPABILITIES.md](./SCRAPER_FUNDING_MA_CAPABILITIES.md), [AUTOMATION-PIPELINE.md](./AUTOMATION-PIPELINE.md), [ENRICHMENT_STAGES.md](./ENRICHMENT_STAGES.md) (phased startup enrichment + cron). Deeper SSOT design notes: [`SSOT_RSS_SCRAPER_GUIDE.md`](../SSOT_RSS_SCRAPER_GUIDE.md) (repo root).

---

## 1. High-level architecture

1. **Source registry** — Curated RSS (and similar) feeds live in Supabase (e.g. `rss_sources`), keyed by name, URL, activity flags, and scrape timestamps.
2. **Transport** — Node.js jobs fetch XML/JSON feeds using the **`rss-parser`** library (`npm`), HTTP headers (including rotating user-agents in the SSOT path), delays/backoff per publisher, optional proxy support, and optional ETag/Last-Modified style caching where implemented.
3. **Parsing / semantics** — Headlines (and sometimes summaries) are interpreted by a **stack of modules**: (a) a **frame-based capital-event parser** (TypeScript), (b) a **pattern-based event classifier** (JavaScript), (c) optional **regex / heuristic extractors** for sectors, funding phrases, and “signal” structures, and (d) **quality gates** (publisher + headline filters, junk URL rules, startup name validation).
4. **Persistence** — Structured rows are written to Supabase tables such as **`startup_events`** (normalized events) and **`discovered_startups`** (candidate companies from lighter paths), with deduplication keys tied to publisher + URL where defined.
5. **Downstream** — Separate jobs **match** events to approved profiles (`startup_uploads`), **merge** fields into JSON blobs (e.g. `extracted_data`), run **scoring** (GOD / hot score services), and trigger **recalculation** scripts.

---

## 2. Primary ingestion paths (two RSS pipelines)

### 2.1 SSOT RSS pipeline — `scripts/core/ssot-rss-scraper.js`

**Role:** Main structured ingestion path for high-volume RSS.

**Design principle (“SSOT”):** The **frame parser** is treated as the single source of truth for semantic decisions (event type, entities, accept/reject, and whether graph-safe joins are allowed). The scraper layer normalizes transport (fetch, rate limits) and persists results; it avoids duplicating “judgment” that belongs in the parser.

**Notable dependencies (imports):**

| Module | Path | Role |
|--------|------|------|
| Frame parser + event shaping | `src/services/rss/frameParser.ts` | Parses headline → **CapitalEvent** (subject/object, amounts, round, `event_type`, `extraction.decision`, `extraction.graph_safe`, etc.) |
| Event classifier | `lib/event-classifier.js` | Fast pattern-based classification (funding, acquisition, launch, …) used inside / alongside frame logic |
| Source quality | `lib/source-quality-filter.js` | Publisher/headline gating before persisting to `startup_events` |
| Inference extractors | `lib/inference-extractor.js` | Structured fields (e.g. sectors, inference-style signals) from text |
| Signal parser | `lib/signalParser.js` | Additional structured “business signals” from article text |
| Scoring | `server/services/startupScoringService.ts` | GOD / hot score computation when new graph rows are created |
| URL / name hygiene | `lib/junk-url-config.js`, `lib/startupNameValidator.js` | Reject junk domains; validate entity names |

**Phases (conceptual):**

- **Phase A:** After parser + source-quality checks, persist the **event** (when accepted per parser contract).
- **Phase B:** Create or link **graph** records (e.g. startup rows) only when the parser marks the event **`graph_safe`**.

**Operational behaviors:** Adaptive delays, backoff on failures, optional `HttpsProxyAgent`, metrics such as `source_quality` for observability.

### 2.2 “Simple” RSS pipeline — `scripts/core/simple-rss-scraper.js` (and `npm run scrape`)

**Role:** Lighter path focused on **headline-driven discovery** with less frame machinery; still uses shared validators and optional inference extractors.

**Notable modules:**

| Module | Path | Role |
|--------|------|------|
| Headline company extraction | `lib/headlineExtractor.js` | Verb-centric patterns to propose a company name from a headline |
| Multi-entity sentence extraction | `lib/sentenceExtractor.js` | Broader patterns for multiple names in one line |
| Insert gate | `lib/startupInsertGate.js` | Centralized rules for inserting into `discovered_startups` (dedupe, quality) |
| Source quality | `lib/source-quality-filter.js` | Same family of filters as SSOT path (shared `shouldProcessEvent` / related APIs) |
| URL sanitization | `lib/junk-url-config.js` | Avoid storing article hosts as company websites |

**Rate limiting:** Per-publisher delays, max sources per run (tuned for CI/host time limits), backoff state per feed name.

### 2.3 Legacy / auxiliary scrapers — `scrapers/` (repo root)

Additional Node scripts for targeted sources (e.g. VC blogs, HN, funding-specific flows, logo fetch, daily ingest). These are **older or specialized** paths; production and CI increasingly favor `scripts/core/ssot-rss-scraper.js` (see `.github/workflows/automated-scraper.yml`).

---

## 3. Parser and classifier stack (technical)

### 3.1 Frame parser (`src/services/rss/frameParser.ts`)

- Emits a versioned **CapitalEvent** contract: frame type (e.g. bidirectional / directional / self-event), **verb**, **subject** / **object** slots, **entities** with roles (SUBJECT, OBJECT, COUNTERPARTY, CHANNEL), optional **amounts** and **funding round** strings, and **extraction** metadata (`decision`, `graph_safe`, pattern ids, reject reasons).
- **Stable identity:** `event_id` derived from publisher + canonical URL (not title), so title edits do not fragment deduplication.
- **Engine label:** Types reference a frame engine version string (e.g. `jisstrecon-v2`) for provenance.

### 3.2 Event classifier (`lib/event-classifier.js`)

- **Zero-LLM** pattern layer: regex and token rules for categories such as **FUNDING**, **ACQUISITION**, **LAUNCH**, **PARTNERSHIP**, plus non-event filters (questions, “Ask HN”, hypotheticals).
- Used as a **first-pass** signal and integrated with the frame parser pipeline.

### 3.3 Inference extractor (`lib/inference-extractor.js`)

- Multi-phase **heuristic** pipeline over text (documented internally as phases for URL sanitization, name-from-URL, sub-extractors for funding/sector/team/etc., confidence tiers).
- Supports **sector** taxonomies (v2 exposes broader category coverage than a legacy 10-bucket set).

### 3.4 Signal parser (`lib/signalParser.js`)

- Extracts structured **signals** used in Pythh’s signal intelligence features (consumers include RSS scripts and other ingest paths).

### 3.5 Trajectory engine (`lib/trajectoryEngine.js`)

- Consumes **chronological signal history** and matches **multi-step narrative patterns** (e.g. hiring → GTM → enterprise → financing; pilot → procurement → deployment; distress → bridge → exit). See [PYTHH_TRAJECTORY_ENGINE.md](./PYTHH_TRAJECTORY_ENGINE.md).

### 3.5 Source quality filter (`lib/source-quality-filter.js`)

- Rules for **noisy publishers**, **non-startup headlines** (politics, sports, lifestyle, etc.), and **established-company** patterns to reduce false positives.
- Integrated into SSOT scraper, simple scraper, RSS enrichment, and other scripts (see file header comments).

### 3.6 Web HTML parsing (non-RSS)

- **`lib/dynamic-parser.js`** — Cheerio-based HTML parsing for page content (used in broader scraping / enrichment flows outside pure RSS).

---

## 4. Downstream workflow (after RSS capture)

### 4.1 Enrichment from events — `scripts/enrich-from-rss-news.js`

- Reads **`startup_events`** over a configurable lookback window.
- Applies the same **source-quality** concepts before matching.
- **Matches** event subjects (and related fields) to **approved** rows in **`startup_uploads`** via normalized name comparison (and related logic).
- Merges **press tier**, **funding amount**, **stage**, and acquisition-related outcomes where implemented (see [SCRAPER_FUNDING_MA_CAPABILITIES.md](./SCRAPER_FUNDING_MA_CAPABILITIES.md) for current gaps vs targets).
- May spawn **score recalculation** after updates.

### 4.2 Scoring and automation

- **GOD / hot scoring:** Implemented in TypeScript services (e.g. `server/services/startupScoringService.ts`) and invoked from batch scripts and the SSOT scraper when new entities are materialized.
- **Pattern-only enrichment** (no LLM): e.g. `run-inference-enrichment.js` and docs in [AUTOMATION-PIPELINE.md](./AUTOMATION-PIPELINE.md).

### 4.3 Orchestration

| Trigger | Example |
|---------|---------|
| **npm scripts** | `npm run scrape` → `simple-rss-scraper.js`; `npm run enrich:rss-news` → `enrich-from-rss-news.js` |
| **GitHub Actions** | `.github/workflows/automated-scraper.yml` — runs `ssot-rss-scraper.js` on a schedule (~12h) plus optional inference steps |
| **PM2 / cron** | `ecosystem.config.js` (and related docs) for long-running or scheduled processes on hosts |

---

## 5. Data stores (conceptual schema touchpoints)

| Artifact | Typical role |
|----------|----------------|
| `rss_sources` | Feed catalog and scrape metadata |
| `startup_events` | Normalized capital / news **events** from SSOT path |
| `discovered_startups` | Candidate companies from discovery paths |
| `startup_uploads` | Canonical startup profiles (approved/pending/rejected) |
| `extracted_data` (JSON on uploads) | Merged enrichment from RSS and other sources |
| `funding_outcomes`, `startup_exits`, `virtual_portfolio` | Outcome / exit tracking (where migrations and jobs are enabled) |

Exact columns evolve with SQL migrations under `supabase/migrations/`.

---

## 6. External components and constraints

- **Third-party libraries:** `rss-parser` for feed XML; `cheerio` (via dynamic parser) for HTML; `@supabase/supabase-js` for database access.
- **No scraping of paywalled content** is implied by RSS-only paths; behavior depends on each feed’s public XML.
- **LLM usage** is optional and configured per script (e.g. OpenAI env vars in CI for some workflows); many classifiers are **purely deterministic** (regex / rules).

---

## 7. Document control

- **Maintainer:** Update this file when adding a new primary ingest script or changing the SSOT contract (`CapitalEvent`, persistence phases, or shared filters).
- **Versioning:** Frame contract includes `schema_version` in code; cite git revision when attaching this doc to filings.
