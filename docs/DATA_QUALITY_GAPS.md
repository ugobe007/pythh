# Data quality gaps (honest inventory)

This document tracks known limitations and mitigations. It complements [ENRICHMENT_STAGES.md](./ENRICHMENT_STAGES.md) and [ENRICHMENT_SCRIPTS_REFERENCE.md](./ENRICHMENT_SCRIPTS_REFERENCE.md).

## URL coverage (`needs_url`)

A large `needs_url` count means many rows are not in the strict RSS cohort; enrichment is harder and entity resolution quality is uneven.

**Mitigations:** entity gate (`entity_gate`: junk / needs_url / qualified), RSS gating flags on tightening, cold sparse runs for no-URL cohorts. Longer term: dedicated URL discovery / manual review queues for high-value rows.

## Headline and junk names (approved set)

Gates and validators remove some noise; pedigree logs and sparse pipelines can still surface headline-style names when news-derived text matches VC-like strings. This is primarily a **data quality and scoring** concern, not a missing table.

**Mitigations:** `entity-resolution-gate`, `startupNameValidator`, quality gates; verbose pedigree lines in `scripts/recalculate-scores.ts` are suppressed when `entity_gate === 'junk'` or the name fails `isValidStartupName` (scoring unchanged—log hygiene only). Further tightening belongs in gate rules and inference prompts, not log filters alone.

## Sparse pipeline vs GOD distribution

Many profiles are phase 4 with `total_god_score ≥ 70`, so they never matched the default sparse cohort (`total_god_score < 70` in `enrich-sparse-startups.js`).

**Mitigations:** widen the ceiling with `--god-score-below=85` or env `SPARSE_ENRICH_GOD_SCORE_BELOW`. The orchestrator accepts `--sparse-god-score-below=N`, which forwards to sparse enrich. Scheduled daily / weekly runs in `scripts/cron/run-enrichment-schedule.sh` pass `--sparse-god-score-below=85` so sparse work is not stuck on `< 70` only. The `cold` mode already runs `--god-score-below=85` for the no-URL cohort.

## Exit propensity

`exit_propensity_*` on `startup_uploads` is a **heuristic** (see `server/services/exitPropensityService.ts` and `scripts/compute-exit-propensity.ts`). It is not trained on labeled M&A outcomes until a labels pipeline exists.

**Mitigations:** batched apply with retries for transient 502s; `--repair-gaps` for backfill. **Future:** store curated acquisition / IPO labels and train or calibrate against them—see `scripts/sql/ma_outcome_labels_roadmap.sql`.

## Operational (502 / fetch failed on bulk writes)

Supabase and edge proxies occasionally return 502 or network errors on bulk upserts.

**Mitigations:** retries with backoff in write-heavy scripts, lower `--concurrency` when rate-limited, and idempotent reruns. Trade-off: higher concurrency is faster but increases burst load.
