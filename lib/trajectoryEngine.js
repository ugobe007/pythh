'use strict';

/**
 * Pythh Company Trajectory Engine — v2
 *
 * Transforms a company's chronological signal history into a trajectory —
 * a pattern-based interpretation of WHERE the company is heading and HOW FAST.
 *
 * Answers five questions:
 *   A. Direction  — what trajectory is this company on?
 *   B. Velocity   — how fast are signals appearing?
 *   C. Consistency — do signals align or contradict?
 *   D. Stage      — what stage transition is occurring?
 *   E. Next move  — what is likely to happen next?
 *
 * Usage:
 *   const { buildTrajectory } = require('./trajectoryEngine');
 *   const report = buildTrajectory(signalHistory, { window_days: 90 });
 *
 * Input:  Array<{ date: string|Date, signal: SignalObject }>
 * Output: TrajectoryReport
 */

// ─── SIGNAL CLASS VELOCITY WEIGHTS ────────────────────────────────────────────
// How much does each signal class contribute to velocity?
// Data-room requests and RFPs matter far more than exploratory language.
const VELOCITY_WEIGHTS = {
  fundraising_signal:        1.00,
  acquisition_signal:        1.00,
  exit_signal:               0.95,
  investor_interest_signal:  0.90,
  distress_signal:           0.90,
  buyer_budget_signal:       0.85,
  regulatory_signal:         0.80,
  buyer_signal:              0.80,
  revenue_signal:            0.80,
  enterprise_signal:         0.75,
  buyer_pain_signal:         0.72,
  expansion_signal:          0.70,
  market_position_signal:    0.65,
  hiring_signal:             0.65,
  gtm_signal:                0.65,
  product_signal:            0.60,
  partnership_signal:        0.55,
  demand_signal:             0.55,
  growth_signal:             0.50,
  efficiency_signal:         0.45,
  market_position_signal:    0.50,
  exploratory_signal:        0.20,
  unclassified_signal:       0.10,
};

// ─── DOMAIN GROUPING ──────────────────────────────────────────────────────────
// Group signal classes into high-level story domains for consistency scoring.
// "Hiring + enterprise + expansion" all map to 'growth' — consistent story.
const SIGNAL_DOMAIN = {
  fundraising_signal:        'fundraising',
  investor_interest_signal:  'fundraising',
  investor_rejection_signal: 'fundraising',
  exit_signal:               'exit',
  acquisition_signal:        'exit',
  distress_signal:           'distress',
  efficiency_signal:         'distress',
  hiring_signal:             'growth',
  growth_signal:             'growth',
  expansion_signal:          'growth',
  gtm_signal:                'growth',
  enterprise_signal:         'growth',
  demand_signal:             'growth',
  revenue_signal:            'growth',
  product_signal:            'product',
  regulatory_signal:         'product',
  buyer_signal:              'buying',
  buyer_pain_signal:         'buying',
  buyer_budget_signal:       'buying',
  partnership_signal:        'partnership',
  market_position_signal:    'market',
  infrastructure_signal:     'product',
  exploratory_signal:        'exploratory',
};

// ─── TRAJECTORY PATTERNS ──────────────────────────────────────────────────────
// Each pattern defines a named trajectory with a signal sequence.
// sequence: [{classes[], max_gap_days}] — each step must contain one of classes[]
// The engine matches these against the chronological signal history.
const TRAJECTORY_PATTERNS = [

  // A. Fundraising trajectory
  {
    id:          'fundraising_active',
    label:       'Active Fundraising',
    description: 'Company is in or entering a financing cycle',
    type:        'fundraising',
    sequence: [
      { classes: ['hiring_signal', 'growth_signal', 'revenue_signal'],          max_gap_days: 90 },
      { classes: ['investor_interest_signal', 'fundraising_signal'],             max_gap_days: 90 },
    ],
    predicted_next_moves: [
      'close_funding_round',
      'hire_vp_sales',
      'build_enterprise_pipeline',
      'buy_crm_and_revops_tools',
    ],
    stage_exit: 'commercial_scale',
    who_cares: { investors: true, vendors: true, recruiters: true },
    strength: 0.85,
  },

  // B. GTM Expansion trajectory
  {
    id:          'gtm_expansion',
    label:       'GTM Expansion',
    description: 'Commercial expansion — enterprise sales, new markets, new geographies',
    type:        'expansion',
    sequence: [
      { classes: ['gtm_signal', 'hiring_signal'],                               max_gap_days: 90 },
      { classes: ['enterprise_signal', 'expansion_signal'],                     max_gap_days: 90 },
    ],
    predicted_next_moves: [
      'hire_solutions_engineers',
      'buy_sales_engagement_tools',
      'seek_channel_partners',
      'raise_growth_capital',
      'expand_new_geographies',
    ],
    stage_exit: 'enterprise_scale',
    who_cares: { investors: true, vendors: true, partners: true, recruiters: true },
    strength: 0.80,
  },

  // C. Product Maturation trajectory
  {
    id:          'product_maturation',
    label:       'Product Maturation',
    description: 'Product moving from beta/pilot toward enterprise readiness and GA',
    type:        'product',
    sequence: [
      { classes: ['product_signal'],                                             max_gap_days: 60 },
      { classes: ['demand_signal', 'revenue_signal', 'buyer_signal'],           max_gap_days: 90 },
    ],
    predicted_next_moves: [
      'launch_enterprise_features',
      'pursue_soc2_compliance',
      'hire_customer_success',
      'raise_series_a',
    ],
    stage_exit: 'go_to_market',
    who_cares: { investors: true, vendors: true, partners: true },
    strength: 0.78,
  },

  // D. Buyer Intent trajectory
  {
    id:          'buyer_procurement',
    label:       'Buyer Procurement Funnel',
    description: 'Organization moving through a structured vendor selection process',
    type:        'buying',
    sequence: [
      { classes: ['buyer_pain_signal'],                                          max_gap_days: 90 },
      { classes: ['buyer_signal', 'buyer_budget_signal'],                       max_gap_days: 60 },
    ],
    predicted_next_moves: [
      'issue_rfp_or_rfq',
      'run_vendor_pilot',
      'approve_procurement_budget',
      'select_implementation_partner',
      'begin_deployment',
    ],
    stage_exit: 'deployment',
    who_cares: { vendors: true, partners: true },
    strength: 0.90,
  },

  // E. Distress trajectory
  {
    id:          'distress_survival',
    label:       'Distress / Survival Mode',
    description: 'Company under financial or operational pressure',
    type:        'distress',
    sequence: [
      { classes: ['efficiency_signal', 'distress_signal'],                      max_gap_days: 90 },
      { classes: ['distress_signal', 'fundraising_signal'],                     max_gap_days: 90 },
    ],
    predicted_next_moves: [
      'seek_bridge_capital',
      'reduce_headcount',
      'explore_strategic_alternatives',
      'engage_turnaround_advisor',
    ],
    stage_exit: 'exit_prep',
    who_cares: { investors: true, acquirers: true },
    strength: 0.88,
  },

  // F. Exit trajectory
  {
    id:          'exit_preparation',
    label:       'Exit Preparation',
    description: 'Company preparing for sale, acquisition, or IPO',
    type:        'exit',
    sequence: [
      { classes: ['exit_signal', 'distress_signal', 'efficiency_signal'],       max_gap_days: 120 },
      { classes: ['acquisition_signal', 'exit_signal', 'investor_interest_signal'], max_gap_days: 90 },
    ],
    predicted_next_moves: [
      'engage_investment_bank',
      'run_sale_process',
      'enter_exclusivity',
      'close_transaction',
    ],
    stage_exit: 'transaction',
    who_cares: { investors: true, acquirers: true },
    strength: 0.90,
  },

  // G. Repositioning trajectory
  {
    id:          'repositioning',
    label:       'Strategic Repositioning',
    description: 'Company pivoting market focus, product, or customer segment',
    type:        'repositioning',
    sequence: [
      { classes: ['efficiency_signal', 'distress_signal'],                      max_gap_days: 60 },
      { classes: ['product_signal', 'expansion_signal', 'hiring_signal'],       max_gap_days: 90 },
    ],
    predicted_next_moves: [
      'launch_new_product_line',
      'narrow_to_core_market',
      'hire_in_new_vertical',
      'rebuild_go_to_market',
    ],
    stage_exit: 'go_to_market',
    who_cares: { investors: true, vendors: true },
    strength: 0.72,
  },

  // Additional single-step patterns

  // Investor diligence funnel
  {
    id:          'investor_diligence',
    label:       'Investor Diligence Funnel',
    description: 'Investor progressively advancing toward term sheet',
    type:        'fundraising',
    sequence: [
      { classes: ['investor_interest_signal'],                                   max_gap_days: 60 },
      { classes: ['fundraising_signal'],                                         max_gap_days: 45 },
    ],
    predicted_next_moves: [
      'close_investment_round',
      'execute_term_sheet',
      'announce_funding',
    ],
    stage_exit: 'financing_closed',
    who_cares: { investors: true },
    strength: 0.92,
  },

  // Expansion acceleration
  {
    id:          'expansion_acceleration',
    label:       'Expansion Acceleration',
    description: 'Opening new markets and geographies at pace',
    type:        'expansion',
    sequence: [
      { classes: ['hiring_signal'],                                              max_gap_days: 90 },
      { classes: ['expansion_signal'],                                           max_gap_days: 90 },
      { classes: ['fundraising_signal', 'revenue_signal'],                      max_gap_days: 120 },
    ],
    predicted_next_moves: [
      'raise_series_b',
      'hire_regional_leaders',
      'seek_localization_partners',
      'open_new_offices',
    ],
    stage_exit: 'global_commercial_scale',
    who_cares: { investors: true, vendors: true, partners: true },
    strength: 0.78,
  },

  // Regulatory → Enterprise unlock
  {
    id:          'regulatory_enterprise',
    label:       'Regulatory Clearance → Enterprise',
    description: 'Compliance milestone unlocking enterprise adoption',
    type:        'product',
    sequence: [
      { classes: ['regulatory_signal'],                                          max_gap_days: 90 },
      { classes: ['enterprise_signal', 'revenue_signal', 'expansion_signal'],   max_gap_days: 120 },
    ],
    predicted_next_moves: [
      'accelerate_enterprise_sales',
      'pursue_government_contracts',
      'build_compliance_team',
      'raise_series_b',
    ],
    stage_exit: 'enterprise_scale',
    who_cares: { investors: true, vendors: true, partners: true },
    strength: 0.83,
  },

  // Sustained hiring (simpler, early-stage)
  {
    id:          'sustained_hiring',
    label:       'Sustained Hiring',
    description: 'Consistent team growth — growth or fundraising approaching',
    type:        'growth',
    sequence: [
      { classes: ['hiring_signal'],                                              max_gap_days: 45 },
      { classes: ['hiring_signal'],                                              max_gap_days: 45 },
    ],
    predicted_next_moves: [
      'raise_funding_round',
      'accelerate_gtm',
      'launch_enterprise_program',
      'buy_hr_and_ats_tools',
    ],
    stage_exit: 'commercial_scale',
    who_cares: { investors: true, recruiters: true, vendors: true },
    strength: 0.65,
  },
];

// ─── STAGE TRANSITION MAP ─────────────────────────────────────────────────────
// Maps dominant signal combinations → company stage label.
// Used to detect and name stage transitions over time.
const STAGE_SIGNAL_MAP = [
  { stage: 'ideation',           requires: ['exploratory_signal'],                          minCount: 1 },
  { stage: 'product_build',      requires: ['product_signal'],                              minCount: 1 },
  { stage: 'market_validation',  requires: ['product_signal', 'demand_signal'],             minCount: 2 },
  { stage: 'pilot',              requires: ['buyer_signal', 'demand_signal'],               minCount: 1 },
  { stage: 'go_to_market',       requires: ['gtm_signal', 'hiring_signal'],                 minCount: 2 },
  { stage: 'enterprise_scale',   requires: ['enterprise_signal', 'revenue_signal'],         minCount: 2 },
  { stage: 'fundraising_active', requires: ['fundraising_signal', 'investor_interest_signal'], minCount: 1 },
  { stage: 'efficiency_mode',    requires: ['efficiency_signal', 'distress_signal'],        minCount: 1 },
  { stage: 'buyer_evaluation',   requires: ['buyer_pain_signal', 'buyer_signal'],           minCount: 1 },
  { stage: 'procurement',        requires: ['buyer_budget_signal', 'buyer_signal'],         minCount: 2 },
  { stage: 'exit_prep',          requires: ['exit_signal', 'acquisition_signal'],           minCount: 1 },
];

// ─── TRAJECTORY NEXT MOVE FALLBACKS ──────────────────────────────────────────
// When no pattern matches, predict from dominant signal class alone.
const SIGNAL_NEXT_MOVE_MAP = {
  hiring_signal:             ['raise_funding_round', 'accelerate_gtm', 'buy_hr_ats_tools'],
  fundraising_signal:        ['close_round', 'deploy_capital', 'hire_leadership'],
  distress_signal:           ['seek_bridge_capital', 'cut_costs', 'explore_exit'],
  expansion_signal:          ['hire_regional_team', 'open_offices', 'raise_growth_capital'],
  enterprise_signal:         ['hire_enterprise_sales', 'buy_sales_tools', 'pursue_enterprise_deals'],
  buyer_pain_signal:         ['evaluate_vendors', 'run_pilot_poc', 'issue_rfp'],
  buyer_signal:              ['issue_rfp', 'select_vendor', 'begin_deployment'],
  buyer_budget_signal:       ['execute_contract', 'begin_deployment', 'announce_rollout'],
  product_signal:            ['acquire_customers', 'hire_gtm', 'launch_enterprise_tier'],
  revenue_signal:            ['accelerate_sales', 'raise_growth_capital', 'expand_markets'],
  investor_interest_signal:  ['complete_diligence', 'term_sheet', 'close_round'],
  exit_signal:               ['engage_banker', 'enter_sale_process', 'close_transaction'],
  gtm_signal:                ['hire_enterprise_aes', 'open_new_verticals', 'seek_channel_partners'],
};

// ─── VELOCITY SCORE ────────────────────────────────────────────────────────────
/**
 * Compute signal velocity: how actively and how recently signals are firing.
 * Uses exponential decay so older signals contribute less.
 *
 * velocity_score = sum(classWeight × confidence × e^(-decay×ageDays) + costlyActionBonus)
 * Normalized to [0, 1].
 *
 * @param {Array<{date, signal}>} history
 * @param {number} windowDays
 * @returns {number} 0.0–1.0
 */
function computeVelocityScore(history, windowDays = 90) {
  if (!history || history.length === 0) return 0;

  const now     = Date.now();
  const cutoff  = now - (windowDays * 24 * 60 * 60 * 1000);
  // Half-life: signal weight halves every 30 days
  const DECAY_RATE = Math.log(2) / 30;

  let totalScore = 0;
  let count = 0;

  for (const entry of history) {
    const ts = new Date(entry.date).getTime();
    if (isNaN(ts) || ts < cutoff) continue;

    const ageDays      = (now - ts) / (24 * 60 * 60 * 1000);
    const cls          = entry.signal?.primary_signal || 'unclassified_signal';
    const classWeight  = VELOCITY_WEIGHTS[cls] ?? 0.30;
    const confidence   = entry.signal?.confidence ?? 0.5;
    const costlyBonus  = entry.signal?.costly_action ? 0.15 : 0;
    const recency      = Math.exp(-DECAY_RATE * ageDays);

    totalScore += (classWeight * confidence + costlyBonus) * recency;
    count++;
  }

  if (count === 0) return 0;

  // Normalize: cap accumulation at 4.0 (achievable with ~5 high-value signals)
  const normalized = Math.min(totalScore / 4.0, 1.0);
  return Math.round(normalized * 100) / 100;
}

// ─── CONSISTENCY SCORE ────────────────────────────────────────────────────────
/**
 * Measure domain alignment: do signals cluster around the same narrative?
 * Uses Herfindahl–Hirschman concentration to score how dominated one
 * domain is relative to all others.
 *
 * 1.0 = all signals in one domain (perfectly consistent story)
 * 0.0 = perfectly evenly distributed across all domains (no clear story)
 *
 * Note: conflicting signals in DIFFERENT domains are not always bad.
 * "Layoffs in ops + hiring in sales" = reprioritization, not contradiction.
 * The consistency score reflects story clarity, not health.
 *
 * @param {Array<{date, signal}>} history
 * @param {number} windowDays
 * @returns {number} 0.0–1.0
 */
function computeConsistencyScore(history, windowDays = 90) {
  if (!history || history.length < 2) return 0;

  const now    = Date.now();
  const cutoff = now - (windowDays * 24 * 60 * 60 * 1000);

  const domainCounts = {};
  for (const entry of history) {
    if (new Date(entry.date).getTime() < cutoff) continue;
    const cls    = entry.signal?.primary_signal || 'unclassified_signal';
    const domain = SIGNAL_DOMAIN[cls] || 'unknown';
    if (domain === 'unknown' || domain === 'exploratory') continue;
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
  }

  const domains = Object.values(domainCounts);
  const total   = domains.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  // HHI: sum of squared market shares
  const hhi    = domains.reduce((sum, c) => sum + (c / total) ** 2, 0);
  const n      = domains.length;
  const minHHI = n > 1 ? 1 / n : 1;
  const score  = n <= 1 ? 1.0 : (hhi - minHHI) / (1 - minHHI);

  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}

// ─── STAGE DETECTION ──────────────────────────────────────────────────────────
function detectStage(entries) {
  const counts = {};
  for (const e of entries) {
    const cls = e.signal?.primary_signal;
    if (cls) counts[cls] = (counts[cls] || 0) + 1;
  }
  let bestScore = -1, bestStage = 'unknown';
  for (const { stage, requires, minCount } of STAGE_SIGNAL_MAP) {
    const hits = requires.filter(r => (counts[r] || 0) >= 1).length;
    const score = hits * (counts[requires[0]] || 0);
    if (hits >= minCount && score > bestScore) {
      bestScore = score;
      bestStage = stage;
    }
  }
  return bestStage;
}

// ─── STAGE TRANSITION DETECTION ───────────────────────────────────────────────
/**
 * Split history into early and recent halves, detect the dominant stage in
 * each, and report whether a transition occurred.
 */
function detectStageTransition(history) {
  if (!history || history.length < 3) return null;

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const mid    = Math.floor(sorted.length / 2);
  const early  = sorted.slice(0, mid);
  const recent = sorted.slice(mid);

  const fromStage = detectStage(early);
  const toStage   = detectStage(recent);

  return {
    from:                fromStage,
    to:                  toStage,
    transition_detected: fromStage !== toStage && toStage !== 'unknown',
  };
}

// ─── DOMINANT TRAJECTORY TYPE ─────────────────────────────────────────────────
function getDominantType(matchedPatterns, dominantSignal) {
  if (matchedPatterns && matchedPatterns.length > 0) {
    return matchedPatterns[0].pattern.type;
  }
  const TYPE_MAP = {
    fundraising_signal:       'fundraising',
    investor_interest_signal: 'fundraising',
    exit_signal:              'exit',
    acquisition_signal:       'exit',
    distress_signal:          'distress',
    efficiency_signal:        'distress',
    buyer_pain_signal:        'buying',
    buyer_signal:             'buying',
    buyer_budget_signal:      'buying',
    enterprise_signal:        'expansion',
    expansion_signal:         'expansion',
    gtm_signal:               'expansion',
    hiring_signal:            'growth',
    growth_signal:            'growth',
    product_signal:           'product',
  };
  return TYPE_MAP[dominantSignal] || 'unknown';
}

// ─── PREDICTED NEXT MOVES ─────────────────────────────────────────────────────
function predictNextMoves(matchedPatterns, dominantSignal) {
  if (matchedPatterns && matchedPatterns.length > 0) {
    return matchedPatterns[0].pattern.predicted_next_moves || [];
  }
  return SIGNAL_NEXT_MOVE_MAP[dominantSignal] || [];
}

// ─── ANOMALY DETECTION ────────────────────────────────────────────────────────
/**
 * Detect unusual signal patterns that suggest hype inflation, hidden stress,
 * or a stealth strategy change.
 */
function detectAnomalies(history, windowDays = 90) {
  if (!history || history.length < 2) return [];

  const now     = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const cutoff  = now - windowMs;
  const oldCutoff = now - (windowMs * 2);

  const recent = history.filter(e => new Date(e.date).getTime() >= cutoff);
  const older  = history.filter(e => {
    const ts = new Date(e.date).getTime();
    return ts >= oldCutoff && ts < cutoff;
  });

  const anomalies = [];

  // 1. Sudden signal spike vs historical baseline
  const daysPerMonth = 30;
  if (older.length >= 3 && recent.length > 0) {
    const olderMonths  = (windowDays * 2) / daysPerMonth;
    const recentMonths = windowDays / daysPerMonth;
    const olderRate    = older.length  / olderMonths;
    const recentRate   = recent.length / recentMonths;
    if (recentRate > olderRate * 3 && recentRate >= 2) {
      anomalies.push({
        type:        'sudden_spike',
        description: `Signal density tripled vs historical baseline (${Math.round(recentRate)}/mo vs ${Math.round(olderRate)}/mo)`,
        severity:    'high',
      });
    }
  }

  // 2. Abrupt domain shift (e.g., growth → distress)
  const OPPOSITE_PAIRS = [
    ['growth', 'distress'], ['fundraising', 'distress'],
    ['expansion', 'distress'], ['product', 'distress'],
  ];
  function topDomain(entries) {
    const counts = {};
    for (const e of entries) {
      const d = SIGNAL_DOMAIN[e.signal?.primary_signal];
      if (d && d !== 'unknown' && d !== 'exploratory') counts[d] = (counts[d] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top?.[0] || null;
  }
  const oldDomain = topDomain(older);
  const newDomain = topDomain(recent);
  if (oldDomain && newDomain && oldDomain !== newDomain) {
    const isOpposite = OPPOSITE_PAIRS.some(
      ([a, b]) => (oldDomain === a && newDomain === b) || (oldDomain === b && newDomain === a)
    );
    anomalies.push({
      type:        isOpposite ? 'abrupt_domain_reversal' : 'domain_transition',
      description: `Signal focus shifted from "${oldDomain}" to "${newDomain}"`,
      severity:    isOpposite ? 'high' : 'medium',
      from:        oldDomain,
      to:          newDomain,
    });
  }

  // 3. Promotional hype without confirmed actions
  const promoCount     = recent.filter(e => e.signal?.evidence_quality === 'low-information').length;
  const confirmedCount = recent.filter(e => e.signal?.evidence_quality === 'confirmed').length;
  if (promoCount >= 3 && confirmedCount === 0 && recent.length >= 3) {
    anomalies.push({
      type:        'hype_without_action',
      description: 'Multiple promotional signals with no confirmed operational actions',
      severity:    'medium',
    });
  }

  // 4. Investor diligence signals without visible traction
  const hasInvestorSignal = recent.some(e =>
    ['investor_interest_signal', 'fundraising_signal'].includes(e.signal?.primary_signal)
  );
  const hasTractionSignal = recent.some(e =>
    ['revenue_signal', 'demand_signal', 'market_position_signal'].includes(e.signal?.primary_signal)
  );
  if (hasInvestorSignal && !hasTractionSignal && recent.length >= 3) {
    anomalies.push({
      type:        'investor_without_traction',
      description: 'Investor activity without visible traction or revenue signals',
      severity:    'medium',
    });
  }

  // 5. Pilot announced, no follow-on procurement
  const hasPilot      = older.some(e => e.signal?._actions?.some(a => a.action_tag === 'action_piloting'));
  const hasProcurement = recent.some(e =>
    ['buyer_budget_signal', 'buyer_signal'].includes(e.signal?.primary_signal)
  );
  if (hasPilot && !hasProcurement && older.length >= 2) {
    anomalies.push({
      type:        'stalled_pilot_conversion',
      description: 'Pilot signals in prior period with no procurement follow-through',
      severity:    'medium',
    });
  }

  return anomalies;
}

// ─── PATTERN MATCHING ─────────────────────────────────────────────────────────
function matchTrajectoryPatterns(history) {
  if (!history || history.length < 2) return [];

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const matches = [];

  for (const pattern of TRAJECTORY_PATTERNS) {
    const { sequence } = pattern;
    const matched_dates = [];
    let searchFrom = 0;
    let stepMatched = true;

    for (const { classes, max_gap_days } of sequence) {
      const prevTs   = matched_dates.length > 0
        ? new Date(matched_dates[matched_dates.length - 1]).getTime()
        : 0;
      const maxGapMs = max_gap_days * 24 * 60 * 60 * 1000;

      let foundStep = false;
      for (let i = searchFrom; i < sorted.length; i++) {
        const entry = sorted[i];
        const cls   = entry.signal?.primary_signal;
        const ts    = new Date(entry.date).getTime();

        if (!cls || !classes.includes(cls)) continue;
        if (matched_dates.length > 0 && (ts - prevTs) > maxGapMs) break;

        matched_dates.push(entry.date);
        searchFrom = i + 1;
        foundStep  = true;
        break;
      }
      if (!foundStep) { stepMatched = false; break; }
    }

    if (!stepMatched || matched_dates.length < sequence.length) continue;

    const completeness = matched_dates.length / sequence.length;
    const match_score  = Math.round(completeness * pattern.strength * 100) / 100;

    matches.push({ pattern, match_score, matched_dates });
  }

  return matches.sort((a, b) => b.match_score - a.match_score);
}

// ─── MOMENTUM (recency-weighted signal density) ───────────────────────────────
function computeMomentum(history, windowDays = 90) {
  if (!history || history.length === 0) return 0;

  const now    = Date.now();
  const cutoff = now - (windowDays * 24 * 60 * 60 * 1000);

  const recent = history.filter(e => {
    const ts = new Date(e.date).getTime();
    return !isNaN(ts) && ts >= cutoff;
  });
  if (recent.length === 0) return 0;

  let totalScore = 0;
  for (const entry of recent) {
    const ageDays      = (now - new Date(entry.date).getTime()) / (24 * 60 * 60 * 1000);
    const recency      = Math.max(0, 1 - ageDays / windowDays);
    const strength     = entry.signal?.signal_strength ?? entry.signal?.confidence ?? 0.5;
    totalScore        += strength * recency;
  }

  const raw         = totalScore / recent.length;
  const volumeBonus = Math.min(0.10, recent.length * 0.01);
  return Math.min(1.0, Math.round((raw + volumeBonus) * 100) / 100);
}

// ─── ACCELERATION ─────────────────────────────────────────────────────────────
function detectAcceleration(history, windowDays = 120) {
  if (!history || history.length < 3) return 'insufficient_data';

  const now      = Date.now();
  const halfMs   = (windowDays / 2) * 24 * 60 * 60 * 1000;
  const fullMs   = windowDays * 24 * 60 * 60 * 1000;
  const midpoint = now - halfMs;
  const cutoff   = now - fullMs;

  const older  = history.filter(e => {
    const ts = new Date(e.date).getTime();
    return ts >= cutoff && ts < midpoint;
  });
  const recent = history.filter(e => new Date(e.date).getTime() >= midpoint);

  if (older.length === 0 && recent.length === 0) return 'insufficient_data';
  if (older.length === 0) return 'accelerating';

  const ratio = recent.length / Math.max(1, older.length);
  if (ratio >= 1.5) return 'accelerating';
  if (ratio <= 0.5) return 'decelerating';
  return 'stable';
}

// ─── DOMINANT SIGNAL ──────────────────────────────────────────────────────────
function getDominantSignal(history, windowDays = 90) {
  const now    = Date.now();
  const cutoff = now - (windowDays * 24 * 60 * 60 * 1000);
  const counts = {};
  for (const entry of history) {
    if (new Date(entry.date).getTime() < cutoff) continue;
    const cls = entry.signal?.primary_signal;
    if (cls && cls !== 'unclassified_signal') counts[cls] = (counts[cls] || 0) + 1;
  }
  if (Object.keys(counts).length === 0) return null;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── SUPPORTING / CONTRADICTORY SIGNALS ──────────────────────────────────────
function classifySignals(history, dominantType, windowDays = 90) {
  const now    = Date.now();
  const cutoff = now - (windowDays * 24 * 60 * 60 * 1000);

  const TYPE_OPPOSITES = {
    fundraising: ['distress', 'exit'],
    growth:      ['distress', 'exit'],
    product:     ['distress'],
    expansion:   ['distress'],
    buying:      [],
    distress:    ['fundraising', 'growth', 'expansion'],
    exit:        ['growth', 'expansion'],
  };
  const opposites = TYPE_OPPOSITES[dominantType] || [];

  const supporting    = new Set();
  const contradictory = new Set();

  for (const entry of history) {
    if (new Date(entry.date).getTime() < cutoff) continue;
    const cls    = entry.signal?.primary_signal;
    const domain = SIGNAL_DOMAIN[cls] || 'unknown';
    if (!cls || cls === 'unclassified_signal') continue;

    if (SIGNAL_DOMAIN[cls] === dominantType || domain === dominantType) {
      supporting.add(cls);
    } else if (opposites.includes(domain)) {
      contradictory.add(cls);
    }
  }

  return {
    supporting:    [...supporting],
    contradictory: [...contradictory],
  };
}

// ─── ROLLING WINDOWS ──────────────────────────────────────────────────────────
/**
 * Build trajectory summaries at multiple time horizons.
 * Recommended: 30d (immediate), 90d (operational), 180d (strategic), 365d (evolution)
 */
function buildRollingWindows(history) {
  const windows = [30, 90, 180, 365];
  return windows.reduce((acc, days) => {
    const label = days === 30  ? 'immediate'  :
                  days === 90  ? 'operational' :
                  days === 180 ? 'strategic'   : 'evolution';
    acc[label] = {
      window_days:     days,
      momentum:        computeMomentum(history, days),
      velocity:        computeVelocityScore(history, days),
      consistency:     computeConsistencyScore(history, days),
      dominant_signal: getDominantSignal(history, days),
      acceleration:    detectAcceleration(history, days),
    };
    return acc;
  }, {});
}

// ─── MAIN: buildTrajectory ────────────────────────────────────────────────────
/**
 * Build a full TrajectoryReport for a company's signal history.
 *
 * @param {Array<{date: string|Date, signal: SignalObject}>} signalHistory
 * @param {object} [options]
 * @param {string} [options.entity_id]          — company / entity identifier
 * @param {number} [options.window_days=90]      — primary evaluation window
 * @returns {TrajectoryReport}
 */
function buildTrajectory(signalHistory, options = {}) {
  const windowDays = options.window_days ?? 90;
  const entityId   = options.entity_id   ?? null;

  if (!signalHistory || signalHistory.length === 0) {
    return _emptyTrajectory(entityId, windowDays);
  }

  const sorted = [...signalHistory]
    .filter(e => e.signal && e.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const now = Date.now();
  const windowStart = new Date(now - windowDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const windowEnd   = new Date(now).toISOString().split('T')[0];

  // Core metrics
  const velocity_score    = computeVelocityScore(sorted, windowDays);
  const consistency_score = computeConsistencyScore(sorted, windowDays);
  const momentum          = computeMomentum(sorted, windowDays);
  const acceleration      = detectAcceleration(sorted, windowDays * 1.5);
  const dominant_signal   = getDominantSignal(sorted, windowDays);

  // Pattern matching
  const matched_patterns  = matchTrajectoryPatterns(sorted);
  const primary_pattern   = matched_patterns[0] || null;

  // Trajectory classification
  const dominant_trajectory = primary_pattern?.pattern?.type
    || getDominantType(matched_patterns, dominant_signal)
    || 'unknown';

  // Trajectory confidence: pattern match_score if pattern found, else velocity × consistency
  const trajectory_confidence = primary_pattern
    ? primary_pattern.match_score
    : Math.round(velocity_score * consistency_score * 100) / 100;

  // Stage transition
  const stage_transition = detectStageTransition(sorted);

  // Supporting / contradictory signals
  const { supporting, contradictory } = classifySignals(sorted, dominant_trajectory, windowDays);

  // Predicted next moves
  const predicted_next_moves = predictNextMoves(matched_patterns, dominant_signal);

  // Who cares (merged from matched patterns)
  const who_cares = {};
  for (const { pattern } of matched_patterns) {
    for (const [k, v] of Object.entries(pattern.who_cares || {})) {
      if (v) who_cares[k] = true;
    }
  }

  // Anomalies
  const anomalies = detectAnomalies(sorted, windowDays);

  // Prediction string
  const prediction = primary_pattern?.pattern?.description
    ? primary_pattern.pattern.description
    : acceleration === 'accelerating' && velocity_score > 0.60
      ? 'Signal velocity accelerating — company activity increasing rapidly.'
      : null;

  // Signal class distribution
  const signal_class_counts = {};
  for (const entry of sorted) {
    const cls = entry.signal?.primary_signal;
    if (cls) signal_class_counts[cls] = (signal_class_counts[cls] || 0) + 1;
  }

  // Simplified timeline
  const timeline = sorted.map(entry => ({
    date:          entry.date,
    signal_class:  entry.signal?.primary_signal   || 'unclassified_signal',
    signal_type:   entry.signal?.signal_type       || 'unknown',
    evidence:      entry.signal?.evidence_quality  || 'unknown',
    confidence:    entry.signal?.confidence        || 0,
    costly_action: entry.signal?.costly_action     || false,
    summary:       entry.signal?._actions?.[0]?.meaning || entry.signal?.primary_signal || '',
    raw_text:      entry.signal?.raw_text          || '',
  }));

  // Rolling window summaries
  const rolling_windows = buildRollingWindows(sorted);

  return {
    entity_id:             entityId,
    window_start:          windowStart,
    window_end:            windowEnd,
    time_window_days:      windowDays,

    // ── Core trajectory ──────────────────────────────────────────────────────
    dominant_trajectory,
    trajectory_confidence,
    trajectory_label:      primary_pattern?.pattern?.label || null,

    // ── Velocity & momentum ──────────────────────────────────────────────────
    velocity_score,
    momentum,
    acceleration,

    // ── Consistency ──────────────────────────────────────────────────────────
    consistency_score,

    // ── Stage ────────────────────────────────────────────────────────────────
    stage_transition,
    current_stage: stage_transition?.to || detectStage(sorted),

    // ── Signal evidence ──────────────────────────────────────────────────────
    dominant_signal,
    supporting_signals:    supporting,
    contradictory_signals: contradictory,
    signal_class_counts,

    // ── Predictions ──────────────────────────────────────────────────────────
    predicted_next_moves,
    prediction,
    who_cares,

    // ── Anomalies ────────────────────────────────────────────────────────────
    anomalies,

    // ── Pattern match detail ─────────────────────────────────────────────────
    matched_patterns,
    primary_pattern,

    // ── Rolling window summaries ─────────────────────────────────────────────
    rolling_windows,

    // ── Timeline ─────────────────────────────────────────────────────────────
    total_signals:     sorted.length,
    first_signal_date: sorted[0]?.date    || null,
    last_signal_date:  sorted[sorted.length - 1]?.date || null,
    timeline,
  };
}

function _emptyTrajectory(entityId, windowDays) {
  return {
    entity_id: entityId, window_start: null, window_end: null,
    time_window_days: windowDays, dominant_trajectory: 'unknown',
    trajectory_confidence: 0, trajectory_label: null,
    velocity_score: 0, momentum: 0, acceleration: 'insufficient_data',
    consistency_score: 0, stage_transition: null, current_stage: 'unknown',
    dominant_signal: null, supporting_signals: [], contradictory_signals: [],
    signal_class_counts: {}, predicted_next_moves: [], prediction: null,
    who_cares: {}, anomalies: [], matched_patterns: [], primary_pattern: null,
    rolling_windows: {}, total_signals: 0, first_signal_date: null,
    last_signal_date: null, timeline: [],
  };
}

// ─── UTILITY ──────────────────────────────────────────────────────────────────
function addSignalToHistory(history, date, signalObject) {
  if (!signalObject || !date) return history;
  const entry = { date: new Date(date).toISOString(), signal: signalObject };
  const idx = history.findIndex(
    e => new Date(e.date).getTime() > new Date(date).getTime()
  );
  if (idx === -1) history.push(entry);
  else history.splice(idx, 0, entry);
  return history;
}

module.exports = {
  buildTrajectory,
  computeVelocityScore,
  computeConsistencyScore,
  computeMomentum,
  detectAcceleration,
  detectStageTransition,
  detectAnomalies,
  getDominantSignal,
  matchTrajectoryPatterns,
  addSignalToHistory,
  TRAJECTORY_PATTERNS,
  SIGNAL_DOMAIN,
  VELOCITY_WEIGHTS,
};
