/**
 * Public copy for startup GOD core-bucket shares.
 * Must stay aligned with GOD_SCORE_CONFIG.componentWeights
 * (server/services/startupScoringService.ts) and
 * server/config/god-score-weights.json.
 */
export const STARTUP_GOD_WEIGHTS = {
  team: 0.22,
  traction: 0.3,
  market: 0.2,
  product: 0.15,
  vision: 0.13,
} as const;

export type StartupGodWeightKey = keyof typeof STARTUP_GOD_WEIGHTS;

export function godWeightPts(key: StartupGodWeightKey): number {
  return Math.round(STARTUP_GOD_WEIGHTS[key] * 100);
}

export function godWeightPtsLabel(key: StartupGodWeightKey): string {
  return `${godWeightPts(key)} pts`;
}

export const STARTUP_GOD_WEIGHT_SUMMARY =
  'Team 22, traction 30, market 20, product 15, vision 13 — signal-informed live shares that sum to 100.';

/** Chart header: bars stay 0–20; the numbers are composite shares, not bar maxes. */
export const STARTUP_GOD_WEIGHT_CHART_LABEL =
  'GOD dimensions · 0–20 scale · live weights 22 / 30 / 20 / 15 / 13';

/** What Vision measures for investors — scale of destination, not narrative polish. */
export const STARTUP_GOD_VISION_THESIS =
  'Investors look for founders building large visions, not small ones — especially repeat founders who have done it before.';

/** What Determination measures — the rare founder trait most investors miss. */
export const STARTUP_GOD_DETERMINATION_THESIS =
  'The rarest success trait in elite founders is pathological determination — a borderline-delusional ability to run through any wall, with no off-switch. It is not confidence or charisma; the most determined founders are often introverted and do not light up rooms. High determination predicts bigger companies, even when it takes longer.';

/** Named public proxies (4 of 12). Do not invent the rest. */
export const STARTUP_GOD_DETERMINATION_PROXIES =
  'We use 12 proxy signals to screen for it — including a desperate desire to prove someone or something wrong, multiple previous failed businesses, early-life adversity, and irrational optimism when others would quit.';
