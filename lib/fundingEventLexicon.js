'use strict';

/**
 * Funding / deal CONTEXT lexicon — word and phrase associations for investment news.
 *
 * Purpose:
 *   - Give the funding-event frame and name pipeline *context*: a proper noun near
 *     one of these associations is more likely a real deal entity than a junk span.
 *   - Lookup tables and standalone string heuristics do not encode this; context does.
 *
 * Relationship to signalOntology.js:
 *   - signalOntology maps patterns → signal_class / action_tag for parseSignal.
 *   - This file is the curated, grouped list of *deal-relevant* language (past vs
 *     active vs negative, etc.) for frame logic and "has deal context?" checks.
 *
 * Groups are not mutually exclusive (e.g. "joint venture" can be strategic or past).
 */

/** @typedef {'completed_or_past' | 'active_investor_or_deal' | 'active_interest_or_pipeline' | 'company_fundraising' | 'negative_or_pass' | 'partnership_or_strategic'} FundingLexiconGroup */

/**
 * Completed events, exits, formal outcomes — often past tense or result nouns.
 * @type {Record<FundingLexiconGroup, string[]>}
 */
const PHRASES = {
  completed_or_past: [
    'acquisition',
    'acquisitions',
    'acquire',
    'acquired',
    'acquires',
    'acquiring',
    'acqui-hire',
    'acquihire',
    'acquihired',
    'merger',
    'mergers',
    'merged',
    'merging',
    'takeover',
    'hostile takeover',
    'buyout',
    'buyouts',
    'bought',
    'leveraged buyout',
    'management buyout',
    'mbo',
    'lbo',
    'divestiture',
    'divestitures',
    'divested',
    'divest',
    'sold',
    'sale',
    'strategic sale',
    'asset sale',
    'carve-out',
    'carve out',
    'spin-off',
    'spinoff',
    'spun off',
    'spin-out',
    'consolidation',
    'consolidated',
    'ipo',
    'i.p.o.',
    'initial public offering',
    'went public',
    'going public',
    'go public',
    'public offering',
    'listed on',
    'public listing',
    'listing',
    'direct listing',
    'secondary offering',
    'follow-on offering',
    'spac',
    'de-spac',
    'despac',
    'de spac',
    'blank-check',
    'blank check',
    'taken private',
    'take-private',
    'take private',
    'go-private',
    'go private',
    'delisted',
    'delisting',
    'joint venture',
    'joint-venture',
    'formed a joint venture',
    'entered into a joint venture',
    'strategic alternatives',
    'exploring strategic alternatives',
    'sale process',
    'dual-track',
    'dual track',
    'drhp',
    'f-1',
    'f1 filing',
    's-1',
    'registration statement',
  ],

  active_investor_or_deal: [
    'investing in',
    'invests in',
    'invested in',
    'investment in',
    'investments in',
    'reinvested in',
    'put money into',
    'writing a check',
    'wrote a check',
    'writes a check',
    'cut a check',
    'backing',
    'backed',
    'backs',
    'co-invest',
    'coinvest',
    'co-invested',
    'co-investing',
    'co-led',
    'co-led the',
    'co-lead',
    'co-leads',
    'led the round',
    'leading the round',
    'lead investor',
    'leading investor',
    'joining the round',
    'joined the round',
    'participating in',
    'participated in',
    'participation in',
    'participating investor',
    'allocation',
    'allocated',
    'syndicate',
    'syndicated',
    'syndication',
    'spv',
    'special purpose vehicle',
    'rolling close',
    'first close',
    'final close',
    'term sheet',
    'term sheets',
    'signed a term sheet',
    'signed term sheet',
    'ts signed',
    'post-money',
    'pre-money',
    'priced the round',
    'pricing',
    'bridge',
    'bridge round',
    'extension round',
    'inside round',
    'party round',
    'safe',
    'convertible note',
    'convertible notes',
    'pro rata',
    'prorata',
    'preempt',
    'pre-empt',
    'preempted',
    'follow-on',
    'follow on',
    'follow-on investment',
    'anchor',
    'anchor investor',
    'cornerstone',
    'first institutional',
    'board seat',
    'board observer',
    'observer seat',
    'cap table',
    'capital call',
    'committed capital',
    'commitment',
    'fund a',
    'funding round',
    'financing round',
    'venture round',
    'equity round',
    'growth round',
    'late stage',
    'early stage',
    'seed round',
    'series a',
    'series b',
    'series c',
    'series d',
    'series e',
    'series f',
    'series g',
    'series h',
    'mezzanine',
    'growth equity',
    'venture debt',
    'venture lending',
  ],

  active_interest_or_pipeline: [
    'interested in',
    'interest in',
    'evaluating',
    'evaluation',
    'looking at',
    'taking a look',
    'take a look',
    'closer look',
    'pipeline',
    'in the pipeline',
    'considering',
    'consideration',
    'exploring an investment',
    'exploring investment',
    'early-stage conversations',
    'early conversations',
    'initial conversations',
    'spoke with',
    'speaking with',
    'met with',
    'meeting with',
    'coffee with',
    'tracking',
    'monitoring',
    'watching closely',
    'on the radar',
    'kicking tires',
    'due diligence',
    'diligence',
    'data room',
    'virtual data room',
    'vdr',
    'requested the deck',
    'reviewing the deck',
    'partner meeting',
    'ic meeting',
    'investment committee',
    'memo',
    'investment memo',
  ],

  company_fundraising: [
    'raised',
    'raising',
    'raises',
    'closed the round',
    'closing the round',
    'secured funding',
    'secured financing',
    'secured',
    'announced funding',
    'announces funding',
    'funding announcement',
    'financing',
    'bootstrapped',
    'bootstrapping',
    'self-funded',
    'friends and family',
    'crowdfunding',
    'reg cf',
    'regulation cf',
    'reg a',
    'regulation a',
  ],

  negative_or_pass: [
    'passed',
    'passed on',
    'pass on',
    'passing on',
    'did not invest',
    'didn\'t invest',
    'never invested',
    'no investment',
    'not investing',
    'declined to invest',
    'declined participation',
    'walked away',
    'walked from',
    'pulled out',
    'pulled funding',
    'rejected',
    'turned down',
    'passed on the deal',
  ],

  partnership_or_strategic: [
    'strategic investment',
    'strategic investor',
    'minority investment',
    'minority stake',
    'corporate venture',
    'cvc',
    'venture arm',
    'strategic partner',
    'commercial partnership',
    'co-development',
    'oem deal',
    'revenue share',
    'rev share',
    'joint development',
    'channel partner',
    'distribution agreement',
    'licensing deal',
    'license agreement',
  ],
};

/**
 * Single tokens that often co-occur with deals but are NOT sufficient alone
 * (headlines like "Series A" with no verb still need other signals).
 * @type {string[]}
 */
const WEAK_CONTEXT_TOKENS = [
  'round',
  'deal',
  'deals',
  'financing',
  'funding',
  'investment',
  'investments',
  'valuation',
  'valued',
  'unicorn',
  'down round',
  'up round',
  'flat round',
  'liquidation',
  'preference',
  'preferred',
  'common stock',
  'options',
  'warrant',
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex that matches `phrase` with word boundaries; internal whitespace is flexible.
 * @param {string} phrase
 * @returns {RegExp}
 */
function phrasePattern(phrase) {
  const normalized = phrase.trim().replace(/\s+/g, ' ');
  const inner = normalized.split(' ').map(escapeRegExp).join('\\s+');
  // `g` is required when scanning with `exec` in a loop; otherwise `exec` repeats the first match forever.
  return new RegExp(`\\b(?:${inner})\\b`, 'gi');
}

let _compiled = null;

function getCompiledPatterns() {
  if (_compiled) return _compiled;
  /** @type {Array<{ group: FundingLexiconGroup, phrase: string, re: RegExp }>} */
  const rows = [];
  for (const [group, list] of Object.entries(PHRASES)) {
    const seen = new Set();
    for (const phrase of list) {
      const key = phrase.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        rows.push({
          group: /** @type {FundingLexiconGroup} */ (group),
          phrase,
          re: phrasePattern(phrase),
        });
      } catch {
        // skip degenerate patterns
      }
    }
  }
  rows.sort((a, b) => b.phrase.length - a.phrase.length);
  _compiled = rows;
  return rows;
}

/**
 * @param {string|null|undefined} text
 * @returns {{ hasStrongContext: boolean, matches: Array<{ group: FundingLexiconGroup, phrase: string }>, weakTokenHits: string[] }}
 */
function matchFundingContext(text) {
  const raw = text == null ? '' : String(text);
  const t = raw.replace(/\s+/g, ' ').trim();
  const matches = [];
  if (t.length < 3) {
    return { hasStrongContext: false, matches: [], weakTokenHits: [] };
  }

  const compiled = getCompiledPatterns();
  const matchedRanges = [];

  for (const { group, phrase, re } of compiled) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      let overlap = false;
      for (const [s, e] of matchedRanges) {
        if (start < e && end > s) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        matchedRanges.push([start, end]);
        matches.push({ group, phrase });
      }
    }
  }

  const lower = t.toLowerCase();
  const weakTokenHits = [];
  for (const tok of WEAK_CONTEXT_TOKENS) {
    const re = phrasePattern(tok);
    if (re.test(lower)) weakTokenHits.push(tok);
  }

  return {
    hasStrongContext: matches.length > 0,
    matches,
    weakTokenHits,
  };
}

/**
 * True if text has at least one strong phrase match OR (optional) weak tokens for downstream heuristics.
 * @param {string|null|undefined} text
 * @param {{ requireWeakWithStrong?: boolean }} [opts]
 */
function textHasDealLanguage(text, opts = {}) {
  const { matches, weakTokenHits, hasStrongContext } = matchFundingContext(text);
  if (hasStrongContext) return true;
  if (opts.requireWeakWithStrong) return false;
  return weakTokenHits.length >= 2;
}

/** @type {FundingLexiconGroup[]} */
const GROUP_KEYS = /** @type {FundingLexiconGroup[]} */ (Object.keys(PHRASES));

module.exports = {
  PHRASES,
  GROUP_KEYS,
  WEAK_CONTEXT_TOKENS,
  matchFundingContext,
  textHasDealLanguage,
  phrasePattern,
};
