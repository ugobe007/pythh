# Enrichment stages — phased workflow

**Purpose:** Describe how startup profile enrichment should be **gated**, how **cold** vs **warm** cohorts differ, and which repo scripts implement each layer. Use this to schedule jobs so expensive steps do not block cheap ones.

**Command cheat sheet (flags, `npm run`, env):** [ENRICHMENT_SCRIPTS_REFERENCE.md](./ENRICHMENT_SCRIPTS_REFERENCE.md)

**Related:** [PYTHH_SCRAPERS_PARSERS_WORKFLOW.md](./PYTHH_SCRAPERS_PARSERS_WORKFLOW.md), [ENV_SECRETS_GITHUB_FLY_SUPABASE.md](./ENV_SECRETS_GITHUB_FLY_SUPABASE.md), [ONTOLOGY_REASONING_ROADMAP.md](./ONTOLOGY_REASONING_ROADMAP.md) (sectors, portfolio overlap, user deal prefs), [DATA_QUALITY_GAPS.md](./DATA_QUALITY_GAPS.md) (known limitations: URL coverage, sparse vs GOD, exit heuristic, ops). Orchestrator: `scripts/cron/startup-data-tightening.js`. Schedule installer: `scripts/setup-enrichment-cron.sh`.

---

## 0. Entity resolution gate — two-step sequence

**Migration:** `supabase/migrations/20260410150000_entity_resolution_gate.sql` adds `entity_gate`, `entity_gate_reason`, `entity_gate_at` on `startup_uploads` and `investors`.

| `entity_gate` | Meaning |
|----------------|--------|
| `junk` | Name fails junk filter or logic engine — not a processable entity |
| `needs_url` | Name passes, but no `website`/`company_website` found |
| `qualified` | Name + URL signals OK — eligible for full RSS matching |

### Correct pipeline order

**Step 1 — Pre-gate name junk filter** (marks obvious name junk across ALL approved rows before the logic engine runs):

```bash
node scripts/reclassify-zero-signal-junk.js --pre-gate --execute
```

Applies `isGarbage()` + `ontologyJunkReason()` + `isNonStartupEntity()` to every approved row, including rows with no `entity_gate` yet. Junk names are labeled immediately — the logic engine never processes them.

**Step 2 — Logic engine gate** (structural template classification on surviving rows):

```bash
node scripts/entity-resolution-gate.js --execute
```

Skips rows already marked `junk`. Runs the logic engine on remaining rows — classifies investor VC-type names, headline fragments, and descriptor phrases as `junk`; labels others `needs_url` or `qualified` based on URL presence.

**Step 3 — Enrich** (only `needs_url` survivors):

```bash
node scripts/enrich-sparse-startups.js --gate-needs-url-only --limit=400
```

**Step 4 — Post-enrichment junk pass** (catches entries enrichment revealed as non-starters):

```bash
node scripts/reclassify-zero-signal-junk.js --execute
```

**Step 5 — Score:**

```bash
npx tsx scripts/recalculate-scores.ts
```

**Single-line pipeline (copy-paste):**

```bash
node scripts/reclassify-zero-signal-junk.js --pre-gate --execute && node scripts/entity-resolution-gate.js --execute && node scripts/enrich-sparse-startups.js --gate-needs-url-only --limit=400 && node scripts/reclassify-zero-signal-junk.js --execute && npx tsx scripts/recalculate-scores.ts
```

### Downstream flags

- **RSS (recommended):** skip **junk only** — keep `null`, `needs_url`, and `qualified`. In repo-root **`.env`**: `RSS_ENRICH_GATE_EXCLUDE_JUNK_ONLY=1`, or CLI: `--gate-exclude-junk`. Tightening: `--rss-gate-exclude-junk`. `enrich-from-rss-news.js` loads `.env` when you run it directly.
- **Strict RSS (optional, small pool):** `RSS_ENRICH_GATE_QUALIFIED_ONLY=1` or `--gate-qualified-only` — only `entity_gate = qualified`. Do **not** set this together with exclude-junk; qualified-only wins if both are set.
- **Tightening:** `--run-entity-gate` runs the gate at the start. Pair with `--rss-gate-exclude-junk` (recommended) or `--rss-gate-qualified` (strict).
- **Sparse:** `SPARSE_ENRICH_EXCLUDE_ENTITY_JUNK=1` skips `entity_gate = junk` rows (still allows `null`).

`cleanup-garbage.js --reject` remains the hammer for auto-rejecting bad startup names; the gate **labels** rows first so you can measure junk volume without rejecting immediately.
---

## 1. Conceptual stages (gates)

Processing should advance **one stage at a time** per cohort. Cheap gates run first; expensive network and news steps run only when still needed.

| Stage | Goal | When to skip |
|--------|------|----------------|
| **A — Junk / headline filter** | Drop or reject names that are not real company entities | Always first for bulk jobs |
| **B — Name / ontology** | Resolve a canonical company signal; quarantine ambiguous rows | Before URL and HTTP |
| **C — URL discovery** | Find `website` / `company_website` from name + light probes | If URL already trusted |
| **D — Press / RSS** | Attach funding, M&A, and text signals from feeds and match to profiles | If signals already fresh enough |
| **E — Sparse inference** | HTML scrape + `extracted_data` + optional news (`quickEnrich`) for thin profiles | Split **cold** (no URL) vs **warm** (has URL) — see §3 |
| **F — Plausibility / policy** | “Is this a startup?” — rules + scores; align with `quality-gate`, GOD tiers | Before auto-approve or bulk promotion |

Today, several stages live inside **one orchestrated script** (`startup-data-tightening.js`). The **schedule** (see §5) separates **daily capped** work from **weekly deeper** work so a full RSS pass does not block daily maintenance.

---

## 2. Scripts mapped to stages

| Stage | Primary scripts / notes |
|--------|-------------------------|
| A0 | `scripts/entity-resolution-gate.js` — classify `junk` / `needs_url` / `qualified` (DB columns) |
| A | `scripts/cleanup-garbage.js` (e.g. `--reject` in tightening step 1) |
| B | Ontology / validators: `lib/startupNameValidator.js`, ontology helpers used in enrichment and RSS paths |
| C–E | `scripts/enrich-sparse-startups.js` (HTML, optional news), URL inference inside inference pipeline |
| D | `scripts/enrich-from-rss-news.js` (press/RSS → `startup_uploads` / events) |
| Promote structured fields | `scripts/promote-extracted-fields.js` |
| Metrics → signals | `scripts/ingest-metrics-signals.js` |
| Integrity / quality | `scripts/data-integrity-check.js`, `scripts/quality-gate.js` |
| Scores | `scripts/sync-signal-scores.js`, `scripts/recalculate-scores.ts` |
| Full tightening chain | `node scripts/cron/startup-data-tightening.js` |

**Config defaults** (limits, timeouts): `lib/inferencePipelineConfig.js` (e.g. `STARTUP_TIGHTEN_SPARSE_DEFAULT`).

---

## 3. Cold vs warm cohorts

| Cohort | Rough definition | Risk | Schedule hint |
|--------|------------------|------|----------------|
| **Warm** | Has usable URL or richer `extracted_data` / higher data phase | Lower wall-clock per row | **Daily** batch: higher throughput (`--sparse-html-only` optional) |
| **Cold** | No URL, minimal fields, often stuck in `waiting` / null enrichment | High latency, timeouts, junk skew | **Separate** window, **small `--limit`**, consider `--no-url-only` on `enrich-sparse-startups.js` |

**Rule of thumb:** Do not run an uncapped **RSS-all** pass on the same clock as a **large cold sparse** queue unless you intend an overnight job.

---

## 4. CLI patterns (copy-paste)

**Full tightening (interactive / rare):** long-running if RSS is `--all`.

```bash
npm run startup:tighten
```

**Daily-style (capped RSS + default sparse batch):**

```bash
./scripts/cron/run-enrichment-schedule.sh daily
```

**Weekly deeper pass (high RSS cap + larger sparse — edit `run-enrichment-schedule.sh` to use full `--all` if you want):**

```bash
./scripts/cron/run-enrichment-schedule.sh weekly
```

**Cold-only sparse queue (example):**

```bash
node scripts/enrich-sparse-startups.js --no-url-only --limit=40 --god-score-below=85
```

**Warm sparse (example):**

```bash
node scripts/enrich-sparse-startups.js --limit=80 --god-score-below=70
```

---

## 5. Scheduling (cron on macOS / Linux)

1. From the repo root, install enrichment cron entries (does not remove the existing `scripts/setup-cron.sh` pipeline jobs):

   ```bash
   ./scripts/setup-enrichment-cron.sh install
   ```

2. Logs: `logs/enrichment-daily.log`, `logs/enrichment-weekly.log`, `logs/enrichment-cold.log`.

3. Inspect:

   ```bash
   ./scripts/setup-enrichment-cron.sh check
   crontab -l
   ```

4. Remove only enrichment lines:

   ```bash
   ./scripts/setup-enrichment-cron.sh remove
   ```

**Default times (adjust in `setup-enrichment-cron.sh`):**

- **Daily** — every morning (7 days): runs `run-enrichment-schedule.sh daily` → full `startup-data-tightening.js` with **entity gate**, **RSS exclude-junk**, capped RSS, and sparse (see `docs/ENRICHMENT_SCRIPTS_REFERENCE.md`). To use weekdays only, change the fifth cron field from `*` to `1-5` in `setup-enrichment-cron.sh` (e.g. `40 5 * * 1-5`).
- **Weekly** — Sunday early morning: larger RSS cap + larger sparse (same gate flags).
- **Cold sparse** — weekly offset night: small `--limit` cold path so it does not contend with daily warm throughput.

---

## 6. Future: explicit `enrichment_stage` column

The ideal implementation stores **one stage per row** (`name_validated` → `url_resolved` → `press_enriched` → …) and runs **one worker per stage**. Until that exists, the **wrapper + cron** above gives **phased behavior in time** (different jobs, different filters) without a single monolithic “do everything” run every day.

---

## 7. Changelog

- **2026-04-14** — Restructured pipeline: junk filter (`--pre-gate`) now runs BEFORE the logic engine gate. Added `runPreGate()` to `reclassify-zero-signal-junk.js`. `lib/startupNameLogicEngine.js` structural template classifier integrated into gate. Gate's Layer 1 (name junk) and Layer 2 (logic engine) now separated as distinct pipeline steps.
- **2026-04-03** — Added [ENRICHMENT_SCRIPTS_REFERENCE.md](./ENRICHMENT_SCRIPTS_REFERENCE.md) (copy-paste commands and flags).
- **2026-04-10** — Entity resolution gate (`entity_gate` columns), `entity-resolution-gate.js`, RSS `--gate-exclude-junk` / `RSS_ENRICH_GATE_EXCLUDE_JUNK_ONLY` (recommended) vs strict `--gate-qualified-only`, tightening `--rss-gate-exclude-junk`, sparse `SPARSE_ENRICH_EXCLUDE_ENTITY_JUNK`.
- **2026-04-03** — Initial doc + `run-enrichment-schedule.sh` + `setup-enrichment-cron.sh`.
