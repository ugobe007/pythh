'use strict';

const { isPersonName, outreachGreeting } = require('./investorEmailInfer');
const { normalizeWhyYouMatch } = require('./normalizeWhyYouMatch');

const STAGE_NUMERIC = { 1: 'pre-seed', 2: 'seed', 3: 'Series A', 4: 'Series B', 5: 'Series C+' };

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
  const hasExplicitStage = stage != null && stage !== '' && formatStageLabel(stage) !== 'early-stage';
  let thesis = null;

  for (const tag of tags) {
    const parsed = parseMatchTag(tag);
    if (!parsed) continue;
    if (parsed.kind === 'sector') matchSector = parsed.value;
    if (parsed.kind === 'stage' && !hasExplicitStage) matchStage = parsed.value;
    if (parsed.kind === 'thesis' && !thesis) thesis = parsed.value;
  }

  if (thesis) {
    return `I've been following ${firm}'s work in ${matchSector}, and ${startupName} maps to the ${thesis} angle several of your recent bets touch.`;
  }

  return `${firm} invests in ${matchSector} at ${matchStage}. ${startupName} sits directly in that focus.`;
}

function buildStageRaiseLine(stage, raiseAmount) {
  const stageLabel = formatStageLabel(stage);
  if (raiseAmount != null && raiseAmount !== '') {
    const amt = Number(raiseAmount);
    if (Number.isFinite(amt) && amt > 0) {
      return `We're raising $${amt.toLocaleString()} in a ${stageLabel} round.`;
    }
  }
  return `We're raising a ${stageLabel} round.`;
}

function buildOutreachSubject(startupName, sector, stage) {
  const name = startupName || 'Startup';
  const sec = sector || 'Tech';
  if (/robot/i.test(sec)) return `${name} — robot deployment infrastructure`;
  return `${name} — ${sec} infrastructure`;
}

function founderNameFromStartup(startup) {
  const candidates = [
    ...(Array.isArray(startup?.founders) ? startup.founders : []),
    ...(Array.isArray(startup?.extracted_data?.founders) ? startup.extracted_data.founders : []),
  ];
  const first = candidates.find((founder) =>
    typeof founder === 'string' ? founder.trim() : String(founder?.name || '').trim(),
  );
  return typeof first === 'string' ? first.trim() : String(first?.name || '').trim();
}

function cleanPitchLine(startup, sector) {
  const name = String(startup?.name || '').trim();
  const pitch = String(startup?.pitch || '').trim();
  const description = String(startup?.description || '').trim();
  const tagline = String(startup?.tagline || '').trim();
  const pitchIsWeak =
    pitch.length < 80 ||
    /^[a-z]/.test(pitch) ||
    /^(from|for|with|building|helping|making|turning)\b/i.test(pitch);
  const raw = (!pitchIsWeak && pitch) || description || tagline || pitch || `We're building in ${sector}.`;
  const withoutDuplicateName = String(raw)
    .replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[—–:-]\\s*`, 'i'), '')
    .trim();
  const completeSentences = withoutDuplicateName
    .replace(/;\s+/g, '. ')
    .replace(/\.\s+((?:Real-time|Scope-enforced|Camera-based)\b)/g, (_match, phrase) => ` for ${phrase.toLowerCase()}`);
  return truncateAtSentence(completeSentences, 300);
}

function strongestProofLine(startup) {
  const proof = [];
  const customerCount = Number(startup?.customer_count);
  const mrr = Number(startup?.mrr);
  const teamSize = Number(startup?.team_size);
  if (Number.isFinite(customerCount) && customerCount > 0) proof.push(`${customerCount.toLocaleString()} customers`);
  if (Number.isFinite(mrr) && mrr > 0) proof.push(`$${mrr.toLocaleString()} MRR`);
  if (Number.isFinite(teamSize) && teamSize > 1) proof.push(`${teamSize}-person team`);
  return proof.length ? `Current proof: ${proof.slice(0, 2).join(' and ')}.` : '';
}

/**
 * Template cold email for wizard outreach package (no LLM).
 */
function buildColdEmail(startup, investor, doc, match, options = {}) {
  const name = startup?.name || 'our company';
  const sector = options.sector || (startup?.sectors || [])[0] || 'tech';
  const stage = options.stage ?? startup?.stage;
  const firm = resolveFirmLabel(investor);
  const pitchLine = cleanPitchLine(startup, sector);
  const raiseAmount = doc?.content?.offer?.raise_amount || startup?.raise_amount;
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
  const founderName = founderNameFromStartup(startup) || '[Your Name]';
  const proofLine = strongestProofLine(startup);
  const materials = startup?.deck_filename
    ? 'I can send the deck beforehand.'
    : 'I can send a concise one-page overview in advance.';

  const lines = [
    greeting,
    '',
    pitchLine,
    '',
    fitLine,
    '',
    [stageRaiseLine, proofLine, progressLine].filter(Boolean).join(' ').trim(),
    '',
    `Would you be open to a 20-minute conversation? ${materials}`,
    '',
    'Best,',
    founderName,
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
  founderNameFromStartup,
  strongestProofLine,
};
