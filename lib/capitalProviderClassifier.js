'use strict';

/**
 * Classify capital-provider type from firm name + optional evidence phrase.
 * Aligns with docs/FUNDING_SOURCE_ONTOLOGY.md provider_type enum.
 *
 * Family offices are rising in equity rounds; detect them explicitly so they
 * are not dumped into the generic VC bucket.
 */

const PROVIDER_TYPES = Object.freeze([
  'vc',
  'cvc',
  'angel',
  'angel_group',
  'family_office',
  'accelerator',
  'government_grant',
  'strategic',
  'venture_debt',
  'crowdfunding',
  'pe',
  'sovereign',
  'unknown',
]);

const FO_NAME_RE =
  /\b(?:family\s+offices?|single[- ]family(?:\s+office)?|multi[- ]family(?:\s+office)?|family\s+investment\s+office|family\s+office\s+(?:capital|investments?|partners?))\b/i;

const FO_PHRASE_RE =
  /\b(?:family\s+offices?|single[- ]family|multi[- ]family|family[- ]backed|family[- ]owned\s+(?:office|capital)|UHNW|ultra[- ]high[- ]net[- ]worth)\b/i;

/** Soft FO cues in firm branding (lower confidence without "family office" literal). */
const FO_SOFT_NAME_RE =
  /\b(?:family\s+capital|family\s+holdings|family\s+investments?|office\s+of\s+the\s+\w+\s+family)\b/i;

const VC_SUFFIX_RE =
  /\b(?:ventures?|venture\s+partners?|capital|partners?|fund|funds|equity|growth)\b/i;

const PE_RE =
  /\b(?:private\s+equity|buyout|growth\s+equity|lbo)\b/i;

const CVC_RE =
  /\b(?:corporate\s+venture|corp\s+ventures?|strategic\s+venture|ventures?\s+arm)\b/i;

const ACCEL_RE =
  /\b(?:accelerator|incubator|studio|y\s*combinator|\byc\b|techstars|500\s*global|antler)\b/i;

const DEBT_RE =
  /\b(?:venture\s+debt|growth\s+credit|debt\s+facility|term\s+loan)\b/i;

const ANGEL_GROUP_RE =
  /\b(?:angel\s+(?:group|network|syndicate)|syndicate|angels)\b/i;

const SOVEREIGN_RE =
  /\b(?:sovereign|wealth\s+fund|state\s+investment|public\s+investment\s+fund|\bgic\b|temasek|mubadala|adia|khazanah|\bpif\b)\b/i;

const STRATEGIC_PHRASE_RE =
  /\b(?:strategic\s+investment|strategic\s+investor|corporate\s+investor)\b/i;

const BANK_WEALTH_RE =
  /\b(?:wealth\s+management|private\s+bank|private\s+wealth)\b/i;

/** Second/last tokens that mark a firm or institution, not a person. */
const FIRM_OR_ORG_TOKENS = new Set([
  'club', 'management', 'technology', 'technologies', 'holdings', 'holding',
  'investments', 'investment', 'financial', 'finance', 'capital', 'ventures',
  'venture', 'partners', 'partner', 'fund', 'funds', 'group', 'corp', 'inc',
  'llc', 'ltd', 'gmbh', 'university', 'college', 'commissioners', 'commission',
  'ireland', 'finland', 'warehouse', 'network', 'amperex', 'brines', 'wastewater',
  'fare', 'industries', 'industry', 'controls', 'center', 'centre', 'beverage',
  'asset', 'assets', 'bank', 'systems', 'solutions', 'labs', 'lab', 'studio',
  'studios', 'media', 'digital', 'global', 'international', 'national', 'state',
  'county', 'city', 'ministry', 'agency', 'authority', 'foundation', 'institute',
  'soon', // Lam Soon
  'play', // Plug and Play debris fragments
]);

/**
 * Heuristic: two Title-Case tokens without firm suffix → likely person/angel.
 * @param {string} name
 */
function looksLikePersonName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length < 2 || parts.length > 3) return false;
  if (VC_SUFFIX_RE.test(name) || FO_NAME_RE.test(name) || /\b(?:llc|llp|inc|ltd|gmbh|corp)\b/i.test(name)) {
    return false;
  }
  // "Scenic Management", "Karaoke Club", "Enterprise Ireland" — Title Case but not people
  if (parts.some((p) => FIRM_OR_ORG_TOKENS.has(p.toLowerCase().replace(/[^a-z]/g, '')))) {
    return false;
  }
  return parts.every((p) => /^[A-Z][a-z'’-]+$/.test(p) || /^[A-Z]\.$/.test(p));
}

/**
 * @param {string} name
 * @param {string} [evidencePhrase]
 * @returns {{ provider_type: string, confidence: number, reasons: string[], suggested_investor_type: string }}
 */
function classifyCapitalProvider(name, evidencePhrase = '') {
  const n = String(name || '').trim();
  const phrase = String(evidencePhrase || '').trim();
  const blob = `${n} ${phrase}`;
  const reasons = [];

  if (!n) {
    return {
      provider_type: 'unknown',
      confidence: 0,
      reasons: ['empty_name'],
      suggested_investor_type: 'Unknown',
    };
  }

  // Name itself is / contains "Family Office" (or single/multi-family office).
  if (FO_NAME_RE.test(n) || FO_SOFT_NAME_RE.test(n)) {
    reasons.push(FO_NAME_RE.test(n) ? 'family_office_literal' : 'family_office_soft_branding');
    return {
      provider_type: 'family_office',
      confidence: FO_NAME_RE.test(n) ? 0.95 : 0.7,
      reasons,
      suggested_investor_type: 'Family Office',
    };
  }

  // Phrase attributes FO to THIS name only — not co-investors in the same sentence.
  // e.g. "Spectrum Impact, a multi-family office" / "led by Acme Family Office"
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const attributedFo = new RegExp(
    `(?:^|\\b)${escaped}\\s*[,\\-–—:]?\\s*(?:(?:is|are)\\s+)?(?:a\\s+|an\\s+)?(?:multi[- ]|single[- ]|prominent\\s+)?family\\s+offices?\\b`,
    'i',
  );
  const nameIsFoInPhrase = new RegExp(
    `\\b${escaped}\\s+family\\s+offices?\\b|\\bfamily\\s+office\\s+${escaped}\\b`,
    'i',
  );
  if (phrase && (attributedFo.test(phrase) || nameIsFoInPhrase.test(phrase))) {
    reasons.push('family_office_attributed_in_phrase');
    return {
      provider_type: 'family_office',
      confidence: 0.85,
      reasons,
      suggested_investor_type: 'Family Office',
    };
  }

  if (SOVEREIGN_RE.test(n) || (SOVEREIGN_RE.test(phrase) && SOVEREIGN_RE.test(n))) {
    reasons.push('sovereign_wealth_language');
    return {
      provider_type: 'sovereign',
      confidence: 0.9,
      reasons,
      suggested_investor_type: 'Sovereign',
    };
  }

  // Oman wealth fund style — name itself carries wealth-fund language
  if (/\bwealth\s+fund\b/i.test(n)) {
    reasons.push('sovereign_wealth_language');
    return {
      provider_type: 'sovereign',
      confidence: 0.9,
      reasons,
      suggested_investor_type: 'Sovereign',
    };
  }

  if (PE_RE.test(n) || (PE_RE.test(phrase) && PE_RE.test(n))) {
    reasons.push('private_equity_language');
    return {
      provider_type: 'pe',
      confidence: 0.85,
      reasons,
      suggested_investor_type: 'PE',
    };
  }

  if (CVC_RE.test(blob) || (STRATEGIC_PHRASE_RE.test(phrase) && /\b(?:inc|corp|technologies|motors|systems)\b/i.test(n))) {
    reasons.push('corporate_venture_or_strategic');
    return {
      provider_type: 'cvc',
      confidence: 0.75,
      reasons,
      suggested_investor_type: 'CVC',
    };
  }

  if (STRATEGIC_PHRASE_RE.test(phrase) && !VC_SUFFIX_RE.test(n)) {
    reasons.push('strategic_investment_context');
    return {
      provider_type: 'strategic',
      confidence: 0.7,
      reasons,
      suggested_investor_type: 'Strategic',
    };
  }

  if (DEBT_RE.test(blob) || /\bsilicon\s+valley\s+bank\b/i.test(n)) {
    reasons.push('venture_debt_language');
    return {
      provider_type: 'venture_debt',
      confidence: 0.85,
      reasons,
      suggested_investor_type: 'Debt',
    };
  }

  if (ACCEL_RE.test(blob)) {
    reasons.push('accelerator_language');
    return {
      provider_type: 'accelerator',
      confidence: 0.9,
      reasons,
      suggested_investor_type: 'Accelerator',
    };
  }

  if (ANGEL_GROUP_RE.test(n) || ANGEL_GROUP_RE.test(phrase) && ANGEL_GROUP_RE.test(n)) {
    reasons.push('angel_group_language');
    return {
      provider_type: 'angel_group',
      confidence: 0.85,
      reasons,
      suggested_investor_type: 'Angel Group',
    };
  }

  if (BANK_WEALTH_RE.test(n)) {
    reasons.push('bank_wealth_desk');
    return {
      provider_type: 'family_office',
      confidence: 0.55,
      reasons,
      suggested_investor_type: 'Family Office',
    };
  }

  if (looksLikePersonName(n)) {
    reasons.push('person_name_shape');
    return {
      provider_type: 'angel',
      confidence: 0.65,
      reasons,
      suggested_investor_type: 'Angel',
    };
  }

  if (VC_SUFFIX_RE.test(n)) {
    reasons.push('vc_firm_suffix');
    return {
      provider_type: 'vc',
      confidence: 0.85,
      reasons,
      suggested_investor_type: 'VC',
    };
  }

  // Bare brand with lead/participant role context — likely institutional VC without suffix.
  if (/\b(?:led by|co-led|participat(?:ed|ion)\s+from)\b/i.test(phrase) && n.split(/\s+/).length <= 3) {
    reasons.push('round_participant_brand');
    return {
      provider_type: 'vc',
      confidence: 0.45,
      reasons,
      suggested_investor_type: 'VC',
    };
  }

  reasons.push('unresolved');
  return {
    provider_type: 'unknown',
    confidence: 0.2,
    reasons,
    suggested_investor_type: 'Unknown',
  };
}

/**
 * Map ontology provider_type → investors.type column values used in the DB.
 * @param {string} providerType
 */
function providerTypeToInvestorType(providerType) {
  const map = {
    vc: 'VC',
    cvc: 'CVC',
    angel: 'Angel',
    angel_group: 'Angel',
    family_office: 'Family Office',
    accelerator: 'Accelerator',
    pe: 'PE',
    sovereign: 'Sovereign',
    strategic: 'Strategic',
    venture_debt: 'Debt',
    government_grant: 'Grant',
    crowdfunding: 'Crowdfunding',
    unknown: 'Unknown',
  };
  return map[providerType] || 'Unknown';
}

module.exports = {
  PROVIDER_TYPES,
  classifyCapitalProvider,
  providerTypeToInvestorType,
  looksLikePersonName,
  FO_NAME_RE,
};
