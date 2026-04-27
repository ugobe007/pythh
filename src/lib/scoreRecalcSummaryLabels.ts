/**
 * Labels for `npm run recalc` / `scripts/recalculate-scores.ts` SUMMARY block.
 * Human-readable doc: docs/SCORE_RECALC_SUMMARY.md
 */

export type ScoreRecalcSummaryKey =
  | 'updated'
  | 'unchanged'
  | 'bootstrap'
  | 'momentum'
  | 'ap'
  | 'promising'
  | 'elite'
  | 'spiky'
  | 'hot'
  | 'pedigree'
  | 'accomplishment'
  | 'total';

export const SCORE_RECALC_SUMMARY_LINES: {
  key: ScoreRecalcSummaryKey;
  logPrefix: string;
  /** One sentence; implementation detail in services referenced in recalculate-scores.ts */
  description: string;
}[] = [
  {
    key: 'updated',
    logPrefix: 'Updated',
    description:
      'Startups whose persisted `total_god_score` (or `momentum_score` when tracked) changed this run.',
  },
  {
    key: 'unchanged',
    logPrefix: 'Unchanged',
    description: 'Startups scored the same as before (within this script’s update logic).',
  },
  {
    key: 'bootstrap',
    logPrefix: 'Bootstrap applied',
    description:
      'Reserved for sparse-data bootstrap bonus (`bootstrapScoringService`). Imported in recalc but the main loop uses pure GOD without incrementing this counter — expect **0** until wired.',
  },
  {
    key: 'momentum',
    logPrefix: 'Momentum applied',
    description:
      'T2 — Forward movement bonus (`momentumScoringService`): trajectory, revenue/customer/product maturity, score history. Phase 1–2 (data-rich) only.',
  },
  {
    key: 'ap',
    logPrefix: 'AP applied',
    description:
      'T4 — “AP Bachelor” bonus (`apScoringService`): GOD ~45–59 with strong multi-dimension signals (product/demand, funding velocity, team, smart money). Max +6.',
  },
  {
    key: 'promising',
    logPrefix: 'Promising applied',
    description:
      'T4 — “Promising Freshman” bonus (`apScoringService`): GOD ~40–44 with substance signals (sector, product, funding, story, team). Max +4.',
  },
  {
    key: 'elite',
    logPrefix: 'Elite boost applied',
    description:
      'T5 — Tiered multiplicative boost (`eliteScoringService`) when pre-score and excellence dimensions justify it (60+ band / Dean’s List style).',
  },
  {
    key: 'spiky',
    logPrefix: 'Spiky Bachelor recognized',
    description:
      'T6 — Uneven high-quality components in Bachelor band (`spikyBachelorService`): spikes vs cohort averages. Organic strength, not prestige lists.',
  },
  {
    key: 'hot',
    logPrefix: 'Hot startup bonus',
    description:
      'T6 — Heat signals (growth, FOMO, traction) additive with spiky path (`spikyBachelorService`).',
  },
  {
    key: 'pedigree',
    logPrefix: 'Investor pedigree bonus',
    description:
      'T7 — Named tier-1/2/3 investors and advisors on the profile (`investorPedigreeScoringService`). Applies to **all** phases, not only data-rich.',
  },
  {
    key: 'accomplishment',
    logPrefix: 'Accomplishment evidence bonus',
    description:
      'T8 — Deck upload and founder-submitted press/evidence (`deck_url` / `deck_filename`, `evidence` with source founder). Counts startups where this bonus was > 0.',
  },
  {
    key: 'total',
    logPrefix: 'Total',
    description: 'All pending + approved startups processed in this run.',
  },
];

/** Multi-line legend for console (leading spaces match SUMMARY indent). */
export function formatScoreRecalcSummaryLegend(): string {
  const rows = SCORE_RECALC_SUMMARY_LINES.filter((r) => r.key !== 'total');
  const lines = rows.map(
    (r) => `  • ${r.logPrefix}: ${r.description}`
  );
  return ['📖 Summary line meanings:', ...lines, `  • Total: ${SCORE_RECALC_SUMMARY_LINES.find((x) => x.key === 'total')!.description}`].join(
    '\n'
  );
}
