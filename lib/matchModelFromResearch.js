'use strict';

/**
 * Turn funding research into a per-investor match model, then rank with it.
 *
 * Research writes observed aspects and round economics. This module analyzes
 * those rows and stores the result on investors.signals.match_model.
 * Preview reads that model. GOD weights are not changed.
 */

const { campaignBriefFromStartup } = require('./campaignBrief');
const { GENERIC_SECTORS, sectorList } = require('./distinctiveInvestorFit');
const { getStartupFundingStage } = require('./fundingLifecycleFit');

const MATCH_MODEL_VERSION = 'match-model-v1';
const MAX_EVENT_IDS = 40;
const MAX_AMOUNTS = 24;
const MAX_SECTOR_KEYS = 12;

const ASPECT_PRIORITY = {
  revenue_growth: 'revenue',
  customer_growth: 'customers',
  customer_access_partnership: 'customers',
  partners: 'customers',
  hiring: 'hire',
  board: 'hire',
  unique_tech: 'product',
  product_rev: 'product',
  product_market_fit: 'product',
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeRound(raw) {
  const key = String(raw || '').toLowerCase().replace(/[_\s]+/g, '-').trim();
  if (!key) return null;
  if (key === 'preseed' || key === 'pre-seed' || key === 'angel') return 'pre-seed';
  if (key === 'seed') return 'seed';
  if (key === 'series-a' || key === 'seriesa' || key === 'a') return 'series-a';
  if (key === 'series-b' || key === 'b') return 'series-b';
  if (key === 'series-c' || key === 'c') return 'series-c';
  if (key === 'growth' || key === 'late') return 'growth';
  return null;
}

function median(values) {
  const nums = (values || []).map(Number).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2) return nums[mid];
  return Math.round((nums[mid - 1] + nums[mid]) / 2);
}

function topKeys(counts, limit) {
  return Object.entries(counts || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key);
}

function aspectCountsFromObserved(observedThesis) {
  const aspects = asObject(asObject(observedThesis).aspects);
  const counts = {};
  for (const [id, row] of Object.entries(aspects)) {
    const count = Number(row?.count) || 0;
    if (count > 0 && ASPECT_PRIORITY[id]) counts[id] = count;
  }
  return counts;
}

function prioritiesFromAspects(aspectCounts) {
  const totals = {};
  for (const [aspect, count] of Object.entries(aspectCounts || {})) {
    const priority = ASPECT_PRIORITY[aspect];
    if (!priority) continue;
    totals[priority] = (totals[priority] || 0) + count;
  }
  return topKeys(totals, 3);
}

function specificSectors(counts) {
  const filtered = {};
  for (const [sector, count] of Object.entries(counts || {})) {
    const key = String(sector || '').trim();
    if (!key || GENERIC_SECTORS.has(key.toLowerCase())) continue;
    filtered[key] = count;
  }
  return filtered;
}

/**
 * Fold one batch of researched rounds into the investor's match model.
 * The same event id is counted once. Aspect counts from observed thesis
 * replace the previous aspect rollup when present.
 */
function foldMatchModel(previous, { aspectCounts, events, updatedAt } = {}) {
  const prior = asObject(previous);
  const seen = new Set(Array.isArray(prior.event_ids) ? prior.event_ids : []);
  const amounts = Array.isArray(prior.amounts) ? prior.amounts.filter((n) => Number(n) > 0) : [];
  const stageCounts = { ...asObject(prior.stage_counts) };
  const sectorCounts = { ...asObject(prior.sector_counts) };
  let added = 0;

  for (const event of Array.isArray(events) ? events : []) {
    const id = String(event?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    added += 1;
    const amount = Number(event.amount_usd);
    if (amount > 0) amounts.push(Math.round(amount));
    const stage = normalizeRound(event.round_type);
    if (stage) stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    for (const sector of sectorList(event.sectors)) {
      if (GENERIC_SECTORS.has(sector)) continue;
      const label = String(sector);
      sectorCounts[label] = (sectorCounts[label] || 0) + 1;
    }
  }

  const nextAspects = aspectCounts && Object.keys(aspectCounts).length
    ? { ...aspectCounts }
    : { ...asObject(prior.aspect_counts) };
  const eventIds = [...seen].slice(-MAX_EVENT_IDS);
  const keptAmounts = amounts.slice(-MAX_AMOUNTS);
  const keptSectors = {};
  for (const key of topKeys(specificSectors(sectorCounts), MAX_SECTOR_KEYS)) {
    keptSectors[key] = sectorCounts[key];
  }

  const model = {
    version: MATCH_MODEL_VERSION,
    updated_at: updatedAt || new Date().toISOString(),
    event_count: seen.size,
    event_ids: eventIds,
    amounts: keptAmounts,
    median_amount_usd: median(keptAmounts),
    stage_counts: stageCounts,
    stages: topKeys(stageCounts, 4),
    sector_counts: keptSectors,
    sectors: topKeys(keptSectors, 5),
    aspect_counts: nextAspects,
    priorities: prioritiesFromAspects(nextAspects),
  };
  return { model, added };
}

function modelFromSignals(signals) {
  return asObject(asObject(signals).match_model);
}

/**
 * Extra preview rank from what this investor has actually funded.
 * Investors with no research model are left alone.
 */
function researchFitDelta(startup, investor) {
  const model = modelFromSignals(investor?.signals);
  if (!model || !(Number(model.event_count) > 0)) return 0;

  let delta = 0;
  const brief = campaignBriefFromStartup(startup || {});
  const stage = brief.stage || getStartupFundingStage(startup || {});
  if (stage && (model.stages || []).includes(stage)) delta += 22;

  const startupSectors = new Set(sectorList(startup?.sectors).filter((sector) => !GENERIC_SECTORS.has(sector)));
  const learnedSectors = sectorList(model.sectors);
  if ([...startupSectors].some((sector) => learnedSectors.includes(sector))) delta += 40;

  const wanted = Array.isArray(brief.priorities) ? brief.priorities : [];
  const learned = Array.isArray(model.priorities) ? model.priorities : [];
  if (wanted.length && learned.length) {
    const hits = wanted.filter((priority) => learned.includes(priority)).length;
    if (hits) delta += 48 * Math.min(hits, 2);
    else delta -= 24;
  }
  return delta;
}

function investorFromMatchRow(row) {
  if (row?.investor) return row.investor;
  const joined = row?.investors;
  return Array.isArray(joined) ? joined[0] : joined;
}

function applyResearchRank(startup, rows) {
  if (!Array.isArray(rows) || !rows.length) return false;
  let touched = false;
  for (const row of rows) {
    const investor = investorFromMatchRow(row);
    const delta = researchFitDelta(startup, investor);
    if (!delta) continue;
    touched = true;
    row.fit_rank = Math.round(((Number(row.fit_rank) || 0) + delta) * 10) / 10;
  }
  return touched;
}

function withMatchModel(signals, model) {
  return { ...asObject(signals), match_model: model };
}

module.exports = {
  MATCH_MODEL_VERSION,
  ASPECT_PRIORITY,
  aspectCountsFromObserved,
  foldMatchModel,
  researchFitDelta,
  applyResearchRank,
  withMatchModel,
};
