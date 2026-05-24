'use strict';

/**
 * Founder voice & culture metrics — team credit ratio, excellence markers.
 * Complements signal-class detection for founder_language_shift scoring.
 */

const FOUNDER_CULTURE_CLASSES = [
  'founder_psychology_signal',
  'founder_excellence_signal',
  'founder_cunning_signal',
  'customer_delight_signal',
  'talent_magnet_signal',
  'failure_learning_signal',
  'failure_exit_signal',
];

const POSITIVE_CULTURE_CLASSES = new Set([
  'founder_psychology_signal',
  'founder_excellence_signal',
  'founder_cunning_signal',
  'customer_delight_signal',
  'talent_magnet_signal',
  'failure_learning_signal',
]);

const CLASS_LABELS = {
  founder_psychology_signal: 'Psychology',
  founder_excellence_signal: 'Excellence',
  founder_cunning_signal: 'Cunning / ship fast',
  customer_delight_signal: 'Customer delight',
  talent_magnet_signal: 'Talent magnet',
  failure_learning_signal: 'Failure → learning',
  failure_exit_signal: 'Failure → exit',
};

/**
 * @param {string[]} texts - founder pitch, posts, descriptions
 * @param {object[]} [signalEvents] - pythh_signal_events rows with primary_signal
 */
function analyzeFounderVoice(texts, signalEvents = []) {
  const text = (texts || []).filter(Boolean).join('\n');
  const lower = text.toLowerCase();

  const iMatches = lower.match(/\b(i'm|i am| i |my vision|i built|i founded|i started|i lead)\b/g) || [];
  const weMatches = lower.match(/\b(we |our team|the team|our engineers|together we|we're building|we built)\b/g) || [];
  const namedPraise =
    lower.match(
      /\b(thrilled to welcome|joined us from|proud of (the |our )?team|shoutout to|thanks to (my |our )?team|couldn't have done it without)\b/g
    ) || [];
  const soloHero = lower.match(/\b(i single.?handedly|i alone|without (my |our )?team|all by myself|only i could)\b/g) || [];

  const iCount = iMatches.length;
  const weCount = weMatches.length;
  const teamCreditRatio =
    Math.round((weCount / Math.max(1, iCount + weCount)) * 100) / 100;

  const excellenceHits =
    (lower.match(
      /\b(raise the bar|best in class|world.?class|obsessed with (quality|excellence|details)|insanely great|never settle|relentless(ly)?)\b/g
    ) || []).length;
  const cunningHits =
    (lower.match(/\b(ship(ped|ping)? fast|move fast|bias for action|iterate quickly|rapid iteration|build in public|dogfooding)\b/g) || [])
      .length;
  const delightHits =
    (lower.match(/\b(delight(ed|ing)? (our )?customers|customers love|fanatical about customers|customer obsessed)\b/g) || [])
      .length;

  const classCounts = Object.fromEntries(FOUNDER_CULTURE_CLASSES.map((c) => [c, 0]));
  for (const s of signalEvents || []) {
    const cls = s.primary_signal;
    if (classCounts[cls] != null) classCounts[cls]++;
  }

  const positiveCulture = FOUNDER_CULTURE_CLASSES.filter((c) => POSITIVE_CULTURE_CLASSES.has(c)).reduce(
    (sum, c) => sum + (classCounts[c] || 0),
    0
  );
  const exitSignals = classCounts.failure_exit_signal || 0;
  const learningSignals = classCounts.failure_learning_signal || 0;

  let founderLanguageAdj = 0;
  founderLanguageAdj += Math.min(0.12, namedPraise.length * 0.04);
  founderLanguageAdj += teamCreditRatio > 0.55 ? 0.08 : teamCreditRatio < 0.35 ? -0.08 : 0;
  founderLanguageAdj -= Math.min(0.15, soloHero.length * 0.08);
  founderLanguageAdj += Math.min(0.1, excellenceHits * 0.025);
  founderLanguageAdj += Math.min(0.08, cunningHits * 0.02);
  founderLanguageAdj += Math.min(0.08, delightHits * 0.025);
  founderLanguageAdj += Math.min(0.12, positiveCulture * 0.015);
  founderLanguageAdj += learningSignals > exitSignals ? 0.06 : 0;
  founderLanguageAdj -= exitSignals > learningSignals ? Math.min(0.2, exitSignals * 0.05) : 0;

  founderLanguageAdj = Math.round(Math.max(-0.35, Math.min(0.35, founderLanguageAdj)) * 1000) / 1000;

  const cultureScore = Math.round(
    Math.max(
      0,
      Math.min(
        1,
        0.35 * teamCreditRatio +
          0.25 * Math.min(1, positiveCulture / 5) +
          0.2 * Math.min(1, excellenceHits / 3) +
          0.1 * Math.min(1, cunningHits / 2) +
          0.1 * Math.min(1, delightHits / 2) -
          (soloHero.length ? 0.15 : 0) -
          (exitSignals > learningSignals ? 0.2 : 0)
      )
    ) * 100
  ) / 100;

  return {
    teamCreditRatio,
    cultureScore,
    founderLanguageAdj,
    excellenceHits,
    cunningHits,
    delightHits,
    namedTeamPraise: namedPraise.length,
    soloHeroSignals: soloHero.length,
    classCounts,
    learningVsExit: { learning: learningSignals, exit: exitSignals },
  };
}

function aggregateFounderCultureCounts(classCountsList) {
  const totals = Object.fromEntries(FOUNDER_CULTURE_CLASSES.map((c) => [c, 0]));
  let teamCreditSum = 0;
  let teamCreditN = 0;
  let cultureSum = 0;
  let cultureN = 0;

  for (const row of classCountsList || []) {
    for (const c of FOUNDER_CULTURE_CLASSES) {
      totals[c] += row.classCounts?.[c] || 0;
    }
    if (row.teamCreditRatio != null) {
      teamCreditSum += row.teamCreditRatio;
      teamCreditN++;
    }
    if (row.cultureScore != null) {
      cultureSum += row.cultureScore;
      cultureN++;
    }
  }

  return {
    classTotals: totals,
    avgTeamCreditRatio: teamCreditN ? Math.round((teamCreditSum / teamCreditN) * 100) / 100 : null,
    avgCultureScore: cultureN ? Math.round((cultureSum / cultureN) * 100) / 100 : null,
    labels: CLASS_LABELS,
  };
}

function extractVoiceTexts(row) {
  if (!row) return [];
  const topLevelFields = [
    'pitch',
    'description',
    'tagline',
    'execution_signals',
    'team_signals',
    'grit_signals',
  ];
  const nestedFields = [
    'description',
    'pitch',
    'problem',
    'solution',
    'value_proposition',
    'tagline',
    'contrarian_belief',
    'why_now',
    'unfair_advantage',
    'market',
  ];
  const parts = [];
  for (const f of topLevelFields) {
    const v = row[f];
    if (typeof v === 'string' && v.trim()) parts.push(v.trim());
  }
  const ed = row.extracted_data;
  if (ed && typeof ed === 'object') {
    for (const f of nestedFields) {
      const v = ed[f];
      if (typeof v === 'string' && v.trim()) parts.push(v.trim());
    }
  }
  return parts;
}

module.exports = {
  FOUNDER_CULTURE_CLASSES,
  CLASS_LABELS,
  analyzeFounderVoice,
  aggregateFounderCultureCounts,
  extractVoiceTexts,
};
