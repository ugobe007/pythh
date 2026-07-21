'use strict';

const { isPersonName, outreachGreeting } = require('./investorEmailInfer');
const { normalizeWhyYouMatch } = require('./normalizeWhyYouMatch');

const STAGE_NUMERIC = { 0: 'pre-seed', 1: 'seed', 2: 'Series A', 3: 'Series B' };

const INTERNAL_TAG = /^(investor tier|god score|signal|algorithmic match)/i;

/**
 * Greeting for template emails when we don't have a recipient address yet.
 */
function outreachInvestorGreeting(investor) {
  const emailType = isPersonName(investor?.name) ? 'personal' : 'generic';
  return outreachGreeting(investor || {}, emailType);
}

function resolveFirmLabel(investor) {
  const firm = investor?.firm && investor.firm !== 'null' ? String(investor.firm).trim() : '';
  if (firm) return firm;
  if (investor?.name && !isPersonName(investor.name)) return String(investor.name).trim();
  return 'your fund';
}

function formatStageLabel(stage) {
  if (stage == null || stage === '') return 'early-stage';
  if (typeof stage === 'number' || /^\d+$/.test(String(stage))) {
    return STAGE_NUMERIC[Number(stage)] || 'early-stage';
  }
  const s = String(stage).trim().toLowerCase();
  if (s === 'pre-seed' || s === 'preseed') return 'pre-seed';
  if (s === 'seed') return 'seed';
  if (s.startsWith('series')) return s.replace(/\b\w/g, (c) => c.toUpperCase());
  return s;
}

function truncateAtSentence(text, max = 240) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  const slice = t.slice(0, max);
  const lastPeriod = slice.lastIndexOf('.');
  if (lastPeriod >= Math.floor(max * 0.45)) return slice.slice(0, lastPeriod + 1).trim();
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trim()}…`;
}

function parseMatchTag(tag) {
  const t = String(tag || '').trim();
  if (!t || INTERNAL_TAG.test(t)) return null;

  let m;
  if ((m = t.match(/^stage fit:\s*(.+)/i))) {
    const fit = m[1].toLowerCase();
    if (fit.includes('growth')) return { kind: 'stage', value: 'growth-stage' };
    if (fit.includes('angel') || fit.includes('seed')) return { kind: 'stage', value: 'seed-stage' };
    return { kind: 'stage', value: 'early-stage' };
  }
  if ((m = t.match(/^stage:\s*(.+)/i))) {
    return { kind: 'stage', value: formatStageLabel(m[1]) };
  }
  if ((m = t.match(/^sector:\s*(.+)/i))) {
    return { kind: 'sector', value: m[1].trim() };
  }
  if ((m = t.match(/^conviction:\s*(.+)/i))) {
    const v = m[1].trim();
    if (/^thesis match$/i.test(v)) return null;
    return { kind: 'thesis', value: v };
  }
  if ((m = t.match(/^🔥\s*super match:\s*(.+)/i))) {
    return { kind: 'thesis', value: m[1].trim() };
  }
  return null;
}

/**
 * Turn match tags into one natural sentence — never dump raw scoring labels.
 */
function humanizeWhyYouMatchForOutreach(raw, ctx = {}) {
  const {
    startupName = 'our company',
    sector = 'your focus areas',
    stage = 'early-stage',
    firm = 'your fund',
  } = ctx;

  const normalized = normalizeWhyYouMatch(raw);
  const tags = normalized
    ? normalized.split(/[,·]/).map((s) => s.trim()).filter(Boolean)
    : [];

  let matchSector = sector;
  let matchStage = formatStageLabel(stage);
  let thesis = null;

  for (const tag of tags) {
    const parsed = parseMatchTag(tag);
    if (!parsed) continue;
    if (parsed.kind === 'sector') matchSector = parsed.value;
    if (parsed.kind === 'stage') matchStage = parsed.value;
    if (parsed.kind === 'thesis' && !thesis) thesis = parsed.value;
  }

  if (thesis) {
    return `I've been following ${firm}'s work in ${matchSector}, and ${startupName} maps to the ${thesis} angle several of your recent bets touch.`;
  }

  return `${firm}'s ${matchStage} practice in ${matchSector} is a strong fit for what we're building at ${startupName}.`;
}

function buildStageRaiseLine(stage, raiseAmount) {
  const stageLabel = formatStageLabel(stage);
  const parts = [`We're ${stageLabel}-stage`];
  if (raiseAmount != null && raiseAmount !== '') {
    const amt = Number(raiseAmount);
    if (Number.isFinite(amt) && amt > 0) {
      parts.push(`raising $${amt.toLocaleString()}`);
    }
  }
  if (parts.length === 1) return `${parts[0]}.`;
  return `${parts[0]} and ${parts[1]}.`;
}

function buildOutreachSubject(startupName, sector, stage) {
  const name = startupName || 'Startup';
  const sec = sector || 'Tech';
  const st = formatStageLabel(stage);
  return `${name} — ${sec}, ${st}`;
}

/**
 * Template cold email for wizard outreach package (no LLM).
 */
function buildColdEmail(startup, investor, doc, match, options = {}) {
  const name = startup?.name || 'our company';
  const sector = options.sector || (startup?.sectors || [])[0] || 'tech';
  const stage = options.stage ?? startup?.stage;
  const firm = resolveFirmLabel(investor);
  const pitch = startup?.pitch || startup?.description || startup?.tagline
    || `We're building in ${sector}.`;
  const pitchLine = truncateAtSentence(pitch);
  const raiseAmount = doc?.content?.offer?.raise_amount;
  const commitments = doc?.content?.commitments || [];
  const completedCount = commitments.filter((c) => c.status === 'completed').length;
  const acknowledgedCount = commitments.filter((c) => c.status === 'acknowledged').length;
  const progressLine = (completedCount + acknowledgedCount) > 0
    ? `We've hit ${completedCount} verified milestones and committed to ${acknowledgedCount} more with clear deadlines.`
    : '';

  const fitLine = humanizeWhyYouMatchForOutreach(match?.why_you_match, {
    startupName: name,
    sector,
    stage,
    firm,
  });

  const stageRaiseLine = buildStageRaiseLine(stage, raiseAmount);
  const greeting = outreachInvestorGreeting(investor);
  const website = startup?.website || '';

  const lines = [
    greeting,
    '',
    `${name} — ${pitchLine}`,
    '',
    fitLine,
    '',
    [stageRaiseLine, progressLine].filter(Boolean).join(' ').trim(),
    '',
    'Would you have 20 minutes for a quick walkthrough? Happy to send a short memo ahead of the call.',
    '',
    'Best,',
    '[Your Name]',
    website,
  ].filter((line, i, arr) => {
    // Drop empty double breaks when stage/progress block is empty
    if (line !== '') return true;
    const prev = arr[i - 1];
    const next = arr[i + 1];
    return !(prev === '' && next === '');
  });

  return lines.join('\n').trim();
}

module.exports = {
  outreachInvestorGreeting,
  humanizeWhyYouMatchForOutreach,
  buildStageRaiseLine,
  buildOutreachSubject,
  buildColdEmail,
  truncateAtSentence,
};
