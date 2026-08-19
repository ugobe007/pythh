#!/usr/bin/env node
/**
 * Baseline report: Pythh matches vs verified funding evidence.
 * Usage: npm run outcomes:report
 */
import 'dotenv/config';
import pg from 'pg';

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL required');
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

const pool = new pg.Pool({ connectionString: massageConnectionString(conn), max: 1 });

const queries = {
  match_counts: `
    SELECT
      count(*)::bigint AS total_matches,
      count(*) FILTER (WHERE created_at IS NOT NULL)::bigint AS with_prediction_at,
      min(created_at) AS earliest_match,
      max(created_at) AS latest_match
    FROM startup_investor_matches
  `,
  evidence_counts: `
    SELECT
      count(*)::bigint AS evidence_rows,
      count(*) FILTER (WHERE verified)::bigint AS verified_rows,
      count(*) FILTER (WHERE NOT verified)::bigint AS unverified_rows,
      count(DISTINCT match_id)::bigint AS matches_with_any_evidence,
      count(DISTINCT match_id) FILTER (WHERE verified)::bigint AS matches_with_verified_evidence
    FROM match_validation_evidence
  `,
  evidence_by_type: `
    SELECT evidence_type, verified, count(*)::bigint AS n
    FROM match_validation_evidence
    GROUP BY 1, 2 ORDER BY 1, 2
  `,
  classifications: `
    SELECT classification, count(*)::bigint AS n
    FROM match_outcome_classifications
    GROUP BY 1 ORDER BY 2 DESC
  `,
  verified_funding_pairs: `
    SELECT count(*)::bigint AS verified_post_prediction_funding
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    WHERE e.verified
      AND e.startup_id = m.startup_id
      AND e.investor_id = m.investor_id
      AND e.event_at > m.created_at
      AND e.evidence_type IN ('funding', 'investment')
  `,
  post_prediction_unverified: `
    SELECT count(*)::bigint AS unverified_post_prediction_rows
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    WHERE NOT e.verified
      AND e.startup_id = m.startup_id
      AND e.investor_id = m.investor_id
      AND e.event_at > m.created_at
  `,
  dataset_labels: `
    SELECT outcome_label, label_reason, count(*)::bigint AS n
    FROM historical_match_validation_dataset
    GROUP BY 1, 2 ORDER BY 3 DESC
  `,
  search_queue: `
    SELECT status, count(*)::bigint AS n
    FROM funding_evidence_search_queue
    GROUP BY 1 ORDER BY 2 DESC
  `,
  recent_verified: `
    SELECT
      su.name AS startup,
      i.name AS investor,
      e.evidence_type,
      e.event_at,
      m.created_at AS match_at,
      round(extract(epoch FROM (e.event_at - m.created_at)) / 86400.0, 1) AS days_after_match,
      e.source_provider,
      left(e.source_url, 80) AS source_url
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    JOIN startup_uploads su ON su.id = e.startup_id
    JOIN investors i ON i.id = e.investor_id
    WHERE e.verified AND e.event_at > m.created_at
    ORDER BY e.event_at DESC
    LIMIT 15
  `,
  recent_unverified_candidates: `
    SELECT
      su.name AS startup,
      i.name AS investor,
      e.evidence_type,
      e.event_at,
      m.created_at AS match_at,
      e.review_status,
      e.source_provider,
      left(e.source_url, 80) AS source_url
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    JOIN startup_uploads su ON su.id = e.startup_id
    JOIN investors i ON i.id = e.investor_id
    WHERE NOT e.verified AND e.event_at > m.created_at
    ORDER BY e.created_at DESC
    LIMIT 15
  `,
};

async function run(name, sql) {
  try {
    const { rows } = await pool.query(sql);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e.message, name };
  }
}

const report = { generated_at: new Date().toISOString(), sections: {} };

for (const [name, sql] of Object.entries(queries)) {
  report.sections[name] = await run(name, sql);
}

await pool.end();
console.log(JSON.stringify(report, null, 2));
