# Score recalculation SUMMARY labels

**Script:** `npm run recalc` → `scripts/recalculate-scores.ts`

After each run, the console prints a **SUMMARY** block. Line-by-line meanings:

| Log label | Meaning |
|-----------|--------|
| **Updated** | Startups whose stored score (or momentum column) **changed** this run. |
| **Unchanged** | No change after recalculation. |
| **Bootstrap applied** | Intended for **sparse-data bootstrap** (`server/services/bootstrapScoringService.ts`). The main recalc path uses **pure GOD** without incrementing this counter today — usually **0**. |
| **Momentum applied** | **T2** — Forward-movement / trajectory bonus (`momentumScoringService`). Only for **data-rich** phases (1–2). |
| **AP applied** | **T4** — “AP Bachelor” path: strong multi-signal startups in the mid GOD band (`apScoringService`). |
| **Promising applied** | **T4** — “Promising Freshman” path: lower band with substance signals (`apScoringService`). |
| **Elite boost applied** | **T5** — Tiered excellence multiplier (`eliteScoringService`). |
| **Spiky Bachelor recognized** | **T6** — Spiky profile in Bachelor band (`spikyBachelorService`). |
| **Hot startup bonus** | **T6** — Heat / momentum-style bonus (`spikyBachelorService`). |
| **Investor pedigree bonus** | **T7** — Tier-1/2/3 investors and advisors on record (`investorPedigreeScoringService`). Runs for **all** startups. |
| **Accomplishment evidence bonus** | **T8** — Deck + founder evidence (`deck_url` / `deck_filename`, `evidence`). |
| **Total** | Count of startups processed (pending + approved). |

**Code:** `src/lib/scoreRecalcSummaryLabels.ts` (same text for IDE / imports).
