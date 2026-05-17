/**
 * Hot GOD from startup_uploads row — SSOT for row → calculateHotScore → DB columns.
 *
 * Kept in sync with scripts/recalculate-scores.ts (batch). Request paths (instant, deck)
 * import from here only — do not fork mapping or divisor math in route files.
 */

'use strict';

let calculateHotScore;
try {
  const scoring = require('../services/startupScoringService.ts');
  calculateHotScore = scoring.calculateHotScore;
} catch (e) {
  console.warn('[hotGodFromStartupRow] startupScoringService.ts unavailable; using stub.', e.message);
  calculateHotScore = () => ({
    total: 5.5,
    breakdown: {
      team_execution: 1,
      team_age: 1,
      market: 1,
      market_insight: 1,
      traction: 1,
      product: 1,
      product_vision: 1,
    },
    psychological_multiplier: 0,
    enhanced_total: null,
    psychological_signals: { fomo: 0, conviction: 0, urgency: 0, risk: 0 },
  });
}

/**
 * Transform a startup_uploads row (+ optional faithSignals, etc.) for calculateHotScore.
 * Mirrors scripts/recalculate-scores.ts toScoringProfile (Feb 2026).
 */
function toScoringProfileFromStartupUpload(startup) {
  const extracted = startup.extracted_data || {};

  const fundingConfidence = startup.funding_confidence || 0;
  const tractionConfidence = startup.traction_confidence || 0;

  const parsedRevenue = tractionConfidence >= 0.35 ? startup.arr_usd || startup.revenue_usd || 0 : 0;
  const parsedCustomers = startup.parsed_customers || 0;
  const parsedUsers = startup.parsed_users || 0;

  const parsedFunding = fundingConfidence >= 0.35 ? startup.last_round_amount_usd || startup.total_funding_usd || 0 : 0;
  const parsedBurn = fundingConfidence >= 0.4 ? startup.burn_monthly_usd || 0 : 0;
  const parsedRunway = fundingConfidence >= 0.4 ? startup.runway_months || 0 : 0;

  const parsedHasRevenue = parsedRevenue > 0;
  const parsedHasCustomers = parsedCustomers > 0;

  const base = { ...startup, ...extracted };

  return {
    ...base,

    tagline: startup.tagline || extracted.tagline,
    pitch: startup.description || startup.pitch || extracted.pitch || extracted.description,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    market_size: startup.market_size || extracted.market_size,
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    team: startup.team_companies
      ? startup.team_companies.map((c) => ({
          name: 'Team Member',
          previousCompanies: [c],
        }))
      : extracted.team || [],
    founders_count: (() => {
      const ts = startup.team_size || extracted.team_size || null;
      const explicit = extracted.founders_count || null;
      if (explicit) return explicit;
      if (ts && ts <= 10) return ts;
      return 1;
    })(),
    team_size: startup.team_size || extracted.team_size || extracted.team?.team_size || null,
    technical_cofounders:
      (startup.has_technical_cofounder ? 1 : 0) || (extracted.has_technical_cofounder ? 1 : 0),

    mrr: startup.mrr || extracted.mrr,
    revenue: parsedRevenue || startup.arr || startup.revenue || extracted.revenue || extracted.arr,
    growth_rate: startup.growth_rate_monthly || extracted.growth_rate || extracted.growth_rate_monthly,
    customers: parsedCustomers || startup.customer_count || extracted.customers || extracted.customer_count,
    active_users: parsedUsers || extracted.active_users || extracted.users,
    gmv: extracted.gmv,
    retention_rate: extracted.retention_rate,
    churn_rate: extracted.churn_rate,
    prepaying_customers: extracted.prepaying_customers,
    signed_contracts: extracted.signed_contracts,

    has_revenue:
      parsedHasRevenue ||
      startup.has_revenue ||
      extracted.has_revenue ||
      (tractionConfidence >= 0.7 && !startup.has_revenue && !extracted.has_revenue),
    has_customers:
      parsedHasCustomers ||
      startup.has_customers ||
      extracted.has_customers ||
      tractionConfidence >= 0.5,
    execution_signals: extracted.execution_signals || [],
    team_signals: extracted.team_signals || [],
    funding_amount: parsedFunding || extracted.funding_amount,
    funding_stage: extracted.funding_stage,

    previous_funding:
      parsedFunding || startup.previous_funding || extracted.previous_funding || extracted.funding_amount,
    burn_rate: parsedBurn || startup.burn_rate || extracted.burn_rate,
    runway_months: parsedRunway || startup.runway_months || extracted.runway_months,

    launched: startup.is_launched || extracted.is_launched || extracted.launched,
    demo_available: startup.has_demo || extracted.has_demo || extracted.demo_available,
    self_use: extracted.self_use || startup.self_use || false,
    unique_ip: extracted.unique_ip,
    defensibility: extracted.defensibility,
    mvp_stage: extracted.mvp_stage,

    founded_date: startup.founded_date || startup.created_at || extracted.founded_date,
    value_proposition: startup.value_proposition || startup.tagline || extracted.value_proposition,
    backed_by: startup.backed_by || extracted.backed_by || extracted.investors,

    has_blog: extracted.web_signals?.blog?.found ?? false,
    blog_post_count: extracted.web_signals?.blog?.post_count_estimate ?? 0,
    days_since_blog_post: extracted.web_signals?.blog?.days_since_last_post ?? null,
    tier1_press_count: extracted.web_signals?.press_tier?.tier1_count ?? 0,
    tier2_press_count: extracted.web_signals?.press_tier?.tier2_count ?? 0,
    press_wire_count: extracted.web_signals?.press_tier?.pr_wire_count ?? 0,
    press_total:
      extracted.web_signals?.press_tier?.total ?? extracted.social_signals?.news_count ?? 0,
    reddit_mentions: extracted.web_signals?.reddit?.mention_count ?? 0,
    reddit_positive: extracted.web_signals?.reddit?.positive_count ?? 0,
    reddit_negative: extracted.web_signals?.reddit?.negative_count ?? 0,
  };
}

function breakdownFromHotResult(result) {
  const total = Math.round(result.total * 10);
  const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
  const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);

  return {
    team_score: Math.min(Math.round((teamCombined / 4.0) * 100), 100),
    traction_score: Math.min(Math.round(((result.breakdown.traction || 0) / 3.0) * 100), 100),
    market_score: Math.min(Math.round((marketCombined / 3.5) * 100), 100),
    product_score: Math.min(Math.round(((result.breakdown.product || 0) / 2.0) * 100), 100),
    vision_score: Math.min(Math.round(((result.breakdown.product_vision || 0) / 2.0) * 100), 100),
    total_god_score: total,
    psychological_multiplier: result.psychological_multiplier || 0,
    enhanced_god_score: result.enhanced_total ? Math.round(result.enhanced_total * 10) : total,
    psychological_signals: result.psychological_signals || {
      fomo: 0,
      conviction: 0,
      urgency: 0,
      risk: 0,
    },
  };
}

/**
 * Six columns used by instant submit / deck upload DB writes.
 */
function calculateGodScoreColumnsFromStartup(startup) {
  const profile = toScoringProfileFromStartupUpload(startup);
  const result = calculateHotScore(profile);
  const b = breakdownFromHotResult(result);
  return {
    team_score: b.team_score,
    traction_score: b.traction_score,
    market_score: b.market_score,
    product_score: b.product_score,
    vision_score: b.vision_score,
    total_god_score: b.total_god_score,
  };
}

/**
 * Full batch shape (recalculate-scores ScoreBreakdown), one HotScore call.
 */
function calculateGodScoreBreakdownFromStartup(startup) {
  const profile = toScoringProfileFromStartupUpload(startup);
  const result = calculateHotScore(profile);
  return breakdownFromHotResult(result);
}

module.exports = {
  toScoringProfileFromStartupUpload,
  calculateGodScoreColumnsFromStartup,
  calculateGodScoreBreakdownFromStartup,
};
