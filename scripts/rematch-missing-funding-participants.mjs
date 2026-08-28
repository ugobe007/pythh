#!/usr/bin/env node
/**
 * Rematch startups that have resolved funding participants missing from
 * startup_investor_matches. Uses the PR #25 force-include / historical-fit path.
 *
 * Does NOT backdate created_at — improves live rankings and future Hit@5,
 * not retrospective clocks on past rounds.
 *
 * Usage:
 *   npm run funding:rematch:missing-participants
 *   npm run funding:rematch:missing-participants -- --apply --limit=100
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const {
  calculateMatch,
  fetchAllInvestors,
  loadVerifiedHistoricalFeatures,
  selectTopInvestorCandidates,
} = require('./matching/generate-matches.js');
const { isGarbageInvestorName, isHardJunkInvestorName } = require('../lib/investorNameHeuristics.js');
const { isPlausibleInvestorEntityName, normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const limit = Math.min(Math.max(Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 80), 1), 400);
const algorithmVersion = 'v3.5-rematch-miss';
const cutoffAt = new Date();
const cutoffIso = cutoffAt.toISOString();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');

const db = createClient(url, key, { auth: { persistSession: false } });

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

function isEligibleFirm(row) {
  const label = String(row.firm || row.name || '').trim();
  const typeField = String(row.type || '');
  const investorType = String(row.investor_type || '');
  // Many firm profiles are mis-tagged type=Angel while investor_type=VC (Accel, Benchmark, …).
  // Trust firm-like investor_type over a generic Angel type label.
  const firmTyped = /\b(?:vc|pe|venture|corporate|accelerator|family.?office|growth|hedge|fund)\b/i.test(
    `${investorType} ${typeField}`,
  );
  const personTyped = /\b(?:individual|person|founder)\b/i.test(`${typeField} ${investorType}`)
    || (/\bangel\b/i.test(typeField) && !firmTyped);
  return row.is_individual !== true
    && !(personTyped && !firmTyped)
    && isPlausibleInvestorEntityName(label)
    && !isGarbageInvestorName(label)
    && !isHardJunkInvestorName(label);
}

async function fetchMemberships(investorIds) {
  const rows = [];
  for (let offset = 0; offset < investorIds.length; offset += 200) {
    const ids = investorIds.slice(offset, offset + 200);
    const { data, error } = await db.from('investor_organization_memberships')
      .select('investor_id,organization_id').in('investor_id', ids);
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function main() {
  const pool = new pg.Pool({
    connectionString: massageConnectionString(process.env.DATABASE_URL),
    max: 2,
  });

  // Startups with ≥1 resolved participant missing a match row (any time).
  const { rows: missStartups } = await pool.query(`
    SELECT e.startup_id,
           MAX(su.name) AS startup_name,
           COUNT(DISTINCT p.investor_id)::int AS missing_investors,
           ARRAY_AGG(DISTINCT p.investor_id) AS missing_investor_ids
    FROM funding_evidence_participants p
    JOIN funding_evidence_events e ON e.id = p.funding_event_id
    JOIN startup_uploads su ON su.id = e.startup_id
    JOIN investors i ON i.id = p.investor_id
    WHERE p.investor_id IS NOT NULL
      AND e.startup_id IS NOT NULL
      AND p.participation_relation IS NOT NULL
      AND p.participant_role IS DISTINCT FROM 'unknown'
      AND su.status = 'approved'
      AND COALESCE(su.entity_gate, '') <> 'junk'
      AND COALESCE(i.is_individual, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM startup_investor_matches m
        WHERE m.startup_id = e.startup_id AND m.investor_id = p.investor_id
      )
    GROUP BY e.startup_id
    ORDER BY COUNT(DISTINCT p.investor_id) DESC, MAX(su.name)
    LIMIT $1
  `, [limit]);

  if (!missStartups.length) {
    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      startups_needing_rematch: 0,
      matches_upserted: 0,
      note: 'No startups with resolved participants missing match rows',
    }, null, 2));
    await pool.end();
    return;
  }

  const startupIds = missStartups.map((r) => r.startup_id);
  const { rows: startupRows } = await pool.query(`
    SELECT id, name, description, sectors, stage, total_god_score, team_score, traction_score,
           market_score, product_score, vision_score, location, website, company_domain,
           source_type, status, entity_gate, raise_amount, mrr, arr, growth_rate_monthly,
           customer_count, team_size, extracted_data
    FROM startup_uploads
    WHERE id = ANY($1::uuid[])
  `, [startupIds]);
  const startupById = new Map(startupRows.map((r) => [r.id, r]));

  const investors = await fetchAllInvestors(db,
    'id,name,firm,url,type,investor_type,is_individual,sectors,stage,check_size_min,check_size_max,geography_focus,investor_score,investor_tier,last_investment_date,investment_pace_per_year,leads_rounds,follows_rounds,portfolio_companies,notable_investments,investment_thesis,entity_gate,status');
  const firmInvestors = investors.filter((row) =>
    isEligibleFirm(row)
    && String(row.status || 'active') === 'active'
    && row.entity_gate !== 'junk');
  const investorById = new Map(investors.map((r) => [String(r.id), r]));
  const memberships = await fetchMemberships(investors.map((r) => r.id));
  const membershipByInvestor = new Map(memberships.map((r) => [String(r.investor_id), r.organization_id]));

  let historicalFeatures = new Map();
  try {
    historicalFeatures = await loadVerifiedHistoricalFeatures(db, membershipByInvestor, cutoffAt);
  } catch (err) {
    console.warn(`Historical features unavailable: ${err.message}`);
  }
  for (const investor of firmInvestors) {
    const organizationId = membershipByInvestor.get(String(investor.id));
    investor.historical_features = historicalFeatures.get(
      organizationId ? `organization:${organizationId}` : `investor:${investor.id}`,
    ) || null;
  }

  const preview = [];
  const upsertRows = [];
  let forcedMissingIncluded = 0;

  for (const miss of missStartups) {
    const startup = startupById.get(miss.startup_id);
    if (!startup) continue;
    const startupAtCutoff = { ...startup, feature_cutoff_at: cutoffIso };
    // Proven ledger participants: always force into the scored pool.
    // Do NOT apply Angel-type / digit-brand / entity_gate=junk heuristics here —
    // those blocked real funders (468 Capital, 8VC, EstBAN) and left forced_included: [].
    const rawMissingIds = Array.isArray(miss.missing_investor_ids)
      ? miss.missing_investor_ids
      : [];
    const forceInvestorIds = rawMissingIds
      .map(String)
      .filter((id) => {
        const inv = investorById.get(id);
        if (!inv?.id) return false;
        const label = String(inv.firm || inv.name || '').trim();
        return label.length >= 2;
      });

    const forceRejectDiag = [];
    for (const id of rawMissingIds.map(String)) {
      if (forceInvestorIds.includes(id)) continue;
      const inv = investorById.get(id);
      forceRejectDiag.push({
        id,
        reason: !inv ? 'not_in_investor_fetch' : 'empty_label',
        name: inv?.name || null,
        firm: inv?.firm || null,
        gate: inv?.entity_gate || null,
      });
    }

    // Ensure forced investors are in the scored pool even if filtered from firmInvestors somehow.
    const poolInvestors = [...firmInvestors];
    const poolIds = new Set(poolInvestors.map((i) => String(i.id)));
    for (const id of forceInvestorIds) {
      if (poolIds.has(id)) continue;
      const inv = investorById.get(id);
      if (!inv) continue;
      const organizationId = membershipByInvestor.get(String(inv.id));
      inv.historical_features = historicalFeatures.get(
        organizationId ? `organization:${organizationId}` : `investor:${inv.id}`,
      ) || null;
      poolInvestors.push(inv);
      poolIds.add(id);
    }

    const scored = poolInvestors.map((investor) => ({
      investor,
      match: calculateMatch(startupAtCutoff, investor),
    })).filter((item) => item.match.score > 10 || forceInvestorIds.includes(String(item.investor.id)));

    const selected = selectTopInvestorCandidates(scored, membershipByInvestor, 50, { forceInvestorIds });
    const forcedInSelected = selected.filter((s) => forceInvestorIds.includes(String(s.investor.id)));
    forcedMissingIncluded += forcedInSelected.length;

    for (const [index, { investor, match }] of selected.entries()) {
      upsertRows.push({
        startup_id: startup.id,
        investor_id: investor.id,
        match_score: match.score,
        confidence_level: match.confidence,
        reasoning: match.reason,
        status: 'suggested',
        algorithm_version: algorithmVersion,
        feature_snapshot: {
          methodology: 'rematch_missing_resolved_participants',
          feature_cutoff_at: cutoffIso,
          candidate_rank: index + 1,
          forced_missing_participant: forceInvestorIds.includes(String(investor.id)),
          investor_fit_score: match.investor_fit_score,
          startup_quality_score: match.startup_quality_score,
        },
      });
    }

    preview.push({
      startup: startup.name,
      missing_investors: miss.missing_investors,
      force_candidate_ids: forceInvestorIds.length,
      force_rejected: forceRejectDiag.slice(0, 5),
      forced_included: forcedInSelected.map((s) => s.investor.firm || s.investor.name),
      top_five: selected.slice(0, 5).map(({ investor, match }) => ({
        investor: investor.firm || investor.name,
        score: match.score,
        forced: forceInvestorIds.includes(String(investor.id)),
      })),
    });
  }

  if (apply && upsertRows.length) {
    for (let offset = 0; offset < upsertRows.length; offset += 400) {
      const { error } = await db.from('startup_investor_matches')
        .upsert(upsertRows.slice(offset, offset + 400), {
          onConflict: 'startup_id,investor_id',
          ignoreDuplicates: false,
        });
      if (error) throw error;
    }
  }

  // Re-check how many missing participants still lack a match after dry-run selection.
  const wouldCover = new Set(
    upsertRows
      .filter((r) => r.feature_snapshot?.forced_missing_participant)
      .map((r) => `${r.startup_id}:${r.investor_id}`),
  );

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    algorithm_version: algorithmVersion,
    feature_cutoff_at: cutoffIso,
    startups_rematched: missStartups.length,
    matches_would_upsert: upsertRows.length,
    matches_upserted: apply ? upsertRows.length : 0,
    forced_missing_participants_included: forcedMissingIncluded,
    forced_pairs_covered: wouldCover.size,
    preview: preview.slice(0, 25),
  }, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exitCode = 1;
});
