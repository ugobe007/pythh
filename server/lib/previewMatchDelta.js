'use strict';

/**
 * Real match-movement stats for preview cliffhanger (no fabricated deltas).
 * Uses match created_at/updated_at + optional signal score history.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function getPreviewMatchDelta(supabase, startupId, { totalMatches = 0, topInvestorIds = [] } = {}) {
  if (!startupId) return null;

  const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();
  const topSet = new Set(topInvestorIds.filter(Boolean));

  let movedToward = 0;
  let movedAway = 0;

  try {
    const { data: recentRows, error } = await supabase
      .from('startup_investor_matches')
      .select('investor_id, match_score, created_at, updated_at')
      .eq('startup_id', startupId)
      .or(`created_at.gte.${weekAgo},updated_at.gte.${weekAgo}`)
      .limit(500);

    if (error) throw error;

    for (const row of recentRows || []) {
      const created = row.created_at ? new Date(row.created_at).getTime() : 0;
      const updated = row.updated_at ? new Date(row.updated_at).getTime() : created;
      const isNewThisWeek = created >= Date.now() - WEEK_MS;
      const wasRegenerated = updated - created > 60 * 60 * 1000 && updated >= Date.now() - WEEK_MS;

      if (!isNewThisWeek && !wasRegenerated) continue;

      if (topSet.has(row.investor_id)) {
        movedToward += 1;
      } else if (wasRegenerated) {
        movedAway += 1;
      }
    }
  } catch (err) {
    console.warn('[previewMatchDelta] match rows:', err.message);
  }

  let signalDelta = null;
  try {
    const { data: hist } = await supabase
      .from('startup_signal_score_history')
      .select('signals_total, captured_at')
      .eq('startup_id', startupId)
      .order('captured_at', { ascending: false })
      .limit(2);

    if (hist?.length >= 2) {
      const latest = Number(hist[0].signals_total);
      const prior = Number(hist[1].signals_total);
      if (Number.isFinite(latest) && Number.isFinite(prior)) {
        signalDelta = Math.round((latest - prior) * 10) / 10;
      }
    }
  } catch {
    /* table optional */
  }

  const hasMovement = movedToward > 0 || movedAway > 0;
  const hasSignal = signalDelta != null && signalDelta !== 0;

  if (!hasMovement && !hasSignal) {
    return null;
  }

  return {
    moved_toward_count: movedToward,
    moved_away_count: movedAway,
    match_count: totalMatches,
    screened_out_count: Math.max(0, totalMatches - topSet.size),
    signal_score_delta: signalDelta,
    source: hasMovement ? 'match_timestamps' : 'signal_score_history',
    window_days: 7,
  };
}

module.exports = { getPreviewMatchDelta };
