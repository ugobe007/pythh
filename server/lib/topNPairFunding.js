'use strict';

/**
 * Place later funders on the pre-event match list (firm-deduped).
 * Used for Hit@5 vs Hit@50: did we already rank that investor before the raise?
 * Does not rematch or retune GOD/fit.
 */

const {
  predictionIdentityKeys,
  participantIdentityKeys,
  identityKeysOverlap,
} = require('./fundingHitIdentity.js');

function matchIdentityKeys(match, identityCtx) {
  return predictionIdentityKeys({ investor_id: match.investor_id }, identityCtx);
}

function rankFirmMatches(matches, identityCtx, { beforeMs } = {}) {
  const eligible = [];
  for (const match of matches || []) {
    const status = match.status || 'suggested';
    if (!['suggested', 'accepted'].includes(status)) continue;
    if (beforeMs != null) {
      const created = new Date(match.created_at).getTime();
      if (!Number.isFinite(created) || created >= beforeMs) continue;
    }
    const keys = matchIdentityKeys(match, identityCtx);
    if (!keys.length) continue;
    eligible.push({ match, keys, score: Number(match.match_score) || 0 });
  }
  eligible.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.match.created_at) - new Date(b.match.created_at);
  });
  const seen = new Set();
  const ranked = [];
  for (const row of eligible) {
    if (row.keys.some((key) => seen.has(key))) continue;
    row.keys.forEach((key) => seen.add(key));
    ranked.push({
      investor_id: row.match.investor_id,
      match_id: row.match.id,
      match_score: row.score,
      created_at: row.match.created_at,
      rank: ranked.length + 1,
      keys: row.keys,
    });
  }
  return ranked;
}

function placeFunderRank(funderKeys, ranked) {
  const keySet = new Set(funderKeys || []);
  if (!keySet.size) return null;
  const hit = (ranked || []).find((row) => identityKeysOverlap(row.keys, keySet));
  return hit ? hit.rank : null;
}

function rankBucket(rank, { topN = 50 } = {}) {
  if (rank == null) return 'never_matched';
  if (rank <= 5) return 'top_5';
  if (rank <= topN) return 'ranks_6_to_n';
  return 'outside_top_n';
}

function bestStartupRank(funderRanks) {
  const ranks = (funderRanks || []).filter((n) => Number.isFinite(n));
  if (!ranks.length) return null;
  return Math.min(...ranks);
}

function summarizeTopNPlacements(rows, { topN = 50 } = {}) {
  const startups = rows.length;
  const bucketCounts = { top_5: 0, ranks_6_to_n: 0, outside_top_n: 0, never_matched: 0 };
  let pairCount = 0;
  const pairBuckets = { top_5: 0, ranks_6_to_n: 0, outside_top_n: 0, never_matched: 0 };
  for (const row of rows) {
    const bucket = rankBucket(row.best_rank, { topN });
    bucketCounts[bucket] += 1;
    for (const pair of row.funders || []) {
      pairCount += 1;
      pairBuckets[rankBucket(pair.rank, { topN })] += 1;
    }
  }
  const top5 = bucketCounts.top_5;
  const topNHits = bucketCounts.top_5 + bucketCounts.ranks_6_to_n;
  const pairTop5 = pairBuckets.top_5;
  const pairTopN = pairBuckets.top_5 + pairBuckets.ranks_6_to_n;
  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
  return {
    top_n: topN,
    startups,
    startups_top_5: top5,
    startups_top_n: topNHits,
    startups_ranks_6_to_n: bucketCounts.ranks_6_to_n,
    startups_outside_top_n: bucketCounts.outside_top_n,
    startups_never_matched: bucketCounts.never_matched,
    startup_top_5_rate_pct: pct(top5, startups),
    startup_top_n_rate_pct: pct(topNHits, startups),
    pairs: pairCount,
    pairs_top_5: pairTop5,
    pairs_top_n: pairTopN,
    pairs_ranks_6_to_n: pairBuckets.ranks_6_to_n,
    pairs_outside_top_n: pairBuckets.outside_top_n,
    pairs_never_matched: pairBuckets.never_matched,
    pair_top_5_rate_pct: pct(pairTop5, pairCount),
    pair_top_n_rate_pct: pct(pairTopN, pairCount),
  };
}

module.exports = {
  matchIdentityKeys,
  rankFirmMatches,
  placeFunderRank,
  rankBucket,
  bestStartupRank,
  summarizeTopNPlacements,
  participantIdentityKeys,
  predictionIdentityKeys,
};
