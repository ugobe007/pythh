#!/usr/bin/env node
/**
 * Consolidated audit: Pythh matches → funding evidence → sealed Hit@5 claim inventory.
 * Use after each ops wave to schedule improvements.
 *
 * Usage:
 *   node scripts/report-match-funding-audit.mjs
 *   node scripts/report-match-funding-audit.mjs --json
 *   node scripts/report-match-funding-audit.mjs --horizon=180
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const asJson = process.argv.includes('--json');
const horizonArg = process.argv.find((a) => a.startsWith('--horizon='));
const horizonDays = Number(horizonArg?.split('=')[1] || 180);

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  const v = String(process.env.DATABASE_SSL || '').toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return s;
  const isSupabase = /supabase\.com/i.test(s) || /\.supabase\.co/i.test(s);
  if (!isSupabase && v !== 'true' && v !== '1' && v !== 'yes') return s;
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

function readJsonFromScript(script, args = []) {
  const res = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  if (res.status !== 0) {
    return { error: (res.stderr || res.stdout || '').slice(0, 400) };
  }
  const text = res.stdout.trim();
  const start = text.indexOf('{');
  if (start < 0) return { error: 'no_json_in_output' };
  try {
    return JSON.parse(text.slice(start));
  } catch (e) {
    return { error: e.message };
  }
}

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: massageConnectionString(conn), max: 1 });

const pairSql = `
  SELECT
    count(*)::int AS total_matches,
    count(DISTINCT startup_id)::int AS startups_with_matches,
    count(DISTINCT investor_id)::int AS investors_in_matches
  FROM startup_investor_matches
`;

const verifiedPairSql = `
  SELECT count(*)::int AS verified_post_prediction_pairs
  FROM match_validation_evidence e
  JOIN startup_investor_matches m ON m.id = e.match_id
  WHERE e.verified
    AND e.startup_id = m.startup_id
    AND e.investor_id = m.investor_id
    AND e.event_at > m.created_at
    AND e.evidence_type IN ('funding', 'investment')
`;

const verifiedStartupSql = `
  SELECT count(DISTINCT e.startup_id)::int AS startups_with_verified_pair_funding
  FROM match_validation_evidence e
  JOIN startup_investor_matches m ON m.id = e.match_id
  WHERE e.verified
    AND e.startup_id = m.startup_id
    AND e.investor_id = m.investor_id
    AND e.event_at > m.created_at
    AND e.evidence_type IN ('funding', 'investment')
`;

const queueSql = `
  SELECT status, count(*)::int AS n
  FROM funding_evidence_search_queue
  GROUP BY 1 ORDER BY 2 DESC
`;

const cohortSql = `
  WITH cohort AS (
    SELECT s.id
    FROM startup_uploads s
    WHERE s.status = 'approved'
      AND s.entity_gate = 'qualified'
      AND s.source_type = 'url'
      AND coalesce(s.website, '') <> ''
      AND EXISTS (SELECT 1 FROM startup_investor_matches m WHERE m.startup_id = s.id)
  ),
  resolved AS (
    SELECT c.id FROM cohort c
    WHERE EXISTS (
      SELECT 1 FROM funding_evidence_search_queue q
      WHERE q.startup_id = c.id AND q.status IN ('complete', 'error')
    )
    OR EXISTS (
      SELECT 1 FROM match_validation_evidence e
      WHERE e.startup_id = c.id AND e.verified
    )
  )
  SELECT
    (SELECT count(*)::int FROM cohort) AS qualified_url_cohort,
    (SELECT count(*)::int FROM resolved) AS resolved_in_cohort,
    (
      SELECT count(*)::int FROM match_validation_evidence e
      JOIN startup_investor_matches m ON m.id = e.match_id
      WHERE e.verified AND e.event_at > m.created_at
    ) AS verified_pairs_all_types
`;

async function query(sql) {
  const { rows } = await pool.query(sql);
  return rows;
}

const [
  pairRows,
  verifiedPairRows,
  verifiedStartupRows,
  queueRows,
  cohortRows,
] = await Promise.all([
  query(pairSql),
  query(verifiedPairSql),
  query(verifiedStartupSql),
  query(queueSql),
  query(cohortSql),
]);

await pool.end();

const claim = readJsonFromScript('scripts/report-funding-prediction-claim-readiness.mjs', ['--summary']);
const hit5 = readJsonFromScript('scripts/report-hit5-startup-prediction-outcomes.mjs', [`--horizon=${horizonDays}`, '--json']);
const reconcile = readJsonFromScript('scripts/reconcile-historical-funding-matches.mjs', ['--summary']);
const triage = readJsonFromScript('scripts/triage-hit5-pending-horizons.mjs', [`--horizon=${horizonDays}`, '--within-days=90', '--json']);

const claim180 = claim?.metrics?.find((m) => m.horizon_days === horizonDays) || null;

const report = {
  generated_at: new Date().toISOString(),
  horizon_days: horizonDays,
  match_layer: {
    total_match_rows: pairRows[0]?.total_matches ?? null,
    startups_with_matches: pairRows[0]?.startups_with_matches ?? null,
    investors_in_match_pool: pairRows[0]?.investors_in_matches ?? null,
    verified_post_prediction_pairs: verifiedPairRows[0]?.verified_post_prediction_pairs ?? null,
    startups_with_verified_pair_funding: verifiedStartupRows[0]?.startups_with_verified_pair_funding ?? null,
    verified_pairs_all_evidence_types: cohortRows[0]?.verified_pairs_all_types ?? null,
  },
  outcomes_cohort: {
    qualified_url_with_matches: cohortRows[0]?.qualified_url_cohort ?? null,
    resolved_searched_or_verified: cohortRows[0]?.resolved_in_cohort ?? null,
    search_queue: queueRows,
  },
  sealed_hit5: claim180
    ? {
        prediction_sets: claim180.prediction_sets,
        mature_sets: claim180.mature_prediction_sets,
        pending_sets: claim180.pending_prediction_sets,
        funded_startups_observed: claim180.funded_startups_observed,
        confirmed_hit_startups: claim180.confirmed_hit_startups,
        confirmed_miss_startups: claim180.confirmed_miss_startups,
        audited_outcomes: claim180.claim_readiness?.audited_outcomes,
        claim_blockers: claim180.claim_readiness?.blockers,
        excluded_not_serve_grade: claim?.inventory?.excluded_prediction_sets_without_prediction_grade_identity,
      }
    : { error: claim?.error || 'claim_readiness_failed' },
  hit5_answer: hit5?.answer || null,
  reconcile_summary: reconcile?.totals
    ? {
        verified_source_events: reconcile.totals.verified_source_events,
        canonical_rounds: reconcile.totals.canonical_funding_rounds,
        rounds_with_pre_event_top_five: reconcile.totals.rounds_with_pre_event_top_five,
        directional_hits_at_5: reconcile.totals.directional_hits_at_5,
        auditable_misses_at_5: reconcile.totals.auditable_misses_at_5,
        censored_rounds: reconcile.totals.censored_rounds,
        delta_reasons: reconcile.actual_investor_delta_reasons,
      }
    : { error: reconcile?.error || 'reconcile_failed' },
  horizon_triage: triage?.inventory
    ? {
        mature_unfunded: triage.hunt_outside_current_funded?.mature_unfunded_count,
        unfunded_with_gaps: triage.hunt_outside_current_funded?.unfunded_with_funding_gaps,
        pending_maturity_within_30d: triage.pending_maturity_buckets?.within_30d,
        pending_funded: triage.pending_funded_breakdown,
      }
    : { error: triage?.error || 'triage_failed' },
  interpretation: {
    pair_vs_startup_hit5:
      'Pair-level verified funding (match_validation_evidence) counts investor↔startup rows where a specific match later funded. Sealed Hit@5 counts startup-level audited outcomes from funding_evidence_events + complete rosters — stricter and the claim metric.',
    primary_gap:
      reconcile?.actual_investor_delta_reasons?.candidate_generation_miss
        ? 'candidate_generation_miss dominates retrospective reconcile — expand match pool before GOD/fit retune.'
        : null,
  },
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('\n📊 Match → funding audit (horizon=' + horizonDays + 'd)\n');
  console.log('Pair layer:');
  console.log(`  match rows:              ${report.match_layer.total_match_rows}`);
  console.log(`  startups w/ matches:     ${report.match_layer.startups_with_matches}`);
  console.log(`  verified pair fundings:  ${report.match_layer.verified_post_prediction_pairs}`);
  console.log(`  startups (pair verified):${report.match_layer.startups_with_verified_pair_funding}`);
  console.log('\nSealed Hit@5 (claim):');
  console.log(`  audited outcomes:        ${report.sealed_hit5.audited_outcomes}`);
  console.log(`  hits / misses:           ${report.sealed_hit5.confirmed_hit_startups} / ${report.sealed_hit5.confirmed_miss_startups}`);
  console.log(`  gap to 100 audited:      ${100 - Number(report.sealed_hit5.audited_outcomes || 0)}`);
  console.log(`  mature unfunded:         ${report.horizon_triage.mature_unfunded}`);
  console.log(`  reconcile cand-gen miss: ${report.reconcile_summary.delta_reasons?.candidate_generation_miss ?? '—'}`);
  console.log('\nOutcomes cohort: resolved', report.outcomes_cohort.resolved_searched_or_verified,
    '/', report.outcomes_cohort.qualified_url_with_matches);
  console.log('');
}
