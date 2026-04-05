'use strict';

/**
 * Use signalParser / ontology output to flag pending startup_uploads "names" that are
 * RSS/headline fragments, not trading names.
 *
 * Tier 1 — Linguistic: rumor / exploratory grammar (narrow).
 * Tier 2 — Structured: primary_signal is a concrete event class. We gate heavily because
 * ACTION_MAP uses substrings (e.g. "accel" ⊂ "Accelerate", "scale" ⊂ "ScaleOps", "pass" ⊂ "Daypass").
 */

const { parseSignal } = require('./signalParser');

/** Exact names that are valid entities but match fundraising / other patterns */
const ONTOLOGY_EXACT_ALLOW = new Set(
  [
    'y combinator',
    'ycombinator',
    'techstars',
    '500 startups',
    'plug and play',
    'andreessen horowitz',
    'a16z',
    'sequoia capital',
    'khosla ventures',
  ].map((s) => s.toLowerCase())
);

/** Substrings that indicate a real org / program, not a junk headline (case-insensitive) */
const FUNDRAISE_SAFE =
  /\b(y combinator|ycombinator|yc batch|techstars|500 startups|500 global|plug and play|a16z|andreessen|sequoia|khosla|y combinator batch|antler|entrepreneur first|ef collect|masschallenge|startup\s+chile)\b/i;

/** Named-investor / "accel" VC regex matches real firm names and "Accelerate*" false positives */
const FUNDRAISE_SKIP_MEANINGS = new Set([
  'top-tier vc investor named',
  'top-tier accelerator backing',
]);

const MAX_WORDS = 22;
const MAX_CHARS = 160;

/** Headline-style hiring (not a brand starting with "Hire…") */
const HEADLINE_HIRING_RE =
  /^(now hiring|we'?re hiring|we are hiring|hiring engineers|hiring for|actively hiring|recruiting for|looking to hire|open roles?:?)\b/i;

/**
 * Wire / PR verbs — "Reveal HealthTech" as a brand should not match (we use reveals|revealed, not bare "reveal").
 */
const PRODUCT_HEADLINE_VERB_RE =
  /\b(announces?|announced|unveils?|unveiled|reveals|revealed|launches|launching|launched|debuts?|introduces?|rolls?\s+out)\b/i;

/** Clear investor "pass" idiom — avoids substring "pass" in "Daypass" */
const INVESTOR_PASS_HEADLINE_RE =
  /\b(pass(ed|ing)? on\b|passed on\b|investors? (passed|pass)\b|vcs? (passed|pass)\b|passing on\b|\bpassing\s+prs?\b)/i;

const STRUCTURED_MIN_CERTAINTY = 0.72;
const EXPLORATORY_MIN_CERTAINTY = 0.33;

/**
 * primary_signal classes safe to treat as headline junk when certainty is high.
 * Excludes growth_signal / revenue_signal (substring "scale", "growth" in brand names).
 * product_signal / investor_rejection_signal handled separately with extra gates.
 */
const STRONG_HEADLINE_SIGNALS = new Set([
  'distress_signal',
  'acquisition_signal',
  'exit_signal',
  'partnership_signal',
  'expansion_signal',
  'efficiency_signal',
  'buyer_pain_signal',
]);

function fundraisingAllowed(text) {
  const lower = text.trim().toLowerCase();
  if (ONTOLOGY_EXACT_ALLOW.has(lower)) return true;
  return FUNDRAISE_SAFE.test(text);
}

function meaningNorm(a) {
  return (a && a.meaning ? String(a.meaning) : '').toLowerCase().trim();
}

/**
 * @param {string} name
 * @returns {string|null} reason key for logging, or null if OK
 */
function ontologyJunkReason(name) {
  if (!name || typeof name !== 'string') return null;
  const t = name.trim();
  if (t.length < 4 || t.length > MAX_CHARS) return null;

  const lower = t.toLowerCase();
  if (ONTOLOGY_EXACT_ALLOW.has(lower)) return null;

  // Align with startupNameValidator: "Company CEO Firstname Lastname" = news headline, not a trading name
  if (/^(?:.+\s+)?(CEO|CTO|CFO|COO|CMO)\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*$/i.test(t)) {
    return 'ontology/executive_person_headline';
  }

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > MAX_WORDS) return null;

  const parsed = parseSignal(t, { source_type: 'rss_scrape' });
  if (!parsed) return null;

  const flags = parsed.ambiguity_flags || [];
  const primary = parsed.primary_signal;
  const actions = parsed._actions || [];
  const top = actions[0];
  const bc = top ? (top.base_certainty ?? 0) : 0;
  const mnorm = meaningNorm(top);

  // Rumor / hedge headline fragments: "… in talks to …", "could be planning …", etc.
  if (flags.includes('rumor_language')) {
    return 'ontology/rumor_language';
  }

  // Long RSS compound headline: multiple distinct signal classes in one line
  if (flags.includes('multi_signal_sentence') && words.length <= 24) {
    return 'ontology/multi_signal_sentence';
  }

  // Explainer / modal-exploratory titles ("Look for when you invest", "Considering options")
  if (primary === 'exploratory_signal' && actions.length > 0) {
    if (bc >= EXPLORATORY_MIN_CERTAINTY) return 'ontology/exploratory_signal';
  }

  // Fundraising — skip named-VC / accelerator regex false positives (Bessemer Venture, Accelerated*, Accel-in-Accelerate)
  if (primary === 'fundraising_signal') {
    if (FUNDRAISE_SKIP_MEANINGS.has(mnorm)) return null;
    if (!fundraisingAllowed(t)) {
      return 'ontology/fundraising_headline';
    }
    return null;
  }

  // Hiring: only clear job-posting / headline phrasing (skip "Hire" as substring in brands)
  if (primary === 'hiring_signal') {
    if (HEADLINE_HIRING_RE.test(t)) return 'ontology/hiring_headline';
    return null;
  }

  // Product: PR verbs OR descriptor-only junk (Copilot… AI tool); not bare "Reveal" brands
  if (primary === 'product_signal' && actions.length > 0) {
    if (bc < STRUCTURED_MIN_CERTAINTY || words.length > 18) return null;
    if (mnorm.includes('ai product or feature') || mnorm.includes('open source release')) {
      return 'ontology/product_signal';
    }
    if (PRODUCT_HEADLINE_VERB_RE.test(t)) return 'ontology/product_signal';
    if (words.length === 1 && /^(launching|revealed|debuts?)$/i.test(t)) return 'ontology/product_signal';
    return null;
  }

  // Investor pass — must look like a deal headline, not "Daypass"
  if (primary === 'investor_rejection_signal' && actions.length > 0) {
    if (bc >= STRUCTURED_MIN_CERTAINTY && INVESTOR_PASS_HEADLINE_RE.test(t)) {
      return 'ontology/investor_rejection_signal';
    }
    return null;
  }

  // Revenue — only clear “record / milestone” headline (omit growth_signal-style substring FPs)
  if (primary === 'revenue_signal' && actions.length > 0) {
    if (bc >= STRUCTURED_MIN_CERTAINTY && words.length <= 18 && mnorm.includes('record performance')) {
      return 'ontology/revenue_signal';
    }
    return null;
  }

  // Distress, M&A, partnership, expansion, buyer pain, etc. (not growth/revenue/product)
  if (STRONG_HEADLINE_SIGNALS.has(primary) && actions.length > 0) {
    if (bc >= STRUCTURED_MIN_CERTAINTY && words.length <= 18) {
      return `ontology/${primary}`;
    }
  }

  return null;
}

/**
 * Structured parse for review tooling (does not decide junk).
 * @param {string} name
 * @returns {{ primary_signal: string|null, ambiguity_flags: string[], top_meaning: string|null, certainty: number }|null}
 */
function parsePendingNameForReview(name) {
  if (!name || typeof name !== 'string') return null;
  const t = name.trim();
  if (t.length < 4) return null;
  const parsed = parseSignal(t, { source_type: 'rss_scrape' });
  if (!parsed) return null;
  const actions = parsed._actions || [];
  const top = actions[0];
  return {
    primary_signal: parsed.primary_signal || null,
    ambiguity_flags: parsed.ambiguity_flags || [],
    top_meaning: top && top.meaning ? String(top.meaning) : null,
    certainty: top && typeof top.base_certainty === 'number' ? top.base_certainty : 0,
  };
}

module.exports = {
  ontologyJunkReason,
  parsePendingNameForReview,
  ONTOLOGY_EXACT_ALLOW,
  fundraisingAllowed,
  HEADLINE_HIRING_RE,
  FUNDRAISE_SKIP_MEANINGS,
};
