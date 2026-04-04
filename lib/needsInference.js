'use strict';

/**
 * Pythh Needs Inference Engine
 *
 * Translates signal objects and trajectory reports into canonical NEED classes —
 * the critical middle layer between "what is happening" and "who should care."
 *
 * The middle layer is: Signal → Trajectory → Need → Match Candidate
 * Without this step, the system can only do pattern matching.
 * With this step, the system generates actionable recommendations.
 *
 * Usage:
 *   const { inferNeeds } = require('./needsInference');
 *   const needs = inferNeeds(signalHistory, trajectoryReport);
 *   // → [{ class: 'series_a_capital', urgency: 'high', confidence: 0.85, ... }]
 */

// ─── CANONICAL NEED TAXONOMY ──────────────────────────────────────────────────
/**
 * Need classes are the canonical vocabulary of what a company, buyer,
 * or investor is likely to require right now.
 *
 * Organized by super-category:
 *   CAPITAL        — financing requirements
 *   GTM            — commercial / go-to-market support
 *   PRODUCT        — technical / product needs
 *   BUYING         — operational purchasing needs
 *   STRATEGIC      — advisory, M&A, restructuring
 *   TALENT         — hiring and people needs
 */
const NEED_CLASSES = {

  // ── Capital ──────────────────────────────────────────────────────────────
  seed_capital: {
    label:        'Seed Capital',
    category:     'capital',
    description:  'Pre-seed or seed financing; typically for early product and team',
    who_provides: ['angel_investor', 'pre_seed_fund', 'seed_fund'],
    urgency_hint: 'medium',
  },
  bridge_capital: {
    label:        'Bridge Capital',
    category:     'capital',
    description:  'Short-term capital to extend runway before the next round or event',
    who_provides: ['existing_investor', 'angel_investor', 'family_office'],
    urgency_hint: 'high',
  },
  series_a_capital: {
    label:        'Series A Capital',
    category:     'capital',
    description:  'Series A institutional financing; growth and GTM buildout',
    who_provides: ['series_a_fund', 'venture_capital'],
    urgency_hint: 'medium',
  },
  series_b_capital: {
    label:        'Series B Capital',
    category:     'capital',
    description:  'Series B financing; scaling and market expansion',
    who_provides: ['growth_fund', 'venture_capital', 'crossover_fund'],
    urgency_hint: 'medium',
  },
  growth_capital: {
    label:        'Growth Capital',
    category:     'capital',
    description:  'Late-stage or growth equity to accelerate commercial expansion',
    who_provides: ['growth_equity_fund', 'crossover_fund', 'hedge_fund'],
    urgency_hint: 'medium',
  },
  strategic_capital: {
    label:        'Strategic Capital',
    category:     'capital',
    description:  'Capital from a corporate or strategic investor, often with partnership value',
    who_provides: ['corporate_vc', 'strategic_investor', 'family_office'],
    urgency_hint: 'medium',
  },

  // ── GTM ──────────────────────────────────────────────────────────────────
  enterprise_sales_support: {
    label:        'Enterprise Sales Support',
    category:     'gtm',
    description:  'Resources, tooling, or talent to build and execute enterprise sales motion',
    who_provides: ['sales_consultant', 'gtm_advisor', 'enterprise_staffing'],
    urgency_hint: 'high',
  },
  channel_partners: {
    label:        'Channel & Distribution Partners',
    category:     'gtm',
    description:  'Partners who can resell, co-sell, or distribute the product',
    who_provides: ['channel_partner', 'reseller', 'vat'],
    urgency_hint: 'medium',
  },
  revops_tools: {
    label:        'Revenue Operations Tooling',
    category:     'gtm',
    description:  'CRM, sales engagement, forecasting, and pipeline management tools',
    who_provides: ['crm_vendor', 'sales_engagement_vendor', 'revops_vendor'],
    urgency_hint: 'medium',
  },
  lead_generation: {
    label:        'Lead Generation & Demand Generation',
    category:     'gtm',
    description:  'Outbound, inbound, paid, or partner-driven pipeline generation',
    who_provides: ['demand_gen_agency', 'sdr_vendor', 'marketing_agency'],
    urgency_hint: 'medium',
  },
  localization_support: {
    label:        'Localization & Market Entry Support',
    category:     'gtm',
    description:  'Legal, language, cultural, regulatory support for new market entry',
    who_provides: ['localization_vendor', 'international_legal', 'market_entry_advisor'],
    urgency_hint: 'medium',
  },

  // ── Product / Technical ───────────────────────────────────────────────────
  infra_tools: {
    label:        'Infrastructure & Cloud Tools',
    category:     'product',
    description:  'Cloud, compute, storage, networking infrastructure to scale systems',
    who_provides: ['cloud_provider', 'infrastructure_vendor', 'managed_services'],
    urgency_hint: 'medium',
  },
  dev_tools: {
    label:        'Developer Tools',
    category:     'product',
    description:  'Tooling for engineering velocity: CI/CD, observability, testing',
    who_provides: ['devtool_vendor', 'platform_engineering_vendor'],
    urgency_hint: 'low',
  },
  compliance_tools: {
    label:        'Compliance & Security Tooling',
    category:     'product',
    description:  'SOC 2, ISO 27001, HIPAA, FedRAMP, or other compliance frameworks',
    who_provides: ['compliance_vendor', 'security_vendor', 'audit_firm'],
    urgency_hint: 'high',
  },
  data_tools: {
    label:        'Data & Analytics Tools',
    category:     'product',
    description:  'Data pipelines, analytics, BI, and AI tooling',
    who_provides: ['data_platform_vendor', 'bi_vendor', 'ai_tooling_vendor'],
    urgency_hint: 'medium',
  },
  implementation_support: {
    label:        'Implementation & Integration Support',
    category:     'product',
    description:  'Professional services, system integration, and deployment support',
    who_provides: ['systems_integrator', 'consulting_firm', 'implementation_partner'],
    urgency_hint: 'high',
  },

  // ── Buying / Operations ───────────────────────────────────────────────────
  automation_vendor: {
    label:        'Automation Vendor',
    category:     'buying',
    description:  'Vendor providing process automation (software, RPA, workflow)',
    who_provides: ['automation_vendor', 'rpa_vendor', 'workflow_vendor'],
    urgency_hint: 'high',
  },
  robotics_vendor: {
    label:        'Robotics Vendor',
    category:     'buying',
    description:  'Physical robotics or autonomous systems for operations',
    who_provides: ['robotics_vendor', 'hardware_vendor'],
    urgency_hint: 'high',
  },
  systems_integrator: {
    label:        'Systems Integrator',
    category:     'buying',
    description:  'Partner to integrate new technology with existing systems at scale',
    who_provides: ['systems_integrator', 'consulting_firm'],
    urgency_hint: 'high',
  },
  procurement_support: {
    label:        'Procurement Support',
    category:     'buying',
    description:  'Help with vendor evaluation, RFP/RFQ, negotiation, and contracting',
    who_provides: ['procurement_consultant', 'sourcing_advisor'],
    urgency_hint: 'medium',
  },
  pilot_partner: {
    label:        'Pilot Partner',
    category:     'buying',
    description:  'Vendor able to run a controlled pilot or proof of concept quickly',
    who_provides: ['pilot_ready_vendor', 'poc_specialist'],
    urgency_hint: 'high',
  },
  energy_vendor: {
    label:        'Energy / Utilities Vendor',
    category:     'buying',
    description:  'Energy procurement, sustainability, or utility management vendor',
    who_provides: ['energy_vendor', 'utility_broker', 'sustainability_advisor'],
    urgency_hint: 'medium',
  },

  // ── Strategic ─────────────────────────────────────────────────────────────
  acquirer_interest: {
    label:        'Acquirer or Strategic Buyer',
    category:     'strategic',
    description:  'Corporate buyer, PE firm, or roll-up seeking acquisition candidates',
    who_provides: ['corporate_acquirer', 'pe_firm', 'rollup'],
    urgency_hint: 'high',
  },
  strategic_partner: {
    label:        'Strategic Partner',
    category:     'strategic',
    description:  'Commercial or technology partnership for mutual market benefit',
    who_provides: ['strategic_partner', 'ecosystem_partner'],
    urgency_hint: 'medium',
  },
  banker_advisor: {
    label:        'Investment Banker / M&A Advisor',
    category:     'strategic',
    description:  'Advisor to run a capital raise, sale process, or strategic review',
    who_provides: ['investment_bank', 'boutique_ma', 'financial_advisor'],
    urgency_hint: 'high',
  },
  turnaround_support: {
    label:        'Turnaround Advisor',
    category:     'strategic',
    description:  'Advisor or firm specializing in operational and financial restructuring',
    who_provides: ['turnaround_firm', 'restructuring_advisor', 'pe_operational'],
    urgency_hint: 'high',
  },
  executive_search: {
    label:        'Executive Search',
    category:     'strategic',
    description:  'Retained search for C-suite, VP, or senior leadership roles',
    who_provides: ['executive_search_firm', 'retained_recruiter'],
    urgency_hint: 'high',
  },

  // ── Talent ───────────────────────────────────────────────────────────────
  engineering_talent: {
    label:        'Engineering Talent',
    category:     'talent',
    description:  'Software, ML, infrastructure, or product engineering hiring',
    who_provides: ['technical_recruiter', 'engineering_staffing'],
    urgency_hint: 'medium',
  },
  sales_talent: {
    label:        'Sales & GTM Talent',
    category:     'talent',
    description:  'Enterprise AEs, SDRs, SEs, and revenue leadership hiring',
    who_provides: ['sales_recruiter', 'gtm_staffing'],
    urgency_hint: 'high',
  },
  operations_talent: {
    label:        'Operations & General Talent',
    category:     'talent',
    description:  'Finance, ops, CS, marketing, and general business talent',
    who_provides: ['general_recruiter', 'staffing_agency'],
    urgency_hint: 'medium',
  },
};

// ─── SIGNAL → NEED MAPPING ────────────────────────────────────────────────────
// Which signal classes imply which canonical needs?
// Ordered by confidence weight within each signal class.
const SIGNAL_NEED_MAP = {
  hiring_signal: [
    { need: 'engineering_talent',       weight: 0.65, condition: null },
    { need: 'sales_talent',             weight: 0.70, condition: null },
    { need: 'revops_tools',             weight: 0.55, condition: null },
  ],
  gtm_signal: [
    { need: 'enterprise_sales_support', weight: 0.80, condition: null },
    { need: 'revops_tools',             weight: 0.75, condition: null },
    { need: 'sales_talent',             weight: 0.70, condition: null },
    { need: 'lead_generation',          weight: 0.60, condition: null },
    { need: 'channel_partners',         weight: 0.60, condition: null },
  ],
  enterprise_signal: [
    { need: 'enterprise_sales_support', weight: 0.85, condition: null },
    { need: 'compliance_tools',         weight: 0.75, condition: null },
    { need: 'revops_tools',             weight: 0.70, condition: null },
    { need: 'series_a_capital',         weight: 0.60, condition: null },
    { need: 'channel_partners',         weight: 0.55, condition: null },
  ],
  expansion_signal: [
    { need: 'localization_support',     weight: 0.80, condition: null },
    { need: 'channel_partners',         weight: 0.75, condition: null },
    { need: 'growth_capital',           weight: 0.70, condition: null },
    { need: 'operations_talent',        weight: 0.60, condition: null },
  ],
  fundraising_signal: [
    { need: 'series_a_capital',         weight: 0.85, condition: null },
    { need: 'banker_advisor',           weight: 0.55, condition: null },
  ],
  investor_interest_signal: [
    { need: 'series_a_capital',         weight: 0.80, condition: null },
    { need: 'series_b_capital',         weight: 0.65, condition: null },
    { need: 'banker_advisor',           weight: 0.50, condition: null },
  ],
  product_signal: [
    { need: 'infra_tools',              weight: 0.65, condition: null },
    { need: 'dev_tools',               weight: 0.60, condition: null },
    { need: 'compliance_tools',         weight: 0.55, condition: null },
    { need: 'data_tools',              weight: 0.50, condition: null },
  ],
  regulatory_signal: [
    { need: 'compliance_tools',         weight: 0.90, condition: null },
    { need: 'banker_advisor',           weight: 0.55, condition: null },
    { need: 'strategic_partner',        weight: 0.50, condition: null },
  ],
  distress_signal: [
    { need: 'bridge_capital',           weight: 0.85, condition: null },
    { need: 'turnaround_support',       weight: 0.70, condition: null },
    { need: 'banker_advisor',           weight: 0.65, condition: null },
    { need: 'acquirer_interest',        weight: 0.60, condition: null },
  ],
  efficiency_signal: [
    { need: 'bridge_capital',           weight: 0.65, condition: null },
    { need: 'turnaround_support',       weight: 0.55, condition: null },
    { need: 'operations_talent',        weight: 0.45, condition: null },
  ],
  exit_signal: [
    { need: 'acquirer_interest',        weight: 0.90, condition: null },
    { need: 'banker_advisor',           weight: 0.85, condition: null },
    { need: 'strategic_partner',        weight: 0.60, condition: null },
  ],
  acquisition_signal: [
    { need: 'acquirer_interest',        weight: 0.95, condition: null },
    { need: 'banker_advisor',           weight: 0.90, condition: null },
  ],
  demand_signal: [
    { need: 'infra_tools',              weight: 0.70, condition: null },
    { need: 'sales_talent',             weight: 0.65, condition: null },
    { need: 'series_a_capital',         weight: 0.55, condition: null },
  ],
  revenue_signal: [
    { need: 'revops_tools',             weight: 0.70, condition: null },
    { need: 'growth_capital',           weight: 0.65, condition: null },
    { need: 'enterprise_sales_support', weight: 0.60, condition: null },
  ],
  partnership_signal: [
    { need: 'channel_partners',         weight: 0.80, condition: null },
    { need: 'strategic_partner',        weight: 0.80, condition: null },
    { need: 'implementation_support',   weight: 0.55, condition: null },
  ],
  buyer_pain_signal: [
    { need: 'automation_vendor',        weight: 0.80, condition: null },
    { need: 'robotics_vendor',          weight: 0.70, condition: null },
    { need: 'procurement_support',      weight: 0.65, condition: null },
    { need: 'pilot_partner',            weight: 0.70, condition: null },
  ],
  buyer_signal: [
    { need: 'pilot_partner',            weight: 0.85, condition: null },
    { need: 'systems_integrator',       weight: 0.75, condition: null },
    { need: 'automation_vendor',        weight: 0.75, condition: null },
    { need: 'procurement_support',      weight: 0.60, condition: null },
  ],
  buyer_budget_signal: [
    { need: 'pilot_partner',            weight: 0.90, condition: null },
    { need: 'systems_integrator',       weight: 0.85, condition: null },
    { need: 'automation_vendor',        weight: 0.80, condition: null },
    { need: 'implementation_support',   weight: 0.75, condition: null },
  ],
  market_position_signal: [
    { need: 'lead_generation',          weight: 0.60, condition: null },
    { need: 'strategic_partner',        weight: 0.55, condition: null },
  ],
};

// ─── TRAJECTORY → NEED MAPPING ────────────────────────────────────────────────
// Which trajectory types imply which additional needs on top of individual signals?
const TRAJECTORY_NEED_MAP = {
  fundraising: [
    { need: 'series_a_capital',         weight: 0.90 },
    { need: 'growth_capital',           weight: 0.75 },
    { need: 'banker_advisor',           weight: 0.60 },
  ],
  expansion: [
    { need: 'growth_capital',           weight: 0.80 },
    { need: 'channel_partners',         weight: 0.75 },
    { need: 'localization_support',     weight: 0.70 },
    { need: 'enterprise_sales_support', weight: 0.65 },
  ],
  product: [
    { need: 'compliance_tools',         weight: 0.70 },
    { need: 'infra_tools',              weight: 0.65 },
    { need: 'series_a_capital',         weight: 0.60 },
  ],
  buying: [
    { need: 'pilot_partner',            weight: 0.90 },
    { need: 'systems_integrator',       weight: 0.85 },
    { need: 'procurement_support',      weight: 0.75 },
    { need: 'implementation_support',   weight: 0.70 },
  ],
  distress: [
    { need: 'bridge_capital',           weight: 0.90 },
    { need: 'turnaround_support',       weight: 0.80 },
    { need: 'banker_advisor',           weight: 0.70 },
    { need: 'acquirer_interest',        weight: 0.65 },
  ],
  exit: [
    { need: 'acquirer_interest',        weight: 0.95 },
    { need: 'banker_advisor',           weight: 0.90 },
  ],
  repositioning: [
    { need: 'strategic_partner',        weight: 0.70 },
    { need: 'turnaround_support',       weight: 0.60 },
    { need: 'executive_search',         weight: 0.55 },
  ],
  growth: [
    { need: 'sales_talent',             weight: 0.75 },
    { need: 'revops_tools',             weight: 0.65 },
    { need: 'series_a_capital',         weight: 0.60 },
    { need: 'infra_tools',              weight: 0.55 },
  ],
  unknown: [],
};

// ─── URGENCY MODEL ────────────────────────────────────────────────────────────
// Urgency is derived from trajectory velocity, acceleration, and the need's
// natural urgency hint combined with signal confidence.
//
// IMPORTANT: confidence is blended rather than used as a pure multiplier.
// Pure multiplication collapses urgency to near-zero for low-confidence
// trajectories (e.g. 0.50 × 0.25 = 0.125 → 'low' for everything).
// Instead we blend toward a neutral anchor (0.45) based on confidence level,
// so a high-urgency need stays medium even when confidence is modest.
function computeUrgency(baseHint, velocityScore, acceleration, confidence) {
  const BASE    = { low: 0.25, medium: 0.50, high: 0.80 };
  const NEUTRAL = 0.45; // blend anchor when confidence is uncertain
  let score = BASE[baseHint] ?? 0.50;
  score += velocityScore * 0.20;
  if (acceleration === 'accelerating') score += 0.15;
  if (acceleration === 'decelerating') score -= 0.10;
  // Blend: confident signals pull fully to their score; uncertain signals
  // are pulled toward the neutral anchor proportionally.
  score = score * confidence + NEUTRAL * (1 - confidence);
  score = Math.max(0, Math.min(1, score));
  if (score >= 0.70) return 'high';
  if (score >= 0.40) return 'medium';
  return 'low';
}

// ─── MAIN: inferNeeds ─────────────────────────────────────────────────────────
/**
 * Infer canonical need classes from a signal history and trajectory report.
 *
 * Steps:
 *   1. Map each active signal class → candidate needs (with weights)
 *   2. Overlay trajectory-level needs
 *   3. Deduplicate and merge, summing weighted evidence
 *   4. Assign urgency, confidence, and explanations
 *   5. Sort by confidence × urgency
 *
 * @param {Array<{date, signal}>}  signalHistory
 * @param {TrajectoryReport}       trajectory      — from buildTrajectory()
 * @param {object}                 [options]
 * @param {number}                 [options.window_days=90]
 * @param {number}                 [options.min_confidence=0.35]   — filter threshold
 * @returns {Array<NeedObject>}
 */
function inferNeeds(signalHistory, trajectory, options = {}) {
  const windowDays    = options.window_days    ?? 90;
  const minConf       = options.min_confidence ?? 0.35;

  const velocityScore = trajectory?.velocity_score ?? 0.50;
  const acceleration  = trajectory?.acceleration   ?? 'stable';
  const trajectoryType = trajectory?.dominant_trajectory ?? 'unknown';

  // Accumulate need evidence: needClass → { totalWeight, count, signals, trajectoryBoost }
  const needEvidence = {};

  function bump(needClass, weight, fromType, signalClass = null) {
    if (!needEvidence[needClass]) {
      needEvidence[needClass] = { totalWeight: 0, count: 0, signals: [], trajectoryBoost: false };
    }
    needEvidence[needClass].totalWeight += weight;
    needEvidence[needClass].count       += 1;
    if (fromType === 'trajectory') needEvidence[needClass].trajectoryBoost = true;
    if (signalClass && !needEvidence[needClass].signals.includes(signalClass)) {
      needEvidence[needClass].signals.push(signalClass);
    }
  }

  // ── Step 1: Signal-level mapping ─────────────────────────────────────────
  const now    = Date.now();
  const cutoff = now - (windowDays * 24 * 60 * 60 * 1000);

  for (const entry of (signalHistory || [])) {
    if (new Date(entry.date).getTime() < cutoff) continue;
    const cls  = entry.signal?.primary_signal;
    const conf = entry.signal?.confidence ?? 0.5;
    if (!cls) continue;

    const mappings = SIGNAL_NEED_MAP[cls] || [];
    for (const { need, weight } of mappings) {
      bump(need, weight * conf, 'signal', cls);
    }
  }

  // ── Step 2: Trajectory-level mapping ──────────────────────────────────────
  const trajectoryNeeds = TRAJECTORY_NEED_MAP[trajectoryType] || [];
  for (const { need, weight } of trajectoryNeeds) {
    bump(need, weight * (trajectory?.trajectory_confidence ?? 0.5), 'trajectory', trajectoryType);
  }

  // Also apply from matched patterns with high match score
  for (const { pattern, match_score } of (trajectory?.matched_patterns || [])) {
    const patternNeeds = TRAJECTORY_NEED_MAP[pattern.type] || [];
    for (const { need, weight } of patternNeeds) {
      bump(need, weight * match_score * 0.5, 'pattern', pattern.id);
    }
  }

  // ── Step 3: Score, filter, rank ───────────────────────────────────────────
  const results = [];

  for (const [needClass, evidence] of Object.entries(needEvidence)) {
    const meta = NEED_CLASSES[needClass];
    if (!meta) continue;

    // Confidence: normalize accumulated weight by count, cap at 1.0
    // Trajectory boost adds a meaningful bump when trajectory also confirms
    const raw    = evidence.totalWeight / Math.max(evidence.count, 1);
    const boost  = evidence.trajectoryBoost ? 0.10 : 0;
    const confidence = Math.min(1.0, Math.round((raw + boost) * 100) / 100);

    if (confidence < minConf) continue;

    const urgency = computeUrgency(meta.urgency_hint, velocityScore, acceleration, confidence);

    results.push({
      need_class:      needClass,
      label:           meta.label,
      category:        meta.category,
      description:     meta.description,
      confidence,
      urgency,
      who_provides:    meta.who_provides,
      signal_sources:  evidence.signals,
      trajectory_boost: evidence.trajectoryBoost,
      evidence_count:  evidence.count,
    });
  }

  // ── Step 4: Sort by urgency × confidence ─────────────────────────────────
  const URGENCY_ORDER = { high: 3, medium: 2, low: 1 };
  results.sort((a, b) => {
    const urgDiff = (URGENCY_ORDER[b.urgency] || 0) - (URGENCY_ORDER[a.urgency] || 0);
    if (urgDiff !== 0) return urgDiff;
    return b.confidence - a.confidence;
  });

  return results;
}

// ─── NEED CATEGORIES ─────────────────────────────────────────────────────────
function groupNeedsByCategory(needs) {
  const groups = {};
  for (const need of needs) {
    const cat = need.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(need);
  }
  return groups;
}

// ─── DESCRIBE NEEDS ──────────────────────────────────────────────────────────
/**
 * Produce a human-readable summary of inferred needs — for the explanation layer.
 */
function describeNeeds(needs, options = {}) {
  const limit = options.limit ?? 5;
  const top   = needs.slice(0, limit);

  if (top.length === 0) return 'No significant needs inferred from available signals.';

  return top
    .map(n => `${n.label} (${n.urgency} urgency, ${Math.round(n.confidence * 100)}% confidence)`)
    .join('; ');
}

module.exports = {
  inferNeeds,
  groupNeedsByCategory,
  describeNeeds,
  NEED_CLASSES,
  SIGNAL_NEED_MAP,
  TRAJECTORY_NEED_MAP,
};
