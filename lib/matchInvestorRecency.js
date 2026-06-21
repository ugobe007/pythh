/**
 * Investor recency + deployment velocity adjustment for match ranking (v3.3+).
 * Penalizes stale / inactive investors; boosts recently active deployers.
 */

function daysSince(isoDate) {
  if (!isoDate) return null;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : null;
}

/**
 * @param {object} investor
 * @returns {{ delta: number, note: string, velocity_index: number|null, days_since_deal: number|null }}
 */
function computeInvestorRecencyDelta(investor = {}) {
  let delta = 0;
  const notes = [];
  const dvi = Number(investor.deployment_velocity_index);
  const velocityIndex = Number.isFinite(dvi) ? dvi : null;

  if (velocityIndex != null) {
    if (velocityIndex >= 75) {
      delta += 6;
      notes.push('high deployment velocity');
    } else if (velocityIndex >= 50) {
      delta += 3;
      notes.push('moderate deployment velocity');
    } else if (velocityIndex < 25) {
      delta -= 5;
      notes.push('low deployment velocity');
    }
  }

  const days = daysSince(investor.last_investment_date);
  if (days != null) {
    if (days <= 90) {
      delta += 4;
      notes.push('invested within 90d');
    } else if (days <= 180) {
      delta += 2;
      notes.push('invested within 6mo');
    } else if (days <= 365) {
      delta -= 1;
      notes.push('last deal 6–12mo ago');
    } else {
      delta -= 6;
      notes.push('stale investor (>12mo since deal)');
    }
  } else if (velocityIndex == null) {
    delta -= 4;
    notes.push('no recency signal');
  }

  delta = Math.max(-12, Math.min(10, delta));
  return {
    delta,
    note: notes.join('; ') || 'recency neutral',
    velocity_index: velocityIndex,
    days_since_deal: days,
  };
}

/**
 * Apply recency adjustment to a scored match (same shape as stageInvestorFit output).
 */
function applyInvestorRecencyAdjustment(scored, investor) {
  const rec = computeInvestorRecencyDelta(investor);
  if (!rec.delta) return scored;

  const score = Math.max(35, Math.min(95, (scored.score || 0) + rec.delta));
  return {
    ...scored,
    score,
    fitAnalysis: {
      ...(scored.fitAnalysis || {}),
      investor_recency_delta: rec.delta,
      investor_recency: rec,
    },
    confidence: score >= 75 ? 'high' : score >= 55 ? 'medium' : 'low',
  };
}

module.exports = {
  daysSince,
  computeInvestorRecencyDelta,
  applyInvestorRecencyAdjustment,
};
