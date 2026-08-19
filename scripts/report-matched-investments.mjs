#!/usr/bin/env node
/**
 * Verified + pending matched investments (startup × investor pairs with post-prediction funding evidence).
 * Usage: npm run outcomes:matched
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
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

const pool = new pg.Pool({ connectionString: massageConnectionString(conn), max: 1 });

const verifiedSql = `
  SELECT
    su.name AS startup,
    i.name AS investor,
    e.evidence_type,
    e.event_at,
    m.created_at AS match_at,
    round(extract(epoch FROM (e.event_at - m.created_at)) / 86400.0, 1) AS days_after_match,
    m.match_score,
    e.source_provider,
    left(e.source_url, 100) AS source_url
  FROM match_validation_evidence e
  JOIN startup_investor_matches m ON m.id = e.match_id
  JOIN startup_uploads su ON su.id = e.startup_id
  JOIN investors i ON i.id = e.investor_id
  WHERE e.verified
    AND e.startup_id = m.startup_id
    AND e.investor_id = m.investor_id
    AND e.event_at > m.created_at
    AND e.evidence_type IN ('funding', 'investment')
  ORDER BY e.event_at DESC
`;

const pendingSql = `
  SELECT
    e.id,
    su.name AS startup,
    i.name AS investor,
    e.event_at,
    m.created_at AS match_at,
    round(extract(epoch FROM (e.event_at - m.created_at)) / 86400.0, 1) AS days_after_match,
    e.review_status,
    left(e.source_url, 100) AS source_url,
    CASE
      WHEN e.source_url ~* '(\\.com/blog|/newsroom/|/news/company|prnewswire|businesswire|globenewswire)' THEN 'high'
      WHEN e.source_url ~* '(dealroom|pitchbook|crunchbase|bloomberg|techcrunch)' THEN 'medium'
      ELSE 'low'
    END AS source_tier
  FROM match_validation_evidence e
  JOIN startup_investor_matches m ON m.id = e.match_id
  JOIN startup_uploads su ON su.id = e.startup_id
  JOIN investors i ON i.id = e.investor_id
  WHERE NOT e.verified
    AND e.review_status = 'pending'
    AND e.event_at > m.created_at
  ORDER BY e.event_at DESC
`;

const summarySql = `
  SELECT
    (SELECT count(*)::int FROM match_validation_evidence e
     JOIN startup_investor_matches m ON m.id = e.match_id
     WHERE e.verified
       AND e.startup_id = m.startup_id
       AND e.investor_id = m.investor_id
       AND e.event_at > m.created_at
       AND e.evidence_type IN ('funding', 'investment')) AS verified_pairs,
    (SELECT count(*)::int FROM match_validation_evidence e
     JOIN startup_investor_matches m ON m.id = e.match_id
     WHERE NOT e.verified AND e.review_status = 'pending' AND e.event_at > m.created_at) AS pending_pairs,
    (SELECT count(*)::int FROM match_outcome_classifications WHERE classification = 'verified_funding') AS classified_verified_funding
`;

try {
  const [{ rows: summary }, { rows: verified }, { rows: pending }] = await Promise.all([
    pool.query(summarySql),
    pool.query(verifiedSql),
    pool.query(pendingSql),
  ]);

  const pendingByTier = pending.reduce((acc, row) => {
    acc[row.source_tier] = (acc[row.source_tier] || 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        summary: summary[0],
        pending_by_source_tier: pendingByTier,
        verified_matched_investments: verified,
        pending_review: pending,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
