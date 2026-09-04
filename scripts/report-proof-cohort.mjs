#!/usr/bin/env node
/**
 * Prospective proof cohort dashboard — URL submits since PROOF_COHORT_SINCE.
 *
 * Usage:
 *   npm run proof-cohort:report -- --since=2026-08-25
 *   npm run proof-cohort:report -- --since=2026-08-25 --json
 */
import 'dotenv/config';
import pg from 'pg';

const asJson = process.argv.includes('--json');
const sinceArg = process.argv.find((a) => a.startsWith('--since='));
const DEFAULT_SINCE = '2026-08-25';
const sinceIso = sinceArg?.split('=')[1] || process.env.PROOF_COHORT_SINCE || DEFAULT_SINCE;
const sinceDate = new Date(sinceIso);
if (Number.isNaN(sinceDate.getTime())) {
  console.error('Invalid --since date');
  process.exit(1);
}

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

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: massageConnectionString(conn), max: 1 });

const summarySql = `
WITH cohort AS (
  SELECT s.id, s.name, s.created_at, s.entity_gate, s.website
  FROM startup_uploads s
  WHERE s.status = 'approved'
    AND s.source_type = 'url'
    AND coalesce(s.website, '') <> ''
    AND s.entity_gate IS DISTINCT FROM 'junk'
    AND s.created_at >= $1::timestamptz
),
with_matches AS (
  SELECT c.*
  FROM cohort c
  WHERE EXISTS (SELECT 1 FROM startup_investor_matches m WHERE m.startup_id = c.id)
),
with_snapshot AS (
  SELECT wm.*
  FROM with_matches wm
  WHERE EXISTS (
    SELECT 1 FROM funding_prediction_snapshots fps
    WHERE fps.startup_id = wm.id AND fps.cohort_key = 'served-first-top5'
  )
),
instrumented AS (
  SELECT wm.*
  FROM with_matches wm
  WHERE EXISTS (
    SELECT 1 FROM funding_prediction_snapshots fps
    WHERE fps.startup_id = wm.id AND fps.cohort_key = 'served-first-top5'
  )
  AND EXISTS (
    SELECT 1 FROM funding_evidence_search_queue q WHERE q.startup_id = wm.id
  )
),
verified_pairs AS (
  SELECT count(*)::int AS n
  FROM match_validation_evidence e
  JOIN startup_investor_matches m ON m.id = e.match_id
  JOIN cohort c ON c.id = e.startup_id
  WHERE e.verified
    AND e.event_at > m.created_at
    AND e.evidence_type IN ('funding', 'investment')
),
startups_5plus_verified AS (
  SELECT count(*)::int AS n
  FROM (
    SELECT e.startup_id
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    JOIN cohort c ON c.id = e.startup_id
    WHERE e.verified
      AND e.event_at > m.created_at
      AND e.evidence_type IN ('funding', 'investment')
    GROUP BY e.startup_id
    HAVING count(*) >= 1
  ) t
)
SELECT
  (SELECT count(*)::int FROM cohort) AS cohort_url_submits,
  (SELECT count(*)::int FROM with_matches) AS with_matches,
  (SELECT count(*)::int FROM with_snapshot) AS with_sealed_snapshot,
  (SELECT count(*)::int FROM instrumented) AS fully_instrumented,
  (SELECT count(*)::int FROM cohort c
    WHERE EXISTS (SELECT 1 FROM funding_evidence_search_queue q WHERE q.startup_id = c.id AND q.priority > 0)
  ) AS queue_priority_boosted,
  (SELECT count(*)::int FROM cohort c
    WHERE EXISTS (
      SELECT 1 FROM funding_evidence_search_queue q
      WHERE q.startup_id = c.id AND q.status IN ('complete', 'error')
    )
  ) AS search_resolved,
  (SELECT n FROM verified_pairs) AS verified_pair_rows,
  (SELECT n FROM startups_5plus_verified) AS startups_with_verified_pair,
  (SELECT count(*)::int FROM cohort WHERE entity_gate = 'qualified') AS entity_gate_qualified,
  (SELECT count(*)::int FROM cohort WHERE entity_gate IS NULL) AS entity_gate_null
`;

const recentSql = `
SELECT s.id, s.name, s.created_at, s.entity_gate,
  EXISTS (SELECT 1 FROM startup_investor_matches m WHERE m.startup_id = s.id) AS has_matches,
  EXISTS (
    SELECT 1 FROM funding_prediction_snapshots fps
    WHERE fps.startup_id = s.id AND fps.cohort_key = 'served-first-top5'
  ) AS has_snapshot,
  EXISTS (SELECT 1 FROM funding_evidence_search_queue q WHERE q.startup_id = s.id) AS in_queue,
  (SELECT q.status FROM funding_evidence_search_queue q WHERE q.startup_id = s.id LIMIT 1) AS queue_status
FROM startup_uploads s
WHERE s.status = 'approved'
  AND s.source_type = 'url'
  AND coalesce(s.website, '') <> ''
  AND s.entity_gate IS DISTINCT FROM 'junk'
  AND s.created_at >= $1::timestamptz
ORDER BY s.created_at DESC
LIMIT 15
`;

try {
  const sinceTs = sinceDate.toISOString();
  const { rows: [row] } = await pool.query(summarySql, [sinceTs]);
  const { rows: recent } = await pool.query(recentSql, [sinceTs]);

  const instrumentationPct =
    row.with_matches > 0
      ? Number(((100 * row.fully_instrumented) / row.with_matches).toFixed(1))
      : null;

  const out = {
    proof_cohort_since: sinceTs,
    definition: 'approved url submits with website, not junk, created_at >= since',
    signup_gate: false,
    counts: {
      cohort_url_submits: row.cohort_url_submits,
      with_matches: row.with_matches,
      with_sealed_snapshot: row.with_sealed_snapshot,
      fully_instrumented: row.fully_instrumented,
      instrumentation_pct_of_matched: instrumentationPct,
      queue_priority_boosted: row.queue_priority_boosted,
      search_resolved: row.search_resolved,
      verified_pair_rows: row.verified_pair_rows,
      startups_with_verified_pair: row.startups_with_verified_pair,
      entity_gate_qualified: row.entity_gate_qualified,
      entity_gate_null: row.entity_gate_null,
    },
    gates: {
      signup_evidence_target_startups: 5,
      signup_evidence_met: row.startups_with_verified_pair >= 5,
      audited_hit5_target: 100,
      god_retune_blocked_until_signup_evidence: true,
    },
    recent_submits: recent,
    weekly_commands: [
      'npm run proof-cohort:report -- --since=' + sinceIso.split('T')[0],
      'npm run outcomes:search-funding:cascade -- --apply --limit=50 --delay=1200',
      'npm run funding:match-funding-audit',
    ],
    doc: 'docs/PROOF_COHORT_SPEC.md',
  };

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log('\n📋 Prospective proof cohort (URL submits, no signup gate)\n');
    console.log(`Since: ${sinceTs.split('T')[0]}`);
    console.log(`Cohort URL submits:     ${row.cohort_url_submits}`);
    console.log(`With matches:           ${row.with_matches}`);
    console.log(`Sealed top-5 snapshot:  ${row.with_sealed_snapshot}`);
    console.log(`Fully instrumented:     ${row.fully_instrumented} (${instrumentationPct ?? '—'}% of matched)`);
    console.log(`Queue priority > 0:   ${row.queue_priority_boosted}`);
    console.log(`Search resolved:        ${row.search_resolved}`);
    console.log(`Verified pair rows:     ${row.verified_pair_rows}`);
    console.log(`Startups w/ verified:   ${row.startups_with_verified_pair}`);
    console.log(`Signup evidence gate:   ${row.startups_with_verified_pair}/5 startups with verified pair`);
    console.log(`entity_gate qualified:  ${row.entity_gate_qualified} | null: ${row.entity_gate_null}`);
    console.log('\nRecent submits (instrumentation):');
    for (const r of recent) {
      const flags = [
        r.has_matches ? 'matches' : 'no-matches',
        r.has_snapshot ? 'snapshot' : 'no-snapshot',
        r.in_queue ? `queue:${r.queue_status || '?'}` : 'no-queue',
      ].join(' · ');
      console.log(`  ${r.created_at?.toISOString?.()?.slice(0, 10) || r.created_at}  ${r.name}  [${flags}]`);
    }
    console.log('\nDoc: docs/PROOF_COHORT_SPEC.md\n');
  }
} finally {
  await pool.end();
}
