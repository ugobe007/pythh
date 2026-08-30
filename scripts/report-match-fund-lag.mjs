#!/usr/bin/env node
/**
 * Match → fund timestamp lag report.
 *
 * Clocks:
 *   - Prediction: startup_investor_matches.created_at (never rewritten on upsert)
 *   - Seal:       funding_prediction_snapshots.predicted_at (= min match.created_at)
 *   - Funding:    match_validation_evidence.event_at (date-only → end-of-UTC-day)
 *
 * Usage:
 *   npm run funding:match-fund-lag
 *   npm run funding:match-fund-lag -- --json
 *   npm run funding:match-fund-lag:cohort
 *   npm run funding:match-fund-lag -- --cohort-since=2026-08-25 --json
 */
import 'dotenv/config';
import pg from 'pg';

const asJson = process.argv.includes('--json');
const cohortSince =
  process.argv.find((a) => a.startsWith('--cohort-since='))?.split('=')[1] || null;
const sampleLimit = Math.max(
  1,
  Number(process.argv.find((a) => a.startsWith('--sample='))?.split('=')[1] || 15),
);

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

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: massageConnectionString(process.env.DATABASE_URL),
  max: 1,
});

const cohortFilter = cohortSince
  ? `AND s.created_at >= $1::timestamptz AND s.source_type = 'url'`
  : '';
const params = cohortSince ? [cohortSince] : [];

const lagSql = `
SELECT
  COUNT(*)::int AS verified_pair_rows,
  COUNT(DISTINCT e.startup_id)::int AS startups,
  ROUND(AVG(EXTRACT(EPOCH FROM (e.event_at - m.created_at)) / 86400.0)::numeric, 1) AS avg_days,
  ROUND(
    (PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (e.event_at - m.created_at)) / 86400.0
    ))::numeric,
    1
  ) AS p50_days,
  COUNT(*) FILTER (WHERE e.event_at - m.created_at < interval '30 days')::int AS bucket_0_30d,
  COUNT(*) FILTER (
    WHERE e.event_at - m.created_at >= interval '30 days'
      AND e.event_at - m.created_at < interval '60 days'
  )::int AS bucket_30_60d,
  COUNT(*) FILTER (
    WHERE e.event_at - m.created_at >= interval '60 days'
      AND e.event_at - m.created_at < interval '90 days'
  )::int AS bucket_60_90d,
  COUNT(*) FILTER (
    WHERE e.event_at - m.created_at >= interval '90 days'
      AND e.event_at - m.created_at < interval '180 days'
  )::int AS bucket_90_180d,
  COUNT(*) FILTER (WHERE e.event_at - m.created_at >= interval '180 days')::int AS bucket_180d_plus
FROM match_validation_evidence e
JOIN startup_investor_matches m ON m.id = e.match_id
JOIN startup_uploads s ON s.id = e.startup_id
WHERE e.verified
  AND e.startup_id = m.startup_id
  AND e.investor_id = m.investor_id
  AND e.event_at > m.created_at
  AND e.evidence_type IN ('funding', 'investment')
  ${cohortFilter}
`;

const samplesSql = `
SELECT s.name AS startup,
       COALESCE(i.firm, i.name) AS investor,
       m.created_at AS matched_at,
       e.event_at AS funded_at,
       ROUND((EXTRACT(EPOCH FROM (e.event_at - m.created_at)) / 86400.0)::numeric, 1) AS days_after_match,
       LEFT(e.source_url, 90) AS source_url
FROM match_validation_evidence e
JOIN startup_investor_matches m ON m.id = e.match_id
JOIN startup_uploads s ON s.id = e.startup_id
JOIN investors i ON i.id = e.investor_id
WHERE e.verified
  AND e.startup_id = m.startup_id
  AND e.investor_id = m.investor_id
  AND e.event_at > m.created_at
  AND e.evidence_type IN ('funding', 'investment')
  ${cohortFilter}
ORDER BY (e.event_at - m.created_at) ASC
LIMIT ${sampleLimit}
`;

const sealedAgingSql = `
WITH seals AS (
  SELECT DISTINCT ON (f.startup_id)
    f.startup_id, f.predicted_at, s.name, s.created_at AS submit_at
  FROM funding_prediction_snapshots f
  JOIN startup_uploads s ON s.id = f.startup_id
  WHERE f.cohort_key = 'served-first-top5'
    ${cohortSince ? `AND s.created_at >= $1::timestamptz AND s.source_type = 'url'` : ''}
  ORDER BY f.startup_id, f.predicted_at ASC
)
SELECT
  COUNT(*)::int AS sealed_startups,
  ROUND(AVG(EXTRACT(EPOCH FROM (now() - predicted_at)) / 86400.0)::numeric, 1) AS avg_age_days,
  COUNT(*) FILTER (WHERE now() - predicted_at < interval '7 days')::int AS age_0_7d,
  COUNT(*) FILTER (
    WHERE now() - predicted_at >= interval '7 days'
      AND now() - predicted_at < interval '30 days'
  )::int AS age_7_30d,
  COUNT(*) FILTER (
    WHERE now() - predicted_at >= interval '30 days'
      AND now() - predicted_at < interval '60 days'
  )::int AS age_30_60d,
  COUNT(*) FILTER (
    WHERE now() - predicted_at >= interval '60 days'
      AND now() - predicted_at < interval '90 days'
  )::int AS age_60_90d,
  COUNT(*) FILTER (WHERE now() - predicted_at >= interval '90 days')::int AS age_90d_plus
FROM seals
`;

try {
  const { rows: lagRows } = await pool.query(lagSql, params);
  const { rows: samples } = await pool.query(samplesSql, params);
  const { rows: agingRows } = await pool.query(sealedAgingSql, params);
  const report = {
    clocks: {
      match: 'startup_investor_matches.created_at (immutable on upsert)',
      seal: 'funding_prediction_snapshots.predicted_at (= min match.created_at)',
      fund: 'match_validation_evidence.event_at (date-only → end-of-UTC-day)',
    },
    expectation:
      'Many true positives land in 60–90d; historical p50 is longer — keep searching sealed clocks.',
    cohort_since: cohortSince,
    verified_lag: lagRows[0],
    sealed_aging: agingRows[0],
    fastest_pairs: samples,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const lag = report.verified_lag;
    const age = report.sealed_aging;
    console.log('\n⏱  Match → fund lag\n');
    console.log(`Scope: ${cohortSince ? `proof cohort since ${cohortSince}` : 'all verified pairs'}`);
    console.log(`Verified pairs:     ${lag.verified_pair_rows}  (${lag.startups} startups)`);
    console.log(`Avg / p50 days:     ${lag.avg_days} / ${lag.p50_days}`);
    console.log(
      `Buckets (days):     0–30=${lag.bucket_0_30d}  30–60=${lag.bucket_30_60d}  60–90=${lag.bucket_60_90d}  90–180=${lag.bucket_90_180d}  180+=${lag.bucket_180d_plus}`,
    );
    console.log('\nSealed prediction clocks (served-first-top5):');
    console.log(`  Sealed startups:  ${age.sealed_startups}  (avg age ${age.avg_age_days}d)`);
    console.log(
      `  Age buckets:      0–7d=${age.age_0_7d}  7–30d=${age.age_7_30d}  30–60d=${age.age_30_60d}  60–90d=${age.age_60_90d}  90d+=${age.age_90d_plus}`,
    );
    if (samples.length) {
      console.log('\nFastest verified pairs (matched_at → funded_at):');
      for (const row of samples.slice(0, 10)) {
        console.log(
          `  ${row.days_after_match}d  ${row.startup} → ${row.investor}  match=${String(row.matched_at).slice(0, 10)} fund=${String(row.funded_at).slice(0, 10)}`,
        );
      }
    }
    console.log('\nClocks: match.created_at · seal.predicted_at · evidence.event_at');
    console.log('Doc: docs/PROOF_COHORT_SPEC.md\n');
  }
} finally {
  await pool.end();
}
