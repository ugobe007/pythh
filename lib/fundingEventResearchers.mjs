/**
 * Agentic funding-event researchers.
 *
 * Four specialists read a trusted announcement and extract a structured
 * briefing: round economics, why the check was written, problem/team, and
 * syndicate / check mentions. Pattern-first (no paid model). Filling these
 * fields is data completeness for GOD/matching — it does not retune weights.
 */
import { createRequire } from 'node:module';
import {
  announcementTextFromEvent,
  extractFundingAttentionAspects,
  inferFundingTriggers,
} from './fundingAttentionAspects.mjs';

const require = createRequire(import.meta.url);
const {
  extractFunding,
  extractTeamSignals,
  extractProblemSignals,
  extractValueProposition,
} = require('./inference-extractor.js');

export const FUNDING_INTEL_VERSION = 'funding-intel-v3';
export const RESEARCHER_IDS = Object.freeze([
  'round_economics',
  'why_funded',
  'problem_team',
  'participation',
]);

const VALUATION_PATTERNS = [
  { kind: 'post_money', re: /(?:post(?:-|\s)?money(?:\s+valuation)?)\s+(?:of\s+)?\$?(\d+(?:\.\d+)?)\s*(million|m|billion|b)\b/i },
  { kind: 'pre_money', re: /(?:pre(?:-|\s)?money(?:\s+valuation)?)\s+(?:of\s+)?\$?(\d+(?:\.\d+)?)\s*(million|m|billion|b)\b/i },
  { kind: 'unknown', re: /(?:valued\s+at|valuation\s+(?:of|at)?)\s+\$?(\d+(?:\.\d+)?)\s*(million|m|billion|b)\b/i },
  { kind: 'unknown', re: /\$(\d+(?:\.\d+)?)\s*(million|billion|m|b)\s+valuation\b/i },
  { kind: 'unknown', re: /at\s+a\s+\$?(\d+(?:\.\d+)?)\s*(million|m|billion|b)\s+valuation\b/i },
];

const USE_OF_PROCEEDS_RE =
  /\bto\s+(?:scale|expand|grow|build|hire|launch|accelerate|fuel|fund|commercialize|enter|revolutionize|transform|power|deploy|acquire|develop|modernize|electrify)\s+[^.!?]{3,140}/i;
const FOR_PURPOSE_RE =
  /\b(?:raises?|raised|secures?|secured|closes?|closed)\b[^.!?]{0,90}?\bfor\s+(?:its\s+|their\s+|an?\s+)?(?!the\s+(?:round|raise|funding)\b)[a-z][^.!?]{4,80}/i;
const QUOTE_RE = /"([^"]{24,220})"/g;
const CHECK_RE =
  /\b([A-Z][A-Za-z0-9&.\-']+(?:\s+[A-Z][A-Za-z0-9&.\-']+){0,4})\s+(?:invested|committed|contributed)\s+\$?(\d+(?:\.\d+)?)\s*(million|m|billion|b|k)\b/gi;

const ROUND_ALIASES = Object.freeze({
  'pre seed': 'pre-seed',
  'pre-seed': 'pre-seed',
  seed: 'seed',
  'series a': 'series-a',
  'series-a': 'series-a',
  'series b': 'series-b',
  'series-b': 'series-b',
  'series c': 'series-c',
  'series-c': 'series-c',
  'series d': 'series-d',
  'series e': 'series-e',
  'series f': 'series-f',
  bridge: 'bridge',
  growth: 'growth',
  angel: 'angel',
});

function parseMoney(raw, unit) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(unit || '').toLowerCase();
  if (u.startsWith('b')) return Math.round(n * 1e9);
  if (u.startsWith('m')) return Math.round(n * 1e6);
  if (u === 'k') return Math.round(n * 1e3);
  return Math.round(n);
}

function normalizeRound(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().replace(/\s+/g, ' ').trim();
  if (ROUND_ALIASES[key]) return ROUND_ALIASES[key];
  const series = key.match(/series\s*([a-f])/i);
  if (series) return `series-${series[1].toLowerCase()}`;
  if (/\bpre-?seed\b/.test(key)) return 'pre-seed';
  if (/\bseed\b/.test(key)) return 'seed';
  if (/\bbridge\b/.test(key)) return 'bridge';
  if (/\bgrowth\b/.test(key)) return 'growth';
  return null;
}

function instrumentFromText(text) {
  if (/\bSAFE\b/i.test(text) || /\bsafe\s+(?:round|note|financing)\b/i.test(text)) return 'safe';
  if (/\bconvertible\s+note\b/i.test(text)) return 'convertible';
  if (/\b(?:sbir|sttr|grant)\b/i.test(text)) return 'grant';
  if (/\b(?:venture\s+debt|credit\s+facility)\b/i.test(text)) return 'debt';
  if (/\b(?:series|seed|equity)\b/i.test(text)) return 'equity';
  return null;
}

export function eventCorpus(event = {}, participants = []) {
  const phrases = (participants || []).map((row) => row.evidence_phrase).filter(Boolean).join(' ');
  return [announcementTextFromEvent(event), phrases].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function researchRoundEconomics({ event = {}, text = '' } = {}) {
  const funding = extractFunding(text) || {};
  let valuationUsd = Number(funding.valuation) || null;
  let valuationKind = valuationUsd ? 'unknown' : null;
  for (const { kind, re } of VALUATION_PATTERNS) {
    const match = text.match(re);
    if (!match) continue;
    const parsed = parseMoney(match[1], match[2]);
    if (!parsed) continue;
    valuationUsd = parsed;
    valuationKind = kind;
    break;
  }
  if (!valuationUsd && /\bunicorn\b/i.test(text)) {
    valuationUsd = 1e9;
    valuationKind = 'unknown';
  }

  const euro = text.match(/(?:raises?|raised|secures?|secured|closes?|closed)\s+€\s*(\d+(?:\.\d+)?)\s*(k|m|million|b|billion)?/i);
  let amountUsd = null;
  let amountRaw = null;
  let currency = null;
  
  if (euro) {
    amountRaw = parseMoney(euro[1], euro[2] || (Number(euro[1]) < 1000 ? 'k' : ''));
    currency = 'EUR';
  } else {
    let extractedAmount = Number(funding.funding_amount) || null;
    if (extractedAmount) {
      const amountStr = String(extractedAmount);
      if (/\$\d+(?:\.\d+)?\s*[Kk]\b/.test(text) && !/(?:raises?|raised|secures?|secured|closes?|closed|bags?|bagged|lands?|landed)\s+\$\d+(?:\.\d+)?\s*[Kk]\b/i.test(text)) {
        extractedAmount = null;
      } else if (/\d+(?:\.\d+)?\s*(?:million|billion)\s+in\b/i.test(text) && !/(?:raises?|raised|secures?|secured|closes?|closed)\s+[^.!?]{0,20}?\d+(?:\.\d+)?\s*(?:million|billion)\s+in\b/i.test(text)) {
        extractedAmount = null;
      }
    }
    amountUsd = extractedAmount || Number(event.amount_usd) || null;
    amountRaw = amountUsd;
    currency = amountUsd ? 'USD' : null;
  }
  if (amountUsd && valuationUsd && amountUsd >= valuationUsd && /valuation/i.test(text)) {
    // Headline only named a valuation — do not treat it as the raise.
    amountUsd = Number(event.amount_usd) || null;
    if (!amountUsd) {
      amountRaw = null;
      currency = null;
    }
  }

  const roundType = normalizeRound(funding.funding_stage || funding.funding_round || event.round_type);
  const instrument = instrumentFromText(text);
  const findings = [];
  if (amountUsd) findings.push(`amount ${amountUsd}`);
  if (valuationUsd) findings.push(`${valuationKind || 'unknown'} valuation ${valuationUsd}`);
  if (roundType) findings.push(`round ${roundType}`);
  if (instrument) findings.push(`instrument ${instrument}`);

  const gaps = [];
  if (!amountUsd) gaps.push('amount_usd');
  if (!valuationUsd) gaps.push('valuation_usd');
  if (!roundType) gaps.push('round_type');

  return {
    researcher: 'round_economics',
    confidence: findings.length ? Math.min(0.5 + findings.length * 0.12, 0.93) : 0.15,
    findings,
    gaps,
    amount_usd: amountUsd,
    amount_raw: amountRaw,
    currency,
    valuation_usd: valuationUsd,
    valuation_kind: valuationKind,
    round_type: roundType,
    instrument,
    lead_investor: funding.lead_investor || null,
  };
}

export function researchWhyFunded({ text = '' } = {}) {
  const extracted = extractFundingAttentionAspects(text);
  const triggers = inferFundingTriggers(extracted);
  const proceedsMatch = text.match(USE_OF_PROCEEDS_RE) || text.match(FOR_PURPOSE_RE);
  const useOfProceeds = proceedsMatch ? proceedsMatch[0].trim().replace(/\s+/g, ' ').slice(0, 160) : null;
  const quotes = [];
  QUOTE_RE.lastIndex = 0;
  let quote;
  while ((quote = QUOTE_RE.exec(text)) !== null && quotes.length < 3) {
    const body = quote[1].trim();
    if (/\b(invest|fund|thesis|why|growth|team|market|product)\b/i.test(body)) quotes.push(body);
  }
  let primary = triggers.primary;
  if (primary === 'unspecified' && useOfProceeds) primary = 'use_of_proceeds';
  const gaps = [];
  if (primary === 'unspecified') gaps.push('why_funded');
  return {
    researcher: 'why_funded',
    confidence: primary === 'unspecified' ? 0.12 : (triggers.primary === 'unspecified' ? 0.5 : 0.72),
    findings: [
      primary !== 'unspecified' ? `why ${primary}` : null,
      useOfProceeds ? 'use_of_proceeds' : null,
      quotes.length ? `${quotes.length} quotes` : null,
    ].filter(Boolean),
    gaps,
    primary,
    reasons: triggers.reasons,
    cited: triggers.cited,
    use_of_proceeds: useOfProceeds,
    quotes,
    aspects: extracted.aspects.map((row) => row.id),
  };
}

const ANNOUNCEMENT_PROBLEM_RES = [
  /\b(?:building|builds|built)\s+[^.!?]{0,40}?\bthat\s+helps?\s+[^.!?]{8,140}/i,
  /\bhelps?\s+[^.!?]{8,120}?\s+(?:cut|reduce|fix|solve|prevent|automate)\s+[^.!?]{4,80}/i,
  /\b(?:to\s+solve|solving|tackling|addressing)\s+[^.!?]{8,140}/i,
  /\bthe\s+(?:company|startup)\s+(?:is|was)\s+(?:building|developing)\s+[^.!?]{8,140}/i,
  /\bto\s+(?:revolutionize|transform|power|electrify)\s+[^.!?]{4,80}/i,
];

function problemFromAnnouncement(text) {
  for (const re of ANNOUNCEMENT_PROBLEM_RES) {
    const match = text.match(re);
    if (match?.[0]) return match[0].trim().replace(/\s+/g, ' ').slice(0, 200);
  }
  return null;
}

export function researchProblemTeam({ event = {}, text = '' } = {}) {
  const name = event.startup_name_raw || '';
  const value = extractValueProposition(text, name) || {};
  const team = extractTeamSignals(text, name) || {};
  const foundedBy = [...text.matchAll(/founded by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})(?:\s+and\s+(?:(?:CEO|CTO|COO|CPO)\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}))?/gi)]
    .flatMap((match) => [match[1], match[2]])
    .filter(Boolean);
  if (foundedBy.length) {
    team.founders = [...new Set([...(team.founders || []), ...foundedBy])].slice(0, 5);
  }
  const problem = extractProblemSignals(text) || {};
  const problemStatement = problemFromAnnouncement(text)
    || team.founder_problem_fit
    || value.value_proposition
    || (problem.problem_keywords?.length
      ? `Announcement cites ${problem.problem_keywords.slice(0, 3).join(', ')}`
      : null);
  const findings = [];
  if (problemStatement) findings.push('problem');
  if (team.founders?.length) findings.push(`${team.founders.length} founders`);
  if (team.has_technical_cofounder) findings.push('technical_cofounder');
  if (team.team_signals?.length) findings.push(`${team.team_signals.length} team signals`);
  const gaps = [];
  if (!problemStatement) gaps.push('problem');
  if (!team.founders?.length && !team.team_signals?.length) gaps.push('team');
  return {
    researcher: 'problem_team',
    confidence: findings.length ? Math.min(0.48 + findings.length * 0.1, 0.9) : 0.12,
    findings,
    gaps,
    problem: problemStatement,
    value_proposition: value.value_proposition || null,
    tagline: value.tagline || null,
    founders: team.founders || [],
    advisors: team.advisors || [],
    has_technical_cofounder: Boolean(team.has_technical_cofounder),
    team_signals: team.team_signals || [],
    problem_keywords: problem.problem_keywords || [],
  };
}

export function researchParticipation({ participants = [], text = '', leadInvestor = null } = {}) {
  const roster = (participants || []).map((row) => ({
    name: row.investor_name_raw || null,
    investor_id: row.investor_id || null,
    role: row.participant_role || 'unknown',
    resolution_status: row.resolution_status || null,
  }));
  const lead = roster.find((row) => row.role === 'lead' || row.role === 'co_lead')
    || (leadInvestor ? { name: leadInvestor, investor_id: null, role: 'lead', resolution_status: null } : null);

  const checks = [];
  CHECK_RE.lastIndex = 0;
  let match;
  while ((match = CHECK_RE.exec(text)) !== null && checks.length < 8) {
    const name = match[1].trim();
    if (/\b(Series|Seed|The Company|Investors?|Round)\b/i.test(name)) continue;
    const amountUsd = parseMoney(match[2], match[3]);
    if (!amountUsd) continue;
    checks.push({ investor_name: name, amount_usd: amountUsd });
  }

  const findings = [];
  if (roster.length) findings.push(`${roster.length} participants`);
  if (lead?.name) findings.push(`lead ${lead.name}`);
  if (checks.length) findings.push(`${checks.length} check mentions`);
  const gaps = [];
  if (!roster.length && !lead) gaps.push('syndicate');
  return {
    researcher: 'participation',
    confidence: findings.length ? Math.min(0.5 + findings.length * 0.1, 0.9) : 0.1,
    findings,
    gaps,
    lead,
    participants: roster,
    check_mentions: checks,
  };
}

export function composeBriefing({ event = {}, reports = {} } = {}) {
  const economics = reports.round_economics || {};
  const why = reports.why_funded || {};
  const company = reports.problem_team || {};
  const syndicate = reports.participation || {};
  const researcherReports = RESEARCHER_IDS.map((id) => reports[id]).filter(Boolean);
  const missing = [...new Set(researcherReports.flatMap((row) => row.gaps || []))];
  const filled = researcherReports.filter((row) => (row.findings || []).length > 0).length;
  const completeness = Number((Math.max(0, 1 - missing.length / 8)).toFixed(2));
  return {
    version: FUNDING_INTEL_VERSION,
    source: 'funding-event-researchers',
    startup_name: event.startup_name_raw || null,
    source_url: event.source_url || null,
    researchers: Object.fromEntries(
      researcherReports.map((row) => [row.researcher, {
        confidence: row.confidence,
        findings: row.findings,
        gaps: row.gaps,
      }]),
    ),
    round: {
      amount_usd: economics.amount_usd || null,
      amount_raw: economics.amount_raw || null,
      currency: economics.currency || null,
      valuation_usd: economics.valuation_usd || null,
      valuation_kind: economics.valuation_kind || null,
      round_type: economics.round_type || null,
      instrument: economics.instrument || null,
    },
    why: {
      primary: why.primary || 'unspecified',
      reasons: why.reasons || [],
      cited: Boolean(why.cited),
      use_of_proceeds: why.use_of_proceeds || null,
      quotes: why.quotes || [],
      aspects: why.aspects || [],
    },
    startup: {
      problem: company.problem || null,
      value_proposition: company.value_proposition || null,
      founders: company.founders || [],
      advisors: company.advisors || [],
      has_technical_cofounder: Boolean(company.has_technical_cofounder),
      team_signals: company.team_signals || [],
    },
    syndicate: {
      lead: syndicate.lead || null,
      participants: syndicate.participants || [],
      check_mentions: syndicate.check_mentions || [],
    },
    completeness: {
      score: completeness,
      filled_researchers: filled,
      missing,
    },
  };
}

export function researchFundingEvent(event = {}, participants = []) {
  const text = eventCorpus(event, participants);
  const round_economics = researchRoundEconomics({ event, text });
  const why_funded = researchWhyFunded({ text });
  const problem_team = researchProblemTeam({ event, text });
  const participation = researchParticipation({
    participants,
    text,
    leadInvestor: round_economics.lead_investor,
  });
  return composeBriefing({
    event,
    reports: { round_economics, why_funded, problem_team, participation },
  });
}

export function eventPatchFromBriefing(event = {}, briefing = {}) {
  const meta = event.metadata && typeof event.metadata === 'object' ? { ...event.metadata } : {};
  const patch = {
    metadata: {
      ...meta,
      funding_intelligence: briefing,
      funding_intelligence_version: FUNDING_INTEL_VERSION,
      funding_intelligence_researched_at: new Date().toISOString(),
    },
  };
  if (!event.amount_usd && briefing.round?.amount_usd) {
    patch.amount_usd = briefing.round.amount_usd;
  }
  if (!event.round_type && briefing.round?.round_type) {
    patch.round_type = briefing.round.round_type;
  }
  return patch;
}

export function briefingHasSignal(briefing = {}) {
  return Boolean(
    briefing.round?.amount_usd
    || briefing.round?.amount_raw
    || briefing.round?.valuation_usd
    || (briefing.why?.primary && briefing.why.primary !== 'unspecified')
    || briefing.startup?.problem
    || briefing.startup?.founders?.length
    || briefing.syndicate?.lead
    || briefing.syndicate?.participants?.length,
  );
}

export function eventDedupeKey(event = {}) {
  const name = String(event.startup_name_raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const amount = event.amount_usd || '';
  const day = String(event.announced_at || event.occurred_at || '').slice(0, 10);
  return `${name}|${amount}|${day}`;
}

const ROUNDUP_HEADLINE_RE =
  /,\s+[A-Z][^,]{0,80}(?:'s|’s)\s+new\b|\b(?:roundup|in brief|also raised|and others)\b|,\s+[A-Z][A-Za-z0-9&.\-']+(?:\s+[A-Z][A-Za-z0-9&.\-']+){0,4}\s+raises?\b/i;
const TOTAL_FUNDING_REACHES_RE = /\btotal\s+funding\s+reaches\b/i;

/**
 * Score a raise copy so sibling articles collapse onto the headline that
 * actually states purpose or valuation — not the newest roundup / tally.
 */
export function headlineQuality(event = {}) {
  const title = String(event.source_title || '').replace(/\s+/g, ' ').trim();
  if (!title) return 0;
  let score = Math.min(title.length, 140) / 70;
  if (USE_OF_PROCEEDS_RE.test(title) || FOR_PURPOSE_RE.test(title)) score += 10;
  if (VALUATION_PATTERNS.some(({ re }) => re.test(title))) score += 4;
  const why = researchWhyFunded({ text: title });
  if (why.primary && why.primary !== 'unspecified') score += 6;
  if (why.use_of_proceeds) score += 3;
  const econ = researchRoundEconomics({ event, text: title });
  if (econ.valuation_usd) score += 3;
  if (ROUNDUP_HEADLINE_RE.test(title)) score -= 8;
  if (TOTAL_FUNDING_REACHES_RE.test(title) && !USE_OF_PROCEEDS_RE.test(title)) score -= 5;
  return score;
}

export function compareHeadlineRichness(a = {}, b = {}) {
  const quality = headlineQuality(a) - headlineQuality(b);
  if (quality) return quality;
  const length = String(a.source_title || '').length - String(b.source_title || '').length;
  if (length) return length;
  const ta = Date.parse(a.announced_at || a.occurred_at || 0) || 0;
  const tb = Date.parse(b.announced_at || b.occurred_at || 0) || 0;
  return ta - tb;
}

export function pickRichestEvent(events = []) {
  if (!events.length) return null;
  return events.reduce((best, row) => (compareHeadlineRichness(row, best) > 0 ? row : best));
}

export function pickRichestPerRaise(events = []) {
  const best = new Map();
  const order = [];
  events.forEach((event, index) => {
    const raiseKey = eventDedupeKey(event);
    const bucket = raiseKey === '|' ? `id:${event.id || index}` : raiseKey;
    const current = best.get(bucket);
    if (!current) {
      best.set(bucket, event);
      order.push(bucket);
      return;
    }
    if (compareHeadlineRichness(event, current) > 0) best.set(bucket, event);
  });
  return order.map((key) => best.get(key));
}

/**
 * Collapse sibling copies of the same raise, then research only the richest
 * headline that is not already stamped. Already-stamped purpose copies stay
 * in the pool so a leftover roundup does not get a second briefing.
 */
export function selectResearchEvents(candidates = [], { limit = 80, isDone = () => false } = {}) {
  const groups = new Map();
  const order = [];
  candidates.forEach((event, index) => {
    const raiseKey = eventDedupeKey(event);
    const bucket = raiseKey === '|' ? `id:${event.id || index}` : raiseKey;
    if (!groups.has(bucket)) {
      groups.set(bucket, []);
      order.push(bucket);
    }
    groups.get(bucket).push(event);
  });

  const selected = [];
  let skippedAlready = 0;
  let skippedDuplicate = 0;
  for (const bucket of order) {
    if (selected.length >= limit) break;
    const group = groups.get(bucket);
    const richest = pickRichestEvent(group);
    skippedDuplicate += Math.max(0, group.length - 1);
    if (isDone(richest)) {
      skippedAlready += 1;
      continue;
    }
    selected.push(richest);
  }
  return {
    selected,
    skipped_already: skippedAlready,
    skipped_duplicate: skippedDuplicate,
  };
}

export function formatResearchMoney(amount, currency = 'USD') {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const prefix = currency === 'EUR' ? '€' : currency === 'USD' || !currency ? '$' : `${currency} `;
  if (n >= 1e9) return `${prefix}${trimNum(n / 1e9)}B`;
  if (n >= 1e6) return `${prefix}${trimNum(n / 1e6)}M`;
  if (n >= 1e3) return `${prefix}${trimNum(n / 1e3)}K`;
  return `${prefix}${n}`;
}

function trimNum(n) {
  return String(Number(n.toFixed(n >= 10 ? 1 : 2))).replace(/\.0$/, '');
}

export function uniquePreview(rows = [], limit = 8) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(row.startup || row.event_id || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function formatPreviewRow(row = {}) {
  const money = formatResearchMoney(row.amount_usd || row.amount_raw, row.currency || 'USD');
  const val = row.valuation_usd ? ` val=${formatResearchMoney(row.valuation_usd)}` : '';
  const why = row.why && row.why !== 'unspecified' ? row.why : 'unspecified';
  return `${row.startup}: ${row.round_type || '—'} ${money}${val} why=${why}`;
}
