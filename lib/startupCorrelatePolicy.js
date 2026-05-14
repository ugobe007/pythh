'use strict';

/**
 * STARTUP CORRELATE POLICY — URL or correlated description (inference-backed gates)
 *
 * Decision stack (same spirit as entityResolutionGate ordering):
 *   1. Logic engine + name ontology on `name` only — evaluateStartupNameForPipeline()
 *   2. Resolvable URL on row — website | company_website | source_url (RSS article proof)
 *   3. Correlated description — substantive text where the trading name is anchored AND
 *      the copy is not disallowed “wrong string class” (pure lab physics, generic study prose
 *      with no company deal), and not a naked exec-appointment headline without company URL.
 *
 * Accept when: (2) OR (3) after passing (1).
 * Reject when: fails (1), OR (fails (2) AND fails (3)).
 *
 * Examples (intent):
 *   GOOD — “Acme just inked a deal with Google to handle their data pipeline” + name Acme
 *   GOOD — professor commentary that still ties “NAME … streamline agent workflows …”
 *   BAD  — “research at MIT shows … Higgs boson formula …” (pure research / wrong object class)
 *   RISK — “Google just named NAME as head of robotics …” (often a person hire; reject without URL)
 *
 * This module does not call remote LLMs; it uses structural text checks + existing name gate.
 */

const { evaluateStartupNameForPipeline } = require('./startupNameGate');

const MIN_CONTEXT_CHARS = 72;

const PLACEHOLDER_WEB = new Set(['n/a', 'na', 'none', 'null', 'tbd', '-', '.', '..', 'unknown']);

function webTrim(s) {
  return String(s || '').trim();
}

function isPlaceholderWeb(s) {
  const t = webTrim(s).toLowerCase();
  return t.length === 0 || PLACEHOLDER_WEB.has(t);
}

function looksLikeDomainOrUrl(s) {
  const t = webTrim(s);
  if (t.length < 4 || isPlaceholderWeb(t)) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^ftp:\/\//i.test(t)) return true;
  if (/^www\.[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(t)) return true;
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(t)) return true;
  return false;
}

function hasResolvableUrl(row) {
  return (
    looksLikeDomainOrUrl(row.website) ||
    looksLikeDomainOrUrl(row.company_website) ||
    looksLikeDomainOrUrl(row.source_url)
  );
}

function extractTextFromObject(obj, depth = 0) {
  if (depth > 4 || obj == null) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return '';
  const keys = [
    'description',
    'company_description',
    'pitch',
    'summary',
    'one_liner',
    'tagline',
    'snippet',
    'body',
  ];
  const parts = [];
  for (const k of keys) {
    if (typeof obj[k] === 'string') parts.push(obj[k]);
  }
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v.length > 40) parts.push(v);
    else if (typeof v === 'object' && v) parts.push(extractTextFromObject(v, depth + 1));
  }
  return parts.join(' ');
}

/**
 * @param {{ name?: string|null, description?: string|null, pitch?: string|null, tagline?: string|null, extracted_data?: object|null }} row
 */
function buildContextString(row) {
  const chunks = [
    row.description,
    row.pitch,
    row.tagline,
    extractTextFromObject(row.extracted_data || {}),
  ]
    .filter(Boolean)
    .map((s) => String(s).trim());
  return chunks.join('\n').trim();
}

function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[''`]/g, '')
    .trim();
}

/**
 * Trading name must appear as a phrase or strong token anchor in context (stops MIT/Higgs rows
 * where the “startup” name does not actually appear in the article body we stored).
 */
function nameAnchoredInContext(name, context) {
  const n = String(name || '').trim();
  const c = normalizeForMatch(context);
  if (!n || !c) return false;
  const nn = normalizeForMatch(n);
  if (nn.length >= 3 && c.includes(nn)) return true;

  const words = nn.split(/\s+/).filter((w) => w.length > 2);
  if (words.length >= 2) {
    const hits = words.filter((w) => new RegExp(`\\b${escapeReg(w)}\\b`, 'i').test(c));
    return hits.length >= Math.min(2, words.length);
  }
  if (words.length === 1) {
    return new RegExp(`\\b${escapeReg(words[0])}\\b`, 'i').test(c);
  }
  return false;
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pure research / physics object class — not usable as “company description” correlation. */
function isPureAcademicResearchContext(text) {
  const t = String(text || '').slice(0, 2500).toLowerCase();
  if (t.length < 40) return false;
  const physics = /\b(higgs|boson|quarks?|hadron|collider|particle accelerator|string theory)\b/.test(
    t
  );
  const studyFrame =
    /\b(research at|scientists at|study finds|peer[- ]reviewed|hypothesis|published in nature|published in science)\b/i.test(
      t
    );
  const formulaHype =
    /\b(formula by|disproves|invalidates|challenges the)\b.*\b(higgs|boson|standard model)\b/i.test(t) ||
    /\b(higgs|boson)\b.*\b(formula|factor of|by a factor)\b/i.test(t);
  return (physics && studyFrame) || formulaHype;
}

/** “Google named X as head of …” — usually a person hire; do not count as startup product correlation without URL. */
function isExecPersonAppointmentContext(text, name) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  if (!/\b(named|appointed|taps?|names?)\b/i.test(lower)) return false;
  if (!/\b(as|to)\b/i.test(lower)) return false;
  if (!/\b(head of|chief|ceo|cto|cfo|coo|president|director|vp|vice president)\b/i.test(lower)) return false;
  return nameAnchoredInContext(name, t);
}

/** Deal / company narrative near the name (supports “inked a deal”, raises, pipeline, etc.). */
function hasCompanyDealNarrative(text, name) {
  if (!nameAnchoredInContext(name, text)) return false;
  const t = String(text || '').toLowerCase();
  return (
    /\b(inked|signed a deal|signed the deal|closed|raised|raising|funding|seed|series\s+[a-e]|valuation|customers?|revenue|pipeline|partnership|acquires?|acquisition|merger)\b/i.test(
      t
    ) ||
    /\$\s*\d/.test(t) ||
    /\b(streamline|workflows?|ambiguities|language models|data pipeline)\b/i.test(t) ||
    /\bbelieves\b.*\b(has a chance|could streamline|will streamline)\b/i.test(t)
  );
}

/**
 * @param {{
 *   name?: string|null,
 *   website?: string|null,
 *   company_website?: string|null,
 *   source_url?: string|null,
 *   description?: string|null,
 *   pitch?: string|null,
 *   tagline?: string|null,
 *   extracted_data?: object|null,
 * }} row
 * @returns {{
 *   ok: boolean,
 *   channel: 'url'|'description'|'none',
 *   reason: string|null,
 *   checks: {
 *     name_gate: boolean,
 *     name_gate_reason: string|null,
 *     url: boolean,
 *     context_chars: number,
 *     anchored: boolean,
 *     pure_academic: boolean,
 *     exec_person_headline: boolean,
 *     company_narrative: boolean,
 *   }
 * }}
 */
function evaluateStartupCorrelatePolicy(row) {
  const name = String(row.name || '').trim();
  if (!name) {
    return {
      ok: false,
      channel: 'none',
      reason: 'correlate/empty_name',
      checks: {
        name_gate: false,
        name_gate_reason: 'empty',
        url: false,
        context_chars: 0,
        anchored: false,
        pure_academic: false,
        exec_person_headline: false,
        company_narrative: false,
      },
    };
  }

  const nameEv = evaluateStartupNameForPipeline(name);
  if (!nameEv.ok) {
    return {
      ok: false,
      channel: 'none',
      reason: nameEv.reason || 'correlate/name_gate',
      checks: {
        name_gate: false,
        name_gate_reason: nameEv.reason,
        url: hasResolvableUrl(row),
        context_chars: buildContextString(row).length,
        anchored: false,
        pure_academic: false,
        exec_person_headline: false,
        company_narrative: false,
      },
    };
  }

  const url = hasResolvableUrl(row);
  const ctx = buildContextString(row);
  const ctxLen = ctx.length;
  const anchored = nameAnchoredInContext(name, ctx);
  const pureAcademic = isPureAcademicResearchContext(ctx);
  const execPerson = isExecPersonAppointmentContext(ctx, name);
  const companyNarrative = hasCompanyDealNarrative(ctx, name);

  const checks = {
    name_gate: true,
    name_gate_reason: null,
    url: url,
    context_chars: ctxLen,
    anchored,
    pure_academic: pureAcademic,
    exec_person_headline: execPerson,
    company_narrative: companyNarrative,
  };

  if (url) {
    return { ok: true, channel: 'url', reason: null, checks };
  }

  const substantive = ctxLen >= MIN_CONTEXT_CHARS;
  if (!substantive) {
    return {
      ok: false,
      channel: 'none',
      reason: 'correlate/no_url_and_thin_context',
      checks,
    };
  }

  if (!anchored) {
    return {
      ok: false,
      channel: 'none',
      reason: 'correlate/name_not_in_description',
      checks,
    };
  }

  if (pureAcademic) {
    return {
      ok: false,
      channel: 'none',
      reason: 'correlate/pure_academic_context',
      checks,
    };
  }

  if (execPerson && !companyNarrative) {
    return {
      ok: false,
      channel: 'none',
      reason: 'correlate/exec_person_headline_without_deal_narrative',
      checks,
    };
  }

  if (companyNarrative || (anchored && substantive && !execPerson)) {
    return { ok: true, channel: 'description', reason: null, checks };
  }

  return {
    ok: false,
    channel: 'none',
    reason: 'correlate/no_url_and_weak_company_signal',
    checks,
  };
}

module.exports = {
  evaluateStartupCorrelatePolicy,
  buildContextString,
  hasResolvableUrl,
  nameAnchoredInContext,
  isPureAcademicResearchContext,
  isExecPersonAppointmentContext,
  hasCompanyDealNarrative,
  MIN_CONTEXT_CHARS,
};
