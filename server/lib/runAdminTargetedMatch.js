'use strict';

/**
 * Admin-only: run targeted investor matches for a startup URL.
 * Returns up to 25 firm-deduped matches with strategy + contact (email included).
 */

const { getSupabaseClient } = require('./supabaseClient');
const { resolveInvestorEmail, investorHasContact } = require('../../lib/recentInvestorDeals');
const { normalizeWhyYouMatch } = require('../../lib/normalizeWhyYouMatch');

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 25;

function clampLimit(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)));
}

function whyBullets(raw) {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || '').trim()).filter(Boolean);
  }
  const joined = normalizeWhyYouMatch(raw);
  if (!joined) return [];
  return joined.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
}

function joinInvestor(row) {
  const inv = row?.investors;
  if (Array.isArray(inv)) return inv[0] || null;
  return inv && typeof inv === 'object' ? inv : null;
}

function shapeAdminMatch(row, rank) {
  const inv = joinInvestor(row) || {};
  const email = resolveInvestorEmail(inv);
  const bullets = whyBullets(row.why_you_match);
  return {
    rank,
    investor_id: row.investor_id || inv.id || null,
    match_score: Number(row.match_score) || 0,
    fit_rank: Number.isFinite(Number(row.fit_rank)) ? Number(row.fit_rank) : Number(row.match_score) || 0,
    confidence_level: row.confidence_level || null,
    strategy: {
      why_you_match: bullets,
      why_you_match_text: normalizeWhyYouMatch(row.why_you_match),
      reasoning: typeof row.reasoning === 'string' ? row.reasoning : null,
      investment_thesis:
        typeof inv.investment_thesis === 'string' ? inv.investment_thesis : null,
      fit_analysis: row.fit_analysis && typeof row.fit_analysis === 'object' ? row.fit_analysis : null,
    },
    contact: {
      email: email?.address || null,
      email_type: email?.type || null,
      email_status: inv.email_status || null,
      linkedin_url: inv.linkedin_url || null,
      twitter_url: inv.twitter_url || null,
      website: inv.url || null,
      contactable: investorHasContact(inv),
    },
    investor: {
      id: inv.id || null,
      name: inv.name || null,
      firm: inv.firm || null,
      type: inv.type || null,
      sectors: Array.isArray(inv.sectors) ? inv.sectors : [],
      stage: inv.stage || null,
      check_size_min: inv.check_size_min ?? null,
      check_size_max: inv.check_size_max ?? null,
      investor_tier: inv.investor_tier || null,
      total_investments: inv.total_investments ?? null,
      last_investment_date: inv.last_investment_date || null,
      photo_url: inv.photo_url || null,
    },
  };
}

async function resolveStartupViaInstantSubmit(url, { force = true, timeoutMs = 20000 } = {}) {
  const PORT = process.env.PORT || (process.env.FLY_APP_NAME ? 8080 : 3002);
  const INSTANT_URL = `http://127.0.0.1:${PORT}/api/instant/submit`;
  const res = await fetch(INSTANT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, force_generate: force === true }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 202) {
    const msg = body.message || body.error || `instant submit failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const startupId = body.startup_id || null;
  if (!startupId) {
    const err = new Error(body.message || body.error || 'No startup_id from instant submit');
    err.status = 502;
    throw err;
  }
  return {
    startup_id: startupId,
    queued: body.queued === true || body.status === 'queued',
    total_god_score: body.total_god_score ?? null,
    name: body.name || body.startup_name || null,
    website: body.website || url,
  };
}

/**
 * @param {{ url: string, limit?: number, force?: boolean, maxMs?: number }} opts
 */
async function runAdminTargetedMatch(opts = {}) {
  const url = String(opts.url || '').trim();
  if (!url) {
    const err = new Error('URL is required');
    err.status = 400;
    throw err;
  }
  const limit = clampLimit(opts.limit);
  const force = opts.force !== false;
  const maxMs = Number(opts.maxMs) > 0 ? Number(opts.maxMs) : 12000;

  const resolved = await resolveStartupViaInstantSubmit(url, { force });
  const supabase = getSupabaseClient();

  const { data: startup, error: sErr } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', resolved.startup_id)
    .maybeSingle();

  if (sErr || !startup) {
    const err = new Error(sErr?.message || 'Startup not found after submit');
    err.status = 404;
    throw err;
  }

  const instantSubmit = require('../routes/instantSubmit');
  const scoreStartupMatches = instantSubmit.scoreStartupMatches;
  const uploadRowToPlaceholderStartup = instantSubmit.uploadRowToPlaceholderStartup;
  if (typeof scoreStartupMatches !== 'function' || typeof uploadRowToPlaceholderStartup !== 'function') {
    const err = new Error('Matching engine unavailable');
    err.status = 503;
    throw err;
  }

  const { data: sigRow } = await supabase
    .from('startup_signal_scores')
    .select('signals_total')
    .eq('startup_id', startup.id)
    .maybeSingle();

  const signalTotal =
    sigRow?.signals_total != null && Number.isFinite(Number(sigRow.signals_total))
      ? Number(sigRow.signals_total)
      : null;

  const placeholder = uploadRowToPlaceholderStartup(startup.id, startup);
  const scored = await scoreStartupMatches(supabase, {
    startupId: startup.id,
    placeholderStartup: placeholder,
    signalTotal,
    maxMs,
    topN: limit,
  });

  if (scored?.error && !(scored.matches || []).length) {
    const err = new Error(scored.error);
    err.status = 500;
    throw err;
  }

  const matches = (scored?.matches || [])
    .slice(0, limit)
    .map((row, i) => shapeAdminMatch(row, i + 1));

  return {
    ok: true,
    limit,
    force,
    startup: {
      id: startup.id,
      name: startup.name || resolved.name || null,
      website: startup.website || resolved.website || url,
      sectors: Array.isArray(startup.sectors) ? startup.sectors : [],
      stage: startup.stage || null,
      total_god_score: startup.total_god_score ?? resolved.total_god_score,
      status: startup.status || null,
    },
    match_count: matches.length,
    engine_error: scored?.error || null,
    queued_on_submit: resolved.queued === true,
    matches,
  };
}

module.exports = {
  runAdminTargetedMatch,
  shapeAdminMatch,
  clampLimit,
  MAX_LIMIT,
  DEFAULT_LIMIT,
};
