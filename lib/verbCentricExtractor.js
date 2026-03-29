/**
 * VERB-CENTRIC HEADLINE EXTRACTION
 * ================================
 * Word strings are layers of logic. Ontological parsing requires understanding
 * the INTENT of words; otherwise we are blind to them.
 *
 * English ontology:
 *   [1] NOUN      = object (or one of the objects) — the entity we want
 *   [2] ADJECTIVE = descriptor — strip these to reach the noun
 *   [3] ADVERB    = helper — modifies the verb, not the entity
 *   [4] VERB      = action — the anchor; find this first, then subject/object
 *   [5] Other     = support words (prepositions, conjunctions, etc.)
 *
 * "I went to the store to find milk but decided to buy Coca Cola instead"
 *   Actor: I | Verbs: went, decided, buy | Objects: store, milk, Coca Cola
 *
 * We extract the NOUN (company) the verb acts on — subject or object.
 * We strip ADJECTIVES (Mexican edtech, YC-backed) to reach the proper noun.
 */

const { isValidStartupName } = require('./startupNameValidator');

// ─── VERBS: actions that anchor the sentence ───────────────────────────────
const SUBJECT_VERBS = [  // Company DOES this: "Company raises"
  'raises', 'raised', 'secures', 'secured', 'closes', 'closed', 'bags', 'gets',
  'nabs', 'receives', 'announces', 'completes', 'collects', 'snags', 'scores',
  'gains', 'earns', 'lands', 'wins', 'grabs', 'captures', 'launches', 'launched',
  'unveils', 'releases', 'partners', 'acquires', 'acquired', 'buys', 'moves'
].join('|');

const OBJECT_VERBS = [   // Investor DOES this TO company: "Investor backs Company"
  'backs', 'backed', 'funds', 'funded', 'invests', 'invested', 'bets', 'bet',
  'sells', 'sell', 'acquires', 'acquire', 'buys', 'buy', 'advises', 'advised'
].join('|');

// Descriptor words/phrases that can precede the company name (adjectives, sectors, types)
// When we see "Mexican edtech Mattilda", we strip the descriptor and keep "Mattilda"
const DESCRIPTOR_PREFIXES = [
  // Sector + type
  /^(?:mexican|spanish|us-backed|uk|european|indian|chinese|french|german)\s+(?:edtech|fintech|healthtech|proptech|insurtech|cleantech|legaltech|agritech|regtech|medtech|biotech)\s+/i,
  /^(?:yc\s+alum|yc-backed|y\s*combinator\s+backed)\s+/i,
  /^(?:bladder\s+cancer\s+innovator|healthcare\s+startup|ai\s+startup)\s+/i,
  /^(?:edtech|fintech|healthtech|proptech|insurtech|cleantech|legaltech|agritech|regtech|medtech|biotech|saas|ai)\s+(?:startup|company|platform)?\s*/i,
  /^(?:startup|company|platform)\s+/i,
  /^(?:data\s+center\s+)?(?:liquid\s+cooling\s+)?company\s+/i,
  /^ai\s+cow\s+collar\s+startup\s+/i,  // "AI Cow Collar Startup" → descriptor, company is elsewhere
  // Geographic + sector
  /^(?:norwegian|swedish|finnish|danish|estonian)\s+[\w\s]+\s+/i,
];

// Words that indicate a descriptor fragment, not a company (reject if whole candidate)
const DESCRIPTOR_ONLY = /\b(startup|company|platform|provider|solution|service|hub|tech|innovator|executive|payments|money|venture|share)\s*$/i;

/**
 * Strip descriptor prefix from a noun phrase.
 * "Mexican edtech Mattilda" → "Mattilda"
 * "Bladder cancer innovator Combat" → "Combat"
 * "YC-backed Mandel AI" → "Mandel AI"
 */
function stripDescriptorPrefix(phrase) {
  if (!phrase || typeof phrase !== 'string') return null;
  let s = phrase.trim();
  for (const re of DESCRIPTOR_PREFIXES) {
    s = s.replace(re, '').trim();
  }
  return s || null;
}

/**
 * Extract the proper noun (company) from a subject phrase.
 * The company is typically the LAST capitalized token(s) before the verb.
 * "Mexican edtech Mattilda" → Mattilda
 * "Spanish edtech BCAS" → BCAS
 */
function extractProperNounFromSubject(subjectPhrase) {
  if (!subjectPhrase || subjectPhrase.length < 2) return null;

  // Try stripping known descriptors first
  const stripped = stripDescriptorPrefix(subjectPhrase);
  if (stripped && stripped.length >= 2) return stripped;

  // Fallback: take the last 1-2 capitalized words (likely the proper noun)
  const tokens = subjectPhrase.trim().split(/\s+/);
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return tokens[0];

  // Find the rightmost capitalized token sequence (proper noun)
  let end = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^[A-Z][a-z0-9]*$/i.test(tokens[i]) || /^[A-Z]+$/i.test(tokens[i])) {
      end = i;
      break;
    }
  }
  const noun = tokens.slice(end).join(' ');
  if (noun.length >= 2 && !DESCRIPTOR_ONLY.test(noun)) return noun;

  return subjectPhrase.trim();
}

/**
 * Verb-centric extraction: find verb, then subject or object.
 * @param {string} text - Headline
 * @returns {string|null} - Company name or null
 */
function extractCompanyNameVerbCentric(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 10) return null;
  const t = text.trim();

  let candidate = null;

  // ─── PATTERN 1: Subject-Verb — "Company raises/secures/closes..."
  const svRe = new RegExp(
    `^(.+?)\\s+(?:${SUBJECT_VERBS})\\s+(?:\\$|€|£|\\d|(?:(?:a|an|the)\\s+)?(?:seed|series|funding|round))`,
    'i'
  );
  const svMatch = t.match(svRe);
  if (svMatch) {
    candidate = extractProperNounFromSubject(svMatch[1].trim());
  }

  // ─── PATTERN 2: "Descriptor Company raises" — e.g. "Mexican edtech Mattilda raises 50 million"
  if (!candidate) {
    const descRe = new RegExp(
      `^(.+?)\\s+(?:${SUBJECT_VERBS})\\s+(?:\\$?[\\d.]+\s*(?:million|M|billion|B)|\\d+)`,
      'i'
    );
    const descMatch = t.match(descRe);
    if (descMatch) {
      candidate = extractProperNounFromSubject(descMatch[1].trim());
    }
  }

  // ─── PATTERN 3: Verb-Object — "Investor backs Company" / "Advises Company On $X"
  if (!candidate) {
    const voRe = new RegExp(
      `\\b(?:${OBJECT_VERBS})\\s+([A-Z][A-Za-z0-9]+)(?:\\s+(?:at\\s+\\$|startup|raises|for\\s+\\$|on\\s+\\$))?`,
      'i'
    );
    const voMatch = t.match(voRe);
    if (voMatch) {
      const obj = voMatch[1].trim();
      if (obj.length >= 4 || !/^(ai|the|a|an|it)$/i.test(obj)) candidate = obj;
    }
  }

  // ─── PATTERN 4: "sell X for $Y" / "company X for $Y" — X is single token before "for $"
  if (!candidate) {
    const sellMatch = t.match(/(?:sell|acquire|buy)\s+(?:[\w\s]+\s+)?(?:company\s+)?([A-Z][A-Za-z0-9-]+)\s+for\s+\$/i);
    if (sellMatch) candidate = sellMatch[1].trim();
  }
  if (!candidate) {
    const companyForMatch = t.match(/(?:company|startup)\s+([A-Z][A-Za-z0-9-]+)\s+for\s+\$/i);
    if (companyForMatch) candidate = companyForMatch[1].trim();
  }

  // ─── PATTERN 5: Law firm "Advises X On $Y"
  if (!candidate) {
    const adviseMatch = t.match(/\bAdvises\s+([A-Z][A-Za-z0-9\s&.'-]{2,40}?)(?:\s+On\s|\s*$|\s+[A-Z])/i);
    if (adviseMatch) {
      candidate = extractProperNounFromSubject(adviseMatch[1].trim());
    }
  }

  // ─── PATTERN 6: "Partners with X"
  if (!candidate) {
    const partnersMatch = t.match(/(?:partners?\s+with|partnering\s+with)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)/i);
    if (partnersMatch) candidate = partnersMatch[1].trim();
  }

  // ─── PATTERN 7: "X, a [sector] startup" — company before comma
  if (!candidate) {
    const commaMatch = t.match(/^([A-Z][A-Za-z0-9\s&.'-]{2,40}?)\s*,\s*(?:a|an)\s+(?:fintech|edtech|healthtech|ai|saas|startup)/i);
    if (commaMatch) candidate = commaMatch[1].trim();
  }

  if (!candidate || candidate.length < 2) return null;

  // Disassociation: reject if it's just a descriptor
  if (DESCRIPTOR_ONLY.test(candidate)) return null;
  if (/\b(startup|company|collar|payments|venture|share)\b/i.test(candidate) && candidate.split(/\s+/).length <= 2) {
    if (!/^[A-Z][a-z]+$/i.test(candidate)) return null; // allow "Stripe" but reject "AI Startup"
  }

  // Normalize
  candidate = candidate
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim();

  if (candidate.length < 2) return null;

  const check = isValidStartupName(candidate);
  if (!check.isValid) return null;

  return candidate;
}

module.exports = {
  extractCompanyNameVerbCentric,
  stripDescriptorPrefix,
  extractProperNounFromSubject,
};
