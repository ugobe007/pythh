'use strict';

const { isPersonName, outreachGreeting } = require('./investorEmailInfer');
const { normalizeWhyYouMatch } = require('./normalizeWhyYouMatch');

const STAGE_NUMERIC = { 1: 'pre-seed', 2: 'seed', 3: 'Series A', 4: 'Series B', 5: 'Series C+' };

const INTERNAL_TAG = /^(investor tier|god score|signal|algorithmic match)/i;
const GENERIC_COMPANY_COPY = /\b(cloud control plane|from first deploy to production scale)\b/i;

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

function listify(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  return String(value).split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

function startupIntelligence(startup) {
  const extracted = startup?.extracted_data || {};
  return {
    valueProposition:
      extracted.value_proposition ||
      extracted.product_description ||
      extracted.solution ||
      extracted.vision_statement ||
      '',
    whyNow: extracted.why_now || '',
    moat:
      extracted.moat ||
      extracted.unfair_advantage ||
      extracted.competitive_advantage ||
      '',
    traction: listify(extracted.traction || extracted.traction_signals || extracted.execution_signals),
  };
}

function buildInvestorFitLine(startup, investor, match, ctx = {}) {
  const name = startup?.extracted_data?.display_name || startup?.name || 'The company';
  const firm = resolveFirmLabel(investor);
  const sector = ctx.sector || (startup?.sectors || [])[0] || 'technology';
  const intelligence = startupIntelligence(startup);
  const thesis = [
    investor?.investment_thesis,
    investor?.bio,
    ...listify(investor?.sectors),
  ].filter(Boolean).join(' ').toLowerCase();
  const portfolio = listify(investor?.portfolio_companies || investor?.notable_investments);
  const startupText = [
    intelligence.valueProposition,
    intelligence.whyNow,
    intelligence.moat,
    startup?.description,
    startup?.pitch,
  ].join(' ').toLowerCase();

  const overlaps = [];
  const themeRules = [
    [/\b(robot|physical ai|automation|autonomous)\b/, /\b(robot|physical ai|automation|autonomous)\b/, 'physical AI'],
    [/\b(infrastructure|platform|layer|developer tool|operating system)\b/, /\b(infrastructure|platform|developer tool|operating system)\b/, 'infrastructure'],
    [/\b(data|memory|intelligence|analytics)\b/, /\b(data|memory|intelligence|analytics)\b/, 'data and intelligence'],
    [/\b(enterprise|b2b|commercial)\b/, /\b(enterprise|b2b|commercial)\b/, 'enterprise deployment'],
    [/\b(robot|physical ai|reality engine|visual memory|intelligent machine)\b/, /\b(frontier|deep tech|hard tech|technical breakthrough|sci-?fi)\b/, 'frontier technology'],
  ];
  for (const [startupPattern, investorPattern, label] of themeRules) {
    if (startupPattern.test(startupText) && investorPattern.test(thesis)) overlaps.push(label);
  }

  const adjacency = portfolio.find((company) => {
    const normalized = company.toLowerCase();
    return normalized && startupText.split(/\W+/).some((token) => token.length > 5 && normalized.includes(token));
  });

  if (overlaps.length) {
    const themes = overlaps.slice(0, 2).join(' and ');
    const portfolioClause = adjacency ? `, reinforced by your investment in ${adjacency}` : '';
    if (/\bsci-?fi\b/.test(thesis) && /\b(reality engine|visual memory)\b/.test(startupText)) {
      return `${firm} backs sci-fi-scale frontier technologies. ${name}'s Reality Engine—shared visual memory and contextual reasoning across robots, cameras, sensors, and machines—fits that thesis${portfolioClause}.`;
    }
    return `${name}'s ${themes} platform aligns with ${firm}'s stated investment thesis${portfolioClause}.`;
  }

  return humanizeWhyYouMatchForOutreach(match?.why_you_match, {
    startupName: name,
    sector,
    stage: ctx.stage ?? startup?.stage,
    firm,
  });
}

function buildRoundFitNote(startup, investor, raiseAmount) {
  const amount = Number(raiseAmount || startup?.raise_amount || startup?.extracted_data?.funding_amount);
  const max = Number(investor?.check_size_max);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(max) || max <= 0) return '';
  if (amount > max * 1.5) {
    return `Likely role: participant rather than sole lead; the $${amount.toLocaleString()} round is above ${resolveFirmLabel(investor)}'s recorded maximum check.`;
  }
  return '';
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

function buildOutreachSubject(startupName, sector, stage, startup = null) {
  const name = startup?.extracted_data?.display_name || startupName || 'Startup';
  const sec = sector || 'Tech';
  const intelligence = startupIntelligence(startup);
  const companyText = [
    intelligence.valueProposition,
    intelligence.whyNow,
    intelligence.moat,
    startup?.description,
    startup?.pitch,
  ].join(' ');
  if (/\bvisual memory\b/i.test(companyText) && /\brobot/i.test(companyText)) {
    return `${name} — visual memory for robotics`;
  }
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
  const intelligence = startupIntelligence(startup);
  const richDeckNarrative = [
    intelligence.valueProposition,
    intelligence.whyNow,
    intelligence.moat,
  ].find((candidate) => candidate && !GENERIC_COMPANY_COPY.test(candidate));
  const raw = richDeckNarrative || (!pitchIsWeak && pitch) || description || tagline || pitch || `We're building in ${sector}.`;
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
  const extracted = startup?.extracted_data || {};
  const customerCount = Number(startup?.customer_count);
  const mrr = Number(startup?.mrr);
  const teamSize = Number(startup?.team_size);
  if (Number.isFinite(customerCount) && customerCount > 0) proof.push(`${customerCount.toLocaleString()} customers`);
  if (Number.isFinite(mrr) && mrr > 0) proof.push(`$${mrr.toLocaleString()} MRR`);
  if (Number.isFinite(teamSize) && teamSize > 1) proof.push(`${teamSize}-person team`);
  if (!proof.length) {
    const traction = listify(extracted.traction || extracted.traction_signals || extracted.execution_signals);
    if (traction.length) return `Current proof: ${truncateAtSentence(traction[0], 150).replace(/[.!]+$/, '')}.`;
  }
  return proof.length ? `Current proof: ${proof.slice(0, 2).join(' and ')}.` : '';
}

/**
 * Template cold email for wizard outreach package (no LLM).
 */
function buildColdEmail(startup, investor, doc, match, options = {}) {
  const name = startup?.extracted_data?.display_name || startup?.name || 'our company';
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

  const fitLine = buildInvestorFitLine(startup, investor, match, { sector, stage });

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
  startupIntelligence,
  buildInvestorFitLine,
  buildRoundFitNote,
};
