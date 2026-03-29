'use strict';

/**
 * SENTENCE PARSER — Ontological Token Classifier & Structural Name Extractor
 * ===========================================================================
 * Language, like code, math, music, and physics, is a PATTERN SYSTEM.
 * Every sentence has a grammatical skeleton. We decode the skeleton FIRST,
 * then pull startup names from the correct structural positions.
 *
 * Pipeline:
 *   tokenize(text)           → RawToken[]
 *   classifyTokens(tokens)   → TaggedToken[]   (each token gets a grammatical role)
 *   mergeProperNouns(tagged) → TaggedToken[]   (consecutive PROPER tokens joined)
 *   extractNamesFromTagged() → string[]        (names from valid structural slots)
 *
 * Structural patterns understood:
 *   P1  SUBJECT     PROPER → VERB             "Stripe raises $50M"
 *   P2  OBJECT      VERB → PROPER             "backs Cohere at $X"
 *   P3  PREP-COMP   PREP → PROPER             "from Stripe", "by Cohere"
 *   P4  ENUM        ENUM → PROPER             "like Cleanlab", "including Cohere"
 *   P5  GEO-POSS    GEO_POSS → PROPER         "Dubai's Tabby"
 *   P6  REL-SUBJ    REL → PROPER → VERB       "that Cased helps developers"
 *   P7  CONJ-ENUM   CONJ_CO → PROPER → …      "and Weights that offers"
 *   P8  REPORT-COMP REPORT → PROPER → COPULA  "believe Anyscale is the best"
 *   P9  CONJ-SUB    CONJ_SUB → PROPER → VERB  "when Notion improves their UI"
 *   P10 POSS-CONF   PROPER ⟶ (≤3) → POSS_DET "Notion improves their UI"
 */

const { isValidStartupName } = require('./startupNameValidator');

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN TYPE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const T = {
  VERB:      'VERB',      // action verb: raises, launches, helps, acquires…
  COPULA:    'COPULA',    // state verb: is, are, was, were, has, have, can…
  REPORT:    'REPORT',    // cognitive/reporting: says, believes, claims, finds…
  PROPER:    'PROPER',    // Title-Case candidate: Stripe, Cohere, Tabby
  COMMON:    'COMMON',    // common noun: startup, company, platform, funding…
  ADJ:       'ADJ',       // adjective/descriptor: hot, fast, innovative, AI-powered
  ADV:       'ADV',       // adverb: recently, quickly, reportedly, globally
  PREP:      'PREP',      // preposition: from, by, at, with, in, for, via
  CONJ_CO:   'CONJ_CO',   // coordinating conjunction: and, but, or, nor
  CONJ_SUB:  'CONJ_SUB',  // subordinating conjunction: when, while, because, if
  DET:       'DET',       // determiner: the, a, an, this, these, those
  POSS_DET:  'POSS_DET',  // possessive determiner: their, its, our, my, his, her
  REL:       'REL',       // relative pronoun: which, who, whom, where
  ENUM:      'ENUM',      // enumeration trigger: like, including, notably, namely
  GEO_POSS:  'GEO_POSS',  // geographic possessive: "Dubai's", "Singapore's"
  PUNCT:     'PUNCT',     // punctuation mark
  NUM:       'NUM',       // number or currency amount
  UNKNOWN:   'UNKNOWN',   // unclassified
};

// ═══════════════════════════════════════════════════════════════════════════
// LEXICONS — Vocabulary ontology
// Each set defines which tokens belong to which grammatical role.
// Order of checking in classifyToken() determines priority.
// ═══════════════════════════════════════════════════════════════════════════

// State verbs and auxiliaries
const COPULA_SET = new Set([
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'having',
  'does', 'do', 'did',
  'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must',
]);

// Cognitive / reporting verbs — signal a name as their complement
const REPORT_SET = new Set([
  'says', 'said', 'tells', 'told', 'states', 'stated',
  'claims', 'claimed', 'argues', 'argued',
  'believes', 'believe', 'believed',
  'thinks', 'think', 'thought',
  'knows', 'know', 'knew',
  'expects', 'expect', 'expected',
  'notes', 'noted', 'note',
  'reports', 'report', 'reported',
  'shows', 'show', 'showed', 'shown',
  'finds', 'find', 'found',
  'sees', 'see', 'saw',
  'suggests', 'suggest', 'suggested',
]);

// Action verbs — startup/business domain
const VERB_SET = new Set([
  // Funding
  'raises', 'raised', 'raise',
  'secures', 'secured', 'secure',
  'closes', 'closed', 'close',
  'completes', 'completed', 'complete',
  'announces', 'announced', 'announce',
  'receives', 'received', 'receive',
  'gets', 'get', 'got', 'gotten',
  // Growth / product
  'launches', 'launched', 'launch',
  'releases', 'released', 'release',
  'introduces', 'introduced', 'introduce',
  'unveils', 'unveiled', 'unveil',
  'ships', 'shipped', 'ship',
  'builds', 'built', 'build',
  'creates', 'created', 'create',
  'develops', 'developed', 'develop',
  'deploys', 'deployed', 'deploy',
  // M&A
  'acquires', 'acquired', 'acquire',
  'merges', 'merged', 'merge',
  'buys', 'bought', 'buy',
  'sells', 'sold', 'sell',
  'exits', 'exited', 'exit',
  // Operations
  'expands', 'expanded', 'expand',
  'enters', 'entered', 'enter',
  'opens', 'opened', 'open',
  'joins', 'joined', 'join',
  'leaves', 'left', 'leave',
  'hires', 'hired', 'hire',
  'appoints', 'appointed', 'appoint',
  'names', 'named',
  // Services
  'helps', 'helped', 'help',
  'enables', 'enabled', 'enable',
  'powers', 'powered', 'power',
  'provides', 'provided', 'provide',
  'offers', 'offered', 'offer',
  'serves', 'served', 'serve',
  'targets', 'targeted', 'target',
  'supports', 'supported', 'support',
  'uses', 'used', 'use',
  'works', 'worked', 'work',
  'improves', 'improved', 'improve',
  'transforms', 'transformed', 'transform',
  'disrupts', 'disrupted', 'disrupt',
  'solves', 'solved', 'solve',
  'addresses', 'addressed', 'address',
  'tackles', 'tackled', 'tackle',
  'sets', 'set',
  // Partnerships
  'partners', 'partnered', 'partner',
  'collaborates', 'collaborated', 'collaborate',
  'signs', 'signed', 'sign',
  // Market
  'lists', 'listed', 'list',
  'files', 'filed', 'file',
  'plans', 'planned', 'plan',
  'prepares', 'prepared', 'prepare',
  // Finance
  'backs', 'backed', 'back',
  'funds', 'funded', 'fund',
  'invests', 'invested', 'invest',
  'leads', 'led', 'lead',
  // General
  'includes', 'included', 'include',
  'adds', 'added', 'add',
  'grows', 'grew', 'grow',
  'scales', 'scaled', 'scale',
  'raises', 'raised',
  'spins', 'spun', 'spin',
]);

// Determiners — signal a COMMON noun follows, not a proper name
const DET_SET = new Set([
  'the', 'a', 'an', 'this', 'these', 'those', 'each', 'every',
  'some', 'any', 'all', 'both', 'few', 'many', 'much', 'several', 'no',
]);

// Possessive determiners — after a proper noun, confirm it's an entity
const POSS_DET_SET = new Set([
  'their', 'its', 'our', 'your', 'my', 'his', 'her',
]);

// Coordinating conjunctions
const CONJ_CO_SET = new Set(['and', 'but', 'or', 'nor', 'yet', 'so', 'for']);

// Subordinating conjunctions — signal a new clause where a name may be subject
const CONJ_SUB_SET = new Set([
  'when', 'while', 'although', 'though', 'because', 'since', 'unless',
  'until', 'after', 'before', 'if', 'once', 'whether', 'whereas',
]);

// Relative pronouns (NOT 'that' — handled contextually)
const REL_SET = new Set(['which', 'who', 'whom', 'where']);

// Prepositions
const PREP_SET = new Set([
  'from', 'by', 'via', 'at', 'with', 'in', 'for', 'of', 'to', 'on',
  'about', 'into', 'through', 'within', 'behind', 'between', 'among',
  'against', 'along', 'around', 'across', 'over', 'under', 'above',
  'below', 'near', 'off', 'out', 'up', 'upon', 'onto',
]);

// Enumeration triggers — directly precede a name as a member of a group
const ENUM_SET = new Set([
  'like', 'including', 'notably', 'especially', 'particularly', 'namely',
  'specifically',
]);

// Common nouns — these cannot be startup names
const COMMON_NOUN_SET = new Set([
  'startup', 'company', 'firm', 'platform', 'app', 'tool', 'product',
  'service', 'software', 'system', 'solution', 'technology', 'tech',
  'business', 'enterprise', 'venture', 'fund', 'investment',
  'funding', 'round', 'deal', 'acquisition', 'merger', 'ipo',
  'market', 'industry', 'sector', 'space', 'segment',
  'team', 'group', 'cohort', 'network', 'community', 'ecosystem',
  'data', 'model', 'algorithm', 'infrastructure', 'api', 'interface',
  'developer', 'engineer', 'founder', 'investor', 'partner',
  'customer', 'user', 'client', 'employee', 'executive',
  'report', 'study', 'survey', 'analysis', 'announcement', 'news',
  'unicorn', 'decacorn', 'scaleup', 'portfolio',
  'series', 'seed', 'stage', 'growth', 'scale',
]);

// Adverbs (morphological -ly check is the primary method, but common ones listed)
const ADVERB_SET = new Set([
  'recently', 'quickly', 'successfully', 'quietly', 'rapidly',
  'currently', 'already', 'now', 'just', 'still', 'also', 'even',
  'only', 'very', 'too', 'soon', 'later', 'finally', 'again',
  'often', 'never', 'always', 'sometimes', 'previously',
  'officially', 'publicly', 'formally', 'globally', 'reportedly',
  'significantly', 'largely', 'primarily', 'mainly', 'initially',
  'effectively', 'eventually', 'immediately', 'today', 'yesterday',
]);

// Common adjective morphological suffixes
const ADJ_SUFFIX_RE = /(?:ive|ical|ous|ful|less|able|ible|ent|ant|ary|ory|ish|like|ward)$/;

// Common noun morphological suffixes
const COMMON_NOUN_SUFFIX_RE = /(?:tion|sion|ment|ness|ity|ance|ence|ship|hood|ism|ist|ics|ogy|ery|age|ure)$/;

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — TOKENIZER
// Splits text into whitespace-separated tokens. Punctuation stays attached
// and is stripped during classification via the `stripped` field.
// ═══════════════════════════════════════════════════════════════════════════

function tokenize(text) {
  const normalized = text
    .replace(/[\u2018\u2019]/g, "'")   // smart quotes → straight
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, ' — ') // em/en dash → spaced dash
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.split(/\s+/).map((raw, idx) => ({ raw, idx }));
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — CLASSIFIER
// Every token is assigned a grammatical role (T.*).
// Order of checks encodes priority: definite rules before heuristics.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Quick type lookup for context checks (no allTokens array needed).
 * @param {string} raw
 * @returns {string} — one of T.*
 */
function quickType(raw) {
  const s = raw.replace(/^['"]|[.,;:!?"']+$/g, '').trim();
  const lower = s.toLowerCase();
  if (DET_SET.has(lower)) return T.DET;
  if (POSS_DET_SET.has(lower)) return T.POSS_DET;
  if (COMMON_NOUN_SET.has(lower)) return T.COMMON;
  if (CONJ_CO_SET.has(lower)) return T.CONJ_CO;
  if (CONJ_SUB_SET.has(lower)) return T.CONJ_SUB;
  if (PREP_SET.has(lower)) return T.PREP;
  if (COPULA_SET.has(lower)) return T.COPULA;
  if (VERB_SET.has(lower)) return T.VERB;
  if (REPORT_SET.has(lower)) return T.REPORT;
  if (/^[A-Z]/.test(s)) return T.PROPER;
  return T.UNKNOWN;
}

/**
 * Classify a single token with full context.
 * @param {{ raw: string }} token
 * @param {{ raw: string }[]} all  — full token array for look-around
 * @param {number} i
 * @returns {object} — tagged token
 */
function classifyToken(token, all, i) {
  const raw = token.raw;
  // Strip leading/trailing punctuation to get the "word core"
  const stripped = raw.replace(/^['""([\-–—]+|['"")\],;:.!?–—\-]+$/g, '').trim();
  const lower = stripped.toLowerCase();

  const tag = (type) => ({ raw, stripped, lower, type });

  // 1. Pure punctuation
  if (!stripped || /^[.,;:!?()\[\]{}"'—–\-]+$/.test(raw)) return tag(T.PUNCT);

  // 2. Currency / number
  if (/^[$€£¥₹][\d.,]+[BMKbmk]?$/.test(raw) || /^\d[\d.,]+[BMKbmk%]?$/.test(raw)) {
    return tag(T.NUM);
  }

  // 3. Geographic possessive: "Dubai's", "Singapore's", "UK's"
  if (/^[A-Z][a-zA-Z]+'s$/.test(raw)) return tag(T.GEO_POSS);

  // 4. Definite lexicon checks (high confidence, order matters)
  if (DET_SET.has(lower)) return tag(T.DET);
  if (POSS_DET_SET.has(lower)) return tag(T.POSS_DET);
  if (COPULA_SET.has(lower)) return tag(T.COPULA);
  if (REPORT_SET.has(lower)) return tag(T.REPORT);
  if (VERB_SET.has(lower)) return tag(T.VERB);
  if (CONJ_CO_SET.has(lower)) return tag(T.CONJ_CO);
  if (CONJ_SUB_SET.has(lower)) return tag(T.CONJ_SUB);

  // 5. Relative pronouns — contextual disambiguation for "that"
  if (lower === 'that') {
    const prevType = i > 0 ? quickType(all[i - 1].raw) : T.UNKNOWN;
    // "that" after a noun/proper → relative pronoun; otherwise determiner
    if (prevType === T.PROPER || prevType === T.COMMON || prevType === T.NUM) {
      return tag(T.REL);
    }
    return tag(T.DET);
  }
  if (REL_SET.has(lower)) return tag(T.REL);

  // 6. Enumeration triggers
  if (ENUM_SET.has(lower)) return tag(T.ENUM);

  // 7. Prepositions
  if (PREP_SET.has(lower)) return tag(T.PREP);

  // 8. Common nouns (lexicon — applied to any case)
  if (COMMON_NOUN_SET.has(lower)) return tag(T.COMMON);

  // 9. Proper noun — Title-Case takes priority over morphological rules.
  //    A word starting with uppercase is almost always a proper noun unless
  //    it was already caught by a definite lexicon above.
  if (/^[A-Z]/.test(stripped) && stripped.length >= 2) {
    // Exception: 2-letter ALL-CAPS abbreviations used as descriptors (AI, ML, AR)
    // are only PROPER if they are standalone (not followed by a common noun)
    if (/^[A-Z]{2,3}$/.test(stripped)) {
      const nextRaw = all[i + 1] ? all[i + 1].raw.replace(/[.,;:!?'"]+$/g, '').trim().toLowerCase() : '';
      if (COMMON_NOUN_SET.has(nextRaw) || VERB_SET.has(nextRaw) || ADVERB_SET.has(nextRaw)) {
        return tag(T.ADJ); // "AI training", "AI startup" → AI is a descriptor
      }
    }
    return tag(T.PROPER);
  }

  // 10. Adverbs (lexicon + morphological -ly) — lowercase only
  if (ADVERB_SET.has(lower) || (/ly$/.test(lower) && lower.length > 4)) return tag(T.ADV);

  // 11. Adjectives (morphological suffixes) — lowercase only
  if (ADJ_SUFFIX_RE.test(lower) && lower.length > 5) return tag(T.ADJ);

  // 12. Common nouns (morphological suffixes) — lowercase only
  if (COMMON_NOUN_SUFFIX_RE.test(lower) && lower.length > 5) return tag(T.COMMON);

  // 13. Morphological verb detection (gerunds / participials) — lowercase only
  //     e.g., "scaling", "launching" — but only when not preceded by DET/PREP
  if (/(?:ing|ized|ised|ified|ened)$/.test(lower) && lower.length > 5) {
    const prevLower = i > 0 ? all[i - 1].raw.replace(/[.,;:!?'"]+$/g, '').trim().toLowerCase() : '';
    if (!DET_SET.has(prevLower) && !PREP_SET.has(prevLower)) return tag(T.VERB);
  }

  return tag(T.UNKNOWN);
}

/**
 * Classify all tokens in a sequence.
 */
function classifyTokens(rawTokens) {
  return rawTokens.map((tok, i) => classifyToken(tok, rawTokens, i));
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3 — PROPER NOUN MERGER
// Consecutive PROPER tokens collapse into a single multi-word name.
// "Stripe Atlas" → one PROPER, not two.
// Hard cap: 4 words max (prevents runaway merges).
// ═══════════════════════════════════════════════════════════════════════════

function mergeProperNouns(tagged) {
  const out = [];
  let i = 0;
  while (i < tagged.length) {
    if (tagged[i].type !== T.PROPER) {
      out.push({ ...tagged[i], wordCount: 1 });
      i++;
      continue;
    }
    // Collect a run of consecutive PROPER tokens
    const parts = [tagged[i].stripped];
    let j = i + 1;
    while (j < tagged.length && tagged[j].type === T.PROPER && j - i < 4) {
      parts.push(tagged[j].stripped);
      j++;
    }
    const merged = parts.join(' ');
    out.push({
      ...tagged[i],
      raw: merged,
      stripped: merged,
      lower: merged.toLowerCase(),
      type: T.PROPER,
      wordCount: parts.length,
    });
    i = j;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4 — STRUCTURAL NAME EXTRACTOR
// Scans the tagged + merged sequence and finds PROPER tokens that occupy
// valid grammatical positions (subject, object, prepositional complement, etc.)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate and add a candidate name to the result set.
 */
function addIfValid(tok, out) {
  if (!tok || tok.type !== T.PROPER) return;
  const name = tok.stripped.replace(/[,;:.!?'"—–]+$/g, '').trim();
  if (!name || name.length < 2) return;
  // Strip trailing generic suffix ("Stripe Startup" → "Stripe")
  const clean = name.replace(/\s+(startup|company|platform|app|tool|inc|llc|ltd|corp)$/i, '').trim();
  if (!clean || clean.length < 2) return;
  // Reject short all-caps abbreviations used as sector/tech descriptors (AI, ML, AR, VR…)
  // Real startup names that happen to be abbreviations are caught by the full pipeline.
  if (/^[A-Z]{2,3}$/.test(clean)) return;
  const check = isValidStartupName(clean);
  if (check.isValid) out.add(clean);
}

/**
 * Safe type-at accessor — returns T.UNKNOWN for out-of-bounds.
 */
function typeAt(tagged, i) {
  return tagged[i] ? tagged[i].type : T.UNKNOWN;
}

/**
 * Token after a PROPER token — accounts for multi-word merges.
 */
function tokenAfterProper(tagged, i) {
  return tagged[i + (tagged[i].wordCount || 1)] || null;
}

function extractNamesFromTagged(tagged) {
  const found = new Set();

  for (let i = 0; i < tagged.length; i++) {
    const tok = tagged[i];
    const next = tagged[i + 1] || null;
    const afterProper = tok.type === T.PROPER ? tokenAfterProper(tagged, i) : null;

    // ── P1: SUBJECT — PROPER → VERB ────────────────────────────────────────
    // "Stripe raises $50M"  |  "Notion launches"
    if (tok.type === T.PROPER) {
      let j = i + (tok.wordCount || 1);
      while (j < tagged.length && tagged[j].type === T.ADV) j++; // skip adverbs
      if (tagged[j] && (tagged[j].type === T.VERB || tagged[j].type === T.COPULA)) {
        addIfValid(tok, found);
      }
    }

    // ── P2: OBJECT — VERB → PROPER ─────────────────────────────────────────
    // "backs Cohere at $X"  |  "acquired Figma for $20B"
    // Guard: PROPER must NOT be immediately followed by COMMON/PROPER (descriptor phrase)
    // "helps AI developers" → AI is a descriptor, not a name
    if (tok.type === T.VERB && next && next.type === T.PROPER) {
      const afterObj = tokenAfterProper(tagged, i + 1);
      const isDescriptorPhrase = afterObj && (afterObj.type === T.COMMON || afterObj.type === T.PROPER);
      if (!isDescriptorPhrase) addIfValid(next, found);
    }

    // ── P3: PREP-COMPLEMENT — PREP → PROPER ────────────────────────────────
    // "from Stripe"  |  "by Cohere"  |  "at Anthropic"
    if (tok.type === T.PREP && next && next.type === T.PROPER) {
      addIfValid(next, found);
    }

    // ── P4: ENUMERATION — ENUM → PROPER ────────────────────────────────────
    // "like Cleanlab"  |  "including Cohere and Weights"
    if (tok.type === T.ENUM && next && next.type === T.PROPER) {
      addIfValid(next, found);
    }

    // ── P5: GEO-POSSESSIVE — GEO_POSS → PROPER ─────────────────────────────
    // "Dubai's Tabby"  |  "Singapore's Grab"
    if (tok.type === T.GEO_POSS && next && next.type === T.PROPER) {
      addIfValid(next, found);
    }

    // ── P6: RELATIVE-SUBJECT — REL → PROPER → VERB ─────────────────────────
    // "that Cased helps developers set"  |  "which Notion powers"
    if (tok.type === T.REL && next && next.type === T.PROPER) {
      const ap = tokenAfterProper(tagged, i + 1);
      if (ap && (ap.type === T.VERB || ap.type === T.ADV || ap.type === T.COPULA)) {
        addIfValid(next, found);
      }
    }

    // ── P7: CONJ ENUMERATION — CONJ_CO → PROPER → (REL|VERB|POSS_DET) ──────
    // "and Weights that offers…"  |  "but Anyscale is"
    if (tok.type === T.CONJ_CO && next && next.type === T.PROPER) {
      const ap = tokenAfterProper(tagged, i + 1);
      if (ap && [T.REL, T.VERB, T.COPULA, T.POSS_DET].includes(ap.type)) {
        addIfValid(next, found);
      }
    }

    // ── P8: REPORT-COMPLEMENT — REPORT → PROPER → COPULA ───────────────────
    // "believe Anyscale is the best"  |  "says Stripe has"
    if (tok.type === T.REPORT && next && next.type === T.PROPER) {
      const ap = tokenAfterProper(tagged, i + 1);
      if (ap && ap.type === T.COPULA) {
        addIfValid(next, found);
      }
    }

    // ── P9: SUBORDINATE-SUBJECT — CONJ_SUB → PROPER → VERB ─────────────────
    // "when Notion improves their UI"  |  "while Stripe scales"
    if (tok.type === T.CONJ_SUB && next && next.type === T.PROPER) {
      const ap = tokenAfterProper(tagged, i + 1);
      if (ap && (ap.type === T.VERB || ap.type === T.ADV || ap.type === T.COPULA)) {
        addIfValid(next, found);
      }
    }

    // ── P10: POSSESSIVE CONFIRMATION — PROPER ⟶ (≤3 tokens) → POSS_DET ────
    // "Notion improves their UI" — "their" is 2 tokens after "Notion"
    // Catches cases where a verb sits between the name and its pronoun.
    if (tok.type === T.PROPER) {
      const start = i + (tok.wordCount || 1);
      const end = Math.min(start + 3, tagged.length);
      for (let j = start; j < end; j++) {
        if (!tagged[j]) break;
        if (tagged[j].type === T.POSS_DET) { addIfValid(tok, found); break; }
        if (tagged[j].type === T.PROPER) break; // another name — stop looking
      }
    }
  }

  return [...found];
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full pipeline: text → names.
 * @param {string} text
 * @returns {string[]} — deduplicated valid startup names found in text
 */
function extractNames(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 5) return [];
  const raw = tokenize(text);
  const tagged = classifyTokens(raw);
  const merged = mergeProperNouns(tagged);
  return extractNamesFromTagged(merged);
}

/**
 * Convenience: return the first extracted name, or null.
 * @param {string} text
 * @returns {string|null}
 */
function extractName(text) {
  const names = extractNames(text);
  return names.length > 0 ? names[0] : null;
}

/**
 * Debug helper: returns full token analysis + extracted names.
 * Use to inspect how a sentence is being parsed.
 *
 * @param {string} text
 * @returns {{ tokens: object[], names: string[] }}
 */
function debug(text) {
  const raw = tokenize(text);
  const tagged = classifyTokens(raw);
  const merged = mergeProperNouns(tagged);
  return {
    tokens: merged.map(t => `[${t.type.padEnd(8)}] ${t.stripped}`),
    names: extractNamesFromTagged(merged),
  };
}

module.exports = { extractNames, extractName, debug, T };
