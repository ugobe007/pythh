/**
 * GOD-weighted blend for startup_signal_scores derived from pythh_signal_events.
 * Keeps sparse event sums aligned with Phase 2 GOD seed (~5.5–9.5).
 * Used by recomputeStartupSignalScoresFromPythh and scripts/sync-signal-scores.js.
 */

'use strict';

function clamp(val, cap) {
  return Math.round(Math.min(Math.max(val, 0), cap) * 10) / 10;
}

/** Same mapping as instantSubmit Phase 2 seed: GOD 35→100 → signal total ~5.5–9.5 */
function godDerivedSignalTotal(godScore) {
  if (godScore == null || godScore === '') return null;
  const g = Number(godScore);
  if (!Number.isFinite(g)) return null;
  const normalized = Math.max(0, Math.min(1, (g - 35) / 65));
  return parseFloat((5.5 + normalized * 4.0).toFixed(1));
}

/**
 * @param {number} eventSum
 * @param {number} signalCount
 * @param {number|null|undefined} godScore
 * @returns {{ targetTotal: number, blendWeight: number, godPrior: number|null }}
 */
function blendTotalWithGodPrior(eventSum, signalCount, godScore) {
  const godPrior = godDerivedSignalTotal(godScore);
  if (godPrior == null) {
    return { targetTotal: clamp(eventSum, 10.0), blendWeight: 1, godPrior: null };
  }
  const w = Math.min(1, Math.max(0, signalCount / 20));
  const blended = w * eventSum + (1 - w) * godPrior;
  return { targetTotal: clamp(blended, 10.0), blendWeight: w, godPrior };
}

/**
 * @param {object} dims - pre-clamped dimension scores from pythh events
 * @param {number} signalCount
 * @param {number|null|undefined} godScore - startup_uploads.total_god_score
 * @param {object} CAP - per-dimension caps
 */
function applyGodBlendToSignalDimensions(dims, signalCount, godScore, CAP) {
  let founder_language_shift = dims.founder_language_shift;
  let investor_receptivity = dims.investor_receptivity;
  let news_momentum = dims.news_momentum;
  let capital_convergence = dims.capital_convergence;
  let execution_velocity = dims.execution_velocity;

  const eventSum =
    founder_language_shift +
    investor_receptivity +
    news_momentum +
    capital_convergence +
    execution_velocity;

  const { targetTotal, blendWeight, godPrior } = blendTotalWithGodPrior(eventSum, signalCount, godScore);

  if (godPrior != null && eventSum > 1e-6) {
    const r = targetTotal / eventSum;
    founder_language_shift = clamp(founder_language_shift * r, CAP.founder_language_shift);
    investor_receptivity = clamp(investor_receptivity * r, CAP.investor_receptivity);
    news_momentum = clamp(news_momentum * r, CAP.news_momentum);
    capital_convergence = clamp(capital_convergence * r, CAP.capital_convergence);
    execution_velocity = clamp(execution_velocity * r, CAP.execution_velocity);
  } else if (godPrior != null && eventSum <= 1e-6) {
    const factor = targetTotal / 7.0;
    founder_language_shift = clamp(1.0 * factor, CAP.founder_language_shift);
    investor_receptivity = clamp(1.2 * factor, CAP.investor_receptivity);
    news_momentum = clamp(1.1 * factor, CAP.news_momentum);
    capital_convergence = clamp(1.1 * factor, CAP.capital_convergence);
    execution_velocity = clamp(1.1 * factor, CAP.execution_velocity);
  }

  const signals_total = clamp(
    founder_language_shift + investor_receptivity + news_momentum + capital_convergence + execution_velocity,
    10.0
  );

  return {
    founder_language_shift,
    investor_receptivity,
    news_momentum,
    capital_convergence,
    execution_velocity,
    signals_total,
    eventSum,
    blendWeight,
    godPrior,
  };
}

module.exports = {
  clamp,
  godDerivedSignalTotal,
  blendTotalWithGodPrior,
  applyGodBlendToSignalDimensions,
};
