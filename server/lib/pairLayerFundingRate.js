/**
 * Pair-layer funding rate for the public homepage.
 *
 * Among startups with a verified post-prediction funder, share where that
 * funder sat in sealed or live top-5 (firm identity). Same definition as
 * `npm run outcomes:matched:summary` HIT RATE. Does not retune GOD/fit.
 */
'use strict';

const pg = require('pg');

const PAIR_LAYER_FUNDING_RATE_SQL = `
  WITH identity AS (
    SELECT
      i.id AS investor_id,
      trim(both FROM regexp_replace(
        regexp_replace(
          lower(trim(coalesce(nullif(i.firm, ''), i.name))),
          '\\y(?:ventures?|capital|partners?|management|fund|holdings?)\\y',
          ' ',
          'g'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      )) AS firm_label,
      (
        SELECT m.organization_id
        FROM investor_organization_memberships m
        WHERE m.investor_id = i.id
        ORDER BY m.organization_id
        LIMIT 1
      ) AS organization_id
    FROM investors i
  ),
  primary_key AS (
    SELECT
      investor_id,
      CASE
        WHEN organization_id IS NOT NULL THEN 'org:' || organization_id::text
        WHEN coalesce(firm_label, '') <> '' THEN 'label:' || firm_label
        ELSE 'investor:' || investor_id::text
      END AS firm_key
    FROM identity
  ),
  ident_keys AS (
    SELECT investor_id, 'investor:' || investor_id::text AS ident FROM identity
    UNION
    SELECT investor_id, 'org:' || organization_id::text
    FROM identity
    WHERE organization_id IS NOT NULL
    UNION
    SELECT investor_id, 'label:' || firm_label
    FROM identity
    WHERE coalesce(firm_label, '') <> ''
  ),
  verified AS (
    SELECT
      e.startup_id,
      e.match_id,
      e.investor_id
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    WHERE e.verified
      AND e.startup_id = m.startup_id
      AND e.investor_id = m.investor_id
      AND e.event_at > m.created_at
      AND e.evidence_type IN ('funding', 'investment')
  ),
  sealed_hit AS (
    SELECT v.match_id, min(s.rank_position) AS sealed_rank
    FROM verified v
    JOIN ident_keys vk ON vk.investor_id = v.investor_id
    JOIN funding_prediction_snapshots s
      ON s.startup_id = v.startup_id
     AND s.cohort_key = 'served-first-top5'
     AND s.rank_position BETWEEN 1 AND 5
    JOIN ident_keys sk ON sk.investor_id = s.investor_id AND sk.ident = vk.ident
    GROUP BY v.match_id
  ),
  live_unique AS (
    SELECT
      m.startup_id,
      pk.firm_key,
      m.match_score,
      m.created_at,
      row_number() OVER (
        PARTITION BY m.startup_id, pk.firm_key
        ORDER BY m.match_score DESC NULLS LAST, m.created_at ASC, m.id ASC
      ) AS firm_dup_rank
    FROM startup_investor_matches m
    JOIN primary_key pk ON pk.investor_id = m.investor_id
    WHERE m.startup_id IN (SELECT startup_id FROM verified)
      AND coalesce(m.status, 'suggested') IN ('suggested', 'accepted')
  ),
  live_rank AS (
    SELECT
      startup_id,
      firm_key,
      row_number() OVER (
        PARTITION BY startup_id
        ORDER BY match_score DESC NULLS LAST, created_at ASC
      ) AS live_rank
    FROM live_unique
    WHERE firm_dup_rank = 1
  ),
  live_hit AS (
    SELECT v.match_id, min(lr.live_rank) AS live_rank
    FROM verified v
    JOIN ident_keys vk ON vk.investor_id = v.investor_id
    JOIN ident_keys other ON other.ident = vk.ident
    JOIN primary_key opk ON opk.investor_id = other.investor_id
    JOIN live_rank lr
      ON lr.startup_id = v.startup_id
     AND lr.firm_key = opk.firm_key
    GROUP BY v.match_id
  ),
  placed AS (
    SELECT
      v.startup_id,
      CASE
        WHEN s.sealed_rank IS NOT NULL THEN 1
        WHEN lh.live_rank IS NOT NULL AND lh.live_rank <= 5 THEN 1
        ELSE 0
      END AS hit
    FROM verified v
    LEFT JOIN sealed_hit s ON s.match_id = v.match_id
    LEFT JOIN live_hit lh ON lh.match_id = v.match_id
  )
  SELECT
    count(DISTINCT startup_id)::int AS startups,
    count(DISTINCT startup_id) FILTER (WHERE hit = 1)::int AS hits,
    count(*)::int AS pairs,
    count(*) FILTER (WHERE hit = 1)::int AS pair_hits
  FROM placed
`;

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (!s) return s;
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

function ratePct(hits, startups) {
  const n = Number(hits);
  const d = Number(startups);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function normalizeRateRow(row) {
  const startups = Number(row?.startups || 0) || 0;
  const hits = Number(row?.hits || 0) || 0;
  const pairs = Number(row?.pairs || 0) || 0;
  const pairHits = Number(row?.pair_hits || 0) || 0;
  return {
    pair_funding_startups: startups,
    pair_funding_hits: hits,
    pair_funding_pairs: pairs,
    pair_funding_pair_hits: pairHits,
    pair_funding_rate_pct: ratePct(hits, startups),
  };
}

async function computePairLayerFundingRate(connectionString = process.env.DATABASE_URL) {
  const conn = massageConnectionString(connectionString);
  if (!conn || /@base[:/]/i.test(conn) || /^postgres:\/\/base\b/i.test(conn)) {
    return null;
  }
  const pool = new pg.Pool({ connectionString: conn, max: 1 });
  try {
    const { rows } = await pool.query(PAIR_LAYER_FUNDING_RATE_SQL);
    return normalizeRateRow(rows[0]);
  } finally {
    await pool.end();
  }
}

module.exports = {
  PAIR_LAYER_FUNDING_RATE_SQL,
  ratePct,
  normalizeRateRow,
  computePairLayerFundingRate,
};
