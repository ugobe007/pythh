'use strict';

const { enrichPortfolioMetrics, computeTrackRecord } = require('./portfolioTrackRecord');

/**
 * Compact social-proof snippet for preview / outbound (cached-friendly).
 */
async function getPreviewOracleProof(supabase) {
  try {
    const record = await computeTrackRecord(supabase);
    const metrics = record?.oracle || {};
    const featured = record?.featured_pick || null;
    const top = (record?.top_performers || [])[0] || null;

    const proof = {
      verified_funded_picks: metrics.verified_funded_picks ?? 0,
      verified_funded_rate_pct: metrics.verified_funded_rate_pct ?? null,
      funded_picks: metrics.funded_picks ?? 0,
      total_picks: metrics.total_picks ?? 0,
      oracle_picks_at_threshold: metrics.oracle_picks_at_threshold ?? null,
      headline:
        metrics.verified_funded_picks > 0
          ? `${metrics.verified_funded_picks} Oracle picks verified funded`
          : metrics.funded_picks > 0
            ? `${metrics.funded_picks} Oracle picks detected funded`
            : 'Oracle fund tracks GOD 70+ picks live',
      featured_pick: featured
        ? {
            name: featured.name,
            entry_god_score: featured.entry_god_score,
            sector: featured.sector,
            verified: featured.verified,
          }
        : null,
      top_performer: top
        ? {
            name: top.name,
            entry_god_score: top.entry_god_score,
            moic: top.moic,
          }
        : null,
    };

    return proof;
  } catch (err) {
    console.warn('[previewOracleProof]', err.message);
    return null;
  }
}

module.exports = { getPreviewOracleProof, enrichPortfolioMetrics };
