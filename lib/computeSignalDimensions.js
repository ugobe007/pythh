'use strict';

const { clamp, applyGodBlendToSignalDimensions } = require('./signalScoreGodBlend');

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

function computeNewsMomentum(signals, newsSourceWeights) {
  let score = 0;
  for (const s of signals) {
    const w = newsSourceWeights[s.source_type] ?? 0;
    if (!w) continue;
    const conf = s.confidence ?? 0.5;
    const rec = recencyMult(s.detected_at);
    score += conf * w * rec * 0.15;
  }
  return score;
}

/**
 * Compute blended startup_signal_scores row fields from pythh_signal_events.
 * @param {object[]} signals
 * @param {import('./signalWeightDefaults').DEFAULT_SIGNAL_WEIGHT_CONFIG} weightConfig
 * @param {number|null|undefined} godScore
 */
function computeSignalScoresFromEvents(signals, weightConfig, godScore) {
  const caps = weightConfig.dimensionCaps;
  const dcw = weightConfig.dimensionClassWeights;

  const founder_language_shift_raw = clamp(
    sumDimension(signals, dcw.founder_language_shift, false),
    caps.founder_language_shift
  );
  const investor_receptivity_raw = clamp(
    sumDimension(signals, dcw.investor_receptivity, false),
    caps.investor_receptivity
  );
  const news_momentum_raw = clamp(
    computeNewsMomentum(signals, weightConfig.newsSourceWeights),
    caps.news_momentum
  );
  const capital_convergence_raw = clamp(
    sumDimension(signals, dcw.capital_convergence, true),
    caps.capital_convergence
  );
  const execution_velocity_raw = clamp(
    sumDimension(signals, dcw.execution_velocity, true),
    caps.execution_velocity
  );

  const blended = applyGodBlendToSignalDimensions(
    {
      founder_language_shift: founder_language_shift_raw,
      investor_receptivity: investor_receptivity_raw,
      news_momentum: news_momentum_raw,
      capital_convergence: capital_convergence_raw,
      execution_velocity: execution_velocity_raw,
    },
    signals.length,
    godScore,
    caps
  );

  return {
    ...blended,
    weightConfigVersion: weightConfig.version,
  };
}

module.exports = {
  computeSignalScoresFromEvents,
  sumDimension,
  computeNewsMomentum,
  recencyMult,
};
