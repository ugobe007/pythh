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

    let matchCount = 0;
    let validatedPairs = 0;
    try {
      const { data: stats } = await supabase.from('platform_stats_cache').select('matches').limit(1).maybeSingle();
      matchCount = Number(stats?.matches) || 0;
    } catch {
      /* cache optional */
    }
    try {
      const { count } = await supabase
        .from('match_validation_evidence')
        .select('id', { count: 'exact', head: true })
        .eq('verified', true);
      validatedPairs = count || 0;
    } catch {
      /* backfill table may be empty or not yet queried */
    }

    const proof = {
      verified_funded_picks: metrics.verified_funded_picks ?? 0,
      verified_funded_rate_pct: metrics.verified_funded_rate_pct ?? null,
      funded_picks: metrics.funded_picks ?? 0,
      total_picks: metrics.total_picks ?? 0,
      oracle_picks_at_threshold: metrics.oracle_picks_at_threshold ?? null,
      match_count: matchCount,
      validated_investment_pairs: validatedPairs,
      headline:
        metrics.verified_funded_picks > 0
          ? `${metrics.verified_funded_picks} GOD-scored picks later verified funded`
          : metrics.funded_picks > 0
            ? `${metrics.funded_picks} Oracle picks detected funded`
            : 'GOD scoring is validated on the public portfolio',
      engine_line: matchCount > 0
        ? `${Number(matchCount).toLocaleString()} timestamped matches. We're correlating which predicted investors actually invested — dates and amounts.`
        : "We're correlating timestamped matches with who actually invested — that's how we prove the engine.",
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
