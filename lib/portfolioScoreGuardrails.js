/**
 * Portfolio score guardrails — SSOT: server/scoring/hotGodFromStartupRow.js + recalculate-scores.ts
 *
 * Detects corrupted total_god_score (legacy god-score-formula overwrites, missing floor)
 * and heals active virtual_portfolio holdings before monitor/digest actions.
 */
'use strict';

const GOD_FLOOR = 40;
const ENHANCED_MISMATCH_GAP = 25;
const EXTREME_DELTA_THRESHOLD = 40;

function detectScoreCorruption(startup, { entry_god_score } = {}) {
  if (!startup) return [{ code: 'missing_startup' }];

  const issues = [];
  const total = Number(startup.total_god_score);
  const enhanced = Number(startup.enhanced_god_score);
  const entry = entry_god_score != null ? Number(entry_god_score) : null;

  if (startup.status === 'approved' && Number.isFinite(total) && total < GOD_FLOOR) {
    issues.push({ code: 'below_floor', total, floor: GOD_FLOOR });
  }

  if (
    Number.isFinite(enhanced) &&
    Number.isFinite(total) &&
    enhanced - total >= ENHANCED_MISMATCH_GAP
  ) {
    issues.push({ code: 'enhanced_mismatch', total, enhanced, gap: enhanced - total });
  }

  if (
    entry != null &&
    Number.isFinite(total) &&
    entry - total >= EXTREME_DELTA_THRESHOLD
  ) {
    issues.push({
      code: 'extreme_negative_delta',
      entry,
      total,
      delta: total - entry,
    });
  }

  return issues;
}

function isCorrupted(startup, context = {}) {
  return detectScoreCorruption(startup, context).length > 0;
}

function rescoreStartupFromHotGod(startup) {
  const hotGod = require('../server/scoring/hotGodFromStartupRow.js');
  const b = hotGod.calculateGodScoreBreakdownFromStartup(startup);
  const signalsBonus = Math.min(Number(startup.signals_bonus) || 0, 10);
  const finalScore = Math.round(
    Math.max(GOD_FLOOR, Math.min(100, b.total_god_score + signalsBonus))
  );

  return {
    team_score: b.team_score,
    traction_score: b.traction_score,
    market_score: b.market_score,
    product_score: b.product_score,
    vision_score: b.vision_score,
    total_god_score: finalScore,
    enhanced_god_score: finalScore,
    previous_total: startup.total_god_score,
  };
}

async function healStartupById(supabase, startupId, { dryRun = false } = {}) {
  const { data: su, error } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', startupId)
    .maybeSingle();

  if (error) throw error;
  if (!su) return { healed: false, reason: 'not_found' };

  const { data: pick } = await supabase
    .from('virtual_portfolio')
    .select('entry_god_score')
    .eq('startup_id', startupId)
    .eq('status', 'active')
    .maybeSingle();

  const issues = detectScoreCorruption(su, { entry_god_score: pick?.entry_god_score });
  if (!issues.length) return { healed: false, reason: 'ok', name: su.name };

  const next = rescoreStartupFromHotGod(su);
  if (!dryRun) {
    const { error: upErr } = await supabase
      .from('startup_uploads')
      .update({
        total_god_score: next.total_god_score,
        enhanced_god_score: next.enhanced_god_score,
        team_score: next.team_score,
        traction_score: next.traction_score,
        market_score: next.market_score,
        product_score: next.product_score,
        vision_score: next.vision_score,
        updated_at: new Date().toISOString(),
      })
      .eq('id', startupId);
    if (upErr) throw upErr;
  }

  return {
    healed: true,
    dryRun,
    name: su.name,
    issues,
    from: su.total_god_score,
    to: next.total_god_score,
  };
}

async function healPortfolioHoldings(supabase, { dryRun = false, log = console.log } = {}) {
  const { data: picks, error: pickErr } = await supabase
    .from('virtual_portfolio')
    .select('startup_id, entry_god_score')
    .eq('status', 'active');

  if (pickErr) throw pickErr;

  const results = { checked: 0, healed: 0, ok: 0, errors: [] };

  for (const pick of picks || []) {
    results.checked++;
    try {
      const { data: su } = await supabase
        .from('startup_uploads')
        .select('*')
        .eq('id', pick.startup_id)
        .maybeSingle();

      if (!su) continue;

      const issues = detectScoreCorruption(su, { entry_god_score: pick.entry_god_score });
      if (!issues.length) {
        results.ok++;
        continue;
      }

      const outcome = await healStartupById(supabase, pick.startup_id, { dryRun });
      if (outcome.healed) {
        results.healed++;
        log(
          `  🛡️  ${outcome.name}: ${outcome.from} → ${outcome.to} (${issues.map((i) => i.code).join(', ')})`
        );
      }
    } catch (err) {
      results.errors.push({ startup_id: pick.startup_id, message: err.message });
    }
  }

  return results;
}

module.exports = {
  GOD_FLOOR,
  ENHANCED_MISMATCH_GAP,
  EXTREME_DELTA_THRESHOLD,
  detectScoreCorruption,
  isCorrupted,
  rescoreStartupFromHotGod,
  healStartupById,
  healPortfolioHoldings,
};
