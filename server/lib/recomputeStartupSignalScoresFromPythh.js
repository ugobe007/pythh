/**
 * Recompute startup_signal_scores from pythh_signal_events for one startup.
 * Uses lib/computeSignalDimensions.js + lib/signalWeightConfig.js (admin-editable weights).
 */

'use strict';

const { loadSignalWeightConfig } = require('../../lib/signalWeightConfig');
const { computeSignalScoresFromEvents } = require('../../lib/computeSignalDimensions');

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ startupUploadId: string, entityId?: string | null, godScore?: number | null }} opts
 * @returns {Promise<{ ok: boolean, reason?: string, signals_total?: number }>}
 */
async function recomputeStartupSignalScoresFromPythh(supabase, { startupUploadId, entityId: entityIdOpt, godScore }) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(startupUploadId)) {
    return { ok: false, reason: 'invalid_startup_id' };
  }

  let entityId = entityIdOpt;
  if (!entityId) {
    const { data: ent } = await supabase
      .from('pythh_entities')
      .select('id')
      .eq('startup_upload_id', startupUploadId)
      .maybeSingle();
    entityId = ent?.id || null;
  }
  if (!entityId) {
    return { ok: false, reason: 'no_entity' };
  }

  const { data: signals, error: sigErr } = await supabase
    .from('pythh_signal_events')
    .select('entity_id, primary_signal, confidence, signal_strength, source_type, detected_at')
    .eq('entity_id', entityId);

  if (sigErr) {
    console.warn('[recomputeStartupSignalScoresFromPythh] load signals:', sigErr.message);
    return { ok: false, reason: 'load_error' };
  }

  if (!signals?.length) {
    return { ok: false, reason: 'no_signals' };
  }

  const weightConfig = await loadSignalWeightConfig(supabase);
  const blended = computeSignalScoresFromEvents(signals, weightConfig, godScore);
  const {
    founder_language_shift,
    investor_receptivity,
    news_momentum,
    capital_convergence,
    execution_velocity,
    signals_total,
    eventSum,
    blendWeight,
    godPrior,
    weightConfigVersion,
  } = blended;

  const { error: upErr } = await supabase.from('startup_signal_scores').upsert(
    {
      startup_id: startupUploadId,
      as_of: new Date().toISOString(),
      signals_total,
      founder_language_shift,
      investor_receptivity,
      news_momentum,
      capital_convergence,
      execution_velocity,
      debug: {
        entity_id: entityId,
        signal_count: signals.length,
        event_sum_before_blend: eventSum,
        god_prior: godPrior,
        blend_weight: godPrior != null ? blendWeight : null,
        god_score_input: godScore ?? null,
        weight_config_version: weightConfigVersion,
        source: 'recomputeStartupSignalScoresFromPythh',
        computed_at: new Date().toISOString(),
      },
    },
    { onConflict: 'startup_id' }
  );

  if (upErr) {
    console.warn('[recomputeStartupSignalScoresFromPythh] upsert:', upErr.message);
    return { ok: false, reason: 'upsert_error' };
  }

  console.log(
    `  ✅ [signals] Recomputed from pythh_signal_events: total=${signals_total} (startup=${startupUploadId.slice(0, 8)}…, n=${signals.length}, weights=${weightConfigVersion})`
  );
  return { ok: true, signals_total };
}

module.exports = { recomputeStartupSignalScoresFromPythh };
