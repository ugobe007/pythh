'use strict';

/**
 * Operator / successful-founder investors.
 *
 * Hot startups are often funded by operators who already built category winners
 * (Altman, Chesky, Dorsey, Zuckerberg, …). They invest personally, write public
 * thesis posts (blog / LinkedIn), and co-invest with friends. That network signal
 * is distinct from institutional VC firm profiles.
 *
 * Used by investor GOD scoring and early-stage match fit — not startup GOD.
 */

const { looksLikePersonName } = require('./partnerAngelInvestors');

/** Canonical labels for well-known operator angels (normalized lowercase). */
const OPERATOR_FOUNDER_ALIASES = Object.freeze([
  'sam altman',
  'brian chesky',
  'jack dorsey',
  'mark zuckerberg',
  'elad gil',
  'naval ravikant',
  'paul graham',
  'garry tan',
  'patrick collison',
  'john collison',
  'tobi lutke',
  'tobias lutke',
  'tobi lütke',
  'dylan field',
  'guillermo rauch',
  'emmett shear',
  'justin kan',
  'max levchin',
  'reid hoffman',
  'daniel gross',
  'jason calacanis',
  'keith rabois',
  'balaji srinivasan',
  'andrew chen',
  'lenny rachitsky',
  'packy mccormick',
  'sahil lavingia',
  'ankur nagpal',
  'pieter levels',
  'levelsio',
  'alexis ohanian',
  'jessica livingston',
  'michael seibel',
  'dalton caldwell',
  'jared friedman',
  'gustaf alstromer',
  'harj taggar',
  'aaron levie',
  'stewart butterfield',
  'drew houston',
  'arash ferdowsi',
  'ben silbermann',
  'evan spiegel',
  'bobby murphy',
  'kevin systrom',
  'mike krieger',
  'brian armstrong',
  'fred ehrsam',
  'chris dixon',
  'marc andreessen',
  'ben horowitz',
]);

const OPERATOR_TYPE_RE = /\boperator[_\s-]?angel\b|\bfounder[_\s-]?angel\b|\boperator\b/i;
const FOUNDER_EXIT_BIO_RE =
  /\b(?:founded|co-?founded|founder of|ex-(?:ceo|cto|coo)|former (?:ceo|cto)|sold|acquired|ipo|exit)\b/i;
const PUBLIC_THESIS_VOICE_RE =
  /\b(?:i invest|we invest|i look for|thesis|why i|writing (?:about|on)|announc(?:e|ing) (?:an )?invest)\b/i;

function normalizePersonLabel(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isKnownOperatorFounderName(name) {
  const n = normalizePersonLabel(name);
  if (!n) return false;
  if (OPERATOR_FOUNDER_ALIASES.includes(n)) return true;
  // Allow "Sam Altman (OpenAI)" style labels
  const withoutParen = n.replace(/\([^)]*\)/g, '').trim();
  return OPERATOR_FOUNDER_ALIASES.includes(withoutParen);
}

/**
 * Score how strongly an investor is an operator / successful-founder angel
 * with public thesis signal.
 *
 * @param {object} investor
 * @returns {{ isOperatorFounder: boolean, score: number, signals: string[], hasPublicThesis: boolean }}
 */
function scoreOperatorFounderInvestor(investor = {}) {
  const signals = [];
  let score = 0;

  const name = String(investor.name || '');
  const type = String(investor.type || investor.investor_type || '');
  const capitalType = String(investor.capital_type || '');
  const bio = String(investor.bio || '');
  const thesis = String(investor.investment_thesis || '');
  const themes = Array.isArray(investor.signals?.top_themes)
    ? investor.signals.top_themes
    : Array.isArray(investor.top_themes)
      ? investor.top_themes
      : [];

  if (isKnownOperatorFounderName(name)) {
    score += 8;
    signals.push('known_operator_founder');
  }

  if (OPERATOR_TYPE_RE.test(type) || OPERATOR_TYPE_RE.test(capitalType)) {
    score += 5;
    signals.push('operator_angel_type');
  }

  if (investor.is_individual === true && looksLikePersonName(name)) {
    score += 2;
    signals.push('individual_person');
  }

  if (FOUNDER_EXIT_BIO_RE.test(bio) || FOUNDER_EXIT_BIO_RE.test(thesis)) {
    score += 3;
    signals.push('founder_exit_language');
  }

  let hasPublicThesis = false;
  if (themes.length >= 3) {
    score += 4;
    hasPublicThesis = true;
    signals.push('rich_faith_themes');
  } else if (themes.length >= 1) {
    score += 2;
    hasPublicThesis = true;
    signals.push('faith_themes');
  }

  if (investor.blog_url || investor.linkedin_url) {
    score += 1;
    signals.push('public_writing_url');
  }

  if (PUBLIC_THESIS_VOICE_RE.test(thesis) || (thesis.length > 200 && themes.length > 0)) {
    score += 2;
    hasPublicThesis = true;
    signals.push('stated_public_thesis');
  }

  // Mega institutional firm rows are not operator angels.
  const firm = String(investor.firm || '');
  const nameNorm = normalizePersonLabel(name);
  const firmNorm = normalizePersonLabel(firm);
  if (firmNorm && nameNorm === firmNorm && !investor.is_individual) {
    score -= 6;
    signals.push('firm_org_row');
  }

  return {
    isOperatorFounder: score >= 6,
    score,
    signals,
    hasPublicThesis,
  };
}

function isOperatorFounderInvestor(investor) {
  return scoreOperatorFounderInvestor(investor).isOperatorFounder;
}

/**
 * Points to fold into investor GOD profile/focus/track buckets (already capped upstream).
 * Does not raise bucket ceilings — reallocates quality toward operators who write publicly.
 */
function operatorFounderGodBonus(investor) {
  const scored = scoreOperatorFounderInvestor(investor);
  if (!scored.isOperatorFounder && !scored.hasPublicThesis) {
    return { profile: 0, focus: 0, track: 0, signals: scored.signals };
  }
  return {
    profile: scored.hasPublicThesis ? Math.min(4, 2 + (scored.signals.includes('rich_faith_themes') ? 2 : 0)) : 0,
    focus: scored.isOperatorFounder ? 4 : scored.hasPublicThesis ? 2 : 0,
    track: scored.signals.includes('known_operator_founder') || scored.signals.includes('founder_exit_language')
      ? 3
      : 0,
    signals: scored.signals,
  };
}

module.exports = {
  OPERATOR_FOUNDER_ALIASES,
  normalizePersonLabel,
  isKnownOperatorFounderName,
  scoreOperatorFounderInvestor,
  isOperatorFounderInvestor,
  operatorFounderGodBonus,
};
