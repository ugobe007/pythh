'use strict';

/**
 * Load a subscriber's persisted top matches for the daily brief.
 * Uses existing startup_investor_matches — does not rematch or rewrite clocks.
 */

async function loadSubscriberMatches(supabase, { startupUrl, startupId, limit = 5 } = {}) {
  if (!supabase) return null;
  let startup = null;

  if (startupId) {
    const { data } = await supabase
      .from('startup_uploads')
      .select('id, name, website, total_god_score')
      .eq('id', startupId)
      .maybeSingle();
    startup = data || null;
  }

  if (!startup && startupUrl) {
    try {
      const { resolveApprovedStartupUploadForUrl } = require('./resolveStartupUploadForUrl');
      startup = await resolveApprovedStartupUploadForUrl(supabase, { inputRaw: startupUrl });
    } catch {
      startup = null;
    }
  }

  if (!startup?.id) {
    return {
      startupName: null,
      inspectUrl: startupUrl || null,
      matches: [],
      pending: true,
    };
  }

  const { data: rows, error } = await supabase
    .from('startup_investor_matches')
    .select('match_score, reasoning, investor_id')
    .eq('startup_id', startup.id)
    .order('match_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[newsletter] subscriber matches:', error.message);
    return {
      startupName: startup.name || null,
      inspectUrl: startupUrl || startup.website || null,
      matches: [],
      pending: true,
    };
  }

  const investorIds = [...new Set((rows || []).map((r) => r.investor_id).filter(Boolean))];
  let investorMap = {};
  if (investorIds.length) {
    const { data: investors } = await supabase
      .from('investors')
      .select('id, name, firm')
      .in('id', investorIds);
    investorMap = Object.fromEntries((investors || []).map((i) => [i.id, i]));
  }

  const matches = (rows || []).map((row) => {
    const inv = investorMap[row.investor_id] || {};
    return {
      match_score: row.match_score,
      reasoning: row.reasoning,
      investor: {
        name: inv.name || null,
        firm_name: inv.firm || inv.name || null,
      },
    };
  });

  return {
    startupName: startup.name || null,
    godScore: startup.total_god_score ?? null,
    inspectUrl: startupUrl || startup.website || null,
    matches,
    pending: matches.length === 0,
  };
}

module.exports = { loadSubscriberMatches };
