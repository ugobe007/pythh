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

function normalizeSectors(sectors) {
  if (Array.isArray(sectors)) return sectors.filter(Boolean).slice(0, 5);
  if (typeof sectors === 'string' && sectors.trim()) {
    return sectors.split(/[,;|/]/).map((s) => s.trim()).filter(Boolean).slice(0, 5);
  }
  return [];
}

function campaignDurationWeeks(stage) {
  const s = String(stage || '').toLowerCase();
  if (s.includes('series')) return 16;
  if (s.includes('seed') || s.includes('pre')) return 12;
  return 10;
}

function formatStageLabel(stage) {
  if (!stage) return 'Seed';
  const s = String(stage).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pendingGapTasks(tasks) {
  return tasks.filter((t) => !t.existing_status || t.existing_status === 'pending');
}

/**
 * Build Oracle raise plan payload — campaign, readiness gaps, decision queue.
 */
function buildRaisePlan(startup, enrichedTasks, matchStats) {
  const pending = pendingGapTasks(enrichedTasks);
  const summary = buildUnlockSummary(enrichedTasks, startup);
  const sectors = normalizeSectors(startup.sectors);
  const stageLabel = formatStageLabel(startup.stage);
  const durationWeeks = campaignDurationWeeks(startup.stage);
  const qualified = matchStats.qualified || 0;
  const identified = matchStats.identified || qualified;
  const outreachBatch = Math.min(30, Math.max(qualified, 10));
  const readinessScore = summary.current_god_score ?? startup.total_god_score ?? 0;

  const beforeOutreach = pending.slice(0, 3).map((t) => ({
    task_key: t.task_key,
    title: t.title,
    impact_points: t.impact_points,
    component: t.component,
    component_label: COMPONENT_LABELS[t.component] || t.component,
    partner_objection: t.partner_objection || null,
  }));

  const segmentLine =
    sectors.length > 0
      ? sectors.join(', ')
      : 'thesis-aligned investors across your sector and stage';

  const decisions = [
    {
      id: 'outreach_batch_a',
      type: 'outreach_batch',
      title: 'Approve first outreach group',
      body: `Oracle recommends contacting ${outreachBatch} qualified ${stageLabel.toLowerCase()} investors scoring ≥70, using your approved narrative. Excludes competitors and prior contacts.`,
      requires_plan_auth: true,
      outreach_count: outreachBatch,
      status: 'pending',
    },
  ];

  if (beforeOutreach.length > 0) {
    decisions.unshift({
      id: 'readiness_gaps',
      type: 'readiness',
      title: 'Close readiness gaps before outreach',
      body: `Oracle identified ${pending.length} gaps blocking meetings. Start with: ${beforeOutreach[0].title}.`,
      requires_plan_auth: false,
      gap_count: pending.length,
      status: 'pending',
    });
  }

  return {
    startup_id: startup.id,
    startup_name: startup.name || 'Your startup',
    website: startup.website || null,
    stage: startup.stage || 'seed',
    stage_label: stageLabel,
    readiness_score: readinessScore,
    projected_readiness: summary.projected_god_score,
    campaign: {
      duration_weeks: durationWeeks,
      segments: sectors,
      segment_summary: segmentLine,
      qualified_investors: qualified,
      identified_investors: identified,
      target_raise: startup.raise_amount || null,
      headline: `${durationWeeks}-week ${stageLabel.toLowerCase()} campaign`,
      subline: `Target ${qualified} qualified investors across ${segmentLine}.`,
    },
    before_outreach: beforeOutreach,
    total_gaps: pending.length,
    unlock_summary: summary,
    decisions,
    oracle_message: buildOracleMessage(startup, readinessScore, pending, qualified, durationWeeks, segmentLine),
  };
}

function buildOracleMessage(startup, readiness, pending, qualified, weeks, segments) {
  const name = startup.name || 'your company';
  if (!pending.length) {
    return `Oracle analyzed ${name}. Readiness is ${readiness}/100 with ${qualified} qualified investors. You're clear to authorize outreach when ready.`;
  }
  const top = pending[0];
  return `Oracle analyzed ${name}, your market, and ${qualified} qualified investors. Readiness is ${readiness}/100. Before outreach, close ${Math.min(pending.length, 3)} readiness gaps starting with "${top.title}". Then Oracle runs a ${weeks}-week campaign targeting ${segments}.`;
}

module.exports = {
  buildRaisePlan,
  pendingGapTasks,
  normalizeSectors,
};
