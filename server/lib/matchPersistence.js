'use strict';

/**
 * Match persistence — reuse stored shortlists when a URL is resubmitted
 * unless the startup profile changed in a way that should change who matches.
 */

function normList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean))].sort();
  }
  const text = String(value || '').trim().toLowerCase();
  return text ? [text] : [];
}

function stageToken(startup) {
  const extracted =
    startup?.extracted_data && typeof startup.extracted_data === 'object'
      ? startup.extracted_data
      : {};
  if (extracted.funding_stage) return String(extracted.funding_stage).trim().toLowerCase();
  if (startup?.stage == null || startup.stage === '') return '';
  return String(startup.stage).trim().toLowerCase();
}

function boolToken(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return '1';
  if (value === false || value === 'false' || value === 0 || value === '0') return '0';
  return '';
}

/**
 * Stable key for the inputs that should change who we match.
 * Intentionally ignores scrape noise / GOD jitter.
 */
function buildMatchFingerprint(startup) {
  const extracted =
    startup?.extracted_data && typeof startup.extracted_data === 'object'
      ? startup.extracted_data
      : {};
  const payload = {
    sectors: normList(startup?.sectors),
    stage: stageToken(startup),
    funding_stage: String(extracted.funding_stage || '').trim().toLowerCase(),
    has_revenue: boolToken(extracted.has_revenue),
    has_product: boolToken(extracted.has_product),
    raise_priorities: normList(extracted.raise_priorities),
  };
  return JSON.stringify(payload);
}

function readStoredMatchFingerprint(startup) {
  const extracted =
    startup?.extracted_data && typeof startup.extracted_data === 'object'
      ? startup.extracted_data
      : {};
  const fp = extracted.match_fingerprint;
  return typeof fp === 'string' && fp.length ? fp : null;
}

/** True when stored matches were built for a different material profile. */
function isMatchFingerprintStale(startup) {
  const stored = readStoredMatchFingerprint(startup);
  if (!stored) return true;
  return stored !== buildMatchFingerprint(startup);
}

function materialMatchChange(startup, opts = {}) {
  if (opts.forceGenerate) return { material: true, reason: 'force' };
  if (opts.sectorRegenRequired) return { material: true, reason: 'sector_regen' };
  if (isMatchFingerprintStale(startup)) {
    return { material: true, reason: 'fingerprint_stale' };
  }
  return { material: false, reason: 'unchanged' };
}

async function persistMatchFingerprint(supabase, startupId, startup) {
  if (!supabase || !startupId || !startup) return;
  const fingerprint = buildMatchFingerprint(startup);
  const extracted =
    startup.extracted_data && typeof startup.extracted_data === 'object'
      ? { ...startup.extracted_data }
      : {};
  if (extracted.match_fingerprint === fingerprint) return fingerprint;
  extracted.match_fingerprint = fingerprint;
  extracted.match_fingerprint_at = new Date().toISOString();
  const { error } = await supabase
    .from('startup_uploads')
    .update({ extracted_data: extracted })
    .eq('id', startupId);
  if (error) {
    console.warn('[matchPersistence] fingerprint persist failed:', error.message);
    return null;
  }
  startup.extracted_data = extracted;
  return fingerprint;
}

/**
 * Load persisted suggested matches in the same join shape the sync engine returns.
 */
async function loadStoredSuggestedMatches(supabase, startupId, opts = {}) {
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 80;
  const select =
    opts.select ||
    `
    id, startup_id, investor_id, match_score, fit_analysis, confidence_level,
    reasoning, why_you_match, investment_thesis, status, created_at, updated_at,
    investors:investor_id (
      id, name, firm, type, url, website, linkedin_url, twitter_url,
      sectors, stage, check_size_min, check_size_max, investor_tier,
      total_investments, last_investment_date, photo_url, partners,
      investment_thesis, notable_investments, portfolio_companies,
      email_status, contactable
    )
  `;
  const { data, error } = await supabase
    .from('startup_investor_matches')
    .select(select)
    .eq('startup_id', startupId)
    .eq('status', 'suggested')
    .order('match_score', { ascending: false })
    .limit(limit);

  if (error) {
    return { matches: [], match_count: 0, error: error.message };
  }

  const matches = (data || []).map((row) => ({
    ...row,
    fit_rank: Number.isFinite(Number(row.fit_rank))
      ? Number(row.fit_rank)
      : Number(row.match_score) || 0,
    scored_by: 'stored',
  }));

  return { matches, match_count: matches.length, error: null };
}

module.exports = {
  buildMatchFingerprint,
  readStoredMatchFingerprint,
  isMatchFingerprintStale,
  materialMatchChange,
  persistMatchFingerprint,
  loadStoredSuggestedMatches,
};
