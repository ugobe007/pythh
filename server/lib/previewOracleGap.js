'use strict';

const { deriveGapTasks } = require('./gapTaskDerivation');
const { enrichGapTasks, buildUnlockSummary } = require('./taskUnlockCatalog');

const COMPONENT_LABELS = {
  team: 'Team',
  traction: 'Traction',
  market: 'Market',
  product: 'Product',
  vision: 'Vision',
};

/**
 * Compact Oracle gap payload for preview teaser + nurture email (no DB writes).
 */
function buildPreviewOracleGap(startup, matchCount = 0) {
  const god = startup.total_god_score;
  if (god == null || !Number.isFinite(Number(god))) return null;

  const rawTasks = deriveGapTasks(startup);
  if (!rawTasks.length) {
    return {
      current_god_score: Math.round(Number(god)),
      projected_god_score: Math.round(Number(god)),
      total_gaps: 0,
      total_investors_unlocked: 0,
      top_gap: null,
      weakest_component: null,
      headline: 'Strong GOD profile — Oracle is focused on outreach readiness',
      subline: 'Your score components look solid. Unlock personalized outreach for your top matches.',
    };
  }

  const tasks = enrichGapTasks(rawTasks, startup, matchCount);
  const top = tasks[0];
  const summary = buildUnlockSummary(tasks, startup);
  const projectedFromTop = Math.min(100, summary.current_god_score + (top.impact_points || 0));

  return {
    current_god_score: summary.current_god_score,
    projected_god_score: summary.projected_god_score,
    projected_god_if_top_fix: projectedFromTop,
    god_points_if_top_fix: top.impact_points,
    investors_unlocked_if_top_fix: top.investors_unlocked_estimate,
    total_gaps: tasks.length,
    total_investors_unlocked: summary.total_investors_unlocked,
    weakest_component: top.component,
    weakest_component_label: COMPONENT_LABELS[top.component] || top.component,
    top_gap: {
      task_key: top.task_key,
      component: top.component,
      title: top.title,
      impact_points: top.impact_points,
      partner_objection: top.partner_objection,
      investors_unlocked_estimate: top.investors_unlocked_estimate,
    },
    headline: `GOD ${summary.current_god_score} — +${top.impact_points} unlocks ~${top.investors_unlocked_estimate} more investors`,
    subline: top.partner_objection || 'Partners flagged a gap on this dimension in screening.',
  };
}

async function fetchMatchCountForGap(supabase, startupId) {
  const { count, error } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', startupId);
  if (error) return 0;
  return count || 0;
}

async function getPreviewOracleGap(supabase, startupId, startupRow = null) {
  let startup = startupRow;
  if (!startup) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(
        'id, total_god_score, team_score, traction_score, market_score, product_score, vision_score, sectors, stage',
      )
      .eq('id', startupId)
      .maybeSingle();
    if (error || !data) return null;
    startup = data;
  }

  const matchCount = await fetchMatchCountForGap(supabase, startupId);
  return buildPreviewOracleGap(startup, matchCount);
}

module.exports = {
  buildPreviewOracleGap,
  getPreviewOracleGap,
  COMPONENT_LABELS,
};
