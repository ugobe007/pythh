/**
 * GET /api/investors — browse investors with optional stage filter.
 *
 * Query params:
 *   stage   early | mid | late | angel | partner | all  (default: all)
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
const { scorePartnerAngelInvestor } = require('../../lib/partnerAngelInvestors');
const { getCanonicalSector } = require('../lib/sectorTaxonomy');

const router = express.Router();

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeStringArray(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizeSignupSectors(raw) {
  return normalizeStringArray(raw).map((sector) => {
    if (/material\s*science/i.test(sector)) return 'Materials';
    return getCanonicalSector(sector) || sector;
  });
}

function buildSignupPayload(body) {
  const email = normalizeEmail(body.email);
  const name = String(body.name || '').trim();
  if (!name) return { error: 'Name is required' };
  if (!isValidEmail(email)) return { error: 'Valid email is required' };

  const sectors = normalizeSignupSectors(body.sectors);
  const stage = normalizeStringArray(body.stage);
  const geography = normalizeStringArray(body.geography_focus ?? body.geography);

  let checkMin = body.check_size_min;
  let checkMax = body.check_size_max;
  if (checkMin != null && checkMin !== '') checkMin = Number(checkMin);
  else checkMin = null;
  if (checkMax != null && checkMax !== '') checkMax = Number(checkMax);
  else checkMax = null;

  return {
    payload: {
      name,
      email,
      firm: body.firm ? String(body.firm).trim() : null,
      title: body.title ? String(body.title).trim() : null,
      type: body.type ? String(body.type).trim() : 'VC',
      check_size_min: Number.isFinite(checkMin) ? checkMin : null,
      check_size_max: Number.isFinite(checkMax) ? checkMax : null,
      sectors,
      stage,
      geography_focus: geography.length > 0 ? geography : null,
      investment_thesis: body.investment_thesis ? String(body.investment_thesis).trim() : null,
      // inactive = pending review; public browse filters status = active
      status: 'inactive',
    },
  };
}

const SELECT_COLS =
  'id, name, firm, type, title, is_individual, sectors, stage, check_size_min, check_size_max, capital_type, investor_score, investor_tier, geography_focus, investment_thesis, linkedin_url, url, total_investments, updated_at';

const VALID_STAGES = new Set(['all', 'early', 'mid', 'late', 'angel', 'angels', 'partner', 'partners', 'growth']);

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
  const partner = scorePartnerAngelInvestor(row);
  return {
    id: row.id,
    name: row.name,
    firm: row.firm,
    type: row.type,
    title: row.title,
    sectors: row.sectors || [],
    stage: row.stage || [],
    check_size_min: row.check_size_min,
    check_size_max: row.check_size_max,
    investor_score: row.investor_score,
    investor_tier: row.investor_tier,
    geography_focus: row.geography_focus,
    investment_thesis: row.investment_thesis,
    linkedin_url: row.linkedin_url,
    url: row.url,
    total_investments: row.total_investments,
    stage_band: profile.band,
    is_angel: profile.isAngel,
    is_partner_angel: partner.isPartnerAngel,
    partner_angel_score: partner.score,
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
      allowed: ['all', 'early', 'mid', 'late', 'angel', 'partner', 'growth'],
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

/**
 * POST /api/investors/signup — anonymous investor intake (service role bypasses RLS).
 */
router.post('/signup', async (req, res) => {
  const built = buildSignupPayload(req.body || {});
  if (built.error) {
    return res.status(400).json({ error: built.error });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.error('[investors/signup] Supabase client:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { email } = built.payload;

    const { data: existing } = await supabase
      .from('investors')
      .select('id, status')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return res.json({
        success: true,
        investor_id: existing.id,
        existing: true,
        status: existing.status,
      });
    }

    const { data, error } = await supabase
      .from('investors')
      .insert(built.payload)
      .select('id, status')
      .single();

    if (error) {
      console.error('[investors/signup] insert error:', error.message, error.code, error.details);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      throw error;
    }

    return res.status(201).json({
      success: true,
      investor_id: data.id,
      status: data.status,
    });
  } catch (err) {
    console.error('[investors/signup] error:', err.message);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

/**
 * PATCH /api/investors/signup/:investorId — complete a partial (email-first) profile.
 * Requires matching email in body; only updates inactive intake records.
 */
router.patch('/signup/:investorId', async (req, res) => {
  const investorId = String(req.params.investorId || '').trim();
  if (!investorId) {
    return res.status(400).json({ error: 'Investor id is required' });
  }

  const built = buildSignupPayload(req.body || {});
  if (built.error) {
    return res.status(400).json({ error: built.error });
  }

  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.error('[investors/signup/patch] Supabase client:', e);
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const { email, ...profileFields } = built.payload;

    const { data: existing, error: fetchError } = await supabase
      .from('investors')
      .select('id, email, status')
      .eq('id', investorId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Investor profile not found' });
    }
    if (normalizeEmail(existing.email) !== email) {
      return res.status(403).json({ error: 'Email does not match this profile' });
    }
    if (existing.status !== 'inactive') {
      return res.status(409).json({ error: 'This profile can no longer be edited here' });
    }

    const { data, error } = await supabase
      .from('investors')
      .update(profileFields)
      .eq('id', investorId)
      .select('id, status')
      .single();

    if (error) {
      console.error('[investors/signup/patch] update error:', error.message, error.code, error.details);
      throw error;
    }

    return res.json({
      success: true,
      investor_id: data.id,
      status: data.status,
      updated: true,
    });
  } catch (err) {
    console.error('[investors/signup/patch] error:', err.message);
    return res.status(500).json({ error: 'Failed to update profile. Please try again.' });
  }
});

module.exports = router;
