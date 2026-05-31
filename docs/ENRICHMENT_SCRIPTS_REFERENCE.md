# Enrichment scripts — reference (copy-paste)

**Purpose:** One place to review **commands**, **`npm run` aliases**, **flags**, and **environment variables** for enrichment without relying on chat history.

**Prerequisites**

- Run commands from the **repository root** (`hot-honey/`).
- Load secrets via repo-root **`.env`** (`VITE_SUPABASE_URL`, `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, etc.). Scripts that call `require('dotenv').config()` load `.env` automatically.

**Related conceptual doc:** [ENRICHMENT_STAGES.md](./ENRICHMENT_STAGES.md) (phases, cold vs warm, scheduling narrative).

**Entity gate ML log:** set `ENTITY_GATE_ML_LOG=1` or pass `--ml-log` on `enrich-sparse-startups.js` / `reclassify-zero-signal-junk.js` to populate `entity_gate_ml_events`; in the Supabase SQL Editor run `select event_source, count(*) from entity_gate_ml_events group by 1;` to verify counts.

**Reference thesis (local copy):** repo-root `Ontologies_Startups_Investors.pdf` — *Startups’ Investment Ontology: the entrepreneur and investor perspectives* (Wilson Caldeira da Silva, FEUP / MIETE, 2021). Presents **SAPIENT** (ten sub-ontologies: Startup, Entrepreneur, Equity Investor, Startup Team, Resources, Presentations for Investors, Investor’s Evaluation Criteria, Investment Assessment Process, Investment Contract, Shareholders’ Agreement). Official open-access copy: [hdl.handle.net/10216/134682](https://hdl.handle.net/10216/134682).

---

## 1. `npm run` shortcuts (enrichment-focused)

| `npm run` | What it runs |
|-----------|----------------|
| `startup:tighten` | `node scripts/cron/startup-data-tightening.js` |
| `enrich:rss-news` | `node scripts/enrich-from-rss-news.js` |
| `enrich:sparse` | `node scripts/enrich-sparse-startups.js` |
| `enrich:sparse:html` | `node scripts/enrich-sparse-startups.js --html-only` |
| `entity-gate` | `node scripts/entity-resolution-gate.js` (dry-run) |
| `entity-gate:execute` | `node scripts/entity-resolution-gate.js --execute` |
| `enrich:schedule:daily` | `bash scripts/cron/run-enrichment-schedule.sh daily` — **full** `startup-data-tightening` chain: `--run-entity-gate`, `--rss-gate-exclude-junk`, capped RSS + sparse (skips DQ rollup for speed) |
| `enrich:schedule:daily-full` | Same as daily **plus** `data-quality-report.js --json --quick` at the end |
| `enrich:schedule:weekly` | `bash scripts/cron/run-enrichment-schedule.sh weekly` |
| `enrich:schedule:cold` | `bash scripts/cron/run-enrichment-schedule.sh cold` |
| `enrich:cron:install` | `bash scripts/setup-enrichment-cron.sh install` |
| `enrich:cron:remove` | `bash scripts/setup-enrichment-cron.sh remove` |
| `enrich:cron:check` | `bash scripts/setup-enrichment-cron.sh check` |
| `recalc` | `npx tsx scripts/recalculate-scores.ts` |
| `compute:exit-propensity` | `npx tsx scripts/compute-exit-propensity.ts` (add `--apply` to persist M&A heuristic scores). Large DBs: parallel batches (`--concurrency=40`, default 25). **`--repair-gaps`** — only rows with `exit_propensity_at IS NULL` (after transient 502/fetch failures). Also runs at end of `startup:tighten` unless `--skip-exit-propensity` |

**SUMMARY line meanings** (Updated / Momentum / AP / …): [SCORE_RECALC_SUMMARY.md](./SCORE_RECALC_SUMMARY.md)

---

## 2. Orchestrator: `scripts/cron/startup-data-tightening.js`

**Entry:** `npm run startup:tighten` or `node scripts/cron/startup-data-tightening.js [flags]`

**Step order (default):**

0. *(optional)* `--run-entity-gate` → entity gate → `enrich-sparse-startups --gate-needs-url-only --html-only` → `reclassify-zero-signal-junk --execute` → entity gate finalize (URL before junk)  
1. `cleanup-garbage.js --reject` *(unless `--skip-garbage`)*  
2. `promote-extracted-fields.js --apply` *(unless `--skip-promote`)*  
2b. `ingest-metrics-signals.js --apply` *(unless `--skip-promote` or `--skip-metrics-signals`)*  
3. `enrich-from-rss-news.js` *(unless `--skip-rss`)* → then `data-integrity-check.js --fix`, `quality-gate.js --execute`  
4. `sync-signal-scores.js --apply`  
5. `recalculate-scores.ts`  
6. *(optional)* `enrich-sparse-startups.js` *(unless `--skip-sparse` or `--sparse-limit=0`)*  
7. `recalculate-scores.ts` again after sparse  
8. *(unless `--skip-dq-report`)* `data-quality-report.js --json --quick`  
9. *(unless `--skip-exit-propensity`)* `compute-exit-propensity.ts --apply` → `startup_uploads.exit_propensity_*` (portfolio UI + API)

| Flag | Effect |
|------|--------|
| `--run-entity-gate` | URL-before-junk chain: gate → sparse HTML on `needs_url` → junk reclassify → gate finalize. Limit: `--url-resolve-limit=N` (default 200). |
| `--url-resolve-limit=200` | Max rows for the pre-junk `needs_url` HTML pass when `--run-entity-gate`. |
| `--rss-gate-exclude-junk` | Pass `--gate-exclude-junk` to RSS enrich (skip `entity_gate=junk` only). **Recommended** with gate populated. |
| `--rss-gate-qualified` | Pass `--gate-qualified-only` (strict: only `entity_gate=qualified`). Do not combine with exclude-junk intent. |
| `--skip-garbage` | Skip cleanup-garbage. |
| `--skip-promote` | Skip promote + metric signals. |
| `--skip-metrics-signals` | Skip `ingest-metrics-signals` only. |
| `--skip-rss` | Skip RSS + integrity + quality gate block. |
| `--rss-capped` | RSS uses `--limit N` instead of `--all`. Default limit in code is **2000** if you omit `--rss-limit=`. |
| `--rss-limit=2500` | Used with `--rss-capped` (example: daily schedule uses 2500). |
| `--skip-sparse` | Skip sparse enrichment entirely. |
| `--sparse-limit=100` | Max startups for `enrich-sparse-startups` (default from `lib/inferencePipelineConfig.js` if omitted). |
| `--sparse-html-only` | Add `--html-only` to sparse step. |
| `--skip-dq-report` | Skip final data-quality report. |
| `--skip-exit-propensity` | Skip exit-propensity batch (`compute-exit-propensity.ts`). |
| `--promote-limit=N` | Pass `--limit=N` to `promote-extracted-fields.js`. |

**Examples**

```bash
# Full default (long if RSS is uncapped)
npm run startup:tighten

# Faster: cap RSS + skip DQ rollup
node scripts/cron/startup-data-tightening.js --rss-capped --rss-limit=3000 --skip-dq-report

# Recommended with entity gate: refresh labels + RSS exclude junk only
node scripts/cron/startup-data-tightening.js --run-entity-gate --rss-gate-exclude-junk --rss-capped --rss-limit=4000 --skip-dq-report

# Maintenance without RSS
node scripts/cron/startup-data-tightening.js --skip-rss --sparse-limit=80
```

---

## 3. RSS matching: `scripts/enrich-from-rss-news.js`

**Entry:** `npm run enrich:rss-news` or `node scripts/enrich-from-rss-news.js [flags]`

**Data:** Reads `startup_events` (recent window from `RSS_ENRICH_DAYS_LOOKBACK` in config) and matches to approved `startup_uploads`.

| Flag | Effect |
|------|--------|
| `--all` | Match against **all** approved startups (paginated). |
| `--limit N` | Only load up to **N** approved startups (faster experiments). |
| `--gate-exclude-junk` | Exclude only rows with `entity_gate = junk` (keeps `null`, `needs_url`, `qualified`). **CLI overrides** conflicting `.env` for this mode. |
| `--gate-qualified-only` | Only `entity_gate = qualified` (strict, small pool). |
| `--dry-run` | No writes. |
| `--skip-recalc` | Do not run `recalculate-scores.ts` after updates. |

**Environment (optional; CLI flags take precedence when passed)**

| Variable | Meaning |
|----------|---------|
| `RSS_ENRICH_GATE_EXCLUDE_JUNK_ONLY=1` | Same as `--gate-exclude-junk` when no CLI gate flag is passed. |
| `RSS_ENRICH_GATE_QUALIFIED_ONLY=1` | Same as `--gate-qualified-only` when no CLI gate flag is passed. |

**Behavior notes**

- **`funding_outcomes` rows** are created only for events whose `event_type` is **`FUNDING`** or **`INVESTMENT`**. Other types may still update press counts and `extracted_data` via inference.
- Progress lines may show **`0` committed** funding rows for a long time: inserts flush in **batches of 50**; a small number of funding rows often flushes **once at the end** of the startup loop. Read the summary line **`Funding outcomes recorded: N`** at the end for the true count.

---

## 4. Sparse enrichment: `scripts/enrich-sparse-startups.js`

**Entry:** `npm run enrich:sparse` or `node scripts/enrich-sparse-startups.js [flags]`

| Flag | Effect |
|------|--------|
| `--limit=N` | Process up to N rows this run. |
| `--dry-run` | No DB writes. |
| `--no-url-only` | Prefer cohort **without** a usable website (cold). Automatically excludes `entity_gate=junk` rows at the DB level — no time wasted on junk names. |
| `--gate-needs-url-only` | **Strictest** no-URL mode: only rows explicitly labeled `entity_gate=needs_url` by the entity resolution gate. Use after `node scripts/entity-resolution-gate.js --execute`. Faster and cleaner than `--no-url-only` when the gate has been run. |
| `--html-only` | Skip Google News fallback; website HTML only (`npm run enrich:sparse:html`). |
| `--include-holding` | Include startups in **holding** status (retries after failures). |
| `--run-all` | Loop in chunks until queue empty (uses `--limit` per chunk). |
| `--god-score-below=N` | Only rows with `total_god_score < N` (default **70**). Raise (e.g. **85**) if the queue looks empty but you still want work. |

**Environment (examples)**

| Variable | Purpose |
|----------|---------|
| `SPARSE_ENRICH_GOD_SCORE_BELOW` | Default ceiling for `--god-score-below`. |
| `SPARSE_ENRICH_EXCLUDE_ENTITY_JUNK=1` | Skip rows with `entity_gate = junk`. |

Timeouts and lite modes are documented in-script and configurable via `.env` (see file header in `enrich-sparse-startups.js`).

---

## 5. Entity resolution gate: `scripts/entity-resolution-gate.js`

**Migration:** `supabase/migrations/20260410150000_entity_resolution_gate.sql`

| Command | Effect |
|---------|--------|
| `npm run entity-gate` | Dry-run: counts only. |
| `npm run entity-gate:execute` | Write `entity_gate`, `entity_gate_reason`, `entity_gate_at`. |
| `node scripts/entity-resolution-gate.js --execute --startups-only` | Startups table only. |
| `node scripts/entity-resolution-gate.js --execute --investors-only` | Investors table only. |

---

## 6. Scheduled wrappers: `scripts/cron/run-enrichment-schedule.sh`

Run from repo root:

| Mode | Command | Rough behavior |
|------|---------|----------------|
| Daily | `./scripts/cron/run-enrichment-schedule.sh daily` | `startup-data-tightening` with `--rss-capped --rss-limit=2500 --sparse-limit=120 --skip-dq-report` |
| Weekly | `./scripts/cron/run-enrichment-schedule.sh weekly` | Capped `--rss-limit=8000 --sparse-limit=250` |
| Cold | `./scripts/cron/run-enrichment-schedule.sh cold` | `enrich-sparse-startups --no-url-only --limit=60 --god-score-below=85` then `recalculate-scores.ts` |
| Smoke | `./scripts/cron/run-enrichment-schedule.sh smoke` | Sanity check (no DB work). |

Edit the script to change limits or to swap weekly from capped to full `--all` RSS if you accept long runtimes.

---

## 7. Cron install helper: `scripts/setup-enrichment-cron.sh`

```bash
./scripts/setup-enrichment-cron.sh install   # add cron lines
./scripts/setup-enrichment-cron.sh check     # show status
./scripts/setup-enrichment-cron.sh remove    # remove those lines
```

Logs (default paths referenced in the installer): `logs/enrichment-daily.log`, `logs/enrichment-weekly.log`, `logs/enrichment-cold.log`.

---

## 8. Config centralization

- **`lib/inferencePipelineConfig.js`** — defaults such as `STARTUP_TIGHTEN_SPARSE_DEFAULT`, `RSS_ENRICH_DAYS_LOOKBACK`, sparse timeouts, etc.

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-04-11 | Linked local `Ontologies_Startups_Investors.pdf` (SAPIENT thesis) and handle.net URI. |
| 2026-04-03 | Added this reference; documented `startup-data-tightening` step order, RSS/gate flags, funding batch logging note. |
