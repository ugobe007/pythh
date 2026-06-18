'use strict';

/**
 * Act 3 — Round readiness gate
 * Outreach unlocks after readiness threshold; PYTHIA pipeline after bar is crossed.
 */

const OUTREACH_THRESHOLD = 52;
const PIPELINE_THRESHOLD = 60;
const GOD_FLOOR = 48;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {object} input
 * @param {object} input.startup - startup_uploads row
 * @param {object[]} input.tasks - founder_commitment_tasks rows
 * @param {object|null} input.doc - latest commitment_documents row
 * @param {number} input.matchCount - suggested match count
 * @param {number} [input.topMatchScore] - best match score
 */
function computeRoundReadiness({ startup, tasks, doc, matchCount, topMatchScore = 0 }) {
  const god = startup?.total_god_score ?? 0;
  const activeTasks = (tasks || []).filter((t) => t.status !== 'skipped');
  const acknowledged = activeTasks.filter((t) => t.status === 'acknowledged' || t.status === 'in_progress').length;
  const completed = activeTasks.filter((t) => t.status === 'completed').length;
  const hasDoc = Boolean(doc);
  const isProvisional = doc?.is_provisional !== false;
  const roundActivatedAt = doc?.content?.header?.round_activated_at || null;

  const commitmentPts = Math.min(35, acknowledged * 11 + completed * 20);
  const docPts = hasDoc ? (isProvisional ? 10 : 18) : 0;
  const matchPts = matchCount > 0 ? Math.min(12, 6 + Math.round((topMatchScore || 50) / 15)) : 0;
  const proofPts = completed > 0 ? 8 : 0;

  const readinessScore = clamp(
    Math.round(god * 0.38 + commitmentPts + docPts + matchPts + proofPts),
    0,
    100,
  );

  const requirements = [
    {
      id: 'god_floor',
      label: `GOD score at investor floor (${GOD_FLOOR}+)`,
      met: god >= GOD_FLOOR,
      hint: god < GOD_FLOOR ? `Currently ${god} — close unlocks to raise your score` : null,
    },
    {
      id: 'commits',
      label: '2+ unlocks committed (or 1 proved)',
      met: acknowledged >= 2 || completed >= 1,
      hint:
        acknowledged < 2 && completed < 1
          ? `${acknowledged} committed · ${completed} proved — lock in more unlocks`
          : null,
    },
    {
      id: 'readiness_doc',
      label: 'Readiness doc generated',
      met: hasDoc,
      hint: !hasDoc ? 'Complete unlock selection to generate your doc' : null,
    },
    {
      id: 'outreach_threshold',
      label: `Round readiness score ${OUTREACH_THRESHOLD}+`,
      met: readinessScore >= OUTREACH_THRESHOLD,
      hint:
        readinessScore < OUTREACH_THRESHOLD
          ? `Currently ${readinessScore} — prove unlocks to cross the bar`
          : null,
    },
  ];

  const outreachReady =
    god >= GOD_FLOOR &&
    (acknowledged >= 2 || completed >= 1) &&
    hasDoc &&
    readinessScore >= OUTREACH_THRESHOLD &&
    matchCount > 0;

  const pipelineReady =
    outreachReady &&
    readinessScore >= PIPELINE_THRESHOLD &&
    (completed >= 1 || acknowledged >= 3);

  let status = 'locked';
  if (roundActivatedAt) status = 'pipeline_active';
  else if (pipelineReady) status = 'pipeline_ready';
  else if (outreachReady) status = 'outreach_ready';
  else if (readinessScore >= 40 || acknowledged >= 1 || hasDoc) status = 'building';

  const pointsToOutreach = Math.max(0, OUTREACH_THRESHOLD - readinessScore);
  const pointsToPipeline = Math.max(0, PIPELINE_THRESHOLD - readinessScore);

  let headline = 'Round locked — build readiness first';
  let subline =
    'Investors are matched, but outreach opens after you commit to unlocks and cross the readiness bar.';
  if (status === 'building') {
    headline = 'Round in progress — you\'re close';
    subline = 'Complete the checklist below to unlock your outreach package.';
  } else if (status === 'outreach_ready') {
    headline = 'Outreach unlocked';
    subline = 'Your personalized emails and memo are ready. Copy and send — or activate PYTHIA to automate.';
  } else if (status === 'pipeline_ready') {
    headline = 'Ready to automate your round';
    subline = 'PYTHIA can run targeted outreach to your top matches with your readiness doc attached.';
  } else if (status === 'pipeline_active') {
    headline = 'PYTHIA round is live';
    subline = 'Your automated outreach pipeline is running. Track progress in Activate.';
  }

  return {
    readiness_score: readinessScore,
    thresholds: {
      outreach: OUTREACH_THRESHOLD,
      pipeline: PIPELINE_THRESHOLD,
      god_floor: GOD_FLOOR,
    },
    status,
    headline,
    subline,
    outreach_ready: outreachReady,
    pipeline_ready: pipelineReady,
    pipeline_active: Boolean(roundActivatedAt),
    round_activated_at: roundActivatedAt,
    requirements,
    points_to_outreach: pointsToOutreach,
    points_to_pipeline: pointsToPipeline,
    stats: {
      god_score: god,
      acknowledged_unlocks: acknowledged,
      proved_unlocks: completed,
      has_readiness_doc: hasDoc,
      is_provisional_doc: isProvisional,
      match_count: matchCount,
      top_match_score: topMatchScore,
    },
  };
}

/**
 * Redact outreach package when gate is not open.
 */
function gateOutreachPayload(payload, gate) {
  if (gate.outreach_ready) {
    return { ...payload, gate, locked: false };
  }

  const investors = (payload.investors || []).slice(0, 3).map((inv) => ({
    id: inv.id,
    name: inv.name,
    firm: inv.firm,
    match_score: inv.match_score,
    title: inv.title ? '—' : undefined,
    why_you_match: undefined,
    linkedin_url: undefined,
  }));

  return {
    ...payload,
    gate,
    locked: true,
    investors,
    email_drafts: [],
    memo_markdown: null,
    message:
      gate.status === 'building'
        ? `Outreach unlocks at readiness ${gate.thresholds.outreach}+. You're at ${gate.readiness_score} — ${gate.points_to_outreach} pts to go.`
        : 'Complete your unlock commitments to access outreach.',
  };
}

module.exports = {
  OUTREACH_THRESHOLD,
  PIPELINE_THRESHOLD,
  GOD_FLOOR,
  computeRoundReadiness,
  gateOutreachPayload,
};
