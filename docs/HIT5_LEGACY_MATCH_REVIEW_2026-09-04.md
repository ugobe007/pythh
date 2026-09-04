# Legacy-match “42%” vs sealed Hit@5 — 2026-09-04

Live pull after PR #118. Scripts: `funding:claim-readiness --summary`, `funding:reconcile:historical:summary`, plus a Supabase count of `match_validation_evidence`.

## Do not treat 42% as Hit@5

The product claim is **sealed startup-level Hit@5**: did any of five firms predicted *before* the round later participate, with an audited roster?

| Metric people mix up | What it actually is | Live (2026-09-04) | Claimable? |
|---|---|---|---|
| Old roadmap “~42 verified pairs” | **Count** of pair-level `match_validation_evidence` (Aug 23 snapshot), not a rate | **107** post-prediction verified pairs / **45** startups | Pair narrative only |
| Oracle ~44% verified-funded | Public **portfolio picks** later press-confirmed funded | Separate Oracle/portfolio metric | Not match Hit@5 |
| `confirmed_outcome_counts.confirmed_hit: 30` ÷ 71 audited | Sum of hit *rows across 30/90/180/365 horizons* (4+8+9+9=30) | Looks like ~42%, is **double-counting the same startups** | No |
| Historical reconcile of **legacy** `startup_investor_matches` | Pre-event top-5 vs later funders; scores may have been rewritten later | **1.4%** directional / **1.5%** audited (1 hit / 65–71 evaluable) | Diagnostic only |
| **Sealed Hit@5 @180d** | Snapshots + trusted post-`predicted_at` events | **10 / 72 = 13.9%** after Runable unlock | Yes, when N≥100 and rate≥85% |

**Hard rule:** current-state match tables are not a prediction clock. Rematches after the round (`post_event_match_not_prediction`) inflate “we matched the funder” stories. Legacy scores may have been updated after `created_at`.

## Sealed Hit@5 (claim inventory)

180d, serve-grade, 5 distinct firms:

| | |
|---|---|
| Sealed sets | 2,212 (47 identity exclusions) |
| Mature / pending | 832 / 1,380 |
| Funded in horizon | 72 |
| Hits / misses / indeterminate | **10 / 62 / 0** |
| Audited | 72 (**28 short of 100**) |
| Observed rate | 13.9% (95% CI 7.7–23.7%) |
| Claim ready | **No** |

Hits: Jump, OpenRouter, Saronic, Replit, Isomorphic Labs, Legora, Cognition, Dust, Upscale AI, **Runable**.

**Runable unlock (applied):** SiliconANGLE $21M Series A, 2026-08-27, after `predicted_at` 2026-08-26 13:44. Co-leads Susquehanna Venture Capital + Nexus Venture Partners (sealed rank 4) + Together Fund + Array VC. Converted the only 180d indeterminate into a hit. Audited 71→72, hits 9→10.

## Legacy-match reconcile (diagnostic)

`funding:reconcile:historical:summary` on verified/corroborated rounds:

| | |
|---|---|
| Canonical rounds | 1,001 (676 startups) |
| Rounds with a pre-event top-5 | 102 |
| Censored (no pre-event top-5) | 896 |
| Directional hits @5 | **1** |
| Auditable misses @5 | 65 |
| `candidate_generation_miss` | **1,688** |
| `post_event_match_not_prediction` | 347 |
| `ranked_outside_top_five` | 11 |
| `top_five_hit` | 1 |

The gap is still **who entered the pre-event pool**, not GOD/fit weights. Do not retune scoring from this review.

## Pair-level match proof (parallel track)

| | |
|---|---|
| `match_validation_evidence` rows | 362 |
| Verified funding/investment | 107 |
| Post-prediction pairs | **107** |
| Startups with a verified pair | 45 |
| Pending review | 0 |

This grew from the Aug 23 “~42 pairs / 30 startups” roadmap line. Pair proof ≠ sealed Hit@5.

## Next ops (forward only)

1. Runable SiliconANGLE roster is already applied (10/72). Do **not** re-ingest from TechCrunch (pre-seal).
2. Do **not** ingest Remepy / Meduloc / SiteVue / Transfyr / **Yardstik**.
   - Yardstik PR Newswire 15:00 UTC is the same 2026-08-27 embargo as SiliconANGLE 13:00 UTC, which is **before** `predicted_at` 14:08 UTC. Sealed top-5 (Northzone, Nexus, GC, Founders Fund, Menlo) missed Harbert / Rally / MissionOG / Crosslink / Grotech / Great North — still not a claimable miss.
   - Transfyr company post is 2026-08-26; seal is 2026-08-29.
3. Paid search queue is drained (`pending` priority>0 = 0). Do **not** `--requeue-priority-empty` until the 7-day complete-status hold expires. Next Mac drain: `outcomes:triage-queue` (needs `DATABASE_URL`) then `outcomes:search-funding:cascade`.
4. Paid-search persist now runs `classifyFundingEvidence` so OpenAI/Anthropic M&A, credit-facility, and listing headlines do not write `funding_evidence_search_results`.
5. Expand `frequentLedgerFunders` from never-pre-matched qualified firms (`funding:audit:candidate-misses`) — needs `DATABASE_URL` on the Mac.
