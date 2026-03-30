/**
 * SHARED HEADLINE → COMPANY NAME EXTRACTOR
 * ========================================
 * Verb-centric: the verb anchors the sentence. We extract the SUBJECT or OBJECT
 * the verb acts on — the company name — not adjectives or descriptors.
 *
 * "Mexican edtech Mattilda raises $50M" → Mattilda (not "Mexican edtech Mattilda")
 * "Sequoia backs Halter at $2B" → Halter
 */

const { isValidStartupName } = require('./startupNameValidator');
const { extractCompanyNameVerbCentric } = require('./verbCentricExtractor');
const { extractNames: extractNamesFromSentence } = require('./sentenceExtractor');

const FUNDING_VERBS = [
  'raises', 'raised', 'closes', 'closed', 'secured', 'secures', 'bags', 'gets',
  'nabs', 'pulls in', 'receives', 'announces', 'completes', 'collects', 'snags',
  'scores', 'gains', 'earns', 'takes in', 'brings in', 'attracts', 'confirms',
  'finalizes', 'lands', 'wins', 'grabs', 'captures'
].join('|');

const LAUNCH_VERBS = [
  'launches', 'launched', 'unveils', 'announces', 'introduces', 'releases',
  'partners', 'acquires', 'acquired', 'buys', 'snaps up'
].join('|');

// Words that make colon-split results likely garbage
const COLON_REJECT_WORDS = new Set([
  'merge', 'merges', 'merged', 'announces', 'announced', 'launches', 'new',
  'big', 'top', 'why', 'how', 'what', 'when', 'market', 'markets', 'nasdaq',
  'report', 'update', 'news', 'challenger', 'global', 'major', 'european',
  'asian', 'enters', 'reveals', 'targets', 'joins', 'startup', 'first', 'next',
  'last', 'this', 'these', 'those', 'could', 'should', 'would', 'will', 'may',
  'might', 'must', 'breaking', 'exclusive', 'understanding', 'building', 'find'
]);

// Suffixes that indicate a descriptor fragment, not a company name (disassociation)
// Note: "ai" removed — many companies are "X AI" (e.g. Mandel AI)
const DESCRIPTOR_SUFFIXES = /\s+(?:startup|company|platform|provider|solution|service|hub|tech|inc|llc|ltd)$/i;

/**
 * Extract company name from headline text.
 * @param {string} text - Article title or headline
 * @returns {string|null} - Extracted company name or null
 */
function extractCompanyName(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 8) return null;

  const trimmed = text.trim();
  let candidate = null;

  // 0. Verb-centric extraction (primary) — verb is anchor, extract subject/object
  candidate = extractCompanyNameVerbCentric(trimmed);

  // Fallback to legacy patterns if verb-centric returns null
  if (!candidate) {
  // 1. Law firm: "X Advises Y On $ZM" / "Wilson Sonsini Advises Edra" → Y
  const adviseMatch = trimmed.match(/\bAdvises\s+([A-Z][A-Za-z0-9\s&.'-]{2,40}?)(?:\s+On\s|\s*$|\s+[A-Z])/i);
  if (adviseMatch) {
    candidate = adviseMatch[1].trim();
    // Trim trailing "On" if captured
    candidate = candidate.replace(/\s+On\s*$/i, '').trim();
  }

  // 2. Funding: "Company raises $X" / "Company secures Series A"
  if (!candidate) {
    const fundingMatch = trimmed.match(
      new RegExp(`^([^:]+?)\\s+(?:${FUNDING_VERBS})\\s+(?:\\$|€|£|(?:(?:a|an|the)\\s+)?(?:seed|series))`, 'i')
    );
    if (fundingMatch) {
      candidate = fundingMatch[1].trim();
    }
  }

  // 3. "Partners with X" — extract X (the partner company)
  if (!candidate) {
    const partnersMatch = trimmed.match(/(?:partners?\s+with|partnering\s+with)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+)?)/i);
    if (partnersMatch) candidate = partnersMatch[1].trim();
  }

  // 4. Launch/acquire: "Company launches" / "Company acquires"
  if (!candidate) {
    const launchMatch = trimmed.match(
      new RegExp(`^([A-Z][A-Za-z0-9\\s&.'-]{2,50}?)\\s+(?:${LAUNCH_VERBS})\\s+`, 'i')
    );
    if (launchMatch) {
      candidate = launchMatch[1].trim();
    }
  }

  // 5. "Company Closes Series A" (no $)
  if (!candidate) {
    const seriesMatch = trimmed.match(
      /^([A-Z][A-Za-z0-9\s&.'-]+?)\s+(?:closes|raises|secures|completes|announces)\s+(?:a|an|the)\s+(?:seed|series\s+[a-z]|round)/i
    );
    if (seriesMatch) {
      candidate = seriesMatch[1].trim();
    }
  }

  // 6. Colon-split: "Company: Raises $X" (with validation)
  if (!candidate) {
    const colonMatch = trimmed.match(/^([^:]+?):/i);
    if (colonMatch) {
      let name = colonMatch[1].trim();
      name = name.replace(/^(the|a|an)\s+/i, '').trim();
      const words = name.split(/\s+/);
      const rejectCount = words.filter(w => COLON_REJECT_WORDS.has(w.toLowerCase())).length;
      if (name.length > 3 && name.length < 60 && words.length <= 5 && rejectCount < 2) {
        candidate = name;
      }
    }
  }

  // 7. "Startup Company" / "Company, a fintech startup"
  if (!candidate) {
    const startupMatch = trimmed.match(/(?:startup|company)\s+([A-Z][A-Za-z0-9\s&.'-]{2,40}?)\s+(?:raises?|secures?|launches?)/i);
    if (startupMatch) candidate = startupMatch[1].trim();
  }

  // 8. "Backs X at $Y" / "Backed X" — investor backs company
  if (!candidate) {
    const backsMatch = trimmed.match(/\b(?:backs?|backed|funds?|funded)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})\s+(?:at\s+\$|startup|raises)/i);
    if (backsMatch) candidate = backsMatch[1].trim();
  }

  // 9. "to sell X for $Y" / "company CoolIT for $4.75b"
  if (!candidate) {
    const sellMatch = trimmed.match(/(?:sell|acquire|buy)\s+(?:[^,]+,?\s+)*(?:company\s+)?([A-Z][A-Za-z0-9]+)\s+for\s+\$/i);
    if (sellMatch) candidate = sellMatch[1].trim();
  }
  if (!candidate) {
    const companyForMatch = trimmed.match(/(?:company|startup)\s+([A-Z][A-Za-z0-9]+)\s+for\s+\$/i);
    if (companyForMatch) candidate = companyForMatch[1].trim();
  }

  // 10. "X for $YM" — company name immediately before dollar amount
  if (!candidate) {
    const forMatch = trimmed.match(/\b([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})\s+for\s+\$[\d.]+\s*[BMKbmk]/i);
    if (forMatch) candidate = forMatch[1].trim();
  }
  }  // end fallback

  if (!candidate || candidate.length < 2) return null;

  // Normalize FIRST — strip location/category/descriptor prefixes before any rejection
  // (disassociation must run on the cleaned name, not the raw captured string)
  candidate = candidate
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    // Location-based: "NYC-based", "Mumbai-based", "London-based", "US-based"
    .replace(/^[A-Za-z][A-Za-z.\s]{0,30}?[- ]based\s+/i, '')
    // Nationality adjective: "Norwegian", "Finnish", "Indian", …
    .replace(/^(?:norwegian|swedish|finnish|danish|dutch|belgian|swiss|austrian|polish|czech|hungarian|romanian|bulgarian|greek|portuguese|spanish|italian|french|german|british|irish|american|canadian|australian|singaporean|indian|chinese|japanese|korean|taiwanese|thai|vietnamese|indonesian|malaysian|philippine|israeli|turkish|nigerian|kenyan|ghanaian|egyptian|moroccan|emirati|saudi|brazilian|argentinian|chilean|colombian|peruvian|mexican|latvian|lithuanian|estonian|ukrainian|russian|georgian)\s+/i, '')
    // Category + startup type: "Proptech startup", "Analog chipmaker", "AI ML startup"
    .replace(/^(?:[A-Za-z][A-Za-z0-9\-/]+\s+){0,3}(?:startup|company|firm|platform|chipmaker|provider|maker|developer|builder|unicorn|venture)\s+/i, '')
    .trim();

  if (candidate.length < 2) return null;

  // Disassociation: reject descriptor fragments on the NORMALIZED candidate
  // (e.g. "AI Cow Collar Startup" → after stripping still contains "startup" → reject)
  if (DESCRIPTOR_SUFFIXES.test(candidate)) return null;
  if (/\b(startup|company|collar)\b/i.test(candidate)) return null;

  // Gate: must pass shared validator
  const check = isValidStartupName(candidate);
  if (!check.isValid) return null;

  return candidate;
}

/**
 * Extract all startup names from a natural language sentence.
 * Delegates to sentenceExtractor for multi-name support.
 *
 * Use this for article descriptions and full-sentence snippets where
 * multiple companies may be mentioned.
 *
 * @param {string} text
 * @returns {string[]}
 */
function extractCompanyNames(text) {
  // Try headline mode first for single-name short inputs
  if (text && text.length < 120) {
    const headline = extractCompanyName(text);
    if (headline) return [headline];
  }
  // Fall back to sentence-mode multi-name extractor
  return extractNamesFromSentence(text);
}

module.exports = { extractCompanyName, extractCompanyNames };
