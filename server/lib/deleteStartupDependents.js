'use strict';

/**
 * Delete rows in child tables that reference startup_uploads.id without ON DELETE CASCADE.
 * Used before hard-deleting junk startups from admin tools.
 */

const STARTUP_DEPENDENT_TABLES = [
  'social_signals',
  'startup_investor_matches',
  'score_history',
  'match_gen_logs',
  'startup_signal_history',
  'startup_signal_score_history',
  'startup_signals',
  'match_queue',
  'virtual_portfolio',
  'virtual_portfolio_followons',
  'funding_rounds',
  'startup_exits',
  'psychological_signals',
  'faith_signals',
  'commitment_wizard_sessions',
  'commitment_wizard_events',
];

async function deleteFromTable(supabase, table, startupIds) {
  const { error } = await supabase.from(table).delete().in('startup_id', startupIds);
  if (!error) return { table, ok: true };
  // undefined_table — skip in environments without this table
  if (error.code === '42P01') return { table, ok: true, skipped: true };
  return { table, ok: false, error: error.message, code: error.code };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} startupIds
 * @returns {Promise<{ ok: boolean; results: object[]; failed: object[] }>}
 */
async function deleteStartupDependents(supabase, startupIds) {
  const ids = [...new Set(startupIds.map(String))].filter(Boolean);
  if (!ids.length) return { ok: true, results: [], failed: [] };

  const results = [];
  for (const table of STARTUP_DEPENDENT_TABLES) {
    results.push(await deleteFromTable(supabase, table, ids));
  }

  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, results, failed };
}

module.exports = { deleteStartupDependents, STARTUP_DEPENDENT_TABLES };
