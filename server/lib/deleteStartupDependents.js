'use strict';

/**
 * Delete rows in child tables that reference startup_uploads.id without ON DELETE CASCADE.
 * Prefers admin_purge_startup_dependents RPC (SECURITY DEFINER); falls back to table deletes.
 */

const STARTUP_DEPENDENT_TABLES = [
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

async function purgeViaRpc(supabase, startupIds) {
  const { data, error } = await supabase.rpc('admin_purge_startup_dependents', {
    p_startup_ids: startupIds,
  });
  if (error) {
    if (isMissingRpcError(error)) return { ok: false, missing: true, error: error.message };
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

  const rpc = await purgeViaRpc(supabase, ids);
  if (rpc.ok) {
    results.push({ method: 'rpc', ok: true, data: rpc.data });
  } else if (!rpc.missing) {
    results.push({ method: 'rpc', ok: false, error: rpc.error });
  } else {
    for (const table of STARTUP_DEPENDENT_TABLES) {
      results.push(await deleteFromTable(supabase, table, ids));
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
