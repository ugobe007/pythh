'use strict';

/**
 * Delete rows in child tables that reference startup_uploads.id without ON DELETE CASCADE.
 *
 * Strategy (avoids Supabase/Postgres statement_timeout on bulk junk deletes):
 *  1) Prefer per-startup chunked deletes for heavy tables (matches, evidence)
 *  2) Fall back to admin_purge_startup_dependents RPC only for tiny batches
 *  3) Clear RESTRICT FKs (match_validation_evidence) before matches / startups
 */

const STARTUP_DEPENDENT_TABLES = [
  'match_validation_evidence',
  'funding_evidence_search_results',
  'funding_evidence_search_queue',
  'social_signals',
  'startup_investor_matches',
  'score_history',
  'match_gen_logs',
  'startup_signal_history',
  'startup_signal_score_history',
  'startup_signals',
  'virtual_portfolio',
  'funding_rounds',
  'startup_exits',
  'psychological_signals',
];

/** Tables safe to wipe with a single .in(startup_id) per small batch */
const LIGHT_TABLES = [
  'funding_evidence_search_results',
  'funding_evidence_search_queue',
  'social_signals',
  'score_history',
  'match_gen_logs',
  'startup_signal_history',
  'startup_signal_score_history',
  'startup_signals',
  'virtual_portfolio',
  'funding_rounds',
  'startup_exits',
  'psychological_signals',
];

const MATCH_CHUNK = 80;
const EVIDENCE_CHUNK = 80;

function isSkippableTableError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST204' ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

function isTimeoutError(error) {
  if (!error) return false;
  const msg = String(error.message || error || '').toLowerCase();
  return msg.includes('statement timeout') || msg.includes('canceling statement');
}

function isMissingRpcError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('admin_purge_startup_dependents') ||
    msg.includes('could not find the function')
  );
}

async function countSocialSignals(supabase, startupIds) {
  const { count, error } = await supabase
    .from('social_signals')
    .select('*', { count: 'exact', head: true })
    .in('startup_id', startupIds);
  if (error) {
    if (isSkippableTableError(error)) return 0;
    throw error;
  }
  return count || 0;
}

async function deleteFromTable(supabase, table, startupIds) {
  const { error } = await supabase.from(table).delete().in('startup_id', startupIds);
  if (!error) return { table, ok: true };
  if (isSkippableTableError(error)) return { table, ok: true, skipped: true };
  return { table, ok: false, error: error.message, code: error.code };
}

/** Delete match_validation_evidence in small chunks (RESTRICT FK on startup_id). */
async function deleteEvidenceForStartup(supabase, startupId) {
  let deleted = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('match_validation_evidence')
      .select('id')
      .eq('startup_id', startupId)
      .limit(EVIDENCE_CHUNK);
    if (error) {
      if (isSkippableTableError(error)) return deleted;
      throw error;
    }
    if (!data?.length) break;
    const ids = data.map((r) => r.id);
    const { error: delErr } = await supabase.from('match_validation_evidence').delete().in('id', ids);
    if (delErr) throw delErr;
    deleted += ids.length;
    if (data.length < EVIDENCE_CHUNK) break;
  }
  return deleted;
}

/** Delete startup_investor_matches in small chunks (often 100–300+ rows per junk startup). */
async function deleteMatchesForStartup(supabase, startupId) {
  let deleted = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('startup_investor_matches')
      .select('id')
      .eq('startup_id', startupId)
      .limit(MATCH_CHUNK);
    if (error) {
      if (isSkippableTableError(error)) return deleted;
      throw error;
    }
    if (!data?.length) break;
    const ids = data.map((r) => r.id);
    // Evidence may also key off match_id
    const { error: evErr } = await supabase
      .from('match_validation_evidence')
      .delete()
      .in('match_id', ids);
    if (evErr && !isSkippableTableError(evErr)) throw evErr;
    const { error: delErr } = await supabase.from('startup_investor_matches').delete().in('id', ids);
    if (delErr) throw delErr;
    deleted += ids.length;
    if (data.length < MATCH_CHUNK) break;
  }
  return deleted;
}

async function purgeOneStartupChunked(supabase, startupId) {
  const stats = {
    startup_id: startupId,
    match_validation_evidence: await deleteEvidenceForStartup(supabase, startupId),
    startup_investor_matches: await deleteMatchesForStartup(supabase, startupId),
  };

  for (const table of LIGHT_TABLES) {
    const result = await deleteFromTable(supabase, table, [startupId]);
    if (!result.ok) {
      throw new Error(`${table}: ${result.error}`);
    }
    stats[table] = result.skipped ? 'skipped' : 'cleared';
  }

  return stats;
}

async function purgeViaRpc(supabase, startupIds) {
  const { data, error } = await supabase.rpc('admin_purge_startup_dependents', {
    p_startup_ids: startupIds,
  });
  if (error) {
    if (isMissingRpcError(error)) return { ok: false, missing: true, error: error.message };
    if (isTimeoutError(error)) return { ok: false, timeout: true, error: error.message };
    return { ok: false, error: error.message };
  }
  return { ok: true, data };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} startupIds
 * @returns {Promise<{ ok: boolean; results: object[]; failed: object[]; social_signals_remaining?: number }>}
 */
async function deleteStartupDependents(supabase, startupIds) {
  const ids = [...new Set(startupIds.map(String))].filter(Boolean);
  if (!ids.length) return { ok: true, results: [], failed: [] };

  const results = [];

  // Tiny batches can use the RPC; larger / any timeout → per-startup chunked path
  if (ids.length <= 3) {
    const rpc = await purgeViaRpc(supabase, ids);
    if (rpc.ok) {
      results.push({ method: 'rpc', ok: true, data: rpc.data });
    } else if (rpc.missing || rpc.timeout) {
      // fall through to chunked
    } else {
      results.push({ method: 'rpc', ok: false, error: rpc.error });
      return { ok: false, results, failed: results.filter((r) => r.ok === false) };
    }
  }

  if (!results.some((r) => r.method === 'rpc' && r.ok)) {
    for (const id of ids) {
      try {
        const stats = await purgeOneStartupChunked(supabase, id);
        results.push({ method: 'chunked', ok: true, ...stats });
      } catch (err) {
        results.push({
          method: 'chunked',
          ok: false,
          startup_id: id,
          error: String(err?.message || err),
        });
      }
    }
  }

  const failed = results.filter((r) => r.ok === false);
  if (failed.length) {
    return { ok: false, results, failed };
  }

  const remaining = await countSocialSignals(supabase, ids);
  if (remaining > 0) {
    return {
      ok: false,
      results,
      failed: [
        {
          table: 'social_signals',
          ok: false,
          error: `${remaining} social_signals row(s) still reference these startups — server needs SUPABASE_SERVICE_KEY or apply migration 20260624120000_social_signals_cascade_and_admin_purge.sql`,
        },
      ],
      social_signals_remaining: remaining,
    };
  }

  return { ok: true, results, failed: [] };
}

module.exports = { deleteStartupDependents, STARTUP_DEPENDENT_TABLES };
