# Signal-informed GOD scoring

**Status:** Phase 1 (feature plumbing) + Phase 2 weights **live** (user-directed override of proof-cohort gate, 2026-08-28).

## Why Hit@5 is still ~12.7%

Sealed Hit@5 among audited funded startups is **not** primarily a GOD weight problem. Dominant miss bucket is **`candidate_generation_miss`** — the actual funder was never in the pre-event match pool / top-5. Rematch and signal polish cannot rewrite sealed prediction clocks.

| Layer | Metric | Role |
|-------|--------|------|
| Ops drain | ~2941/5000 resolved | Evidence search coverage |
| Product claim | ~12.7% Hit@5 @180d | Sealed top-5 vs later funders |
| Proof cohort | **0/5** verified pairs since 2026-08-25 | Originally gated weight retune; overridden for live apply |

## Matching is not GOD↔GOD

Startup GOD and investor GOD are **separate** scores. Match score (`calculateMatchScore` in `server/routes/instantSubmit.js`) is a multi-factor fit:

| Component | Cap | Meaning |
|-----------|-----|---------|
| Sector fit | 40 | Taxonomy overlap |
| Stage fit | 20 | Stage label overlap |
| Investor quality | 20 | From investor GOD / tier (not equality to startup GOD) |
| Startup quality | 25 | Thresholded from startup `total_god_score` |
| Signal bonus | 10 | Independent `signals_total` |
| Faith alignment | 15 | Investor thesis themes × startup sectors |

Then stage/tech-VC adjustments, recency, prior relationship, firm dedup, and force-include via `frequentLedgerFunders`.

## What was wrong with signals

```
scrape → GOD score → invent signals_total FROM GOD → match
                              ↑
                    circular: signals mirror GOD
                 real pythh_signal_events arrive in Phase 4 (after match)
```

Market/entity signals arrived **after** ranking, and `applyGodBlendToSignalDimensions` shrinks event sums toward a GOD prior — so signals could not inform fundability.

## Phase 1 — architecture (shipped)

```
scrape / inference / news enrich
       ↓
load pythh_signal_events (if any) ──► dims WITHOUT GOD prior
       ↓
merge dims into scoring profile (press / execution / psych strengths)
       ↓
calculateHotScore (GOD)  ← sees signal features
       ↓
persist real signals_total → match uses independent signal term
```

Code:
- `lib/signalInformedGod.js` — `loadSignalDimsBeforeGod`, `mergeSignalDimsIntoStartup`, `upsertSignalScoresFromPreGod`
- `server/scoring/hotGodFromStartupRow.js` — maps psych strengths into profile
- `server/routes/instantSubmit.js` — sync + Phase 2 load signals **before** GOD

## Phase 2 — weight retune (live)

Live `GOD_SCORE_CONFIG.componentWeights`:

| Component | Share | Rationale |
|-----------|-------|-----------|
| team | 0.22 | Slightly down vs equal team-heavy inflation |
| traction | 0.30 | Up — capital/news evidence should move fundability |
| market | 0.20 | Unchanged |
| product | 0.15 | Unchanged |
| vision | 0.13 | Down — thin thesis-only rows |

Applied in `calculateHotScore` via `weightedCore` (normalize each bucket to its max, multiply by weight, scale by core budget). Base boost + red flags remain additive outside the rebalance.

Also expand `frequentLedgerFunders` from `funding:audit:candidate-misses` → never-pre-matched qualified firms still missing from the allowlist.

## What to run after merge

```bash
# New URL submits use signal-before-GOD + live weights automatically
# Optional batch rescore:
# node scripts/recalculate-scores.ts

# Highest Hit@5 lever remains generation coverage:
npm run funding:audit:candidate-misses
# → expand frequentLedgerFunders from gaps in topNeverPreMatched
```
