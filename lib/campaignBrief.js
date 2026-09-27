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
  buildRaisePlan,
};
