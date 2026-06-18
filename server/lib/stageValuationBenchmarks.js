/**
 * Stage-based post-money valuation bands for portfolio entry estimates.
 * GOD 70 → floor of band; GOD 100 → ceiling (stronger picks mark higher in-range).
 *
 * Bands (USD):
 *   Pre-seed  $5M – $15M
 *   Seed      $10M – $20M
 *   Series A  $30M – $40M
 *   Series B  $50M – $100M
 *   Mezzanine $75M – $125M  (between B and C)
 *   Series C  $100M – $200M
 *
 * Fallback only — prefer timed rounds from fundingTimelineService when available.
 */

const STAGE_VALUATION_RANGES = {
  'pre-seed': [5_000_000, 15_000_000],
  seed: [10_000_000, 20_000_000],
  'series a': [30_000_000, 40_000_000],
  'series b': [50_000_000, 100_000_000],
  mezzanine: [75_000_000, 125_000_000],
  'series c': [100_000_000, 200_000_000],
};

const STAGE_ALIASES = {
  1: 'pre-seed',
  'stage 1': 'pre-seed',
  'pre-seed': 'pre-seed',
  preseed: 'pre-seed',
  'pre seed': 'pre-seed',
  2: 'seed',
  'stage 2': 'seed',
  seed: 'seed',
  3: 'series a',
  'stage 3': 'series a',
  'series a': 'series a',
  4: 'series b',
  'stage 4': 'series b',
  'series b': 'series b',
  'series b+': 'series b',
  mezzanine: 'mezzanine',
  'mezz round': 'mezzanine',
  5: 'series c',
  'stage 5': 'series c',
  'series c': 'series c',
  'series c+': 'series c',
};

function normalizeStage(stage) {
  const raw = String(stage ?? '').trim().toLowerCase();
  if (!raw) return 'pre-seed';
  return STAGE_ALIASES[raw] || (STAGE_VALUATION_RANGES[raw] ? raw : 'pre-seed');
}

/**
 * @param {string|number|null} stage
 * @param {number} [godScore=70]
 * @returns {number} post-money USD
 */
function estimateEntryValuationUsd(stage, godScore = 70) {
  const key = normalizeStage(stage);
  const [min, max] = STAGE_VALUATION_RANGES[key] || STAGE_VALUATION_RANGES['pre-seed'];
  const score = Number(godScore) || 70;
  const t = Math.min(1, Math.max(0, (score - 70) / 30));
  return Math.round(min + t * (max - min));
}

/** Midpoint per normalized stage (for display / legacy maps). */
function stageValuationMidpoints() {
  const out = {};
  for (const [stage, [min, max]] of Object.entries(STAGE_VALUATION_RANGES)) {
    out[stage] = Math.round((min + max) / 2);
  }
  return out;
}

module.exports = {
  STAGE_VALUATION_RANGES,
  normalizeStage,
  estimateEntryValuationUsd,
  stageValuationMidpoints,
};
