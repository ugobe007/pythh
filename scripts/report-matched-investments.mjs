#!/usr/bin/env node
/**
 * Verified + pending matched investments (startup × investor pairs with
 * post-prediction funding evidence). Working metric is the overall pair
 * layer — every verified funder we matched before the raise — including
 * live top-5 that never received a served-first-top5 seal.
 *
 * Headline rate: among startups with a verified post-prediction funder,
 * share where that funder sat in sealed or live top-5 (firm identity).
 *
 * Usage:
 *   npm run outcomes:matched
 *   npm run outcomes:matched -- --summary
 *   npm run outcomes:matched:summary
 */
import 'dotenv/config';
import pg from 'pg';

const conn = process.env.DATABASE_URL;
if (!conn) {
  console.error('DATABASE_URL required');
  process.exit(1);
}

const asSummary = process.argv.includes('--summary');

function massageConnectionString(connectionString) {
  const s = String(connectionString || '');
  if (/sslmode=no-verify/i.test(s)) return s;
  if (/sslmode=/i.test(s)) return s.replace(/sslmode=[^&]*/i, 'sslmode=no-verify');
  return s.includes('?') ? `${s}&sslmode=no-verify` : `${s}?sslmode=no-verify`;
}

const pool = new pg.Pool({ connectionString: massageConnectionString(conn), max: 1 });

const verifiedSql = `
  WITH   investor_keys AS (
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
  investor_firm AS (
    SELECT
      investor_id,
      array_remove(ARRAY[
        'investor:' || investor_id::text,
        CASE WHEN organization_id IS NOT NULL THEN 'org:' || organization_id::text END,
        CASE WHEN coalesce(firm_label, '') <> '' THEN 'label:' || firm_label END
      ], NULL) AS firm_keys
    FROM investor_keys
  ),
  verified AS (
    SELECT
      e.startup_id,
      e.investor_id,
      e.match_id,
      su.name AS startup,
      i.name AS investor,
      e.evidence_type,
      e.event_at,
      m.created_at AS match_at,
      round(extract(epoch FROM (e.event_at - m.created_at)) / 86400.0, 1) AS days_after_match,
      m.match_score,
      e.source_provider,
      left(e.source_url, 100) AS source_url,
      f.firm_keys
    FROM match_validation_evidence e
    JOIN startup_investor_matches m ON m.id = e.match_id
    JOIN startup_uploads su ON su.id = e.startup_id
    JOIN investors i ON i.id = e.investor_id
    JOIN investor_firm f ON f.investor_id = e.investor_id
    WHERE e.verified
      AND e.startup_id = m.startup_id
      AND e.investor_id = m.investor_id
      AND e.event_at > m.created_at
      AND e.evidence_type IN ('funding', 'investment')
  ),
  sealed AS (
    SELECT
      s.startup_id,
      s.investor_id,
      s.rank_position,
      f.firm_keys
    FROM funding_prediction_snapshots s
    JOIN investor_firm f ON f.investor_id = s.investor_id
    WHERE s.cohort_key = 'served-first-top5'
      AND s.rank_position BETWEEN 1 AND 5
  ),
  sealed_best AS (
    SELECT DISTINCT ON (startup_id, firm_keys)
      startup_id,
      investor_id,
      rank_position,
      firm_keys
    FROM sealed
    ORDER BY startup_id, firm_keys, rank_position ASC
  ),
  live_unique AS (
    SELECT
      m.startup_id,
      m.investor_id,
      f.firm_keys,
      m.match_score,
      m.created_at,
      row_number() OVER (
        PARTITION BY m.startup_id, f.firm_keys
        ORDER BY m.match_score DESC NULLS LAST, m.created_at ASC, m.id ASC
      ) AS firm_dup_rank
    FROM startup_investor_matches m
    JOIN investor_firm f ON f.investor_id = m.investor_id
    WHERE m.startup_id IN (SELECT startup_id FROM verified)
      AND coalesce(m.status, 'suggested') IN ('suggested', 'accepted')
  ),
  live_rank AS (
    SELECT
      startup_id,
      investor_id,
      firm_keys,
      row_number() OVER (
        PARTITION BY startup_id
        ORDER BY match_score DESC NULLS LAST, created_at ASC
      ) AS live_rank
    FROM live_unique
    WHERE firm_dup_rank = 1
  )
  SELECT
    v.startup_id,
    v.investor_id,
    v.match_id,
    v.startup,
    v.investor,
    v.evidence_type,
    v.event_at,
    v.match_at,
    v.days_after_match,
    v.match_score,
    v.source_provider,
    v.source_url,
    v.firm_keys,
    s.rank_position AS sealed_rank,
    lr.live_rank,
    CASE
      WHEN s.firm_keys IS NOT NULL THEN 'sealed_top5'
      WHEN lr.live_rank IS NOT NULL AND lr.live_rank <= 5 THEN 'live_top5_unsealed'
      ELSE 'outside_top5'
    END AS placement
  FROM verified v
  LEFT JOIN sealed_best s
    ON s.startup_id = v.startup_id AND s.firm_keys && v.firm_keys
  LEFT JOIN live_rank lr
    ON lr.startup_id = v.startup_id AND lr.firm_keys && v.firm_keys
  ORDER BY v.event_at DESC
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
    (SELECT count(DISTINCT e.startup_id)::int FROM match_validation_evidence e
     JOIN startup_investor_matches m ON m.id = e.match_id
     WHERE e.verified
       AND e.startup_id = m.startup_id
       AND e.investor_id = m.investor_id
       AND e.event_at > m.created_at
       AND e.evidence_type IN ('funding', 'investment')) AS startups,
    (SELECT count(*)::int FROM match_validation_evidence e
     JOIN startup_investor_matches m ON m.id = e.match_id
     WHERE NOT e.verified AND e.review_status = 'pending' AND e.event_at > m.created_at) AS pending_pairs,
    (SELECT count(*)::int FROM match_outcome_classifications WHERE classification = 'verified_funding') AS classified_verified_funding
`;

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const k = row[key] || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

function uniqueStartups(rows, predicate = () => true) {
  return new Set(rows.filter(predicate).map((r) => r.startup_id)).size;
}

function isTop5Placement(placement) {
  return placement === 'sealed_top5' || placement === 'live_top5_unsealed';
}

function pct(numerator, denominator) {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  return Math.round((n / d) * 1000) / 10;
}

function formatRate(numerator, denominator) {
  const rate = pct(numerator, denominator);
  return rate == null ? 'n/a' : `${numerator}/${denominator} = ${rate}%`;
}

function firmDedupedPairs(verified) {
  const best = new Map();
  for (const row of verified) {
    const key = `${row.startup_id}|${row.firm_key}`;
    const cur = best.get(key);
    if (!cur || rankPlacement(row.placement) < rankPlacement(cur.placement)) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}

function rateSummary(verified) {
  const firms = firmDedupedPairs(verified);
  const startupIds = [...new Set(verified.map((r) => r.startup_id))];
  const startupHitAny = startupIds.filter((id) =>
    verified.some((r) => r.startup_id === id && isTop5Placement(r.placement)),
  ).length;
  const startupHitSealed = startupIds.filter((id) =>
    verified.some((r) => r.startup_id === id && r.placement === 'sealed_top5'),
  ).length;
  const firmTop5 = firms.filter((r) => isTop5Placement(r.placement)).length;
  const pairTop5 = verified.filter((r) => isTop5Placement(r.placement)).length;
  return {
    headline: {
      name: 'startup_hit_at_5_including_unsealed',
      hits: startupHitAny,
      startups: startupIds.length,
      rate_pct: pct(startupHitAny, startupIds.length),
    },
    startup_hit_at_5_including_unsealed: {
      hits: startupHitAny,
      startups: startupIds.length,
      rate_pct: pct(startupHitAny, startupIds.length),
    },
    startup_hit_at_5_sealed_only: {
      hits: startupHitSealed,
      startups: startupIds.length,
      rate_pct: pct(startupHitSealed, startupIds.length),
    },
    firm_pair_top5: {
      hits: firmTop5,
      pairs: firms.length,
      rate_pct: pct(firmTop5, firms.length),
    },
    raw_pair_top5: {
      hits: pairTop5,
      pairs: verified.length,
      rate_pct: pct(pairTop5, verified.length),
    },
    live_rank: rankBuckets(verified),
  };
}

function rankBuckets(verified) {
  const ranks = verified.map((r) => Number(r.live_rank)).filter((n) => Number.isFinite(n));
  const bucket = (lo, hi) => ranks.filter((n) => n >= lo && n <= hi).length;
  const sorted = [...ranks].sort((a, b) => a - b);
  const mid = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  return {
    n: ranks.length,
    p50: mid,
    rank_1_5: bucket(1, 5),
    rank_6_10: bucket(6, 10),
    rank_11_20: bucket(11, 20),
    rank_21_50: bucket(21, 50),
    rank_50_plus: ranks.filter((n) => n > 50).length,
  };
}

function placementSummary(verified) {
  const sealedPairs = verified.filter((r) => r.placement === 'sealed_top5');
  const liveUnsealedPairs = verified.filter((r) => r.placement === 'live_top5_unsealed');
  const anyTop5Pairs = verified.filter((r) => isTop5Placement(r.placement));
  const outsidePairs = verified.filter((r) => r.placement === 'outside_top5');
  return {
    sealed_top5: { pairs: sealedPairs.length, startups: uniqueStartups(sealedPairs) },
    live_top5_unsealed: { pairs: liveUnsealedPairs.length, startups: uniqueStartups(liveUnsealedPairs) },
    any_top5: { pairs: anyTop5Pairs.length, startups: uniqueStartups(anyTop5Pairs) },
    outside_top5: { pairs: outsidePairs.length, startups: uniqueStartups(outsidePairs) },
    startups_with_any_verified_pair: uniqueStartups(verified),
    startups_with_only_outside_top5: new Set(
      [...new Set(verified.map((r) => r.startup_id))].filter((id) => {
        const rows = verified.filter((r) => r.startup_id === id);
        return rows.length > 0 && rows.every((r) => r.placement === 'outside_top5');
      }),
    ).size,
  };
}

function rankPlacement(placement) {
  if (placement === 'sealed_top5') return 0;
  if (placement === 'live_top5_unsealed') return 1;
  return 2;
}

function startupRollup(verified) {
  const byStartup = new Map();
  for (const row of verified) {
    const cur = byStartup.get(row.startup_id) || {
      startup: row.startup,
      pairs: 0,
      investors: new Set(),
      best_placement: 'outside_top5',
    };
    cur.pairs += 1;
    cur.investors.add(row.investor);
    if (rankPlacement(row.placement) < rankPlacement(cur.best_placement)) {
      cur.best_placement = row.placement;
    }
    byStartup.set(row.startup_id, cur);
  }
  return [...byStartup.values()]
    .map((row) => ({
      startup: row.startup,
      pairs: row.pairs,
      investors: [...row.investors].sort(),
      best_placement: row.best_placement,
    }))
    .sort((a, b) => b.pairs - a.pairs || a.startup.localeCompare(b.startup));
}

function printScoreboard(summary, placement, pendingByTier, rates) {
  const headline = rates.startup_hit_at_5_including_unsealed;
  console.log('Overall matched investments (pair layer, including non-sealed top 5)');
  console.log(
    `  HIT RATE:                 ${headline.rate_pct}%   ${headline.hits} of ${headline.startups} startups had a matched funder in top-5`,
  );
  console.log(`  sealed-only hit rate:     ${formatRate(rates.startup_hit_at_5_sealed_only.hits, rates.startup_hit_at_5_sealed_only.startups)}`);
  console.log(`  firm-deduped pair top-5:  ${formatRate(rates.firm_pair_top5.hits, rates.firm_pair_top5.pairs)}`);
  console.log(`  raw pair top-5:           ${formatRate(rates.raw_pair_top5.hits, rates.raw_pair_top5.pairs)}`);
  if (rates.live_rank) {
    console.log(
      `  live rank of funders:     p50=${rates.live_rank.p50}  1-5=${rates.live_rank.rank_1_5}  6-10=${rates.live_rank.rank_6_10}  11-20=${rates.live_rank.rank_11_20}  21-50=${rates.live_rank.rank_21_50}  50+=${rates.live_rank.rank_50_plus}`,
    );
  }
  console.log(`  verified pairs:           ${summary.verified_pairs} across ${summary.startups} startups`);
  console.log(`  pending review:           ${summary.pending_pairs}`);
  console.log('  placement:');
  console.log(`    any top-5 (sealed+live): ${placement.any_top5.pairs} pairs / ${placement.any_top5.startups} startups`);
  console.log(`    sealed top-5:            ${placement.sealed_top5.pairs} pairs / ${placement.sealed_top5.startups} startups`);
  console.log(`    live top-5, no seal:     ${placement.live_top5_unsealed.pairs} pairs / ${placement.live_top5_unsealed.startups} startups`);
  console.log(`    outside top-5:           ${placement.outside_top5.pairs} pairs / ${placement.outside_top5.startups} startups`);
  console.log(`    startups outside only:   ${placement.startups_with_only_outside_top5}`);
  if (Object.keys(pendingByTier).length) {
    console.log(`  pending by source tier:  ${JSON.stringify(pendingByTier)}`);
  }
}

try {
  const [{ rows: summaryRows }, { rows: verified }, { rows: pending }] = await Promise.all([
    pool.query(summarySql),
    pool.query(verifiedSql),
    pool.query(pendingSql),
  ]);

  const summary = summaryRows[0];
  const pendingByTier = countBy(pending, 'source_tier');
  const placement = placementSummary(verified);
  const rates = rateSummary(verified);
  const startups = startupRollup(verified);

  const payload = {
    generated_at: new Date().toISOString(),
    working_metric: 'startup_hit_at_5_including_unsealed',
    headline_rate_pct: rates.headline.rate_pct,
    summary: {
      ...summary,
      placement,
      rates,
    },
    pending_by_source_tier: pendingByTier,
    startups_with_verified_pairs: startups,
    verified_matched_investments: verified,
    pending_review: pending,
  };

  if (asSummary) {
    printScoreboard(summary, placement, pendingByTier, rates);
    console.log('\nStartups with a verified post-prediction funder:');
    for (const row of startups) {
      console.log(
        `  ${row.startup}  ${row.pairs} pair${row.pairs === 1 ? '' : 's'}  [${row.best_placement}]  ${row.investors.join(', ')}`,
      );
    }
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
} finally {
  await pool.end();
}
