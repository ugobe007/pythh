'use strict';

/**
 * Pythh Signal-to-Match Engine
 *
 * Turns signal trajectories and inferred needs into ranked match objects
 * with multi-dimensional fit scores, timing awareness, explanation reasons,
 * and recommended actions.
 *
 * Pipeline:
 *   Signal History
 *     → Trajectory Report    (trajectoryEngine.buildTrajectory)
 *     → Inferred Needs       (needsInference.inferNeeds)
 *     → Candidate Retrieval  (matchEngine.findCandidates)
 *     → Fit Scoring          (matchEngine.scoreMatch)
 *     → Timing Score         (matchEngine.scoreTiming)
 *     → Ranked Matches       (matchEngine.rankMatches)
 *     → Explanation Layer    (matchEngine.buildExplanation)
 *     → Recommended Action   (matchEngine.recommendAction)
 *
 * Usage:
 *   const { rankMatches } = require('./matchEngine');
 *   const matches = rankMatches(entity, trajectory, needs, candidatePool);
 */

// ─── MATCH TYPES ──────────────────────────────────────────────────────────────
const MATCH_TYPES = [
  'capital_match',
  'vendor_match',
  'buyer_match',
  'partner_match',
  'talent_match',
  'acquirer_match',
  'advisor_match',
];

// ─── CANDIDATE TYPE → MATCH TYPE ─────────────────────────────────────────────
const CANDIDATE_MATCH_TYPE = {
  investor:    'capital_match',
  vendor:      'vendor_match',
  buyer:       'buyer_match',
  partner:     'partner_match',
  recruiter:   'talent_match',
  acquirer:    'acquirer_match',
  advisor:     'advisor_match',
};

// ─── STAGE FIT MATRIX ────────────────────────────────────────────────────────
// Maps entity stage → ideal investor/candidate stage preference.
// If a company is at "pilot" stage, a Series B fund is likely premature.
const STAGE_PREFERENCE = {
  // Entity Stage          : [ideal candidate stages]
  ideation:               ['pre_seed', 'seed', 'angel'],
  product_build:          ['pre_seed', 'seed'],
  market_validation:      ['seed', 'series_a'],
  pilot:                  ['seed', 'series_a', 'pilot_vendor'],
  go_to_market:           ['series_a', 'growth'],
  enterprise_scale:       ['series_a', 'series_b', 'growth'],
  fundraising_active:     ['series_a', 'series_b', 'seed'],
  efficiency_mode:        ['growth', 'bridge', 'turnaround'],
  buyer_evaluation:       ['pilot_vendor', 'poc_vendor'],
  procurement:            ['deployment_vendor', 'si'],
  exit_prep:              ['pe', 'corporate_acquirer', 'banker'],
};

// ─── TRAJECTORY → GOOD CANDIDATE TYPES ───────────────────────────────────────
const TRAJECTORY_CANDIDATE_AFFINITY = {
  fundraising:   ['investor', 'advisor'],
  expansion:     ['investor', 'partner', 'vendor', 'recruiter'],
  product:       ['vendor', 'partner', 'investor'],
  buying:        ['vendor', 'partner', 'advisor'],
  distress:      ['investor', 'advisor', 'acquirer'],
  exit:          ['acquirer', 'advisor', 'investor'],
  repositioning: ['advisor', 'recruiter', 'partner'],
  growth:        ['investor', 'recruiter', 'vendor'],
  unknown:       ['investor', 'vendor'],
};

// ─── NEED → CANDIDATE CATEGORY ───────────────────────────────────────────────
const NEED_CANDIDATE_MAP = {
  seed_capital:             ['investor'],
  bridge_capital:           ['investor', 'advisor'],
  series_a_capital:         ['investor'],
  series_b_capital:         ['investor'],
  growth_capital:           ['investor'],
  strategic_capital:        ['investor', 'partner'],
  enterprise_sales_support: ['vendor', 'partner', 'advisor'],
  channel_partners:         ['partner'],
  revops_tools:             ['vendor'],
  lead_generation:          ['vendor'],
  localization_support:     ['vendor', 'partner', 'advisor'],
  infra_tools:              ['vendor'],
  dev_tools:                ['vendor'],
  compliance_tools:         ['vendor', 'advisor'],
  data_tools:               ['vendor'],
  implementation_support:   ['partner', 'vendor'],
  automation_vendor:        ['vendor'],
  robotics_vendor:          ['vendor'],
  systems_integrator:       ['partner', 'vendor'],
  procurement_support:      ['advisor', 'partner'],
  pilot_partner:            ['vendor', 'partner'],
  energy_vendor:            ['vendor'],
  acquirer_interest:        ['acquirer'],
  strategic_partner:        ['partner'],
  banker_advisor:           ['advisor'],
  turnaround_support:       ['advisor'],
  executive_search:         ['recruiter'],
  engineering_talent:       ['recruiter'],
  sales_talent:             ['recruiter'],
  operations_talent:        ['recruiter'],
};

// ─── RECOMMENDED ACTIONS ─────────────────────────────────────────────────────
const RECOMMENDED_ACTIONS = {
  // By match type + urgency
  capital_match: {
    high:   'Prioritize outreach now — company is in active financing cycle.',
    medium: 'Initiate conversation; ask for a brief intro call.',
    low:    'Monitor — not yet in a financing window but trending toward one.',
  },
  vendor_match: {
    high:   'Reach out this quarter — buyer is in evaluation or procurement phase.',
    medium: 'Enter during pilot stage with a low-commitment proof of concept.',
    low:    'Monitor — buying intent signals present but early stage.',
  },
  buyer_match: {
    high:   'Company is an active buyer target. Initiate now.',
    medium: 'Send introductory materials and request a discovery call.',
    low:    'Track buying signals; initiate when procurement language appears.',
  },
  partner_match: {
    high:   'Propose partnership conversation now — strong trajectory fit.',
    medium: 'Warm introduction via mutual contact recommended.',
    low:    'Monitor and initiate when expansion signals intensify.',
  },
  talent_match: {
    high:   'Company is hiring aggressively. Submit talent proposals now.',
    medium: 'Reach out with relevant candidate profiles.',
    low:    'Monitor hiring signals — early-stage intent only.',
  },
  acquirer_match: {
    high:   'Company shows exit signals. Request warm introduction via advisor.',
    medium: 'Monitor closely — position for strategic conversation.',
    low:    'Track; not yet actionable.',
  },
  advisor_match: {
    high:   'Company needs advisory support imminently.',
    medium: 'Warm outreach with relevant expertise context.',
    low:    'Monitor for timing opportunity.',
  },
};

// ─── FIT SCORING ──────────────────────────────────────────────────────────────

/**
 * Score sector fit: does the candidate serve the entity's sector/vertical?
 * Uses fuzzy overlap between candidate.sectors and entity.sectors.
 *
 * @returns {number} 0.0–1.0
 */
function scoreSectorFit(entity, candidate) {
  const entitySectors    = (entity.sectors    || []).map(s => s.toLowerCase());
  const candidateSectors = (candidate.sectors || []).map(s => s.toLowerCase());

  if (candidateSectors.length === 0 || entitySectors.length === 0) return 0.50; // neutral

  const overlap = entitySectors.filter(s => candidateSectors.includes(s)).length;
  if (overlap === 0) return 0.10;
  return Math.min(1.0, 0.40 + (overlap / Math.max(entitySectors.length, 1)) * 0.60);
}

/**
 * Score stage fit: is the candidate appropriate for the entity's current stage?
 * @returns {number} 0.0–1.0
 */
function scoreStageFit(entity, candidate, trajectory) {
  const currentStage = trajectory?.current_stage ?? entity.stage ?? 'unknown';
  const idealStages  = STAGE_PREFERENCE[currentStage] || [];
  const candidateStages = candidate.stages || [];

  if (idealStages.length === 0 || candidateStages.length === 0) return 0.50;

  const hasIdealStage = candidateStages.some(s => idealStages.includes(s));
  return hasIdealStage ? 0.90 : 0.20;
}

/**
 * Score need fit: does the candidate solve any of the entity's inferred needs?
 * @returns {number} 0.0–1.0
 */
function scoreNeedFit(candidate, needs) {
  if (!needs || needs.length === 0) return 0.50;

  const candidateNeedSupport = new Set([
    ...(candidate.need_classes_supported || []),
    ...(candidate.buying_signals_supported || []),
  ]);

  if (candidateNeedSupport.size === 0) return 0.30;

  let score = 0;
  for (const need of needs.slice(0, 5)) {
    if (candidateNeedSupport.has(need.need_class)) {
      // Weight by need confidence and urgency
      const urgencyMult = need.urgency === 'high' ? 1.0 : need.urgency === 'medium' ? 0.7 : 0.4;
      score += need.confidence * urgencyMult;
    }
  }
  return Math.min(1.0, Math.round(score * 100) / 100);
}

/**
 * Score trajectory fit: does the candidate align with the entity's trajectory type?
 * @returns {number} 0.0–1.0
 */
function scoreTrajectoryFit(candidate, trajectory) {
  const trajectoryType = trajectory?.dominant_trajectory ?? 'unknown';
  const preferredTypes = TRAJECTORY_CANDIDATE_AFFINITY[trajectoryType] || [];
  const candidateType  = candidate.candidate_type ?? '';

  if (preferredTypes.includes(candidateType)) {
    // Also weight by trajectory confidence
    const conf = trajectory?.trajectory_confidence ?? 0.50;
    return Math.min(1.0, 0.60 + conf * 0.40);
  }
  return 0.15;
}

/**
 * Score geography fit: does the candidate operate where the entity is active?
 * @returns {number} 0.0–1.0
 */
function scoreGeographyFit(entity, candidate) {
  const entityGeos    = (entity.geographies    || []).map(g => g.toLowerCase());
  const candidateGeos = (candidate.geographies || []).map(g => g.toLowerCase());

  if (entityGeos.length === 0 || candidateGeos.length === 0) return 0.60; // neutral

  // Global candidates always fit
  if (candidateGeos.includes('global') || candidateGeos.includes('worldwide')) return 0.90;

  const overlap = entityGeos.filter(g => candidateGeos.includes(g)).length;
  return overlap > 0 ? Math.min(1.0, 0.50 + overlap * 0.25) : 0.15;
}

/**
 * Score timing fit: is the candidate relevant at the entity's current stage/velocity?
 * This prevents matching a Series B fund to a company just leaving ideation.
 * @returns {number} 0.0–1.0
 */
function scoreTimingFit(entity, candidate, trajectory, needs) {
  // Base: stage fit is the most important timing signal
  const stageFit  = scoreStageFit(entity, candidate, trajectory);
  const velocity  = trajectory?.velocity_score ?? 0.50;
  const accel     = trajectory?.acceleration   ?? 'stable';

  // Acceleration bonus: if the company is accelerating, urgency to engage is higher
  const accelBonus = accel === 'accelerating' ? 0.10 : accel === 'decelerating' ? -0.10 : 0;

  // High-urgency needs improve timing for appropriate candidates
  const highUrgencyNeeds = (needs || []).filter(n => n.urgency === 'high').length;
  const urgencyBonus = Math.min(0.15, highUrgencyNeeds * 0.05);

  const raw = (stageFit * 0.60) + (velocity * 0.20) + accelBonus + urgencyBonus;
  return Math.min(1.0, Math.round(Math.max(0, raw) * 100) / 100);
}

/**
 * Score signal alignment: do the candidate's stated preferences match
 * observed signal classes?
 * @returns {number} 0.0–1.0
 */
function scoreSignalAlignment(candidate, trajectory, needs) {
  const supported = new Set([
    ...(candidate.buying_signals_supported   || []),
    ...(candidate.trajectory_preferences     || []),
    ...(candidate.need_classes_supported     || []),
  ]);

  if (supported.size === 0) return 0.40;

  let hits = 0;
  let total = 0;

  // Check dominant signals
  for (const cls of (trajectory?.supporting_signals || [])) {
    total++;
    if (supported.has(cls)) hits++;
  }
  // Check dominant trajectory
  if (trajectory?.dominant_trajectory && supported.has(trajectory.dominant_trajectory)) {
    hits++; total++;
  }
  // Check inferred needs
  for (const need of (needs || []).slice(0, 5)) {
    total++;
    if (supported.has(need.need_class)) hits++;
  }

  if (total === 0) return 0.40;
  return Math.round((hits / total) * 100) / 100;
}

// ─── MISMATCH PENALTY ─────────────────────────────────────────────────────────
function computeMismatchPenalty(entity, candidate, trajectory) {
  let penalty = 0;

  // Hard sector mismatch (candidate explicitly excludes this sector)
  const entitySectors = (entity.sectors || []).map(s => s.toLowerCase());
  const negativeFilters = (candidate.negative_filters || []).map(s => s.toLowerCase());
  if (entitySectors.some(s => negativeFilters.includes(s))) penalty += 0.30;

  // Business model mismatch
  const entityModel = (entity.business_model || '').toLowerCase();
  const biz = (candidate.business_model_fit || []).map(b => b.toLowerCase());
  if (entityModel && biz.length > 0 && !biz.includes(entityModel) && !biz.includes('any')) {
    penalty += 0.15;
  }

  // Trajectory mismatch (e.g., distress trajectory being matched to Series B growth fund)
  const trajectoryType = trajectory?.dominant_trajectory ?? 'unknown';
  const preferredTypes = TRAJECTORY_CANDIDATE_AFFINITY[trajectoryType] || [];
  if (preferredTypes.length > 0 && !preferredTypes.includes(candidate.candidate_type)) {
    penalty += 0.10;
  }

  return Math.min(0.50, penalty);
}

// ─── MATCH SCORE ─────────────────────────────────────────────────────────────
/**
 * Compute the final match score across all six dimensions.
 *
 * match_score = sector_fit(0.15) + stage_fit(0.15) + need_fit(0.25)
 *             + trajectory_fit(0.15) + geo_fit(0.10) + signal_alignment(0.20)
 *             - mismatch_penalty
 *
 * @returns {{ match_score, timing_score, dimension_scores }}
 */
function scoreMatch(entity, candidate, trajectory, needs) {
  const sector     = scoreSectorFit(entity, candidate);
  const stage      = scoreStageFit(entity, candidate, trajectory);
  const need       = scoreNeedFit(candidate, needs);
  const traj       = scoreTrajectoryFit(candidate, trajectory);
  const geo        = scoreGeographyFit(entity, candidate);
  const signals    = scoreSignalAlignment(candidate, trajectory, needs);
  const penalty    = computeMismatchPenalty(entity, candidate, trajectory);
  const timing     = scoreTimingFit(entity, candidate, trajectory, needs);

  const raw_score =
    (sector  * 0.15) +
    (stage   * 0.15) +
    (need    * 0.25) +
    (traj    * 0.15) +
    (geo     * 0.10) +
    (signals * 0.20) -
    penalty;

  const match_score = Math.round(Math.max(0, Math.min(1, raw_score)) * 100) / 100;

  return {
    match_score,
    timing_score:  Math.round(Math.min(1, timing) * 100) / 100,
    dimension_scores: {
      sector_fit:        Math.round(sector  * 100) / 100,
      stage_fit:         Math.round(stage   * 100) / 100,
      need_fit:          Math.round(need    * 100) / 100,
      trajectory_fit:    Math.round(traj    * 100) / 100,
      geography_fit:     Math.round(geo     * 100) / 100,
      signal_alignment:  Math.round(signals * 100) / 100,
      mismatch_penalty:  Math.round(penalty * 100) / 100,
    },
  };
}

// ─── EXPLANATION BUILDER ─────────────────────────────────────────────────────
/**
 * Build an array of plain-English reasons explaining why this match was generated.
 * These surface directly in the product UI.
 */
function buildExplanation(entity, candidate, trajectory, needs, scores) {
  const reasons = [];
  const d = scores?.dimension_scores || {};

  // Trajectory context
  if (trajectory?.dominant_trajectory && trajectory?.trajectory_label) {
    reasons.push(`${entity.name || 'Company'} is on a "${trajectory.trajectory_label}" trajectory.`);
  }

  // Sector match
  if (d.sector_fit >= 0.70) {
    const shared = (entity.sectors || []).filter(s =>
      (candidate.sectors || []).map(x => x.toLowerCase()).includes(s.toLowerCase())
    );
    if (shared.length > 0) {
      reasons.push(`Candidate focuses on ${shared.join(', ')} — matching entity sector.`);
    }
  }

  // Stage match
  if (d.stage_fit >= 0.80) {
    reasons.push(`Candidate is an ideal fit for the company's current stage (${trajectory?.current_stage || 'unknown'}).`);
  } else if (d.stage_fit < 0.30) {
    reasons.push(`Stage may be slightly early for this candidate — monitor for advancement.`);
  }

  // Top needs
  const highNeeds = (needs || []).filter(n => n.urgency === 'high').slice(0, 3);
  for (const need of highNeeds) {
    if ((candidate.need_classes_supported || []).includes(need.need_class)) {
      reasons.push(`Candidate can address high-urgency need: ${need.label}.`);
    }
  }

  // Signal alignment
  if (trajectory?.supporting_signals?.length > 0 && d.signal_alignment >= 0.50) {
    const aligned = trajectory.supporting_signals.slice(0, 2);
    reasons.push(`Key signals (${aligned.join(', ')}) align with candidate's focus area.`);
  }

  // Velocity/acceleration
  if (trajectory?.acceleration === 'accelerating' && trajectory?.velocity_score > 0.60) {
    reasons.push(`Signal velocity is accelerating — timing window is opening now.`);
  }

  // Anomaly warnings
  for (const anomaly of (trajectory?.anomalies || [])) {
    if (anomaly.severity === 'high') {
      reasons.push(`⚠ Anomaly: ${anomaly.description}`);
    }
  }

  // Predicted moves context
  const moves = (trajectory?.predicted_next_moves || []).slice(0, 2);
  if (moves.length > 0) {
    reasons.push(`Predicted next moves: ${moves.join(', ').replace(/_/g, ' ')}.`);
  }

  return reasons;
}

// ─── RECOMMENDED ACTION ───────────────────────────────────────────────────────
function recommendAction(matchType, urgency) {
  const actions = RECOMMENDED_ACTIONS[matchType] || RECOMMENDED_ACTIONS.vendor_match;
  return actions[urgency] || actions.medium;
}

// ─── DETERMINE MATCH TYPE ─────────────────────────────────────────────────────
function getMatchType(candidate) {
  return CANDIDATE_MATCH_TYPE[candidate.candidate_type] || 'vendor_match';
}

// ─── OVERALL URGENCY ─────────────────────────────────────────────────────────
function computeMatchUrgency(matchScore, timingScore, trajectoryVelocity, acceleration) {
  let score = (matchScore * 0.40) + (timingScore * 0.35) + (trajectoryVelocity * 0.25);
  if (acceleration === 'accelerating') score += 0.10;
  if (acceleration === 'decelerating') score -= 0.05;
  if (score >= 0.72) return 'high';
  if (score >= 0.45) return 'medium';
  return 'low';
}

// ─── MAIN: rankMatches ────────────────────────────────────────────────────────
/**
 * Score, rank, and annotate all candidates against an entity's trajectory and needs.
 *
 * @param {object}              entity          — company profile
 * @param {TrajectoryReport}    trajectory      — from buildTrajectory()
 * @param {Array<NeedObject>}   needs           — from inferNeeds()
 * @param {Array<CandidateProfile>} candidates  — pool of potential matches
 * @param {object}              [options]
 * @param {number}              [options.min_score=0.30]    — filter threshold
 * @param {number}              [options.max_results=20]    — max ranked results
 * @returns {Array<MatchObject>}
 */
function rankMatches(entity, trajectory, needs, candidates, options = {}) {
  const minScore   = options.min_score   ?? 0.30;
  const maxResults = options.max_results ?? 20;

  if (!candidates || candidates.length === 0) return [];

  const results = [];

  for (const candidate of candidates) {
    const scores   = scoreMatch(entity, candidate, trajectory, needs);
    const { match_score, timing_score, dimension_scores } = scores;

    if (match_score < minScore) continue;

    const matchType  = getMatchType(candidate);
    const velocity   = trajectory?.velocity_score ?? 0.5;
    const accel      = trajectory?.acceleration   ?? 'stable';
    const urgency    = computeMatchUrgency(match_score, timing_score, velocity, accel);
    const confidence = Math.round(((match_score + timing_score) / 2) * 100) / 100;

    const explanation = buildExplanation(entity, candidate, trajectory, needs, scores);
    const action      = recommendAction(matchType, urgency);

    const predictedNeeds = (needs || [])
      .filter(n => (candidate.need_classes_supported || []).includes(n.need_class))
      .map(n => n.need_class);

    results.push({
      match_id:         `match_${entity.entity_id || 'entity'}_${candidate.candidate_id}`,
      entity_id:        entity.entity_id     || null,
      candidate_id:     candidate.candidate_id,
      candidate_name:   candidate.name       || null,
      candidate_type:   candidate.candidate_type,
      match_type:       matchType,

      match_score,
      timing_score,
      confidence,

      dimension_scores,

      urgency,
      predicted_need:       predictedNeeds,
      trajectory_used:      trajectory?.dominant_trajectory ?? 'unknown',
      dominant_signal:      trajectory?.dominant_signal     ?? null,
      supporting_signals:   trajectory?.supporting_signals  || [],

      explanation,
      recommended_action:   action,

      // For UI grouping / filtering
      category: (needs[0]?.category) || null,
    });
  }

  // Sort: urgency descending, then match_score descending
  const URGENCY_ORDER = { high: 3, medium: 2, low: 1 };
  results.sort((a, b) => {
    const urgDiff = (URGENCY_ORDER[b.urgency] || 0) - (URGENCY_ORDER[a.urgency] || 0);
    return urgDiff !== 0 ? urgDiff : b.match_score - a.match_score;
  });

  return results.slice(0, maxResults);
}

// ─── SINGLE MATCH OBJECT (standalone) ────────────────────────────────────────
/**
 * Build a single MatchObject without a full candidate pool ranking.
 * Useful for on-demand scoring of one entity ↔ candidate pair.
 */
function buildMatchObject(entity, candidate, trajectory, needs) {
  const scores   = scoreMatch(entity, candidate, trajectory, needs);
  const { match_score, timing_score, dimension_scores } = scores;
  const matchType = getMatchType(candidate);
  const velocity  = trajectory?.velocity_score ?? 0.5;
  const accel     = trajectory?.acceleration   ?? 'stable';
  const urgency   = computeMatchUrgency(match_score, timing_score, velocity, accel);
  const confidence = Math.round(((match_score + timing_score) / 2) * 100) / 100;
  const explanation = buildExplanation(entity, candidate, trajectory, needs, scores);
  const action      = recommendAction(matchType, urgency);

  const predictedNeeds = (needs || [])
    .filter(n => (candidate.need_classes_supported || []).includes(n.need_class))
    .map(n => n.need_class);

  return {
    match_id:         `match_${entity.entity_id || 'entity'}_${candidate.candidate_id}`,
    entity_id:        entity.entity_id     || null,
    candidate_id:     candidate.candidate_id,
    candidate_name:   candidate.name       || null,
    candidate_type:   candidate.candidate_type,
    match_type:       matchType,
    match_score,
    timing_score,
    confidence,
    dimension_scores,
    urgency,
    predicted_need:      predictedNeeds,
    trajectory_used:     trajectory?.dominant_trajectory ?? 'unknown',
    dominant_signal:     trajectory?.dominant_signal     ?? null,
    supporting_signals:  trajectory?.supporting_signals  || [],
    explanation,
    recommended_action:  action,
  };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────
module.exports = {
  rankMatches,
  buildMatchObject,
  scoreMatch,
  buildExplanation,
  recommendAction,
  scoreSectorFit,
  scoreStageFit,
  scoreNeedFit,
  scoreTrajectoryFit,
  scoreGeographyFit,
  scoreTimingFit,
  scoreSignalAlignment,
  MATCH_TYPES,
  CANDIDATE_MATCH_TYPE,
  NEED_CANDIDATE_MAP,
  TRAJECTORY_CANDIDATE_AFFINITY,
};
