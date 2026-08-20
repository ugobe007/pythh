/**
 * Keep funding_evidence_search_queue.earliest_match_at = min(match.created_at).
 * Never overwrite with funding announcement dates or "now".
 */
'use strict';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} startupId
 * @returns {Promise<string|null>} ISO earliest match timestamp
 */
async function fetchEarliestMatchAt(supabase, startupId) {
  const { data, error } = await supabase
    .from('startup_investor_matches')
    .select('created_at')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.created_at ? new Date(data.created_at).toISOString() : null;
}

/**
 * Upsert/patch queue row so earliest_match_at is the true prediction clock.
 * @returns {Promise<{ ok: boolean, earliest_match_at?: string|null, error?: string }>}
 */
async function syncQueueEarliestMatchAt(supabase, startupId) {
  if (!supabase || !startupId) return { ok: false, error: 'missing args' };
  try {
    const earliest = await fetchEarliestMatchAt(supabase, startupId);
    if (!earliest) return { ok: true, earliest_match_at: null };

    const { data: existing } = await supabase
      .from('funding_evidence_search_queue')
      .select('startup_id, earliest_match_at')
      .eq('startup_id', startupId)
      .maybeSingle();

    if (!existing) {
      return { ok: true, earliest_match_at: earliest };
    }

    const current = existing.earliest_match_at
      ? new Date(existing.earliest_match_at).toISOString()
      : null;
    // Always use the true minimum; never keep a later polluted value.
    if (current === earliest) return { ok: true, earliest_match_at: earliest };

    const { error } = await supabase
      .from('funding_evidence_search_queue')
      .update({
        earliest_match_at: earliest,
        updated_at: new Date().toISOString(),
        error_message: 'sync:earliest_match_at_rectified',
      })
      .eq('startup_id', startupId);
    if (error) throw new Error(error.message);
    return { ok: true, earliest_match_at: earliest };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

module.exports = {
  fetchEarliestMatchAt,
  syncQueueEarliestMatchAt,
};
