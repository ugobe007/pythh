/**
 * GET /api/investors — browse investors with optional stage filter.
 *
 * Query params:
 *   stage   early | mid | late | angel | all  (default: all)
 *   sector  optional sector substring / canonical match
 *   limit   1–100 (default 25)
 *   offset  pagination offset (default 0)
 *   sort    score | name (default score)
 */

const express = require('express');
const { getSupabaseClient } = require('../lib/supabaseClient');
const { isNonInvestorAggregator } = require('../../lib/investorAggregatorBlocklist');
const {
  investorMatchesStageFilter,
  buildInvestorStageDbOrFilter,
  getInvestorStageProfile,
} = require('../../lib/stageInvestorFit');
const { getCanonicalSector } = require('../lib/sectorTaxonomy');

const router = express.Router();

const SELECT_COLS =
  'id, name, firm, type, sectors, stage, check_size_min, check_size_max, capital_type, investor_score, investor_tier, geography_focus, investment_thesis, linkedin_url, website, total_investments, updated_at';

const VALID_STAGES = new Set(['all', 'early', 'mid', 'late', 'angel', 'angels', 'growth']);

function normalizeSectorFilter(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  return getCanonicalSector(s) || s;
}

function investorMatchesSector(investor, sectorFilter) {
  if (!sectorFilter) return true;
  const needle = sectorFilter.toLowerCase();
  const sectors = Array.isArray(investor.sectors) ? investor.sectors : [];
  return sectors.some((sec) => {
    const canonical = getCanonicalSector(sec) || sec;
    const hay = `${sec} ${canonical}`.toLowerCase();
    return hay.includes(needle) || needle.includes(String(sec).toLowerCase());
  });
}

function sortInvestors(rows, sort) {
  if (sort === 'name') {
    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  return rows.sort((a, b) => (Number(b.investor_score) || 0) - (Number(a.investor_score) || 0));
}

function shapeInvestor(row) {
  const profile = getInvestorStageProfile(row);
  return {
    id: row.id,
    name: row.name,
    firm: row.firm,
    type: row.type,
    sectors: row.sectors || [],
    stage: row.stage || [],
    check_size_min: row.check_size_min,
    check_size_max: row.check_size_max,
    investor_score: row.investor_score,
    investor_tier: row.investor_tier,
    geography_focus: row.geography_focus,
    investment_thesis: row.investment_thesis,
    linkedin_url: row.linkedin_url,
    website: row.website,
    total_investments: row.total_investments,
    stage_band: profile.band,
    is_angel: profile.isAngel,
  };
}

router.get('/', async (req, res) => {
  const stageParam = String(req.query.stage || 'all').toLowerCase().trim();
  const sectorParam = normalizeSectorFilter(req.query.sector);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
  const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);
  const sort = String(req.query.sort || 'score').toLowerCase() === 'name' ? 'name' : 'score';

  if (!VALID_STAGES.has(stageParam)) {
    return res.status(400).json({
      error: 'Invalid stage',
      allowed: ['all', 'early', 'mid', 'late', 'angel', 'growth'],
    });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.error('[investors] Supabase client:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const stageFilter = stageParam === 'growth' ? 'late' : stageParam;
    const dbOr = buildInvestorStageDbOrFilter(stageFilter);
    const fetchLimit = stageFilter === 'all' && !sectorParam ? limit : 2500;

    let query = supabase
      .from('investors')
      .select(SELECT_COLS)
      .eq('status', 'active')
      .order('investor_score', { ascending: false, nullsFirst: false })
      .limit(fetchLimit);

    if (dbOr) query = query.or(dbOr);

    const { data, error } = await query;
    if (error) throw error;

    let rows = (data || []).filter((inv) => !isNonInvestorAggregator(inv));
    if (stageFilter !== 'all') {
      rows = rows.filter((inv) => investorMatchesStageFilter(inv, stageFilter));
    }
    if (sectorParam) {
      rows = rows.filter((inv) => investorMatchesSector(inv, sectorParam));
    }

    sortInvestors(rows, sort);
    const total = rows.length;
    const page = rows.slice(offset, offset + limit).map(shapeInvestor);

    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    return res.json({
      investors: page,
      total,
      limit,
      offset,
      stage: stageFilter,
      sector: sectorParam || null,
    });
  } catch (err) {
    console.error('[investors] list error:', err.message);
    return res.status(500).json({ error: 'Failed to load investors' });
  }
});

module.exports = router;
