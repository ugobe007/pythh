/**
 * Enqueue a startup into funding_evidence_search_queue after matches are written.
 * Fire-and-forget safe: never throws to callers; logs on failure.
 *
 * Prediction clock = earliest startup_investor_matches.created_at for the startup.
 */
'use strict';

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} startupId
 * @param {{ priorityBoost?: number, source?: string }} [opts]
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function enqueueFundingEvidenceSearch(supabase, startupId, opts = {}) {
  if (!startupId || !supabase) return { ok: false, skipped: true, error: 'missing args' };
  try {
    const { data: matchAgg, error: matchErr } = await supabase
      .from('startup_investor_matches')
      .select('created_at')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (matchErr) throw new Error(matchErr.message);
    if (!matchAgg?.created_at) return { ok: true, skipped: true };

    const { count, error: countErr } = await supabase
      .from('startup_investor_matches')
      .select('id', { count: 'exact', head: true })
      .eq('startup_id', startupId);
    if (countErr) throw new Error(countErr.message);

    const priority = Math.min(100000, Number(count || 0) + Number(opts.priorityBoost || 0));
    const earliest = matchAgg.created_at;

    const { data: existing } = await supabase
      .from('funding_evidence_search_queue')
      .select('status,earliest_match_at,priority')
      .eq('startup_id', startupId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from('funding_evidence_search_queue').insert({
        startup_id: startupId,
        status: 'pending',
        priority,
        earliest_match_at: earliest,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Re-open completed/error rows when new matches may have been written;
    // keep processing alone so concurrent workers are not stomped.
    const patch = {
      priority: Math.max(existing.priority || 0, priority),
      earliest_match_at:
        existing.earliest_match_at && new Date(existing.earliest_match_at) < new Date(earliest)
          ? existing.earliest_match_at
          : earliest,
      updated_at: new Date().toISOString(),
    };
    if (existing.status === 'complete' || existing.status === 'error') {
      patch.status = 'pending';
      patch.error_message = opts.source
        ? `requeued_after_new_matches:${opts.source}`
        : 'requeued_after_new_matches';
    }

    const { error: upErr } = await supabase
      .from('funding_evidence_search_queue')
      .update(patch)
      .eq('startup_id', startupId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  } catch (err) {
    console.warn(
      `[funding-queue] enqueue failed for ${startupId}: ${err?.message || err}`,
    );
    return { ok: false, error: String(err?.message || err) };
  }
}

/** Non-blocking wrapper for request paths. */
function enqueueFundingEvidenceSearchAsync(supabase, startupId, opts) {
  void enqueueFundingEvidenceSearch(supabase, startupId, opts);
}

module.exports = {
  enqueueFundingEvidenceSearch,
  enqueueFundingEvidenceSearchAsync,
};
