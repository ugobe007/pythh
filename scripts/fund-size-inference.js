#!/usr/bin/env node
/**
 * FUND SIZE INFERENCE ENGINE v3
 * ==============================
 * Two-pass architecture:
 *   Pass 1 — Extract ALL "Fund Size Mentions" from text → normalized objects
 *   Pass 2 — Choose "best" mention, set DB fields
 *
 * Improvements over v2:
 *   1. Structured FundSizeMention objects (raw_text, amount, currency, scope, status, ordinal)
 *   2. Strict AUM vs single-fund scoping with keyword guardrails
 *   3. Status parsing: final_close > closed > first_close > target > rumored
 *   4. Currency normalization with conservative static FX table
 *   5. Multi-vehicle detection ("$177M across two funds")
 *   6. Robust ordinal parsing (Roman, Arabic, word-form)
 *   7. Compositional confidence (source × status × scope × currency)
 *   8. Reported always beats inference — never overridden
 *   9. fund_size_version: reported_usd, reported_status, reported_date
 *  10. Expanded regex patterns for global VC press phrasing
 *  11. Entity disambiguation guardrail
 *  12. Raw evidence storage (fund_size_raw_mentions JSON)
 *
 * USAGE (module):
 *   const { runInferencePipeline, extractFundSizeMentions } = require('./fund-size-inference');
 *   const result = runInferencePipeline(investorRow);
 *
 * USAGE (CLI):
 *   node scripts/fund-size-inference.js --id=UUID
 *   node scripts/fund-size-inference.js --report
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: CONSTANTS & TAXONOMY
// ═══════════════════════════════════════════════════════════════════════════════

const CAPITAL_TYPES = {
  SINGLE_FUND: 'single_fund',
  TOTAL_AUM: 'total_aum',
  PLATFORM_CAPITAL: 'platform_capital',
  MICRO_VC: 'micro_vc',
};

// ─── Static FX table (conservative, updated ~Feb 2026) ───────────────────────
const STATIC_FX_TO_USD = {
  USD: 1.0, EUR: 1.08, GBP: 1.26, AUD: 0.65, CAD: 0.74,
  SGD: 0.74, CHF: 1.12, SEK: 0.095, NOK: 0.094, DKK: 0.145,
  INR: 0.012, JPY: 0.0067, KRW: 0.00075, CNY: 0.14, HKD: 0.128,
  NZD: 0.60, ZAR: 0.055, BRL: 0.19, MXN: 0.058, ILS: 0.28,
  AED: 0.272, SAR: 0.267, QAR: 0.275, KWD: 3.26, MYR: 0.22,
  THB: 0.028, IDR: 0.000063, PHP: 0.018, VND: 0.00004,
  NGN: 0.00065, KES: 0.0078, EGP: 0.032,
};

// ─── INR Crore/Lakh parsing ─────────────────────────────────────────────────
const INDIAN_UNITS = {
  cr: 10_000_000, crore: 10_000_000, crores: 10_000_000,
  lakh: 100_000, lakhs: 100_000,
};

// ─── Scope keywords ─────────────────────────────────────────────────────────
const AUM_KEYWORDS = [
  'aum', 'assets under management', 'capital under management',
  'under management', 'manages', 'managing',
  'evergreen', 'balance sheet', 'corporate venture', 'cvc',
  'sovereign', 'holding company', 'investment company',
  'total capital', 'total assets',
];

const SINGLE_FUND_KEYWORDS = [
  'fund i', 'fund ii', 'fund iii', 'fund iv', 'fund v',
  'fund vi', 'fund vii', 'fund viii', 'fund ix', 'fund x',
  'fund xi', 'fund xii',
  'fund 1', 'fund 2', 'fund 3', 'fund 4', 'fund 5',
  'fund 6', 'fund 7', 'fund 8', 'fund 9', 'fund 10',
  'capital i', 'capital ii', 'capital iii', 'capital iv', 'capital xi',
  'closed', 'final close', 'first close', 'raised',
  'announced a', 'launched a', 'inaugural fund', 'debut fund',
  'new fund', 'latest fund', 'oversubscribed',
];

const MULTI_VEHICLE_KEYWORDS = [
  'across', 'combined', 'totaling', 'includes', 'between', 'spanning', 'aggregate',
];

// ─── Status keywords → priority tier ────────────────────────────────────────
const STATUS_PATTERNS = [
  { keywords: ['final close', 'final closing'], status: 'final_close', priority: 1 },
  { keywords: ['closed at', 'closed on', 'closed a', 'closed its', 'has closed'], status: 'closed', priority: 2 },
  { keywords: ['raised', 'secured', 'received'], status: 'closed', priority: 3 },
  { keywords: ['oversubscribed'], status: 'closed', priority: 2 },
  { keywords: ['first close', 'first closing', 'initial close'], status: 'first_close', priority: 4 },
  { keywords: ['announced', 'launched', 'debut', 'inaugural'], status: 'announced', priority: 5 },
  { keywords: ['target', 'targeting', 'seeking', 'aiming'], status: 'target', priority: 6 },
  { keywords: ['rumor', 'reported', 'said to be'], status: 'rumored', priority: 7 },
];

// ─── Roman numeral map ──────────────────────────────────────────────────────
const ROMAN_TO_INT = {
  'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7,
  'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12, 'XIII': 13,
  'XIV': 14, 'XV': 15,
};
const WORD_TO_INT = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
};

// ─── Known entity lists ─────────────────────────────────────────────────────
const PLATFORM_CAPITAL_KEYWORDS = [
  'ventures', 'corporate', 'cvc', 'strategic',
  'sovereign', 'wealth fund', 'investment authority', 'pension', 'endowment',
];
const KNOWN_PLATFORM_CAPITAL = [
  'mckesson ventures', 'google ventures', 'gv', 'intel capital',
  'salesforce ventures', 'microsoft ventures', 'm12',
  'qualcomm ventures', 'samsung next', 'comcast ventures',
  'paypal', 'paypal ventures',
  'qatar wealth fund', 'qatar investment authority', 'qia',
  'temasek', 'gic', 'mubadala', 'adia',
  'british patient capital', 'british business bank',
  'kitopi', 'quantum commodity intelligence',
];
const KNOWN_TOTAL_AUM = [
  'sofinnova partners', 'peak xv', 'sequoia', 'a16z', 'andreessen horowitz',
  'dst global', 'prosus', 'softbank', 'tiger global',
  'westbridge capital', 'sofina', 'plug and play', 'blue venture fund',
];

// ─── Stage / Geography tables ───────────────────────────────────────────────
const STAGE_PORTFOLIO_SIZE = {
  'pre-seed': { avgCompanies: 35, avgCheckUsd: 200_000 },
  'seed': { avgCompanies: 28, avgCheckUsd: 750_000 },
  'series a': { avgCompanies: 20, avgCheckUsd: 5_000_000 },
  'series b': { avgCompanies: 15, avgCheckUsd: 15_000_000 },
  'growth': { avgCompanies: 12, avgCheckUsd: 30_000_000 },
  'late-stage': { avgCompanies: 10, avgCheckUsd: 50_000_000 },
  'early-stage': { avgCompanies: 25, avgCheckUsd: 1_500_000 },
  'mid-stage': { avgCompanies: 15, avgCheckUsd: 10_000_000 },
  'venture': { avgCompanies: 20, avgCheckUsd: 5_000_000 },
};
const GEO_FUND_RANGES = {
  'us':             { preSeedMedian:  30_000_000, seedMedian:  75_000_000, seriesAMedian: 150_000_000, growthMedian: 400_000_000 },
  'europe':         { preSeedMedian:  22_000_000, seedMedian:  60_000_000, seriesAMedian: 125_000_000, growthMedian: 350_000_000 },
  'uk':             { preSeedMedian:  20_000_000, seedMedian:  55_000_000, seriesAMedian: 120_000_000, growthMedian: 300_000_000 },
  'india':          { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  80_000_000, growthMedian: 200_000_000 },
  'southeast asia': { preSeedMedian:  12_000_000, seedMedian:  35_000_000, seriesAMedian:  70_000_000, growthMedian: 180_000_000 },
  'mena':           { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  80_000_000, growthMedian: 200_000_000 },
  'africa':         { preSeedMedian:  10_000_000, seedMedian:  25_000_000, seriesAMedian:  50_000_000, growthMedian: 120_000_000 },
  'israel':         { preSeedMedian:  25_000_000, seedMedian:  65_000_000, seriesAMedian: 140_000_000, growthMedian: 350_000_000 },
  'latam':          { preSeedMedian:  12_000_000, seedMedian:  35_000_000, seriesAMedian:  70_000_000, growthMedian: 180_000_000 },
  'nordics':        { preSeedMedian:  18_000_000, seedMedian:  45_000_000, seriesAMedian: 100_000_000, growthMedian: 250_000_000 },
  'philippines':    { preSeedMedian:   8_000_000, seedMedian:  20_000_000, seriesAMedian:  45_000_000, growthMedian: 120_000_000 },
  'china':          { preSeedMedian:  20_000_000, seedMedian:  60_000_000, seriesAMedian: 130_000_000, growthMedian: 350_000_000 },
  'japan':          { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  90_000_000, growthMedian: 250_000_000 },
  'korea':          { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  90_000_000, growthMedian: 250_000_000 },
  'australia':      { preSeedMedian:  18_000_000, seedMedian:  50_000_000, seriesAMedian: 110_000_000, growthMedian: 280_000_000 },
  'canada':         { preSeedMedian:  20_000_000, seedMedian:  55_000_000, seriesAMedian: 120_000_000, growthMedian: 300_000_000 },
  'dach':           { preSeedMedian:  22_000_000, seedMedian:  55_000_000, seriesAMedian: 120_000_000, growthMedian: 300_000_000 },
  'global':         { preSeedMedian:  25_000_000, seedMedian:  60_000_000, seriesAMedian: 130_000_000, growthMedian: 350_000_000 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: FUND SIZE MENTION EXTRACTION (Pass 1)
// ═══════════════════════════════════════════════════════════════════════════════

/** Parse a fund ordinal from context text. Returns integer or null. */
function parseFundOrdinal(text) {
  if (!text) return null;
  // "Fund III", "Capital XI", "Vehicle II" — regex covers I through XV
  const romanMatch = text.match(/(?:fund|capital|vehicle|growth)\s+([IVXLCDM]{1,6})\b/i);
  if (romanMatch) {
    const roman = romanMatch[1].toUpperCase();
    if (ROMAN_TO_INT[roman]) return ROMAN_TO_INT[roman];
  }
  // "Fund 3", "Fund 03"
  const arabicMatch = text.match(/(?:fund|capital|vehicle)\s+(\d{1,2})\b/i);
  if (arabicMatch) return parseInt(arabicMatch[1]);
  // "Fund One"
  const wordMatch = text.match(/(?:fund|capital|vehicle)\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (wordMatch) return WORD_TO_INT[wordMatch[1].toLowerCase()] || null;
  return null;
}

/** Detect fund status from surrounding text. */
function detectStatus(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const sp of STATUS_PATTERNS) {
    for (const kw of sp.keywords) {
      if (lower.includes(kw)) return { status: sp.status, priority: sp.priority };
    }
  }
  return null;
}

/** Detect scope: single_fund vs aum vs vehicle_total vs platform_capital. */
function detectScope(contextText, rawMatch) {
  if (!contextText) return 'unknown';
  const lower = contextText.toLowerCase();

  // AUM / platform signals
  for (const kw of AUM_KEYWORDS) {
    if (lower.includes(kw)) {
      // Fund ordinal + raised/closed overrides AUM context
      if (parseFundOrdinal(lower) && /(?:closed|raised|first close|final close)/i.test(lower)) {
        return 'single_fund';
      }
      if (['sovereign', 'holding company', 'investment company', 'balance sheet', 'corporate venture', 'cvc', 'evergreen'].some(pk => lower.includes(pk))) {
        return 'platform_capital';
      }
      return 'aum';
    }
  }

  // Multi-vehicle detection: "across X funds", "combined", etc.
  if (/(across|combined|totaling|aggregate).{0,40}(fund|funds|vehicles?|strategies)/i.test(lower)) {
    return 'vehicle_total';
  }
  if (/(fund\s+(?:[ivxlcdm]{1,6}|\d+)).{0,40}(?:and|&).{0,40}(fund\s+(?:[ivxlcdm]{1,6}|\d+))/i.test(lower)) {
    return 'vehicle_total';
  }
  for (const kw of MULTI_VEHICLE_KEYWORDS) {
    if (lower.includes(kw) && /fund|vehicle/i.test(lower)) {
      return 'vehicle_total';
    }
  }

  // Single fund signals
  if (parseFundOrdinal(lower)) return 'single_fund';
  for (const kw of SINGLE_FUND_KEYWORDS) {
    if (lower.includes(kw)) return 'single_fund';
  }
  if (/fund|vehicle|vintage/i.test((rawMatch || '').toLowerCase())) return 'single_fund';

  return 'unknown';
}

/** Detect currency from text near the amount. Returns ISO code. */
function detectCurrency(text) {
  if (!text) return 'USD';
  if (/\$/.test(text) && !/[ACNS]\$/.test(text)) return 'USD';
  if (/A\$/.test(text)) return 'AUD';
  if (/C\$/.test(text)) return 'CAD';
  if (/S\$/.test(text)) return 'SGD';
  if (/N\$/.test(text)) return 'NZD';
  if (/€/.test(text)) return 'EUR';
  if (/£/.test(text)) return 'GBP';
  if (/₹/.test(text) || /\bINR\b/i.test(text) || /\bRs\.?\b/i.test(text)) return 'INR';
  if (/\bEUR\b/i.test(text)) return 'EUR';
  if (/\bGBP\b/i.test(text)) return 'GBP';
  if (/\bCHF\b/i.test(text)) return 'CHF';
  if (/\bSEK\b/i.test(text)) return 'SEK';
  if (/\bNOK\b/i.test(text)) return 'NOK';
  if (/\bDKK\b/i.test(text)) return 'DKK';
  if (/\bKRW\b|₩/.test(text)) return 'KRW';
  // ¥ is ambiguous: CNY vs JPY — check context keywords to disambiguate
  if (/¥/.test(text)) {
    if (/\bCNY\b|china|chinese|renminbi|\brmb\b/i.test(text)) return 'CNY';
    if (/\bJPY\b|japan|japanese|\byen\b/i.test(text)) return 'JPY';
    return 'JPY'; // default ¥ to JPY if no context
  }
  if (/\bJPY\b/.test(text)) return 'JPY';
  if (/\bCNY\b/.test(text)) return 'CNY';
  if (/\bHKD\b|HK\$/.test(text)) return 'HKD';
  if (/\bAED\b/.test(text)) return 'AED';
  if (/\bSAR\b/.test(text)) return 'SAR';
  if (/\bBRL\b|R\$/.test(text)) return 'BRL';
  if (/\bZAR\b/.test(text)) return 'ZAR';
  if (/\bMXN\b/.test(text)) return 'MXN';
  if (/\bILS\b|₪/.test(text)) return 'ILS';
  if (/\bNGN\b|₦/.test(text)) return 'NGN';
  if (/\bQAR\b/.test(text)) return 'QAR';
  if (/\bKWD\b/.test(text)) return 'KWD';
  return 'USD';
}

/** Parse amount string + unit into base-currency value. */
function parseAmount(numStr, unitStr) {
  const clean = numStr.replace(/,/g, '');
  let amount = parseFloat(clean);
  if (isNaN(amount) || amount <= 0) return 0;
  const unit = (unitStr || '').toLowerCase().trim();
  if (INDIAN_UNITS[unit]) return amount * INDIAN_UNITS[unit];
  if (['b', 'billion', 'bn'].includes(unit)) return amount * 1_000_000_000;
  if (['m', 'million', 'mn'].includes(unit)) return amount * 1_000_000;
  if (['k', 'thousand'].includes(unit)) return amount * 1_000;
  if (['t', 'trillion'].includes(unit)) return amount * 1_000_000_000_000;
  return amount;
}

/** Convert amount to USD using static FX table. */
function convertToUsd(amount, currency, asOfDate) {
  if (currency === 'USD') return { amount_usd: amount, fx_method: 'native_usd', fx_rate: 1.0, confidence_penalty: 0 };
  const rate = STATIC_FX_TO_USD[currency];
  if (!rate) return { amount_usd: null, fx_method: 'unknown_currency', fx_rate: null, confidence_penalty: 0.4 };
  return {
    amount_usd: Math.round(amount * rate),
    fx_method: asOfDate ? 'fx_static_dated' : 'fx_static',
    fx_rate: rate,
    confidence_penalty: asOfDate ? 0.05 : 0.15,
  };
}

// ─── Skip patterns: NOT fund sizes ──────────────────────────────────────────
const SKIP_PATTERNS = [
  /typical\s+check/i,
  /check\s*(?:size)?[\s:]/i,
  /market\s+cap/i,
  /valuation\s+(?:of|at)/i,
  /revenue\s+of/i,
  /raised\s+(?:by|from)\s+(?:startups|portfolio|companies)/i,
  /portfolio\s+companies?\s+(?:have\s+)?raised/i,
  /invested\s+in\s+\d+/i,
  /series\s+[a-d]\b/i,
  /seed\s+round/i,
  /pre-?seed\s+round/i,
  /raised\s+\$?\d+.*(?:round|series|seed)/i,
  /acquired\s+(?:for|by)/i,
  /\bgrant\b/i,
  /debt\s+facility|credit\s+facility/i,
  /\birr\b|\btvpi\b|\bdpi\b/i,
  /\bdistributed\b|\breturned\s+to\s+LPs?/i,
  /commitment\s+(?:from|by)/i,
];

// ─── Fund-intent tokens: must appear near amount for "reported" scope ────────
const FUND_INTENT_RE = /\b(fund|vehicle|vintage|close|closing|raised|oversubscribed|inaugural|debut|new fund|aum|assets under management|under management|manages|managing)\b/i;

// ─── Strong fund-sizing phrases → high confidence ───────────────────────────
const STRONG_FUND_PHRASE_RE = /(final close|first close|closed at|closed a \$|raised a \$|launched a \$|debut fund|inaugural fund|fund\s+[IVXLCDM]{1,6}\s+closed)/i;

function isCheckSizeNoise(contextText) {
  if (!contextText) return false;
  return SKIP_PATTERNS.some(p => p.test(contextText));
}

/**
 * Extract sentence-bounded context around a match position.
 * Finds the sentence containing the amount, plus a neighbor sentence if it mentions "fund".
 * Falls back to 120 chars if no sentence boundary found.
 */
function extractSentenceContext(text, matchIndex, matchLength) {
  // Find sentence start: look backwards for . ? ! or start of text
  let sentStart = matchIndex;
  for (let i = matchIndex - 1; i >= Math.max(0, matchIndex - 300); i--) {
    const ch = text[i];
    if (ch === '.' || ch === '?' || ch === '!') {
      sentStart = i + 1;
      break;
    }
    if (i === Math.max(0, matchIndex - 300)) sentStart = i;
  }

  // Find sentence end: look forwards for . ? ! or end of text
  let sentEnd = matchIndex + matchLength;
  for (let i = matchIndex + matchLength; i < Math.min(text.length, matchIndex + matchLength + 300); i++) {
    const ch = text[i];
    if (ch === '.' || ch === '?' || ch === '!') {
      sentEnd = i + 1;
      break;
    }
    if (i === Math.min(text.length, matchIndex + matchLength + 300) - 1) sentEnd = i + 1;
  }

  let context = text.substring(sentStart, sentEnd).replace(/\n/g, ' ').trim();

  // If the sentence is too short, expand to 120 chars
  if (context.length < 40) {
    const ctxStart = Math.max(0, matchIndex - 120);
    const ctxEnd = Math.min(text.length, matchIndex + matchLength + 120);
    context = text.substring(ctxStart, ctxEnd).replace(/\n/g, ' ').trim();
  }

  // Add neighbor sentence if it mentions "fund" and isn't already included
  if (sentEnd < text.length - 5) {
    let nextSentEnd = sentEnd;
    for (let i = sentEnd; i < Math.min(text.length, sentEnd + 200); i++) {
      const ch = text[i];
      if (ch === '.' || ch === '?' || ch === '!') {
        nextSentEnd = i + 1;
        break;
      }
      if (i === Math.min(text.length, sentEnd + 200) - 1) nextSentEnd = i + 1;
    }
    const nextSent = text.substring(sentEnd, nextSentEnd).trim();
    if (/\bfund\b/i.test(nextSent) && nextSent.length < 200) {
      context = context + ' ' + nextSent;
    }
  }

  // Cap at 500 chars
  return context.substring(0, 500);
}

// ─── Core amount-finding regex patterns ─────────────────────────────────────
const AMOUNT_PATTERN = /(?:[\$€£₹₩₦₪]|A\$|C\$|S\$|N\$|HK\$|R\$)\s*([\d,.]+)\s*(M|B|K|T|million|billion|mn|bn|Cr|crore|crores|lakh|lakhs|thousand|trillion)?/gi;
const AMOUNT_PATTERN_PREFIX = /\b(USD|EUR|GBP|INR|AUD|CAD|SGD|CHF|SEK|NOK|JPY|KRW|CNY|HKD|AED|BRL|ZAR|MXN|ILS|QAR|KWD)\s*([\d,.]+)\s*(M|B|K|T|million|billion|mn|bn|Cr|crore|crores|lakh|lakhs)?/gi;

/**
 * Extract ALL fund size mentions from investor text fields.
 * Returns array of FundSizeMention objects.
 */
function extractFundSizeMentions(investor) {
  const fields = [
    { name: 'bio', text: investor.bio || '' },
    { name: 'investment_thesis', text: investor.investment_thesis || '' },
    { name: 'portfolio_performance', text: typeof investor.portfolio_performance === 'string' ? investor.portfolio_performance : '' },
  ];

  const mentions = [];

  for (const field of fields) {
    const text = field.text;
    if (!text || text.length < 10) continue;

    const allMatches = [];

    // Pattern 1: Currency symbol before amount
    let m;
    const p1 = new RegExp(AMOUNT_PATTERN.source, AMOUNT_PATTERN.flags);
    while ((m = p1.exec(text)) !== null) {
      allMatches.push({ fullMatch: m[0], numStr: m[1], unit: m[2] || '', index: m.index, currencyHint: m[0].charAt(0) });
    }

    // Pattern 2: Currency code before amount (EUR 250M)
    const p2 = new RegExp(AMOUNT_PATTERN_PREFIX.source, AMOUNT_PATTERN_PREFIX.flags);
    while ((m = p2.exec(text)) !== null) {
      const isDupe = allMatches.some(am => Math.abs(am.index - m.index) < 5);
      if (!isDupe) {
        allMatches.push({ fullMatch: m[0], numStr: m[2], unit: m[3] || '', index: m.index, currencyCode: m[1] });
      }
    }

    for (const am of allMatches) {
      // Context window: sentence-bounded with fallback to 120 chars
      const context = extractSentenceContext(text, am.index, am.fullMatch.length);

      // Skip check-size noise (narrow window)
      const narrowStart = Math.max(0, am.index - 50);
      const narrowEnd = Math.min(text.length, am.index + am.fullMatch.length + 50);
      if (isCheckSizeNoise(text.substring(narrowStart, narrowEnd))) continue;

      const amountValue = parseAmount(am.numStr, am.unit);
      if (amountValue <= 0) continue;

      const currency = am.currencyCode || detectCurrency(context);
      const dateMatch = context.match(/(?:in|since|as\s+of|Q[1-4]\s+)(\d{4})/i);
      const asOfDate = dateMatch ? dateMatch[1] : null;
      const fx = convertToUsd(amountValue, currency, asOfDate);
      if (fx.amount_usd === null) continue;
      if (fx.amount_usd < 500_000) continue; // too small to be a fund size

      // ─── Fund-intent gate ─────────────────────────────────────
      // If no fund-intent token in context, downgrade scope to 'unknown'
      const hasFundIntent = FUND_INTENT_RE.test(context);
      const hasStrongPhrase = STRONG_FUND_PHRASE_RE.test(context);
      let scope = detectScope(context, am.fullMatch);
      if (!hasFundIntent && scope === 'single_fund') {
        scope = 'unknown'; // prevent random numbers from becoming reported_single
      }
      const fundOrdinal = parseFundOrdinal(context);
      const statusInfo = detectStatus(context);

      // ─── Compositional confidence ────────────────────────────────
      // Source-type calibration (wired for future multi-source)
      const sourceType = field.sourceType || 'database_profile';
      const baseSource = sourceType === 'firm_site' ? 0.9
        : sourceType === 'reputable_news' ? 0.8
        : sourceType === 'database_profile' ? 0.65
        : sourceType === 'unknown_blog' ? 0.55
        : 0.6;
      const statusMult = !statusInfo ? 0.8
        : statusInfo.status === 'final_close' ? 1.0
        : statusInfo.status === 'closed' ? 0.95
        : statusInfo.status === 'first_close' ? 0.85
        : statusInfo.status === 'announced' ? 0.75
        : statusInfo.status === 'target' ? 0.60
        : statusInfo.status === 'rumored' ? 0.50
        : 0.7;
      const scopeMult = scope === 'single_fund' ? 1.0
        : scope === 'aum' ? 0.85
        : scope === 'vehicle_total' ? 0.70
        : scope === 'platform_capital' ? 0.65
        : 0.75;
      const currencyMult = currency === 'USD' ? 1.0
        : fx.fx_method === 'fx_static_dated' ? 0.95
        : 0.85;

      let confidence = Math.min(1.0, baseSource * statusMult * scopeMult * currencyMult);
      if (fundOrdinal) confidence = Math.min(1.0, confidence * 1.3); // ordinal boosts trust
      if (hasStrongPhrase) confidence = Math.min(1.0, confidence * 1.2); // strong phrase boosts
      if (!hasFundIntent && !fundOrdinal) confidence = Math.min(confidence, 0.55); // cap if no fund signal
      confidence = Math.round(confidence * 100) / 100;

      mentions.push({
        raw_text: am.fullMatch,
        amount_value: amountValue,
        amount_usd: fx.amount_usd,
        amount_unit: am.unit || 'none',
        currency,
        as_of_date: asOfDate,
        scope,
        fund_ordinal: fundOrdinal,
        status: statusInfo ? statusInfo.status : null,
        status_priority: statusInfo ? statusInfo.priority : 99,
        source_field: field.name,
        source_type: 'database_profile',
        context,
        confidence,
        fx_method: fx.fx_method,
      });
    }
  }

  return mentions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: BEST MENTION SELECTION (Pass 2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Choose the "best" mention.
 * Precedence: scope (single_fund > vehicle_total > aum > unknown) →
 *             status_priority → confidence → amount.
 */
function selectBestMention(mentions) {
  if (!mentions || mentions.length === 0) return null;
  const scopeOrder = { single_fund: 0, vehicle_total: 1, aum: 2, platform_capital: 3, unknown: 4 };
  const sorted = [...mentions].sort((a, b) => {
    const scopeDiff = (scopeOrder[a.scope] || 4) - (scopeOrder[b.scope] || 4);
    if (scopeDiff !== 0) return scopeDiff;
    if (a.status_priority !== b.status_priority) return a.status_priority - b.status_priority;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.amount_usd - a.amount_usd;
  });
  return sorted[0];
}

/** Find best AUM-scoped mention separately. */
function selectBestAumMention(mentions) {
  const aum = mentions.filter(m => m.scope === 'aum' || m.scope === 'platform_capital');
  if (aum.length === 0) return null;
  return aum.sort((a, b) => b.confidence - a.confidence || b.amount_usd - a.amount_usd)[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: CAPITAL TYPE CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

function classifyCapitalType(investor, bestMention) {
  const name = (investor.name || '').toLowerCase().trim();
  const firm = (investor.firm || '').toLowerCase().trim();
  const type = (investor.type || '').toLowerCase();
  const thesis = (investor.investment_thesis || '').toLowerCase();
  const combined = `${name} ${firm} ${thesis}`;

  for (const kw of KNOWN_PLATFORM_CAPITAL) {
    if (name.includes(kw) || firm.includes(kw)) return { capital_type: CAPITAL_TYPES.PLATFORM_CAPITAL, confidence: 0.9, reason: `Known platform: ${kw}` };
  }
  if (type === 'cvc' || type === 'corporate vc') return { capital_type: CAPITAL_TYPES.PLATFORM_CAPITAL, confidence: 0.85, reason: 'Type is CVC' };

  const platformHits = PLATFORM_CAPITAL_KEYWORDS.filter(kw => combined.includes(kw));
  if (platformHits.length >= 2 || combined.includes('sovereign') || combined.includes('balance sheet') || combined.includes('pension fund')) {
    return { capital_type: CAPITAL_TYPES.PLATFORM_CAPITAL, confidence: 0.7, reason: `Platform signals: ${platformHits.join(', ')}` };
  }
  for (const kw of KNOWN_TOTAL_AUM) {
    if (name.includes(kw) || firm.includes(kw)) return { capital_type: CAPITAL_TYPES.TOTAL_AUM, confidence: 0.85, reason: `Known multi-fund: ${kw}` };
  }

  if (bestMention && (bestMention.scope === 'aum' || bestMention.scope === 'platform_capital')) {
    return { capital_type: CAPITAL_TYPES.TOTAL_AUM, confidence: 0.8, reason: `Text mentions AUM: ${bestMention.raw_text}` };
  }

  const fundSize = investor.active_fund_size || (bestMention ? bestMention.amount_usd : 0);
  if (fundSize > 0 && fundSize < 30_000_000) return { capital_type: CAPITAL_TYPES.MICRO_VC, confidence: 0.8, reason: `Fund ${formatAmount(fundSize)} < $30M` };
  if (fundSize > 0) return { capital_type: CAPITAL_TYPES.SINGLE_FUND, confidence: 0.8, reason: `Known fund: ${formatAmount(fundSize)}` };

  const avgCheck = getAverageCheck(investor);
  if (avgCheck > 0) {
    if (avgCheck < 500_000) return { capital_type: CAPITAL_TYPES.MICRO_VC, confidence: 0.6, reason: `Check ${formatAmount(avgCheck)} → micro` };
    if (avgCheck > 15_000_000) return { capital_type: CAPITAL_TYPES.TOTAL_AUM, confidence: 0.5, reason: `Large check → multi-fund` };
    return { capital_type: CAPITAL_TYPES.SINGLE_FUND, confidence: 0.5, reason: `Check → single fund` };
  }

  return { capital_type: CAPITAL_TYPES.SINGLE_FUND, confidence: 0.3, reason: 'Default — insufficient signals' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: FUND SIZE INFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Set fund size from mentions or inference. Reported NEVER overridden.
 * Precedence: reported single > reported multi-vehicle > reported AUM >
 *             active_fund_size DB field > multi-signal inference > geo×stage
 */
function inferFundSize(investor, mentions) {
  const signals = [];
  const bestMention = selectBestMention(mentions);
  const bestAum = selectBestAumMention(mentions);

  // ── Reported single fund ──
  if (bestMention && bestMention.scope === 'single_fund') {
    // Only floor to 0.85 if strong phrase or ordinal present; otherwise 0.70
    const hasStrong = STRONG_FUND_PHRASE_RE.test(bestMention.context) || bestMention.fund_ordinal;
    const confFloor = hasStrong ? 0.85 : 0.70;
    signals.push(`reported_single(${bestMention.source_field}): ${formatAmount(bestMention.amount_usd)} [${bestMention.status || '?'}] conf=${bestMention.confidence}`);
    return {
      fund_size_estimate_usd: bestMention.amount_usd,
      fund_size_confidence: Math.max(confFloor, bestMention.confidence),
      estimation_method: 'reported',
      signals_used: signals,
      reported_usd: bestMention.amount_usd,
      reported_status: bestMention.status || 'as_of',
      reported_date: bestMention.as_of_date,
      best_mention: bestMention,
      all_mentions: mentions,
    };
  }

  // ── Reported multi-vehicle ──
  if (bestMention && bestMention.scope === 'vehicle_total') {
    signals.push(`reported_multi(${bestMention.source_field}): ${formatAmount(bestMention.amount_usd)} conf=${bestMention.confidence}`);
    return {
      fund_size_estimate_usd: bestMention.amount_usd,
      fund_size_confidence: Math.min(0.75, bestMention.confidence),
      estimation_method: 'reported_multi_vehicle',
      signals_used: signals,
      reported_usd: bestMention.amount_usd,
      reported_status: bestMention.status || 'as_of',
      reported_date: bestMention.as_of_date,
      best_mention: bestMention,
      all_mentions: mentions,
    };
  }

  // ── Reported AUM → derive single fund estimate ──
  if (bestAum) {
    const estFunds = bestAum.amount_usd > 10_000_000_000 ? 6 : bestAum.amount_usd > 1_000_000_000 ? 4 : 2;
    const singleEst = Math.round(bestAum.amount_usd / estFunds);
    signals.push(`reported_aum(${bestAum.source_field}): ${formatAmount(bestAum.amount_usd)} ÷ ${estFunds} → est single ${formatAmount(singleEst)}`);
    return {
      fund_size_estimate_usd: singleEst,  // single fund estimate, NOT raw AUM
      fund_size_confidence: Math.min(0.65, bestAum.confidence), // AUM-derived is lower
      estimation_method: 'aum_divided_inference',
      signals_used: signals,
      reported_usd: bestAum.amount_usd, // store raw AUM here
      reported_status: 'aum',
      reported_date: bestAum.as_of_date,
      aum_reported_usd: bestAum.amount_usd,
      estimated_single_fund: singleEst,
      best_mention: bestAum,
      all_mentions: mentions,
    };
  }

  // ── Unknown-scope text mention ──
  if (bestMention && bestMention.scope === 'unknown') {
    signals.push(`reported_unknown(${bestMention.source_field}): ${formatAmount(bestMention.amount_usd)} conf=${bestMention.confidence}`);
    return {
      fund_size_estimate_usd: bestMention.amount_usd,
      fund_size_confidence: Math.min(0.65, bestMention.confidence),
      estimation_method: 'reported_unknown_scope',
      signals_used: signals,
      reported_usd: bestMention.amount_usd,
      reported_status: bestMention.status || 'as_of',
      reported_date: bestMention.as_of_date,
      best_mention: bestMention,
      all_mentions: mentions,
    };
  }

  // ── active_fund_size DB field ──
  const knownFundSize = investor.active_fund_size || 0;
  if (knownFundSize > 0) {
    return {
      fund_size_estimate_usd: knownFundSize,
      fund_size_confidence: 1.0,
      estimation_method: 'reported',
      signals_used: ['active_fund_size DB field'],
      reported_usd: knownFundSize,
      reported_status: 'as_of',
      reported_date: null,
      best_mention: null,
      all_mentions: mentions,
    };
  }

  // ── Structural inference ──
  return inferFromStructuralSignals(investor, mentions);
}

/** Pure inference from structural data. */
function inferFromStructuralSignals(investor, mentions) {
  const signals = [];
  const estimates = [];
  const avgCheck = getAverageCheck(investor);
  const portfolioCount = investor.total_investments || 0;
  const primaryStage = getPrimaryStage(investor);

  if (avgCheck > 0 && portfolioCount > 0) {
    const est = avgCheck * portfolioCount * 1.5;
    estimates.push({ value: est, weight: 0.8 });
    signals.push(`check×portfolio: ${formatAmount(avgCheck)}×${portfolioCount}×1.5 = ${formatAmount(est)}`);
  } else if (avgCheck > 0 && primaryStage) {
    const sd = STAGE_PORTFOLIO_SIZE[primaryStage];
    if (sd) {
      const est = avgCheck * sd.avgCompanies * 1.5;
      estimates.push({ value: est, weight: 0.6 });
      signals.push(`check×stage(${primaryStage}): ${formatAmount(avgCheck)}×${sd.avgCompanies}×1.5 = ${formatAmount(est)}`);
    }
  }

  if (portfolioCount > 0 && avgCheck === 0) {
    let est;
    if (portfolioCount <= 15) est = portfolioCount * 1_500_000;
    else if (portfolioCount <= 30) est = portfolioCount * 2_500_000;
    else if (portfolioCount <= 80) est = portfolioCount * 3_000_000;
    else est = portfolioCount * 4_000_000;
    estimates.push({ value: est, weight: 0.4 });
    signals.push(`portfolio_count(${portfolioCount}): ${formatAmount(est)}`);
  }

  if (primaryStage) {
    const geo = getPrimaryGeo(investor);
    const gr = GEO_FUND_RANGES[geo] || GEO_FUND_RANGES['global'];
    let geoEst;
    if (primaryStage === 'pre-seed') geoEst = gr.preSeedMedian;
    else if (['seed', 'early-stage'].includes(primaryStage)) geoEst = gr.seedMedian;
    else if (['series a', 'series b', 'mid-stage', 'venture'].includes(primaryStage)) geoEst = gr.seriesAMedian;
    else geoEst = gr.growthMedian;
    estimates.push({ value: geoEst, weight: 0.3 });
    signals.push(`geo×stage(${geo}/${primaryStage}): ${formatAmount(geoEst)}`);
  }

  if (avgCheck > 0 && estimates.length < 2) {
    const tp = primaryStage ? (STAGE_PORTFOLIO_SIZE[primaryStage]?.avgCompanies || 20) : 20;
    const est = avgCheck * tp * 1.5;
    estimates.push({ value: est, weight: 0.5 });
    signals.push(`check_heuristic: ${formatAmount(avgCheck)}×${tp}×1.5 = ${formatAmount(est)}`);
  }

  if (estimates.length === 0) {
    return {
      fund_size_estimate_usd: null, fund_size_confidence: 0,
      estimation_method: 'none', signals_used: ['No inference signals'],
      reported_usd: null, reported_status: null, reported_date: null,
      best_mention: null, all_mentions: mentions,
    };
  }

  const totalW = estimates.reduce((s, e) => s + e.weight, 0);
  const wAvg = estimates.reduce((s, e) => s + e.value * e.weight, 0) / totalW;

  const hasCheck = avgCheck > 0, hasPortfolio = portfolioCount > 0, hasStage = !!primaryStage;
  let conf;
  if (hasCheck && hasPortfolio) conf = hasStage ? 0.75 : 0.70;
  else if (hasCheck && hasStage) conf = 0.60;
  else if (hasPortfolio && hasStage) conf = 0.55;
  else if (hasCheck) conf = 0.50;
  else if (hasPortfolio) conf = 0.40;
  else conf = 0.35;

  let method = 'multi_signal';
  if (estimates.length === 1) {
    if (signals.find(s => s.startsWith('check×portfolio'))) method = 'check_portfolio_inference';
    else if (signals.find(s => s.startsWith('portfolio_count'))) method = 'portfolio_count_inference';
    else if (signals.find(s => s.startsWith('geo×stage'))) method = 'geo_stage_inference';
    else if (signals.find(s => s.startsWith('check'))) method = 'check_size_inference';
  }

  return {
    fund_size_estimate_usd: Math.round(wAvg),
    fund_size_confidence: Math.round(conf * 100) / 100,
    estimation_method: method, signals_used: signals,
    reported_usd: null, reported_status: null, reported_date: null,
    best_mention: null, all_mentions: mentions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: CAPITAL POWER & VELOCITY
// ═══════════════════════════════════════════════════════════════════════════════

function computeCapitalPower(fundSizeUsd) {
  if (!fundSizeUsd || fundSizeUsd <= 0) return 0;
  const log = Math.log10(fundSizeUsd);
  const anchors = [
    { log: 7.0, score: 0.5 }, { log: 7.3, score: 1.0 }, { log: 7.875, score: 2.0 },
    { log: 8.4, score: 3.0 }, { log: 9.0, score: 4.0 }, { log: 10.0, score: 5.0 },
  ];
  if (log <= anchors[0].log) return Math.max(0, anchors[0].score * (log / anchors[0].log));
  if (log >= anchors[anchors.length - 1].log) return 5.0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (log >= anchors[i].log && log < anchors[i + 1].log) {
      const t = (log - anchors[i].log) / (anchors[i + 1].log - anchors[i].log);
      return Math.round((anchors[i].score + t * (anchors[i + 1].score - anchors[i].score)) * 100) / 100;
    }
  }
  return 0;
}

function computeDeploymentVelocity(investor, fundSizeUsd) {
  const totalInv = investor.total_investments || 0;
  const signals = [];
  if (totalInv === 0) return { deployment_velocity_index: 0, label: 'unknown', signals: ['No investment count data'] };

  let yrs = 5;
  const bio = (investor.bio || '').toLowerCase();
  const foundedMatch = bio.match(/(?:founded|established|started|launched)\s+(?:in\s+)?(\d{4})/i);
  if (foundedMatch) { yrs = Math.max(1, 2026 - parseInt(foundedMatch[1])); signals.push(`founded: ${foundedMatch[1]} (${yrs}yr)`); }
  else {
    const sinceMatch = bio.match(/since\s+(\d{4})/i);
    if (sinceMatch) { yrs = Math.max(1, 2026 - parseInt(sinceMatch[1])); signals.push(`since: ${sinceMatch[1]} (${yrs}yr)`); }
    else signals.push('years_active: estimated 5yr (default)');
  }

  const dpy = totalInv / yrs;
  signals.push(`deals/year: ${totalInv}/${yrs} = ${dpy.toFixed(1)}`);

  if (fundSizeUsd > 0) {
    const deployed = totalInv * (getAverageCheck(investor) || 0);
    if (deployed > 0) signals.push(`deployment_ratio: ${(deployed / fundSizeUsd * 100).toFixed(0)}% of fund deployed`);
  }

  const ci = Math.min(5, Math.max(0.5,
    dpy < 3 ? 0.5 + (dpy / 3) * 0.5 :
    dpy < 8 ? 1 + ((dpy - 3) / 5) :
    dpy < 15 ? 2 + ((dpy - 8) / 7) :
    dpy < 30 ? 3 + ((dpy - 15) / 15) :
    4 + Math.min(1, (dpy - 30) / 30)
  ));

  let label;
  if (dpy < 3) label = 'very_conservative';
  else if (dpy < 8) label = 'conservative';
  else if (dpy < 15) label = 'moderate';
  else if (dpy < 30) label = 'active';
  else label = 'hyper_active';

  return { deployment_velocity_index: Math.round(ci * 100) / 100, label, signals };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: FULL PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

function runInferencePipeline(investor) {
  // Pass 1: Extract all mentions
  const mentions = extractFundSizeMentions(investor);

  // Pass 2: Choose best + infer
  const inference = inferFundSize(investor, mentions);
  const effFundSize = inference.fund_size_estimate_usd || 0;
  const power = computeCapitalPower(effFundSize);
  const effPower = Math.round(power * inference.fund_size_confidence * 100) / 100;
  const velocity = computeDeploymentVelocity(investor, effFundSize);

  // Capital type
  const bestMention = selectBestMention(mentions);
  const classification = classifyCapitalType(investor, bestMention);
  let finalType = classification.capital_type;
  if (bestMention) {
    if (bestMention.scope === 'aum' && finalType === CAPITAL_TYPES.SINGLE_FUND) finalType = CAPITAL_TYPES.TOTAL_AUM;
    else if (bestMention.scope === 'platform_capital') finalType = CAPITAL_TYPES.PLATFORM_CAPITAL;
  }

  // Raw mentions for evidence storage
  const rawMentions = mentions.map(m => ({
    raw_text: m.raw_text, amount_usd: m.amount_usd, currency: m.currency,
    scope: m.scope, status: m.status, fund_ordinal: m.fund_ordinal,
    source_field: m.source_field, confidence: m.confidence,
    context: m.context.substring(0, 200),
  }));

  // Use inference.best_mention for evidence (matches the winning branch)
  const evidenceMention = inference.best_mention;

  return {
    capital_type: finalType,
    capital_type_confidence: classification.confidence,
    capital_type_reason: classification.reason,
    fund_size_estimate_usd: inference.fund_size_estimate_usd,
    fund_size_confidence: inference.fund_size_confidence,
    estimation_method: inference.estimation_method,
    estimation_signals: inference.signals_used,
    capital_power_score: power,
    effective_capital_power: effPower,
    deployment_velocity_index: velocity.deployment_velocity_index,
    deployment_velocity_label: velocity.label,
    deployment_velocity_signals: velocity.signals,
    // v3: versioning
    fund_size_reported_usd: inference.reported_usd || null,
    fund_size_reported_status: inference.reported_status || null,
    fund_size_reported_date: inference.reported_date || null,
    // v3: AUM pass-through (when method is aum_divided_inference)
    aum_reported_usd: inference.aum_reported_usd || null,
    // v3: evidence — use inference.best_mention, not pipeline bestMention
    fund_size_raw_mentions: rawMentions,
    fund_size_evidence_text: evidenceMention ? evidenceMention.context.substring(0, 500) : null,
    mention_count: mentions.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getAverageCheck(investor) {
  const min = investor.check_size_min || 0;
  const max = investor.check_size_max || 0;
  if (min > 0 && max > 0) return (min + max) / 2;
  if (max > 0) return max;
  if (min > 0) return min;
  return 0;
}

function getPrimaryStage(investor) {
  const stages = investor.stage || [];
  if (stages.length === 0) return null;
  const norm = stages.map(s => s.toLowerCase().trim());
  const order = ['pre-seed', 'seed', 'early-stage', 'series a', 'series b', 'mid-stage', 'venture', 'growth', 'late-stage'];
  for (const s of order) { if (norm.includes(s)) return s; }
  return norm[0];
}

function getPrimaryGeo(investor) {
  const geos = investor.geography_focus || [];
  if (geos.length === 0) return 'global';
  const norm = geos.map(g => g.toLowerCase().trim());
  for (const geo of norm) {
    if (GEO_FUND_RANGES[geo]) return geo;
    for (const key of Object.keys(GEO_FUND_RANGES)) {
      if (geo.includes(key) || key.includes(geo)) return key;
    }
  }
  return 'global';
}

function formatAmount(n) {
  if (!n) return 'N/A';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: CLI
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');

  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doReport = args.includes('--report');
  const idArg = args.find(a => a.startsWith('--id='));
  const investorId = idArg ? idArg.split('=')[1] : null;

  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  FUND SIZE INFERENCE ENGINE v3               ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  if (!doApply) console.log('🔍 DRY RUN — use --apply to write\n');

  let query = supabase.from('investors').select('*');
  if (investorId) query = query.eq('id', investorId);
  query = query.order('investor_score', { ascending: true });

  const { data: investors, error } = await query;
  if (error) { console.error('DB Error:', error.message); return; }
  console.log(`📦 Analyzing ${investors.length} investors\n`);

  const results = [];
  let reported = 0, inferred = 0, noData = 0;

  for (const inv of investors) {
    const result = runInferencePipeline(inv);
    results.push({ investor: inv, ...result });
    if (['reported', 'reported_aum', 'reported_multi_vehicle', 'reported_unknown_scope'].includes(result.estimation_method)) reported++;
    else if (result.fund_size_estimate_usd) inferred++;
    else noData++;
  }

  // Detail output for small batches
  if (investors.length <= 30 || investorId) {
    for (const r of results) {
      const inv = r.investor;
      const known = inv.active_fund_size ? `(known: ${formatAmount(inv.active_fund_size)})` : '(no fund size)';
      console.log(`━━━ ${inv.name} ${known} ━━━`);
      console.log(`   Type:      ${r.capital_type} (${(r.capital_type_confidence * 100).toFixed(0)}%)`);
      console.log(`   Reason:    ${r.capital_type_reason}`);
      if (r.fund_size_estimate_usd) {
        console.log(`   Estimate:  ${formatAmount(r.fund_size_estimate_usd)} (${(r.fund_size_confidence * 100).toFixed(0)}% conf)`);
        console.log(`   Method:    ${r.estimation_method}`);
        console.log(`   Power:     ${r.capital_power_score.toFixed(2)}/5 | Effective: ${r.effective_capital_power.toFixed(2)}/5`);
      } else {
        console.log(`   Estimate:  Unable to infer`);
      }
      if (r.fund_size_reported_usd) {
        console.log(`   Reported:  ${formatAmount(r.fund_size_reported_usd)} [${r.fund_size_reported_status}]${r.fund_size_reported_date ? ' (' + r.fund_size_reported_date + ')' : ''}`);
      }
      if (r.mention_count > 0) {
        console.log(`   Mentions:  ${r.mention_count}`);
        for (const m of r.fund_size_raw_mentions) {
          console.log(`     📑 ${formatAmount(m.amount_usd)} [${m.scope}|${m.status || '?'}] conf=${m.confidence} "${m.context.substring(0, 80)}..."`);
        }
      }
      if (r.deployment_velocity_index > 0) {
        console.log(`   Velocity:  ${r.deployment_velocity_index.toFixed(2)}/5 (${r.deployment_velocity_label})`);
      }
      for (const s of r.estimation_signals || []) console.log(`   📐 ${s}`);
      console.log('');
    }
  }

  // Summary
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  SUMMARY${doApply ? '' : ' (DRY RUN)'}                                ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Total:     ${investors.length}`);
  console.log(`  Reported:  ${reported} (${(reported / investors.length * 100).toFixed(1)}%)`);
  console.log(`  Inferred:  ${inferred} (${(inferred / investors.length * 100).toFixed(1)}%)`);
  console.log(`  No data:   ${noData} (${(noData / investors.length * 100).toFixed(1)}%)`);

  const methodDist = {};
  for (const r of results) methodDist[r.estimation_method] = (methodDist[r.estimation_method] || 0) + 1;
  console.log('\n  Method Distribution:');
  for (const [m, c] of Object.entries(methodDist).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${m.padEnd(28)} ${c.toString().padStart(4)} (${(c / investors.length * 100).toFixed(1)}%)`);
  }

  const confBuckets = { '<0.35': 0, '0.35-0.50': 0, '0.50-0.65': 0, '0.65-0.80': 0, '0.80-0.95': 0, '0.95+': 0 };
  for (const r of results) {
    const c = r.fund_size_confidence;
    if (c < 0.35) confBuckets['<0.35']++;
    else if (c < 0.50) confBuckets['0.35-0.50']++;
    else if (c < 0.65) confBuckets['0.50-0.65']++;
    else if (c < 0.80) confBuckets['0.65-0.80']++;
    else if (c < 0.95) confBuckets['0.80-0.95']++;
    else confBuckets['0.95+']++;
  }
  console.log('\n  Confidence Distribution:');
  for (const [b, c] of Object.entries(confBuckets)) {
    const bar = '█'.repeat(Math.round(c / investors.length * 40));
    console.log(`    ${b.padEnd(12)} ${c.toString().padStart(4)} ${bar}`);
  }

  const sorted = results.filter(r => r.effective_capital_power > 0).sort((a, b) => b.effective_capital_power - a.effective_capital_power);
  if (sorted.length > 0) {
    console.log('\n  Top 15 by Effective Capital Power:');
    for (let i = 0; i < Math.min(15, sorted.length); i++) {
      const r = sorted[i];
      console.log(`    ${(i+1).toString().padStart(2)}. ${(r.investor.name || '').padEnd(30)} ${formatAmount(r.fund_size_estimate_usd).padEnd(10)} eff=${r.effective_capital_power.toFixed(2)} conf=${r.fund_size_confidence} [${r.estimation_method}]`);
    }
  }

  if (doReport) {
    const fs = require('fs');
    const path = require('path');
    const csvDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });
    const csvPath = path.join(csvDir, 'fund-size-inference-v3-report.csv');
    const header = 'Name,Firm,Known Fund Size,Estimated,Confidence,Method,Capital Type,Power,Eff Power,Velocity,Mentions,Reported Status\n';
    const rows = results.map(r => {
      const inv = r.investor;
      return [
        `"${(inv.name || '').replace(/"/g, '""')}"`,
        `"${(inv.firm || '').replace(/"/g, '""')}"`,
        inv.active_fund_size || '',
        r.fund_size_estimate_usd || '',
        r.fund_size_confidence,
        r.estimation_method,
        r.capital_type,
        r.capital_power_score,
        r.effective_capital_power,
        r.deployment_velocity_index,
        r.mention_count,
        r.fund_size_reported_status || '',
      ].join(',');
    }).join('\n');
    require('fs').writeFileSync(csvPath, header + rows);
    console.log(`\n✅ Report: data/fund-size-inference-v3-report.csv`);
  }

  console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  CAPITAL_TYPES,
  STATIC_FX_TO_USD,
  extractFundSizeMentions,
  selectBestMention,
  selectBestAumMention,
  parseFundOrdinal,
  detectStatus,
  detectScope,
  detectCurrency,
  parseAmount,
  convertToUsd,
  classifyCapitalType,
  inferFundSize,
  computeCapitalPower,
  computeDeploymentVelocity,
  runInferencePipeline,
  formatAmount,
};

if (require.main === module) {
  main().catch(console.error);
}
