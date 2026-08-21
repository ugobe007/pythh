/**
 * Freeze an immutable top-5 prediction set for Hit@5 claim evaluation.
 *
 * Product thesis: Pythh matches startups to investors who will invest.
 * Live ranking may change; these rows must not. Upserts use ignoreDuplicates
 * so rematch / re-score cannot rewrite history.
 *
 * predicted_at = min(source match created_at) for the frozen set (prediction clock).
 */
'use strict';

const {
  isPlausibleInvestorEntityName,
  isServeGradeStartupIdentity,
} = require('./fundingEvidenceLedger');
const { isGarbageInvestorName, isHardJunkInvestorName } = require('../../lib/investorNameHeuristics');

const SERVED_COHORT_KEY = 'served-first-top5';
const DEFAULT_MODEL_VERSION = 'v3.5-instant-submit';

function canonicalFirm(row) {
  return String(row.firm || row.name || '')
    .toLowerCase()
    .replace(/\b(?:ventures?|capital|partners?|management|fund|holdings?)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isEligibleFirmInvestor(row) {
  const label = String(row.firm || row.name || '').trim();
  const type = `${row.type || ''} ${row.investor_type || ''}`;
  const firmTyped = /\b(?:vc|pe|venture|corporate|accelerator|family.?office|growth|hedge|fund)\b/i.test(type);
  const personTyped = /\b(?:individual|person|founder)\b/i.test(type)
    || (/\bangel\b/i.test(String(row.type || '')) && !firmTyped);
  return row
    && row.is_individual !== true
    && !(personTyped && !firmTyped)
    && isPlausibleInvestorEntityName(label)
    && !isGarbageInvestorName(label)
    && !isHardJunkInvestorName(label);
}

async function fetchInvestorsByIds(supabase, ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const { data, error } = await supabase
      .from('investors')
      .select('id,name,firm,type,investor_type,is_individual')
      .in('id', chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchMemberships(supabase, ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const { data, error } = await supabase
      .from('investor_organization_memberships')
      .select('investor_id,organization_id')
      .in('investor_id', chunk);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

/**
 * @param {object} opts
 * @param {import('@supabase/supabase-js').SupabaseClient} opts.supabase
 * @param {string} opts.startupId
 * @param {string} [opts.cohortKey]
 * @param {'served_impression'|'prospective_shadow'} [opts.predictionKind]
 * @param {string} [opts.modelVersionFallback]
 * @param {boolean} [opts.requirePredictionGradeStartup]
 * @returns {Promise<{ frozen: boolean, reason?: string, rows?: number, predicted_at?: string }>}
 */
async function freezeTopFiveIfAbsent({
  supabase,
  startupId,
  cohortKey = SERVED_COHORT_KEY,
  predictionKind = 'served_impression',
  modelVersionFallback = DEFAULT_MODEL_VERSION,
  requirePredictionGradeStartup = true,
} = {}) {
  if (!supabase || !startupId) {
    return { frozen: false, reason: 'missing_args' };
  }

  const { data: existing, error: existingErr } = await supabase
    .from('funding_prediction_snapshots')
    .select('id')
    .eq('cohort_key', cohortKey)
    .eq('startup_id', startupId)
    .limit(1);
  if (existingErr) throw existingErr;
  if (existing?.length) {
    return { frozen: false, reason: 'already_frozen' };
  }

  const { data: startup, error: suErr } = await supabase
    .from('startup_uploads')
    .select('id,name,website,company_domain,source_type,entity_gate,status,description,total_god_score')
    .eq('id', startupId)
    .maybeSingle();
  if (suErr) throw suErr;
  if (!startup) return { frozen: false, reason: 'startup_not_found' };
  if (startup.entity_gate === 'junk') return { frozen: false, reason: 'junk_startup' };
  if (requirePredictionGradeStartup && !isServeGradeStartupIdentity(startup)) {
    return { frozen: false, reason: 'not_serve_grade_identity' };
  }

  const { data: matches, error: matchErr } = await supabase
    .from('startup_investor_matches')
    .select('id,startup_id,investor_id,match_score,algorithm_version,created_at,updated_at,status')
    .eq('startup_id', startupId)
    .eq('status', 'suggested')
    .order('match_score', { ascending: false })
    .limit(80);
  if (matchErr) throw matchErr;
  if (!matches?.length) return { frozen: false, reason: 'no_matches' };

  const investorIds = [...new Set(matches.map((m) => m.investor_id))];
  const [investors, memberships] = await Promise.all([
    fetchInvestorsByIds(supabase, investorIds),
    fetchMemberships(supabase, investorIds),
  ]);
  const investorById = new Map(investors.map((r) => [r.id, r]));
  const organizationByInvestor = new Map(memberships.map((r) => [r.investor_id, r.organization_id]));

  const seenFirms = new Set();
  const unique = [];
  for (const match of matches) {
    const investor = investorById.get(match.investor_id) || {};
    if (!isEligibleFirmInvestor(investor)) continue;
    const firmKeys = [
      organizationByInvestor.get(match.investor_id)
        ? `organization:${organizationByInvestor.get(match.investor_id)}`
        : null,
      `label:${canonicalFirm(investor)}`,
    ].filter((key) => key && key !== 'label:');
    if (!firmKeys.length || firmKeys.some((key) => seenFirms.has(key))) continue;
    firmKeys.forEach((key) => seenFirms.add(key));
    unique.push(match);
    if (unique.length === 5) break;
  }
  if (unique.length !== 5) {
    return { frozen: false, reason: 'incomplete_top_five', rows: unique.length };
  }

  const predictedAtMs = Math.min(
    ...unique.map((m) => new Date(m.created_at || m.updated_at || Date.now()).getTime()),
  );
  const predictedAt = new Date(predictedAtMs).toISOString();
  const god = Number(startup.total_god_score);
  const snapshots = unique.map((match, index) => {
    const investor = investorById.get(match.investor_id) || {};
    return {
      cohort_key: cohortKey,
      startup_id: startupId,
      investor_id: match.investor_id,
      source_match_id: match.id,
      god_score_at_prediction: Number.isFinite(god) ? god : 0,
      match_score_at_prediction: match.match_score,
      rank_position: index + 1,
      model_version: match.algorithm_version || modelVersionFallback,
      predicted_at: predictedAt,
      prediction_kind: predictionKind,
      context: {
        startup_name: startup.name,
        startup_identity_source: startup.source_type,
        startup_identity_url: startup.website || startup.company_domain,
        investor_name: investor.firm || investor.name || null,
        investor_organization_id: organizationByInvestor.get(match.investor_id) || null,
        source_match_created_at: match.created_at || null,
        freeze_source: 'freezeTopFiveIfAbsent',
      },
    };
  });

  const { error: upErr } = await supabase
    .from('funding_prediction_snapshots')
    .upsert(snapshots, {
      onConflict: 'cohort_key,startup_id,investor_id',
      ignoreDuplicates: true,
    });
  if (upErr) throw upErr;

  return { frozen: true, rows: 5, predicted_at: predictedAt, cohort_key: cohortKey };
}

module.exports = {
  SERVED_COHORT_KEY,
  DEFAULT_MODEL_VERSION,
  canonicalFirm,
  isEligibleFirmInvestor,
  freezeTopFiveIfAbsent,
};
