/**
 * Enqueue a startup into funding_evidence_search_queue after matches are written.
 * Fire-and-forget safe: never throws to callers; logs on failure.
 *
 * Prediction clock = earliest startup_investor_matches.created_at (persistent).
 * Skips junk / parks weak identities so continual reconciliation drains real startups.
 */
'use strict';

const { fetchEarliestMatchAt, syncQueueEarliestMatchAt } = require('./syncQueueEarliestMatchAt.js');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} startupId
 * @param {{ priorityBoost?: number, source?: string }} [opts]
 * @returns {Promise<{ ok: boolean, skipped?: boolean, error?: string }>}
 */
async function enqueueFundingEvidenceSearch(supabase, startupId, opts = {}) {
  if (!startupId || !supabase) return { ok: false, skipped: true, error: 'missing args' };
  try {
    const { data: startup, error: startupErr } = await supabase
      .from('startup_uploads')
      .select('id, status, entity_gate, source_type, website, total_god_score')
      .eq('id', startupId)
      .maybeSingle();
    if (startupErr) throw new Error(startupErr.message);
    if (!startup || startup.status !== 'approved') {
      return { ok: true, skipped: true, error: 'not_approved' };
    }
    if (startup.entity_gate === 'junk') {
      return { ok: true, skipped: true, error: 'junk_entity_gate' };
    }

    const earliest = await fetchEarliestMatchAt(supabase, startupId);
    if (!earliest) return { ok: true, skipped: true };

    const { count, error: countErr } = await supabase
      .from('startup_investor_matches')
      .select('id', { count: 'exact', head: true })
      .eq('startup_id', startupId);
    if (countErr) throw new Error(countErr.message);

    const isQualifiedUrl =
      startup.entity_gate === 'qualified' &&
      startup.source_type === 'url' &&
      Boolean(String(startup.website || '').trim());

    let priority = Math.min(100000, Number(count || 0) + Number(opts.priorityBoost || 0));
    if (isQualifiedUrl) {
      priority = Math.max(priority, 20000) + Math.min(Number(startup.total_god_score) || 0, 100);
    } else {
      priority = 0;
    }

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
        error_message: isQualifiedUrl ? 'enqueue:qualified_url' : 'enqueue:parked_weak_identity',
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    const patch = {
      priority: isQualifiedUrl
        ? Math.max(existing.priority || 0, priority)
        : Math.min(existing.priority || 0, 0),
      earliest_match_at: earliest,
      updated_at: new Date().toISOString(),
    };
    if (isQualifiedUrl && (existing.status === 'complete' || existing.status === 'error')) {
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
    await syncQueueEarliestMatchAt(supabase, startupId);
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
