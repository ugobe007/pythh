'use strict';

/**
 * Pythh Startup Maturity Classifier
 *
 * Assigns each startup a canonical degree-level maturity label based on
 * a composite reading of its GOD score, signal history, trajectory, and
 * data richness. Used by the Goldilocks filter to ensure matches are
 * appropriately staged (don't show Series B funds to Freshmen; don't show
 * pre-seed angels to PhDs).
 *
 * Trajectory levels (ascending; internal keys kept for DB stability):
 *   exploring (freshman) → building → traction → momentum → scaling → apex (phd)
 *   Public UI uses investor-native names (Exploring … Apex), not school terms.
 *
 * Portfolio: `portfolio_health` (Supabase view) compares `maturity_level` to the same GOD→floor
 * mapping (`god_implied_maturity_floor_index`) as Step 1 here — run `scripts/compute-maturity.js --apply`.
 *
 * Usage:
 *   const { classifyMaturity } = require('./maturityClassifier');
 *   const result = classifyMaturity(startup, trajectory, signalHistory);
 *   // result.level         → 'junior'
 *   // result.label         → 'Traction' (public label for key junior)
 *   // result.description   → 'Product launched, early customers ...'
 *   // result.score         → 42  (0–100 maturity score, distinct from GOD)
 *   // result.next_level    → 'senior'
 *   // result.gaps          → ['revenue_signal needed', 'fundraising_signal needed']
 *   // result.investor_fit  → ['seed_fund', 'series_a_fund']
 */

// ─── DEGREE TAXONOMY ──────────────────────────────────────────────────────────
const DEGREES = {
  freshman: {
    label:       'Exploring',
    description: 'Idea or pre-product stage. Little data, no clear market signals.',
    next:        'sophomore',
    god_range:   [0, 29],
    investor_fit: ['angel_investor', 'pre_seed_fund', 'accelerator', 'incubator'],
    color:       '#6B7280', // zinc-500
  },
  sophomore: {
    label:       'Building',
    description: 'Early build phase. Product in development, first team forming.',
    next:        'junior',
    god_range:   [30, 44],
    investor_fit: ['pre_seed_fund', 'seed_fund', 'angel_investor', 'accelerator'],
    color:       '#3B82F6', // blue-500
  },
  junior: {
    label:       'Traction',
    description: 'Product launched and in market. Early customers or users.',
    next:        'senior',
    god_range:   [45, 54],
    investor_fit: ['seed_fund', 'series_a_fund', 'angel_investor'],
    color:       '#10B981', // emerald-500
  },
  senior: {
    label:       'Momentum',
    description: 'Revenue generating with growth momentum. Fundraising-active.',
    next:        'graduate',
    god_range:   [55, 64],
    investor_fit: ['series_a_fund', 'series_b_fund', 'growth_equity_fund'],
    color:       '#F59E0B', // amber-500
  },
  graduate: {
    label:       'Scaling',
    description: 'Scaling with strong multi-signal trajectory. Institutional quality.',
    next:        'phd',
    god_range:   [65, 79],
    investor_fit: ['series_b_fund', 'growth_equity_fund', 'crossover_fund'],
    color:       '#8B5CF6', // violet-500
  },
  phd: {
    label:       'Apex',
    description: 'Peak signal density. Exit, acquisition, or market-leader trajectory.',
    next:        null,
    god_range:   [80, 100],
    investor_fit: ['growth_equity_fund', 'pe_firm', 'corporate_acquirer', 'crossover_fund'],
    color:       '#EF4444', // red-500
  },
};

// ─── SIGNAL WEIGHTS FOR MATURITY ─────────────────────────────────────────────
// How much does each signal class contribute toward a higher degree level?
const SIGNAL_MATURITY_WEIGHTS = {
  product_signal:            4,   // building / launching
  hiring_signal:             3,   // team expansion
  revenue_signal:           10,   // strong indicator of Junior+
  fundraising_signal:        8,   // active fundraising → Senior+
  investor_interest_signal:  6,   // investor engagement
  growth_signal:             7,   // expansion / momentum
  expansion_signal:          6,   // geographic / market growth
  acquisition_signal:       12,   // M&A → Graduate+
  exit_signal:              12,   // exit prep → PhD
  distress_signal:          -5,   // negative modifier
  buyer_pain_signal:         4,   // market validation
  enterprise_signal:         5,   // enterprise customer
  efficiency_signal:        -2,   // cost-cutting → subtract
  exploratory_signal:        1,   // cautious intent
  partnership_signal:        3,   // commercial traction
  gtm_signal:                5,   // go-to-market motion
  demand_signal:             4,   // pull from market
  market_position_signal:    3,
};

// ─── TRAJECTORY MATURITY BOOST ────────────────────────────────────────────────
const TRAJECTORY_MATURITY_BOOST = {
  fundraising:   8,
  growth:        7,
  expansion:     6,
  product:       3,
  exit:         15,
  acquisition:  15,
  repositioning: 2,
  distress:     -4,
  buying:        5,
  unknown:       0,
};

// ─── MAIN: classifyMaturity ────────────────────────────────────────────────────
/**
 * Classify a startup's maturity degree.
 *
 * Logic:
 *   1. GOD score sets a FLOOR degree (primary signal).
 *   2. Signal history, trajectory, and data richness accumulate a bonus score
 *      (0–30 pts) that can advance the degree beyond the GOD floor.
 *   3. Strong exit/acquisition signals always advance at least to 'graduate'.
 *
 * @param {object} startup          — startup_uploads row (needs total_god_score, etc.)
 * @param {object} [trajectory]     — pythh_trajectories row (optional)
 * @param {Array}  [signalHistory]  — array of { signal: SignalObject, date } (optional)
 * @returns {MaturityResult}
 */
function classifyMaturity(startup, trajectory = null, signalHistory = []) {
  const god = startup?.total_god_score ?? 0;

  // ── Step 1: GOD score → baseline degree (floor) ───────────────────────────
  let floorLevel;
  if      (god >= 80) floorLevel = 'graduate';
  else if (god >= 65) floorLevel = 'senior';
  else if (god >= 52) floorLevel = 'junior';
  else if (god >= 32) floorLevel = 'sophomore';
  else                floorLevel = 'freshman';

  // Numeric index for comparison
  const floorIdx = DEGREE_ORDER.indexOf(floorLevel);

  // ── Step 2: Advancement bonus from signals, trajectory, data richness ──────
  let advanceBonus = 0;
  const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

  // Signal history: each class contributes weighted advance points
  let signalBonus = 0;
  for (const entry of (signalHistory || [])) {
    if (new Date(entry.date || entry.detected_at).getTime() < recentCutoff) continue;
    const cls  = entry.signal?.primary_signal;
    const conf = entry.signal?.confidence ?? 0.5;
    const w    = SIGNAL_MATURITY_WEIGHTS[cls];
    if (w !== undefined) signalBonus += w * conf;
  }
  advanceBonus += Math.max(-15, Math.min(20, signalBonus));

  // Trajectory
  if (trajectory) {
    const traj  = trajectory.dominant_trajectory || 'unknown';
    const conf  = trajectory.trajectory_confidence || 0;
    const boost = TRAJECTORY_MATURITY_BOOST[traj] ?? 0;
    advanceBonus += boost * conf;
  }

  // Data richness
  if (startup?.website)     advanceBonus += 1.5;
  if (startup?.description && startup.description.length > 100) advanceBonus += 2;
  if (startup?.mrr > 0)     advanceBonus += 6;
  if (startup?.customer_count > 0) advanceBonus += 4;
  if (startup?.latest_funding_amount > 0) advanceBonus += 4;

  // ── Step 3: Determine advancement (1 level up per 12 bonus pts) ───────────
  const advanceLevels = Math.max(0, Math.floor(advanceBonus / 10));
  const advancedIdx   = Math.min(floorIdx + advanceLevels, DEGREE_ORDER.length - 1);

  // ── Step 4: Synthetic 0–100 maturity score for display ────────────────────
  // Base = GOD score, capped at 90; bonus brings it to 100 for PhD
  const maturityScore = Math.max(0, Math.min(100,
    Math.round(god * 0.88 + Math.min(advanceBonus, 12))
  ));

  // ── Step 5: Assign level ───────────────────────────────────────────────────
  let level = DEGREE_ORDER[advancedIdx];

  // Strong exit/acquisition signals always advance to at least 'graduate'
  const hasExitSignal = (signalHistory || []).some(e =>
    ['exit_signal', 'acquisition_signal'].includes(e.signal?.primary_signal) &&
    (e.signal?.confidence || 0) > 0.80
  );
  if (hasExitSignal) {
    const exitIdx = DEGREE_ORDER.indexOf('graduate');
    if (advancedIdx < exitIdx) level = 'graduate';
  }

  const meta = DEGREES[level];

  // ── Gap analysis: what signals would move to next level ───────────────────
  const gaps = _computeGaps(level, startup, trajectory, signalHistory);

  return {
    level,
    label:        meta.label,
    description:  meta.description,
    score:        maturityScore,
    color:        meta.color,
    next_level:   meta.next,
    next_label:   meta.next ? DEGREES[meta.next]?.label : null,
    investor_fit: meta.investor_fit,
    gaps,
    god_score:    god,
  };
}

// ─── GAP ANALYSIS ─────────────────────────────────────────────────────────────
function _computeGaps(currentLevel, startup, trajectory, signalHistory) {
  const gaps = [];
  const recentSignals = new Set(
    (signalHistory || []).map(e => e.signal?.primary_signal).filter(Boolean)
  );

  switch (currentLevel) {
    case 'freshman':
      if (!startup?.description || startup.description.length < 50)
        gaps.push('Add a company description to raise your profile score');
      if (!recentSignals.has('product_signal'))
        gaps.push('Product launch signals help move toward Building');
      if (!startup?.website)
        gaps.push('Company website missing — adds 25 pts to GOD score');
      break;

    case 'sophomore':
      if (!recentSignals.has('hiring_signal'))
        gaps.push('Hiring signals would confirm team expansion');
      if (!recentSignals.has('product_signal'))
        gaps.push('Product launch signals needed for Traction');
      break;

    case 'junior':
      if (!recentSignals.has('revenue_signal'))
        gaps.push('Revenue signals help reach Momentum');
      if (!recentSignals.has('fundraising_signal'))
        gaps.push('Fundraising activity would confirm Momentum trajectory');
      break;

    case 'senior':
      if (!recentSignals.has('growth_signal') && !recentSignals.has('expansion_signal'))
        gaps.push('Growth or expansion signals needed for Scaling');
      if ((trajectory?.trajectory_confidence || 0) < 0.50)
        gaps.push('More consistent signal history helps reach Scaling');
      break;

    case 'graduate':
      if (!recentSignals.has('exit_signal') && !recentSignals.has('acquisition_signal'))
        gaps.push('Exit or acquisition signals help qualify for Apex');
      if ((startup?.total_god_score || 0) < 80)
        gaps.push(`GOD score 80+ strengthens Apex trajectory (currently ${startup?.total_god_score})`);
      break;

    case 'phd':
      gaps.push('Top tier — no gaps identified');
      break;
  }

  return gaps;
}

// ─── CLASSIFY BATCH ───────────────────────────────────────────────────────────
/**
 * Classify an array of startups.
 * Each item may optionally include trajectory and signalHistory.
 *
 * @param {Array<{ startup, trajectory?, signalHistory? }>} items
 * @returns {Array<{ startup_id, ...MaturityResult }>}
 */
function classifyMaturityBatch(items) {
  return items.map(({ startup, trajectory, signalHistory }) => ({
    startup_id: startup.id,
    ...classifyMaturity(startup, trajectory, signalHistory),
  }));
}

// ─── GOLDILOCKS FILTER ────────────────────────────────────────────────────────
/**
 * Check whether a candidate (investor/vendor/advisor) is appropriate for a
 * startup at the given maturity level.
 *
 * Returns { fits: boolean, reason: string }
 */
function goldilocksCheck(maturityLevel, candidateType, candidateTier) {
  const meta = DEGREES[maturityLevel];
  if (!meta) return { fits: true, reason: 'unknown maturity' };

  const fits = meta.investor_fit.includes(candidateType) ||
               meta.investor_fit.includes(candidateTier);

  const reason = fits
    ? `${meta.label} startups align well with ${candidateType}`
    : `${candidateType} typically invests at a different stage than ${meta.label}`;

  return { fits, reason };
}

// ─── DEGREE ORDERING ──────────────────────────────────────────────────────────
const DEGREE_ORDER = ['freshman', 'sophomore', 'junior', 'senior', 'graduate', 'phd'];

function degreeIndex(level) {
  return DEGREE_ORDER.indexOf(level);
}

module.exports = {
  classifyMaturity,
  classifyMaturityBatch,
  goldilocksCheck,
  DEGREES,
  DEGREE_ORDER,
  degreeIndex,
};
