/**
 * Recompute startup_signal_scores from pythh_signal_events for one startup.
 * Mirrors scripts/sync-signal-scores.js — run after new signals are written (e.g. instant submit Phase 4).
 * If there are no pythh signals, returns { ok: false, reason: 'no_signals' } and does not overwrite GOD-seeded rows.
 */

'use strict';

const FOUNDER_LANGUAGE_CLASSES = {
  exploratory_signal: 1.0,
  product_signal: 0.9,
  market_position_signal: 0.8,
  gtm_signal: 0.8,
  expansion_signal: 0.6,
  buyer_signal: 0.5,
  exit_signal: 0.5,
};

const INVESTOR_RECEPTIVITY_CLASSES = {
  fundraising_signal: 1.0,
  revenue_signal: 0.9,
  growth_signal: 0.85,
  acquisition_signal: 0.8,
  enterprise_signal: 0.75,
  demand_signal: 0.7,
  efficiency_signal: 0.65,
  distress_signal: 0.3,
};

const CAPITAL_CONVERGENCE_CLASSES = {
  fundraising_signal: 1.0,
  acquisition_signal: 0.9,
  exit_signal: 0.85,
  revenue_signal: 0.75,
  growth_signal: 0.65,
  distress_signal: 0.4,
};

const EXECUTION_VELOCITY_CLASSES = {
  product_signal: 1.0,
  hiring_signal: 0.9,
  growth_signal: 0.85,
  expansion_signal: 0.8,
  partnership_signal: 0.75,
  gtm_signal: 0.7,
  demand_signal: 0.6,
};

const NEWS_SOURCE_WEIGHTS = {
  execution_signals: 0.85,
  web_signals: 0.65,
  rss_scrape: 1.0,
  sec_edgar: 0.85,
  llm_enrichment: 0.35,
  social_signal: 0.45,
  description: 0.0,
  pitch: 0.0,
  problem: 0.0,
  solution: 0.0,
  value_proposition: 0.0,
  tagline: 0.0,
  market: 0.0,
  founder_upload: 0.0,
  structured_metrics: 0.0,
};

const CAP = {
  founder_language_shift: 2.0,
  investor_receptivity: 2.5,
  news_momentum: 1.5,
  capital_convergence: 2.0,
  execution_velocity: 2.0,
};

const DAY_MS = 86_400_000;

function ageMs(detectedAt) {
  return Math.max(0, Date.now() - new Date(detectedAt).getTime());
}

function recencyMult(detectedAt) {
  const ageDays = ageMs(detectedAt) / DAY_MS;
  if (ageDays < 7) return 1.5;
  if (ageDays < 30) return 1.0;
  if (ageDays < 90) return 0.7;
  return 0.4;
}

function sumDimension(signals, classWeights, recency) {
  let score = 0;
  for (const s of signals) {
    const w = classWeights[s.primary_signal];
    if (!w) continue;
    const conf = s.confidence ?? 0.5;
    const strength = s.signal_strength ?? 0.5;
    const rec = recency ? recencyMult(s.detected_at) : 1.0;
    score += conf * strength * w * rec;
  }
  return score;
}

function computeNewsMomentum(signals) {
  let score = 0;
  for (const s of signals) {
    const w = NEWS_SOURCE_WEIGHTS[s.source_type] ?? 0;
    if (!w) continue;
    const conf = s.confidence ?? 0.5;
    const rec = recencyMult(s.detected_at);
    score += conf * w * rec * 0.15;
  }
  return score;
}

function clamp(val, cap) {
  return Math.round(Math.min(Math.max(val, 0), cap) * 10) / 10;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ startupUploadId: string, entityId?: string | null }} opts
 * @returns {Promise<{ ok: boolean, reason?: string, signals_total?: number }>}
 */
async function recomputeStartupSignalScoresFromPythh(supabase, { startupUploadId, entityId: entityIdOpt }) {
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

  const founder_language_shift = clamp(
    sumDimension(signals, FOUNDER_LANGUAGE_CLASSES, false),
    CAP.founder_language_shift
  );
  const investor_receptivity = clamp(
    sumDimension(signals, INVESTOR_RECEPTIVITY_CLASSES, false),
    CAP.investor_receptivity
  );
  const news_momentum = clamp(computeNewsMomentum(signals), CAP.news_momentum);
  const capital_convergence = clamp(
    sumDimension(signals, CAPITAL_CONVERGENCE_CLASSES, true),
    CAP.capital_convergence
  );
  const execution_velocity = clamp(
    sumDimension(signals, EXECUTION_VELOCITY_CLASSES, true),
    CAP.execution_velocity
  );
  const signals_total = clamp(
    founder_language_shift + investor_receptivity + news_momentum + capital_convergence + execution_velocity,
    10.0
  );

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
    `  ✅ [signals] Recomputed from pythh_signal_events: total=${signals_total} (startup=${startupUploadId.slice(0, 8)}…, n=${signals.length})`
  );
  return { ok: true, signals_total };
}

module.exports = { recomputeStartupSignalScoresFromPythh };
