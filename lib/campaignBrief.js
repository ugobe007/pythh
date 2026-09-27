'use strict';

const STAGES = ['pre-seed', 'seed', 'series-a'];
const PRIORITIES = ['revenue', 'hire', 'customers', 'product'];

const STAGE_LABEL = {
  'pre-seed': 'pre-seed',
  seed: 'seed',
  'series-a': 'Series A',
};

const PROCEEDS = {
  revenue: 'Reach revenue',
  hire: 'Hire the team',
  customers: 'Pick up customers',
  product: 'Ship the next version',
};

function parseCampaignBrief(body = {}) {
  const stage = STAGES.includes(body.funding_stage) ? body.funding_stage : null;
  const hasRevenue = body.has_revenue === true ? true : body.has_revenue === false ? false : null;
  const hasProduct = body.has_product === true ? true : body.has_product === false ? false : null;
  const priorities = [...new Set(
    (Array.isArray(body.raise_priorities) ? body.raise_priorities : [])
      .filter((item) => PRIORITIES.includes(item)),
  )];
  return { stage, hasRevenue, hasProduct, priorities };
}

function campaignIsActionable(brief) {
  return Boolean(brief?.stage) || brief?.hasRevenue != null || brief?.hasProduct != null || (brief?.priorities?.length > 0);
}

function stageNumber(stage) {
  if (stage === 'pre-seed') return 0;
  if (stage === 'seed') return 1;
  if (stage === 'series-a') return 2;
  return null;
}

function mergeCampaignExtracted(existing, brief) {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  if (brief.stage) base.funding_stage = brief.stage;
  if (brief.hasRevenue != null) base.has_revenue = brief.hasRevenue;
  if (brief.hasProduct != null) base.has_product = brief.hasProduct;
  if (brief.priorities.length) base.raise_priorities = brief.priorities;
  return base;
}

function campaignColumns(body, existingExtracted) {
  const brief = parseCampaignBrief(body);
  if (!campaignIsActionable(brief)) return null;
  const columns = { extracted_data: mergeCampaignExtracted(existingExtracted, brief) };
  const stage = stageNumber(brief.stage);
  if (stage != null) columns.stage = stage;
  return columns;
}

const PRIORITY_TERMS = {
  revenue: ['monetization', 'commercial', 'sales'],
  hire: ['hiring', 'recruiting', 'talent', 'operators'],
  customers: ['acquisition', 'distribution', 'go-to-market', 'customers'],
  product: ['technical', 'engineering', 'prototype'],
};

function prioritySearchTerms(priorities) {
  return [...new Set((Array.isArray(priorities) ? priorities : []).flatMap((priority) => PRIORITY_TERMS[priority] || []))];
}

function thesisHasTerm(thesis, term) {
  const escaped = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(thesis);
}

function campaignBriefFromStartup(startup = {}) {
  const extracted = startup.extracted_data && typeof startup.extracted_data === 'object'
    ? startup.extracted_data
    : {};
  return parseCampaignBrief({
    funding_stage: extracted.funding_stage,
    has_revenue: extracted.has_revenue,
    has_product: extracted.has_product,
    raise_priorities: extracted.raise_priorities,
  });
}

function investorFromMatchRow(row) {
  if (row?.investor) return row.investor;
  const joined = row?.investors;
  return Array.isArray(joined) ? joined[0] : joined;
}

/** Extra rank from the founder's answers. This is not a GOD weight change. */
function campaignFitDelta(startup, investor) {
  const brief = campaignBriefFromStartup(startup);
  if (!campaignIsActionable(brief) || !investor) return 0;
  const thesis = [
    investor.investment_thesis,
    investor.firm,
    investor.name,
    ...(Array.isArray(investor.sectors) ? investor.sectors : []),
    ...(Array.isArray(investor.stage) ? investor.stage : [investor.stage]),
  ].filter(Boolean).join(' ').toLowerCase();
  let delta = 0;
  let priorityHits = 0;
  for (const priority of brief.priorities) {
    if ((PRIORITY_TERMS[priority] || []).some((term) => thesisHasTerm(thesis, term))) {
      delta += 90;
      priorityHits += 1;
    }
  }
  // Common words like "team" and "product" used to boost every fund the same amount,
  // so the five names never moved. A real priority hit has to outrank that.
  if (brief.priorities.length && priorityHits === 0) delta -= 70;
  if (brief.hasRevenue === false && /\bpre-seed\b|\bpre-revenue\b|\bangel\b/.test(thesis)) delta += 12;
  if (brief.hasRevenue === true && /\brevenue\b|\bseries a\b|\bgrowth\b/.test(thesis)) delta += 12;
  if (brief.hasProduct === false && /\bpre-product\b|\bprototype\b|\bidea\b/.test(thesis)) delta += 8;
  if (brief.hasProduct === true && /\bproduct\b|\blaunch\b/.test(thesis)) delta += 8;
  try {
    const { evaluateFundingLifecycleFit } = require('./fundingLifecycleFit');
    const fit = evaluateFundingLifecycleFit(startup, investor);
    if (fit.eligible === false) delta -= 60;
    else if (fit.level === 'exact') delta += 18;
  } catch {
    /* stage fit optional */
  }
  return delta;
}

function applyCampaignRank(startup, rows) {
  const brief = campaignBriefFromStartup(startup);
  if (!campaignIsActionable(brief) || !Array.isArray(rows)) return false;
  for (const row of rows) {
    const investor = investorFromMatchRow(row);
    row.fit_rank = Math.round(((Number(row.fit_rank) || 0) + campaignFitDelta(startup, investor)) * 10) / 10;
  }
  return true;
}

function retainCampaignExtracted(previous, next) {
  const prev = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  const out = next && typeof next === 'object' && !Array.isArray(next) ? { ...next } : {};
  if (STAGES.includes(prev.funding_stage)) out.funding_stage = prev.funding_stage;
  if (typeof prev.has_revenue === 'boolean') out.has_revenue = prev.has_revenue;
  if (typeof prev.has_product === 'boolean') out.has_product = prev.has_product;
  if (Array.isArray(prev.raise_priorities) && prev.raise_priorities.length) {
    out.raise_priorities = prev.raise_priorities.filter((item) => PRIORITIES.includes(item));
  }
  return out;
}

/** Preview can rank from the request when the saved row has not caught up. */
function overlayCampaignQuery(startup, query = {}) {
  const rawPriorities = query.raise_priorities;
  const priorities = Array.isArray(rawPriorities)
    ? rawPriorities
    : typeof rawPriorities === 'string'
      ? rawPriorities.split(',').map((item) => item.trim()).filter(Boolean)
      : [];
  const body = {
    funding_stage: query.funding_stage,
    has_revenue: query.has_revenue === true || query.has_revenue === 'true'
      ? true
      : query.has_revenue === false || query.has_revenue === 'false'
        ? false
        : null,
    has_product: query.has_product === true || query.has_product === 'true'
      ? true
      : query.has_product === false || query.has_product === 'false'
        ? false
        : null,
    raise_priorities: priorities,
  };
  const brief = parseCampaignBrief(body);
  if (!campaignIsActionable(brief)) return startup || {};
  const columns = campaignColumns(body, startup?.extracted_data);
  if (!columns) return startup || {};
  return { ...(startup || {}), ...columns };
}

function buildRaisePlan(brief = {}) {
  const round = STAGE_LABEL[brief.stage] || 'this round';
  const proceeds = (brief.priorities || []).map((item) => PROCEEDS[item]).filter(Boolean);
  return {
    round,
    proof: brief.hasRevenue
      ? 'The company has revenue. Put that number on one slide.'
      : 'The company does not have revenue yet. The round is to get there, not to invent a number.',
    product: brief.hasProduct
      ? 'There is a working product.'
      : 'There is not a working product yet.',
    proceeds,
  };
}

module.exports = {
  STAGES,
  PRIORITIES,
  PROCEEDS,
  parseCampaignBrief,
  campaignIsActionable,
  stageNumber,
  mergeCampaignExtracted,
  campaignColumns,
  campaignBriefFromStartup,
  campaignFitDelta,
  applyCampaignRank,
  prioritySearchTerms,
  retainCampaignExtracted,
  overlayCampaignQuery,
  buildRaisePlan,
};
