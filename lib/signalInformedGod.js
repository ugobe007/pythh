/**
 * Signal-informed GOD — load market/entity signal dims BEFORE startup GOD,
 * map them into scoring-profile fields GOD already understands, and prefer
 * real signals_total for matching instead of inventing signals from GOD.
 *
 * Live weight retune remains gated (AGENTS.md proof cohort ≥5 verified pairs).
 * This module only shares signal *features* with GOD; it does not change
 * GOD_SCORE_CONFIG divisors/weights.
 */

'use strict';

const { loadSignalWeightConfig } = require('./signalWeightConfig');
const { computeSignalScoresFromEvents } = require('./computeSignalDimensions');
const { extractVoiceTexts } = require('./founderVoiceAnalysis');

/**
 * Compute signal dimensions from pythh_signal_events WITHOUT a GOD prior
 * (godScore=null → blend trusts event sums).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ startupUploadId: string, entityId?: string|null }} opts
 * @returns {Promise<null | {
 *   dims: object,
 *   signals_total: number,
 *   signal_count: number,
 *   entity_id: string,
 * }>}
 */
async function loadSignalDimsBeforeGod(supabase, { startupUploadId, entityId: entityIdOpt }) {
  if (!startupUploadId) return null;

  let entityId = entityIdOpt || null;
  if (!entityId) {
    const { data: ent } = await supabase
      .from('pythh_entities')
      .select('id')
      .eq('startup_upload_id', startupUploadId)
      .maybeSingle();
    entityId = ent?.id || null;
  }
  if (!entityId) return null;

  const { data: signals, error } = await supabase
    .from('pythh_signal_events')
    .select('entity_id, primary_signal, confidence, signal_strength, source_type, detected_at')
    .eq('entity_id', entityId);
  if (error || !signals?.length) return null;

  const weightConfig = await loadSignalWeightConfig(supabase);
  const { data: uploadRow } = await supabase
    .from('startup_uploads')
    .select('pitch, description, tagline, extracted_data, execution_signals, team_signals, grit_signals')
    .eq('id', startupUploadId)
    .maybeSingle();
  const voiceTexts = extractVoiceTexts(uploadRow);

  // godScore=null → no GOD→signal circular prior
  const blended = computeSignalScoresFromEvents(signals, weightConfig, null, { voiceTexts });

  return {
    dims: {
      founder_language_shift: blended.founder_language_shift,
      investor_receptivity: blended.investor_receptivity,
      news_momentum: blended.news_momentum,
      capital_convergence: blended.capital_convergence,
      execution_velocity: blended.execution_velocity,
    },
    signals_total: blended.signals_total,
    signal_count: signals.length,
    entity_id: entityId,
    weight_config_version: blended.weightConfigVersion,
  };
}

/**
 * Map independent signal dims into extracted_data / profile fields that
 * calculateHotScore already reads (press, execution, psych-adjacent).
 *
 * @param {object} startup - startup_uploads-shaped row
 * @param {{ founder_language_shift?: number, investor_receptivity?: number, news_momentum?: number, capital_convergence?: number, execution_velocity?: number }} dims
 */
function mergeSignalDimsIntoStartup(startup, dims) {
  if (!startup || !dims) return startup;
  const extracted = { ...(startup.extracted_data || {}) };
  const news = Number(dims.news_momentum) || 0;
  const capital = Number(dims.capital_convergence) || 0;
  const velocity = Number(dims.execution_velocity) || 0;
  const founderShift = Number(dims.founder_language_shift) || 0;
  const receptivity = Number(dims.investor_receptivity) || 0;

  const prevSocial = extracted.social_signals || {};
  const prevWeb = extracted.web_signals || {};
  const prevPress = prevWeb.press_tier || {};

  const pressBoost = Math.round(news * 4);
  const newsCountBoost = Math.round(news * 3);

  const execution = [...(extracted.execution_signals || [])];
  if (velocity >= 1.2 && !execution.includes('signal_informed_velocity')) {
    execution.push('signal_informed_velocity');
  }
  if (capital >= 1.2 && !execution.includes('signal_informed_capital')) {
    execution.push('signal_informed_capital');
  }

  // Psych-adjacent flags GOD's calculatePsychologicalBonus can pick up when present
  const psych = {
    ...(extracted.psychological_signals || {}),
  };
  if (founderShift >= 1.5) psych.conviction = Math.max(Number(psych.conviction) || 0, 0.6);
  if (receptivity >= 1.5) psych.fomo = Math.max(Number(psych.fomo) || 0, 0.5);
  if (velocity >= 1.5) psych.urgency = Math.max(Number(psych.urgency) || 0, 0.5);

  return {
    ...startup,
    extracted_data: {
      ...extracted,
      signal_informed: {
        ...dims,
        applied_at: new Date().toISOString(),
        source: 'signal_before_god',
      },
      social_signals: {
        ...prevSocial,
        news_count: Math.max(Number(prevSocial.news_count) || 0, newsCountBoost),
      },
      web_signals: {
        ...prevWeb,
        press_tier: {
          ...prevPress,
          total: Math.max(Number(prevPress.total) || 0, pressBoost),
          tier2_count: Math.max(
            Number(prevPress.tier2_count) || 0,
            news >= 1 ? Math.round(news) : 0,
          ),
        },
      },
      execution_signals: execution,
      psychological_signals: psych,
      // Mild traction confidence lift when capital signals are present
      ...(capital >= 1.5 && !extracted.has_revenue
        ? { signal_informed_capital_hint: true }
        : {}),
    },
  };
}

/**
 * Persist signal dims computed before GOD (no circular prior).
 */
async function upsertSignalScoresFromPreGod(supabase, startupId, preGod) {
  if (!preGod?.dims) return { ok: false, reason: 'no_dims' };
  const { error } = await supabase.from('startup_signal_scores').upsert(
    {
      startup_id: startupId,
      as_of: new Date().toISOString(),
      signals_total: preGod.signals_total,
      founder_language_shift: preGod.dims.founder_language_shift,
      investor_receptivity: preGod.dims.investor_receptivity,
      news_momentum: preGod.dims.news_momentum,
      capital_convergence: preGod.dims.capital_convergence,
      execution_velocity: preGod.dims.execution_velocity,
      debug: {
        entity_id: preGod.entity_id,
        signal_count: preGod.signal_count,
        god_prior: null,
        blend_weight: 1,
        weight_config_version: preGod.weight_config_version,
        source: 'signal_before_god',
        computed_at: new Date().toISOString(),
      },
    },
    { onConflict: 'startup_id' },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true, signals_total: preGod.signals_total };
}

module.exports = {
  loadSignalDimsBeforeGod,
  mergeSignalDimsIntoStartup,
  upsertSignalScoresFromPreGod,
};
