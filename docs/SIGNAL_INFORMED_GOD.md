# Signal-informed GOD scoring

**Status:** Phase 1 shipped (feature plumbing). Live **weight retune deferred** until proof cohort unlocks (AGENTS.md).

## Why Hit@5 is still ~12.7%

Sealed Hit@5 among audited funded startups is **not** primarily a GOD weight problem. Dominant miss bucket is **`candidate_generation_miss`** — the actual funder was never in the pre-event match pool / top-5. Rematch and signal polish cannot rewrite sealed prediction clocks.

| Layer | Metric | Role |
|-------|--------|------|
| Ops drain | 2941/5000 resolved | Evidence search coverage |
| Product claim | ~12.7% Hit@5 @180d | Sealed top-5 vs later funders |
| Proof cohort | **0/5** verified pairs since 2026-08-25 | Gates startup GOD weight retune |

## What was wrong with signals

```
scrape → GOD score → invent signals_total FROM GOD → match
                              ↑
                    circular: signals mirror GOD
                 real pythh_signal_events arrive in Phase 4 (after match)
```

Market/entity signals arrived **after** ranking, and `applyGodBlendToSignalDimensions` shrinks event sums toward a GOD prior — so signals could not inform fundability.

## Phase 1 (this PR) — architecture

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

**Not changed:** `GOD_SCORE_CONFIG` in `startupScoringService.ts` (live SSOT weights).

## Phase 2 — weight retune (gated)

Unlock when:
1. `npm run proof-cohort:report` → `signup_evidence_met ≥ 5`
2. Cohort miss audit shows ranking issues dominate generation misses

Then experiment (before/after on prospective stream only):

| Proposal | Rationale |
|----------|-----------|
| Raise traction component share when `capital_convergence` + `news_momentum` present | Funded outcomes correlate with capital/news evidence |
| Cap vision share for thin evidence rows | Over-scoring thesis-only companies |
| Keep investor GOD operator-founder / faith as data fill (already allowed) | Investor nuances |
| Expand `frequentLedgerFunders` for `topNeverPreMatched` firms | Fixes Hit@5 generation miss faster than GOD weights |

Draft proposals live under `proposed_signal_informed` in `server/config/god-score-weights.json` — **not live**.

## What to run after merge

```bash
# New URL submits automatically use signal-before-GOD when events exist
# Batch rescore (optional, after weight unlock):
# node scripts/recalculate-scores.ts

# Still the highest Hit@5 lever today:
npm run funding:audit:candidate-misses
# → expand frequentLedgerFunders from topNeverPreMatched
```
