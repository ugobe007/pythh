/**
 * After matches exist: enqueue funding-evidence search + freeze Hit@5 top-5.
 * Awaited (not fire-and-forget) so serverless/request teardown cannot drop the work.
 *
 * Used by instant submit (sync + BG), match worker, and proof-cohort backfill.
 */
'use strict';

const { enqueueFundingEvidenceSearch } = require('./enqueueFundingEvidenceSearch');
const { freezeTopFiveIfAbsent } = require('./freezeFundingPredictionSnapshot');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} startupId
 * @param {{ source?: string, predictionKind?: string, modelVersionFallback?: string }} [opts]
 */
async function instrumentMatchOutcomes(supabase, startupId, opts = {}) {
  const source = opts.source || 'instrument';
  if (!supabase || !startupId) {
    return { ok: false, skipped: true, error: 'missing_args' };
  }

  const enqueue = await enqueueFundingEvidenceSearch(supabase, startupId, { source });

  let freeze = { frozen: false, reason: 'not_attempted' };
  try {
    freeze = await freezeTopFiveIfAbsent({
      supabase,
      startupId,
      predictionKind: opts.predictionKind || 'served_impression',
      modelVersionFallback: opts.modelVersionFallback || 'v3.5-instant-submit',
    });
    if (freeze.frozen) {
      console.log(`  🧊 [PRED] Frozen top-5 for ${startupId} via ${source} @ ${freeze.predicted_at}`);
    } else if (freeze.reason && freeze.reason !== 'already_frozen') {
      console.log(`  🧊 [PRED] Skip freeze (${source}): ${freeze.reason}`);
    }
  } catch (err) {
    console.warn(`  ⚠️ [PRED] freeze failed (${source}): ${err.message}`);
    freeze = { frozen: false, reason: 'error', error: err.message };
  }

  return {
    ok: Boolean(enqueue?.ok !== false),
    enqueue,
    freeze,
  };
}

/** Log-and-continue wrapper for paths that must not throw. */
async function instrumentMatchOutcomesSafe(supabase, startupId, opts = {}) {
  try {
    return await instrumentMatchOutcomes(supabase, startupId, opts);
  } catch (err) {
    console.warn(
      `[instrument] ${opts.source || 'instrument'} failed for ${startupId}: ${err?.message || err}`,
    );
    return { ok: false, error: String(err?.message || err) };
  }
}

module.exports = {
  instrumentMatchOutcomes,
  instrumentMatchOutcomesSafe,
};
