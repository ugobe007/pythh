#!/usr/bin/env node
/**
 * STARTUP METRIC PARSER v1
 * ═══════════════════════════════════════════════════════════════════════════════
 * Two-pass architecture mirroring fund-size-inference.js:
 *   Pass 1 — Extract ALL "Metric Mentions" from text → normalized objects
 *   Pass 2 — Choose "best" mention per metric type, set DB fields
 *
 * Metric Types:
 *   FUNDING:   last_round_amount, total_funding, valuation
 *   TRACTION:  arr, revenue, mrr, gmv, customers, users, headcount
 *   ECONOMICS: burn, runway
 *
 * Hard Guardrails:
 *   - TAM/market_size → ALWAYS skipped (not a startup metric)
 *   - GMV ≠ revenue — tagged separately, never promoted to revenue
 *   - Round size ≠ valuation — "raised" keyword disambiguates
 *   - Customer savings / ROI ≠ revenue
 *   - Projections / targets get confidence penalty
 *
 * Confidence System:
 *   baseSource (0.5–0.9) × keywordMult × dateMult × projectionMult
 *
 * USAGE (module):
 *   const { runStartupPipeline, extractStartupMetrics } = require('./startup-metric-parser');
 *   const result = runStartupPipeline(startupRow);
 *
 * USAGE (CLI - test mode):
 *   node scripts/startup-metric-parser.js --test
 */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: CONSTANTS & TAXONOMY
// ═══════════════════════════════════════════════════════════════════════════════

const METRIC_TYPES = {
  // Funding
  LAST_ROUND: 'last_round_amount',
  TOTAL_FUNDING: 'total_funding',
  VALUATION: 'valuation',
  // Traction
  ARR: 'arr',
  REVENUE: 'revenue',
  MRR: 'mrr',
  GMV: 'gmv',
  CUSTOMERS: 'customers',
  USERS: 'users',
  HEADCOUNT: 'headcount',
  // Economics
  BURN: 'burn',
  RUNWAY: 'runway',
};

const METRIC_CATEGORIES = {
  [METRIC_TYPES.LAST_ROUND]: 'funding',
  [METRIC_TYPES.TOTAL_FUNDING]: 'funding',
  [METRIC_TYPES.VALUATION]: 'funding',
  [METRIC_TYPES.ARR]: 'traction',
  [METRIC_TYPES.REVENUE]: 'traction',
  [METRIC_TYPES.MRR]: 'traction',
  [METRIC_TYPES.GMV]: 'traction',
  [METRIC_TYPES.CUSTOMERS]: 'traction',
  [METRIC_TYPES.USERS]: 'traction',
  [METRIC_TYPES.HEADCOUNT]: 'traction',
  [METRIC_TYPES.BURN]: 'economics',
  [METRIC_TYPES.RUNWAY]: 'economics',
};

// ─── Static FX table (mirrors fund-size-inference.js) ────────────────────────
const STATIC_FX_TO_USD = {
  USD: 1.0, EUR: 1.08, GBP: 1.26, AUD: 0.65, CAD: 0.74,
  SGD: 0.74, CHF: 1.12, SEK: 0.095, NOK: 0.094, DKK: 0.145,
  INR: 0.012, JPY: 0.0067, KRW: 0.00075, CNY: 0.14, HKD: 0.128,
  NZD: 0.60, ZAR: 0.055, BRL: 0.19, MXN: 0.058, ILS: 0.28,
  AED: 0.272, SAR: 0.267, QAR: 0.275, KWD: 3.26, MYR: 0.22,
  THB: 0.028, IDR: 0.000063, PHP: 0.018, VND: 0.00004,
  NGN: 0.00065, KES: 0.0078, EGP: 0.032,
};

const INDIAN_UNITS = {
  cr: 10_000_000, crore: 10_000_000, crores: 10_000_000,
  lakh: 100_000, lakhs: 100_000,
};

// ─── Round type normalization ────────────────────────────────────────────────
const ROUND_TYPE_MAP = {
  'pre-seed': 'pre_seed', 'preseed': 'pre_seed',
  'seed': 'seed', 'seed round': 'seed',
  'angel': 'angel', 'angel round': 'angel',
  'series a': 'series_a', 'a round': 'series_a',
  'series b': 'series_b', 'b round': 'series_b',
  'series c': 'series_c', 'c round': 'series_c',
  'series d': 'series_d', 'd round': 'series_d',
  'series e': 'series_e', 'e round': 'series_e',
  'series f': 'series_f', 'f round': 'series_f',
  'bridge': 'bridge', 'bridge round': 'bridge',
  'convertible': 'convertible', 'convertible note': 'convertible',
  'safe': 'safe',
  'growth': 'growth', 'growth round': 'growth', 'growth equity': 'growth',
  'late stage': 'late_stage', 'late-stage': 'late_stage',
  'ipo': 'ipo', 'initial public offering': 'ipo',
  'debt': 'debt', 'venture debt': 'debt',
  'grant': 'grant',
  'crowdfunding': 'crowdfunding',
  'extension': 'extension',
};

// ─── SKIP patterns: NOT startup metrics ──────────────────────────────────────
const SKIP_PATTERNS = [
  // TAM / market size — NEVER a startup metric
  /\btam\b/i,
  /\bsam\b/i,
  /\bsom\b/i,
  /total\s+addressable\s+market/i,
  /serviceable\s+(?:addressable|available|obtainable)\s+market/i,
  /market\s+(?:size|opportunity|potential|worth|valued\s+at)/i,
  /\$[\d,.]+\s*(?:B|billion|T|trillion)\s+market/i,
  /market\s+(?:is|was|will be|expected|projected|estimated)\s+(?:to\s+)?(?:reach|grow|hit|exceed)/i,

  // Customer savings / ROI — NOT revenue
  /(?:saved?|saving)\s+(?:customers?|clients?|users?)/i,
  /customers?\s+sav(?:e|ed|ing)/i,
  /\broi\b/i,
  /cost\s+savings?/i,
  /reduction\s+in\s+costs?/i,

  // Competitor / industry references
  /competitor\s+raised/i,
  /rival\s+raised/i,
  /industry\s+funding/i,
  /sector\s+raised/i,

  // Investment fund / LP references (this is investor data, not startup)
  /\bfund\s+(?:i{1,4}v?|[ivxlcdm]{1,6}|\d+)\b/i,
  /\blp\b.*\bcommitment\b/i,
  /\baum\b/i,
  /assets\s+under\s+management/i,

  // Valuation of other companies
  /(?:tesla|apple|google|microsoft|amazon|meta|nvidia)\s+(?:valuation|market\s+cap)/i,

  // Acquisition price — not a funding round
  /acqui(?:red|sition)\s+(?:for|at|by)/i,

  // Macroeconomic / government / geopolitical references — NOT startup metrics
  /\bgdp\b/i,
  /\bdefense\s+(?:spending|budget)/i,
  /\bgovernment\s+(?:spending|budget|debt|funding)/i,
  /\bnational\s+debt/i,
  /\btrade\s+(?:deficit|surplus|volume|war)/i,
  /\beconomy\s+(?:grew|shrank|worth|valued|sized|output)/i,
  /\bstock\s+market\s+(?:cap|capitalization)/i,
  /\bmarket\s+cap(?:italization)?\b/i,
  /\b(?:nato|military|pentagon|congress|parliament)\b/i,
  /\b(?:healthcare|health\s+care)\s+(?:spending|market|industry|sector)\b/i,
  /\bglobal\s+(?:ai|tech|fintech|crypto)\s+(?:funding|market|spending|investment)\b/i,
  /\bindustry\s+(?:valued|worth|size)/i,
  /\b(?:ipo\s+(?:valued|priced)|went\s+public\s+at)\b/i,
  /\bmarket\s+(?:rally|crash|correction|bubble)/i,
  /\bindex\s+(?:fund|etf)\b/i,

  // Projections / forecasts (handled separately as confidence penalty)
  // These are soft skips — we still extract but penalize confidence
];

// ─── Projection / target indicators → confidence penalty ─────────────────────
const PROJECTION_INDICATORS = [
  /\b(?:target|targeting|aiming|expected|projected|forecast|predicted)\b/i,
  /\b(?:will|plans?\s+to|expects?\s+to|could|may|might|should)\s+(?:reach|hit|grow|generate)\b/i,
  /\b(?:by\s+20\d{2}|next\s+year|this\s+year|year-end)\b/i,
  /\b(?:run\s+rate|annualized|pro\s+forma)\b/i,
  /\b(?:estimates?|approximately|around|roughly|nearly|about|close\s+to)\b/i,
];

// ─── Strong metric phrases → high confidence ─────────────────────────────────
const STRONG_FUNDING_PHRASE_RE = /(raised\s+(?:a\s+)?\$|secured\s+\$|closed\s+(?:a\s+)?\$|announced\s+(?:a\s+)?\$|just\s+raised|series\s+[a-f]\s+(?:round|funding)|seed\s+(?:round|funding)|funding\s+round)/i;
const STRONG_REVENUE_PHRASE_RE = /(annual\s+recurring\s+revenue|arr\s+of|revenue\s+of|monthly\s+recurring|mrr\s+of|generating\s+\$|revenue\s+reached|revenue\s+hit|making\s+\$)/i;
const STRONG_VALUATION_PHRASE_RE = /(valued?\s+at|valuation\s+of|post-money|pre-money|at\s+a\s+\$.*valuation)/i;

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: AMOUNT PARSING (shared with fund inference)
// ═══════════════════════════════════════════════════════════════════════════════

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

function detectCurrency(text) {
  if (!text) return 'USD';
  if (/\$/.test(text) && !/[ACNS]\$/.test(text)) return 'USD';
  if (/A\$/.test(text)) return 'AUD';
  if (/C\$/.test(text)) return 'CAD';
  if (/S\$/.test(text)) return 'SGD';
  if (/€/.test(text)) return 'EUR';
  if (/£/.test(text)) return 'GBP';
  if (/₹/.test(text) || /\bINR\b/i.test(text) || /\bRs\.?\b/i.test(text)) return 'INR';
  if (/\bEUR\b/i.test(text)) return 'EUR';
  if (/\bGBP\b/i.test(text)) return 'GBP';
  if (/\bCHF\b/i.test(text)) return 'CHF';
  if (/¥/.test(text)) {
    if (/\bCNY\b|china|chinese|renminbi|\brmb\b/i.test(text)) return 'CNY';
    if (/\bJPY\b|japan|japanese|\byen\b/i.test(text)) return 'JPY';
    return 'JPY';
  }
  if (/\bKRW\b|₩/.test(text)) return 'KRW';
  return 'USD';
}

function convertToUsd(amount, currency) {
  if (currency === 'USD') return { amount_usd: amount, fx_rate: 1.0 };
  const rate = STATIC_FX_TO_USD[currency];
  if (!rate) return { amount_usd: null, fx_rate: null };
  return { amount_usd: Math.round(amount * rate), fx_rate: rate };
}

function formatAmount(val) {
  if (!val || val === 0) return '$0';
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: METRIC CLASSIFICATION — What type of metric is this amount?
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Classify what metric type an amount represents based on surrounding context.
 *
 * CRITICAL RULES:
 *   - "raised" keyword → ALWAYS funding (last_round or total_funding), NEVER revenue/valuation
 *   - "valued at" / "valuation" → valuation
 *   - "ARR" / "recurring revenue" → arr
 *   - "revenue" without "recurring" → revenue
 *   - "GMV" / "gross merchandise" → gmv (NOT revenue)
 *   - "burn" / "burning" → burn
 *   - "runway" → runway (months)
 *   - "team" / "employees" / "headcount" → headcount (count, not $)
 *   - "customers" / "clients" → customers (count, not $)
 *   - "users" / "DAU" / "MAU" → users (count, not $)
 *
 * @param {string} context - Text around the amount
 * @param {number} amountUsd - Amount in USD (helps disambiguate)
 * @param {string} amountRawText - The raw matched text (e.g., "$380 Billion")
 * @returns {{ type: string, round_type: string|null, confidence_mult: number }}
 */
function classifyMetricType(context, amountUsd, amountRawText) {
  if (!context) return { type: null, round_type: null, confidence_mult: 0.5 };
  const lower = context.toLowerCase();
  const rawLower = (amountRawText || '').toLowerCase();

  // ─── Hard skip: TAM / market size ───────────────────────────────────────
  if (SKIP_PATTERNS.some(p => p.test(context))) {
    return { type: null, round_type: null, confidence_mult: 0 };
  }

  // ─── RULE 1: "raised" → funding, NEVER valuation/revenue ──────────────
  const hasRaised = /\b(?:raised?|raising|rais(?:es|ing))\b/i.test(lower);
  const hasSecured = /\b(?:secured?|securing|closed?|closing)\b/i.test(lower);
  const hasFundingAction = hasRaised || hasSecured;

  // ─── Round type detection ─────────────────────────────────────────────
  let roundType = null;
  const roundMatch = lower.match(/\b(pre-?seed|seed|angel|series\s+[a-f]|bridge|convertible|safe|growth|late[\s-]stage|ipo|venture\s+debt)\b/i);
  if (roundMatch) {
    const raw = roundMatch[1].toLowerCase().replace(/\s+/g, ' ').trim();
    roundType = ROUND_TYPE_MAP[raw] || raw.replace(/[\s-]+/g, '_');
  }

  // ─── Find THIS specific amount's position in context for proximity ─────
  const amountIdx = rawLower ? lower.indexOf(rawLower) : lower.indexOf('$');
  const effectiveIdx = amountIdx >= 0 ? amountIdx : lower.indexOf('$');

  // ─── Valuation: "valued at", "valuation of", "post-money", "pre-money" ─
  const hasValuation = /\b(?:valu(?:ed?|ation)|post-?money|pre-?money)\b/i.test(lower);
  if (hasValuation) {
    if (!hasFundingAction) {
      return { type: METRIC_TYPES.VALUATION, round_type: roundType, confidence_mult: 1.0 };
    }
    // Both raised AND valuation present — use proximity to THIS amount
    const raisedIdx = lower.search(/\b(?:raised?|secured?|closed?)\b/i);
    const valuIdx = lower.search(/\b(?:valu(?:ed?|ation)|post-?money|pre-?money)\b/i);
    if (effectiveIdx >= 0 && raisedIdx >= 0 && valuIdx >= 0) {
      const distToRaised = Math.abs(effectiveIdx - raisedIdx);
      const distToValu = Math.abs(effectiveIdx - valuIdx);
      if (distToValu < distToRaised) {
        return { type: METRIC_TYPES.VALUATION, round_type: roundType, confidence_mult: 0.85 };
      }
    }
  }

  // ─── Funding: "raised", "secured", "closed", round type present ────────
  if (hasFundingAction || roundType) {
    // Check for total funding vs single round
    if (/\b(?:total|all|cumulative|to\s+date|overall)\b/i.test(lower) && /\bfund(?:ing|ed|s)?\b/i.test(lower)) {
      return { type: METRIC_TYPES.TOTAL_FUNDING, round_type: roundType, confidence_mult: 0.95 };
    }
    return { type: METRIC_TYPES.LAST_ROUND, round_type: roundType, confidence_mult: 1.0 };
  }

  // ─── ARR / MRR: explicit acronyms or "recurring revenue" ──────────────
  if (/\barr\b/i.test(lower) || /annual\s+recurring\s+revenue/i.test(lower)) {
    // Check if "ARR" is within 20 chars of this amount (to avoid cross-sentence contamination)
    if (effectiveIdx >= 0) {
      const arrIdx = lower.indexOf('arr');
      if (arrIdx >= 0 && Math.abs(effectiveIdx - arrIdx) > 40) {
        // ARR keyword is far from this amount — might be cross-sentence noise
        // Only use if no closer keyword exists
        // Fall through to check other types
      } else {
        return { type: METRIC_TYPES.ARR, round_type: null, confidence_mult: 1.0 };
      }
    } else {
      return { type: METRIC_TYPES.ARR, round_type: null, confidence_mult: 1.0 };
    }
  }
  if (/\bmrr\b/i.test(lower) || /monthly\s+recurring\s+revenue/i.test(lower)) {
    return { type: METRIC_TYPES.MRR, round_type: null, confidence_mult: 1.0 };
  }

  // ─── GMV: "gross merchandise value" / "GMV" — NOT revenue (check BEFORE revenue) ─
  if (/\bgmv\b/i.test(lower) || /gross\s+merchandise/i.test(lower)) {
    // If "revenue" is also present, check proximity to THIS amount
    if (/\brevenue\b/i.test(lower) && effectiveIdx >= 0) {
      const gmvIdx = lower.search(/\bgmv\b|gross\s+merchandise/i);
      const revIdx = lower.search(/\brevenue\b/i);
      if (gmvIdx >= 0 && revIdx >= 0) {
        const distToGmv = Math.abs(effectiveIdx - gmvIdx);
        const distToRev = Math.abs(effectiveIdx - revIdx);
        if (distToRev < distToGmv) {
          return { type: METRIC_TYPES.REVENUE, round_type: null, confidence_mult: 0.9 };
        }
      }
    }
    return { type: METRIC_TYPES.GMV, round_type: null, confidence_mult: 0.85 };
  }

  // ─── Revenue: "revenue" without "recurring" ────────────────────────────
  if (/\brevenue\b/i.test(lower) && !/recurring/i.test(lower)) {
    return { type: METRIC_TYPES.REVENUE, round_type: null, confidence_mult: 0.9 };
  }

  // ─── Burn rate ─────────────────────────────────────────────────────────
  if (/\bburn(?:ing|s|ed)?\s+(?:rate)?\b/i.test(lower) || /\bmonthly\s+burn\b/i.test(lower)) {
    return { type: METRIC_TYPES.BURN, round_type: null, confidence_mult: 0.8 };
  }

  // ─── Runway ────────────────────────────────────────────────────────────
  if (/\brunway\b/i.test(lower)) {
    return { type: METRIC_TYPES.RUNWAY, round_type: null, confidence_mult: 0.8 };
  }

  // ─── If there's a $ amount and "funding" mentioned ─────────────────────
  if (/\bfund(?:ing|ed|s)\b/i.test(lower)) {
    return { type: METRIC_TYPES.LAST_ROUND, round_type: roundType, confidence_mult: 0.7 };
  }

  // ─── Default: if amount looks like funding (range check) ───────────────
  // Common funding ranges: $100K – $100B
  // Amounts < $50K are unlikely to be funding, > $100B is unusual
  if (amountUsd >= 100_000 && amountUsd <= 100_000_000_000) {
    // Context has no clear indicator — low confidence
    return { type: METRIC_TYPES.LAST_ROUND, round_type: null, confidence_mult: 0.3 };
  }

  return { type: null, round_type: null, confidence_mult: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: COUNT METRIC EXTRACTION (non-dollar amounts)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract count-based metrics (customers, users, headcount) from text.
 * These don't use dollar amounts — they're raw numbers.
 */
function extractCountMetrics(text) {
  if (!text || text.length < 10) return [];
  const mentions = [];

  // ─── Headcount / team size ────────────────────────────────────────────
  const headcountPatterns = [
    /(\d[\d,]*)\s*(?:\+\s*)?(?:employees?|team\s+members?|people|staff|headcount)/gi,
    /(?:team\s+(?:of|with|has)|employees?|headcount|staff)\s*(?:of|:)?\s*(?:about\s+|approximately\s+|around\s+|over\s+|more\s+than\s+)?(\d[\d,]*)/gi,
    /(?:grown?\s+(?:to|from))\s*(\d[\d,]*)\s*(?:employees?|people|staff)/gi,
  ];

  for (const pat of headcountPatterns) {
    let m;
    const p = new RegExp(pat.source, pat.flags);
    while ((m = p.exec(text)) !== null) {
      const numStr = m[1] || m[2];
      if (!numStr) continue;
      const val = parseInt(numStr.replace(/,/g, ''));
      if (val > 0 && val < 100_000) {
        // Skip if TAM context
        const ctx = extractNarrowContext(text, m.index, m[0].length);
        if (SKIP_PATTERNS.some(sk => sk.test(ctx))) continue;
        mentions.push({
          type: METRIC_TYPES.HEADCOUNT,
          value: val,
          raw_text: m[0],
          context: ctx,
          confidence: val < 10_000 ? 0.7 : 0.5,
          source_field: 'text',
        });
      }
    }
  }

  // ─── Customer count ───────────────────────────────────────────────────
  const customerPatterns = [
    /(\d[\d,]*)\s*(?:\+\s*)?(?:customers?|clients?|enterprises?|businesses?|companies|organizations?)\b/gi,
    /(?:serves?\s+|serving\s+|working\s+with\s+|has\s+)(\d[\d,]*)\s*(?:\+\s*)?(?:customers?|clients?)/gi,
    /(?:customer|client)\s*(?:count|base)\s*(?:of|:)?\s*(?:over\s+|more\s+than\s+)?(\d[\d,]*)/gi,
  ];

  for (const pat of customerPatterns) {
    let m;
    const p = new RegExp(pat.source, pat.flags);
    while ((m = p.exec(text)) !== null) {
      const numStr = m[1] || m[2] || m[3];
      if (!numStr) continue;
      const val = parseInt(numStr.replace(/,/g, ''));
      if (val > 0 && val < 10_000_000) {
        const ctx = extractNarrowContext(text, m.index, m[0].length);
        if (SKIP_PATTERNS.some(sk => sk.test(ctx))) continue;
        mentions.push({
          type: METRIC_TYPES.CUSTOMERS,
          value: val,
          raw_text: m[0],
          context: ctx,
          confidence: 0.7,
          source_field: 'text',
        });
      }
    }
  }

  // ─── User count ───────────────────────────────────────────────────────
  const userPatterns = [
    /(\d[\d,]*)\s*(?:\+\s*)?(?:users?|active\s+users?|monthly\s+active|daily\s+active|mau|dau)\b/gi,
    /(?:users?|mau|dau)\s*(?:of|:)?\s*(?:over\s+|more\s+than\s+|reached?\s+)?(\d[\d,]*)/gi,
  ];

  for (const pat of userPatterns) {
    let m;
    const p = new RegExp(pat.source, pat.flags);
    while ((m = p.exec(text)) !== null) {
      const numStr = m[1] || m[2];
      if (!numStr) continue;
      let val = parseInt(numStr.replace(/,/g, ''));
      if (val > 0 && val < 1_000_000_000) {
        const ctx = extractNarrowContext(text, m.index, m[0].length);
        if (SKIP_PATTERNS.some(sk => sk.test(ctx))) continue;
        mentions.push({
          type: METRIC_TYPES.USERS,
          value: val,
          raw_text: m[0],
          context: ctx,
          confidence: 0.65,
          source_field: 'text',
        });
      }
    }
  }

  // ─── Runway (in months) ───────────────────────────────────────────────
  const runwayPatterns = [
    /(\d+)\s*(?:months?)\s*(?:of\s+)?runway/gi,
    /runway\s*(?:of|:)?\s*(\d+)\s*months?/gi,
  ];

  for (const pat of runwayPatterns) {
    let m;
    const p = new RegExp(pat.source, pat.flags);
    while ((m = p.exec(text)) !== null) {
      const numStr = m[1] || m[2];
      if (!numStr) continue;
      const val = parseInt(numStr);
      if (val > 0 && val < 120) {
        mentions.push({
          type: METRIC_TYPES.RUNWAY,
          value: val,
          raw_text: m[0],
          context: extractNarrowContext(text, m.index, m[0].length),
          confidence: 0.75,
          source_field: 'text',
        });
      }
    }
  }

  return mentions;
}

function extractNarrowContext(text, index, length) {
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + length + 80);
  return text.substring(start, end).replace(/\n/g, ' ').trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: DOLLAR METRIC EXTRACTION (Pass 1)
// ═══════════════════════════════════════════════════════════════════════════════

const AMOUNT_PATTERN = /(?:[\$€£₹₩₦₪]|A\$|C\$|S\$|N\$|HK\$|R\$)\s*([\d,.]+)\s*(M|B|K|T|million|billion|mn|bn|Cr|crore|crores|lakh|lakhs|thousand|trillion)?/gi;
const AMOUNT_PATTERN_PREFIX = /\b(USD|EUR|GBP|INR|AUD|CAD|SGD|CHF|SEK|NOK|JPY|KRW|CNY|HKD|AED|BRL|ZAR|MXN|ILS|QAR|KWD)\s*([\d,.]+)\s*(M|B|K|T|million|billion|mn|bn|Cr|crore|crores|lakh|lakhs)?/gi;

/**
 * Extract ALL dollar-amount metric mentions from a startup's text fields.
 * Returns array of MetricMention objects — each tagged with likely metric type.
 */
function extractDollarMetrics(startup) {
  const fields = [
    { name: 'description', text: startup.description || '', sourceType: 'description' },
    { name: 'pitch', text: startup.pitch || '', sourceType: 'pitch' },
    { name: 'tagline', text: startup.tagline || '', sourceType: 'tagline' },
  ];

  const mentions = [];

  for (const field of fields) {
    const text = field.text;
    if (!text || text.length < 10) continue;

    const allMatches = [];

    // Pattern 1: Currency symbol before amount ($250M)
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
      // Context: sentence-bounded
      const context = extractSentenceContext(text, am.index, am.fullMatch.length);

      // Skip TAM / market size / customer savings
      if (SKIP_PATTERNS.some(p => p.test(context))) continue;

      const amountValue = parseAmount(am.numStr, am.unit);
      if (amountValue <= 0) continue;

      const currency = am.currencyCode || detectCurrency(context);
      const fx = convertToUsd(amountValue, currency);
      if (fx.amount_usd === null) continue;

      // Classify what metric this is
      const classification = classifyMetricType(context, fx.amount_usd, am.fullMatch);
      if (!classification.type) continue;

      // ─── Source-based base confidence ──────────────────────────────────
      const baseConf = field.sourceType === 'pitch' ? 0.85
        : field.sourceType === 'description' ? 0.75
        : field.sourceType === 'tagline' ? 0.65
        : 0.6;

      // ─── Projection penalty ────────────────────────────────────────────
      let projMult = 1.0;
      for (const patt of PROJECTION_INDICATORS) {
        if (patt.test(context)) { projMult = 0.6; break; }
      }

      // ─── Strong phrase boost ───────────────────────────────────────────
      let strongBoost = 1.0;
      if (STRONG_FUNDING_PHRASE_RE.test(context) && (classification.type.startsWith('last_round') || classification.type === 'total_funding')) {
        strongBoost = 1.2;
      }
      if (STRONG_REVENUE_PHRASE_RE.test(context) && (classification.type === 'arr' || classification.type === 'revenue' || classification.type === 'mrr')) {
        strongBoost = 1.2;
      }
      if (STRONG_VALUATION_PHRASE_RE.test(context) && classification.type === 'valuation') {
        strongBoost = 1.25;
      }

      // ─── Currency penalty ──────────────────────────────────────────────
      const currMult = currency === 'USD' ? 1.0 : 0.9;

      let confidence = Math.min(1.0, baseConf * classification.confidence_mult * projMult * strongBoost * currMult);
      confidence = Math.round(confidence * 100) / 100;

      mentions.push({
        type: classification.type,
        round_type: classification.round_type,
        raw_text: am.fullMatch,
        amount_value: amountValue,
        amount_usd: fx.amount_usd,
        currency,
        context,
        confidence,
        source_field: field.name,
        is_projection: projMult < 1.0,
      });
    }
  }

  return mentions;
}

/**
 * Extract sentence-bounded context around a match position.
 */
function extractSentenceContext(text, matchIndex, matchLength) {
  let sentStart = matchIndex;
  let foundStart = false;
  for (let i = matchIndex - 1; i >= Math.max(0, matchIndex - 300); i--) {
    if ('.?!'.includes(text[i])) { sentStart = i + 1; foundStart = true; break; }
    if (i === Math.max(0, matchIndex - 300)) sentStart = i;
  }

  let sentEnd = matchIndex + matchLength;
  let foundEnd = false;
  for (let i = matchIndex + matchLength; i < Math.min(text.length, matchIndex + matchLength + 300); i++) {
    if ('.?!'.includes(text[i])) { sentEnd = i + 1; foundEnd = true; break; }
    if (i === Math.min(text.length, matchIndex + matchLength + 300) - 1) sentEnd = i + 1;
  }

  let context = text.substring(sentStart, sentEnd).replace(/\n/g, ' ').trim();

  // Only expand if no sentence boundaries were found (unstructured text)
  if (!foundStart && !foundEnd && context.length < 40) {
    const ctxStart = Math.max(0, matchIndex - 120);
    const ctxEnd = Math.min(text.length, matchIndex + matchLength + 120);
    context = text.substring(ctxStart, ctxEnd).replace(/\n/g, ' ').trim();
  }
  return context.substring(0, 500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: EXTRACTED_DATA METRICS (structured data from scraper)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract metrics from the extracted_data JSONB field.
 * These come from the scraper/enrichment pipeline — already partially parsed.
 * We treat these as mid-confidence structured data.
 */
function extractFromStructuredData(startup) {
  const ed = startup.extracted_data;
  if (!ed || typeof ed !== 'object') return [];

  const mentions = [];
  const baseConf = 0.7; // structured data is mid-confidence

  // ─── funding_amount (already parsed by scraper) ────────────────────────
  if (ed.funding_amount && typeof ed.funding_amount === 'number' && ed.funding_amount > 0) {
    let roundType = null;
    if (ed.funding_round || ed.funding_stage) {
      const raw = (ed.funding_round || ed.funding_stage || '').toLowerCase().replace(/\s+/g, ' ').trim();
      roundType = ROUND_TYPE_MAP[raw] || raw.replace(/[\s-]+/g, '_');
    }

    mentions.push({
      type: METRIC_TYPES.LAST_ROUND,
      round_type: roundType,
      raw_text: `extracted_data.funding_amount=${ed.funding_amount}`,
      amount_value: ed.funding_amount,
      amount_usd: ed.funding_amount, // assumed USD by scraper
      currency: 'USD',
      context: `Scraped funding: ${formatAmount(ed.funding_amount)} ${ed.funding_round || ''} ${ed.funding_stage || ''}`.trim(),
      confidence: roundType ? baseConf * 1.1 : baseConf,
      source_field: 'extracted_data',
      is_projection: false,
    });
  }

  // ─── raise (sometimes a string like "$5M") ────────────────────────────
  if (ed.raise && typeof ed.raise === 'string') {
    const raiseMatch = ed.raise.match(/\$?([\d,.]+)\s*(M|B|K|million|billion|mn|bn)?/i);
    if (raiseMatch) {
      const val = parseAmount(raiseMatch[1], raiseMatch[2]);
      if (val > 0) {
        mentions.push({
          type: METRIC_TYPES.LAST_ROUND,
          round_type: null,
          raw_text: `extracted_data.raise="${ed.raise}"`,
          amount_value: val,
          amount_usd: val,
          currency: 'USD',
          context: `Scraped raise field: ${ed.raise}`,
          confidence: baseConf * 0.9,
          source_field: 'extracted_data',
          is_projection: false,
        });
      }
    }
  }

  // ─── valuation ─────────────────────────────────────────────────────────
  if (ed.valuation && typeof ed.valuation === 'number' && ed.valuation > 0) {
    mentions.push({
      type: METRIC_TYPES.VALUATION,
      round_type: null,
      raw_text: `extracted_data.valuation=${ed.valuation}`,
      amount_value: ed.valuation,
      amount_usd: ed.valuation,
      currency: 'USD',
      context: `Scraped valuation: ${formatAmount(ed.valuation)}`,
      confidence: baseConf,
      source_field: 'extracted_data',
      is_projection: false,
    });
  }

  // ─── revenue ───────────────────────────────────────────────────────────
  if (ed.revenue && typeof ed.revenue === 'number' && ed.revenue > 0) {
    mentions.push({
      type: METRIC_TYPES.REVENUE,
      round_type: null,
      raw_text: `extracted_data.revenue=${ed.revenue}`,
      amount_value: ed.revenue,
      amount_usd: ed.revenue,
      currency: 'USD',
      context: `Scraped revenue: ${formatAmount(ed.revenue)}`,
      confidence: baseConf * 0.85,
      source_field: 'extracted_data',
      is_projection: false,
    });
  }

  // ─── ARR ───────────────────────────────────────────────────────────────
  if (ed.arr && typeof ed.arr === 'number' && ed.arr > 0) {
    mentions.push({
      type: METRIC_TYPES.ARR,
      round_type: null,
      raw_text: `extracted_data.arr=${ed.arr}`,
      amount_value: ed.arr,
      amount_usd: ed.arr,
      currency: 'USD',
      context: `Scraped ARR: ${formatAmount(ed.arr)}`,
      confidence: baseConf,
      source_field: 'extracted_data',
      is_projection: false,
    });
  }

  // ─── MRR ───────────────────────────────────────────────────────────────
  if (ed.mrr && typeof ed.mrr === 'number' && ed.mrr > 0) {
    mentions.push({
      type: METRIC_TYPES.MRR,
      round_type: null,
      raw_text: `extracted_data.mrr=${ed.mrr}`,
      amount_value: ed.mrr,
      amount_usd: ed.mrr,
      currency: 'USD',
      context: `Scraped MRR: ${formatAmount(ed.mrr)}`,
      confidence: baseConf,
      source_field: 'extracted_data',
      is_projection: false,
    });
  }

  // ─── market_size / marketSize → SKIP (TAM guardrail) ──────────────────
  // Intentionally NOT extracted — this is market data, not a startup metric

  // ─── Count metrics from extracted_data ─────────────────────────────────
  if (ed.team_size && typeof ed.team_size === 'number' && ed.team_size > 0) {
    mentions.push({
      type: METRIC_TYPES.HEADCOUNT,
      value: ed.team_size,
      raw_text: `extracted_data.team_size=${ed.team_size}`,
      context: `Scraped team size: ${ed.team_size}`,
      confidence: baseConf,
      source_field: 'extracted_data',
    });
  }

  if (ed.customer_count && typeof ed.customer_count === 'number' && ed.customer_count > 0) {
    mentions.push({
      type: METRIC_TYPES.CUSTOMERS,
      value: ed.customer_count,
      raw_text: `extracted_data.customer_count=${ed.customer_count}`,
      context: `Scraped customer count: ${ed.customer_count}`,
      confidence: baseConf,
      source_field: 'extracted_data',
    });
  }

  if (ed.active_users && typeof ed.active_users === 'number' && ed.active_users > 0) {
    mentions.push({
      type: METRIC_TYPES.USERS,
      value: ed.active_users,
      raw_text: `extracted_data.active_users=${ed.active_users}`,
      context: `Scraped active users: ${ed.active_users}`,
      confidence: baseConf * 0.9,
      source_field: 'extracted_data',
    });
  }

  return mentions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: DB FIELD EXTRACTION (existing columns)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract metrics from existing startup_uploads columns.
 * These columns were populated by earlier pipelines — they're reference data.
 */
function extractFromDbFields(startup) {
  const mentions = [];
  const baseConf = 0.65; // DB fields from older pipeline

  // ─── raise_amount column ───────────────────────────────────────────────
  if (startup.raise_amount && typeof startup.raise_amount === 'string') {
    const raiseMatch = startup.raise_amount.match(/\$?([\d,.]+)\s*(M|B|K|million|billion|mn|bn)?/i);
    if (raiseMatch) {
      const val = parseAmount(raiseMatch[1], raiseMatch[2]);
      if (val > 0) {
        let roundType = null;
        if (startup.raise_type) {
          const raw = startup.raise_type.toLowerCase().replace(/\s+/g, ' ').trim();
          roundType = ROUND_TYPE_MAP[raw] || raw.replace(/[\s-]+/g, '_');
        }
        mentions.push({
          type: METRIC_TYPES.LAST_ROUND,
          round_type: roundType,
          raw_text: `raise_amount="${startup.raise_amount}"`,
          amount_value: val,
          amount_usd: val,
          currency: 'USD',
          context: `DB raise_amount: ${startup.raise_amount} ${startup.raise_type || ''}`,
          confidence: baseConf,
          source_field: 'raise_amount',
          is_projection: false,
        });
      }
    }
  }

  // ─── latest_funding_amount ─────────────────────────────────────────────
  if (startup.latest_funding_amount && typeof startup.latest_funding_amount === 'number' && startup.latest_funding_amount > 0) {
    let roundType = null;
    if (startup.latest_funding_round) {
      const raw = startup.latest_funding_round.toLowerCase().replace(/\s+/g, ' ').trim();
      roundType = ROUND_TYPE_MAP[raw] || raw.replace(/[\s-]+/g, '_');
    }
    mentions.push({
      type: METRIC_TYPES.LAST_ROUND,
      round_type: roundType,
      raw_text: `latest_funding_amount=${startup.latest_funding_amount}`,
      amount_value: startup.latest_funding_amount,
      amount_usd: startup.latest_funding_amount,
      currency: 'USD',
      context: `DB latest funding: ${formatAmount(startup.latest_funding_amount)} ${startup.latest_funding_round || ''}`,
      confidence: baseConf * 1.1,
      source_field: 'latest_funding_amount',
      is_projection: false,
    });
  }

  // ─── revenue_annual ────────────────────────────────────────────────────
  if (startup.revenue_annual && typeof startup.revenue_annual === 'number' && startup.revenue_annual > 0) {
    mentions.push({
      type: METRIC_TYPES.REVENUE,
      round_type: null,
      raw_text: `revenue_annual=${startup.revenue_annual}`,
      amount_value: startup.revenue_annual,
      amount_usd: startup.revenue_annual,
      currency: 'USD',
      context: `DB revenue_annual: ${formatAmount(startup.revenue_annual)}`,
      confidence: baseConf,
      source_field: 'revenue_annual',
      is_projection: false,
    });
  }

  // ─── arr column ────────────────────────────────────────────────────────
  if (startup.arr && typeof startup.arr === 'number' && startup.arr > 0) {
    mentions.push({
      type: METRIC_TYPES.ARR,
      round_type: null,
      raw_text: `arr=${startup.arr}`,
      amount_value: startup.arr,
      amount_usd: startup.arr,
      currency: 'USD',
      context: `DB ARR: ${formatAmount(startup.arr)}`,
      confidence: baseConf,
      source_field: 'arr_column',
      is_projection: false,
    });
  }

  // ─── mrr column ────────────────────────────────────────────────────────
  if (startup.mrr && typeof startup.mrr === 'number' && startup.mrr > 0) {
    mentions.push({
      type: METRIC_TYPES.MRR,
      round_type: null,
      raw_text: `mrr=${startup.mrr}`,
      amount_value: startup.mrr,
      amount_usd: startup.mrr,
      currency: 'USD',
      context: `DB MRR: ${formatAmount(startup.mrr)}`,
      confidence: baseConf,
      source_field: 'mrr_column',
      is_projection: false,
    });
  }

  // ─── team_size_estimate / team_size ────────────────────────────────────
  const teamSize = startup.team_size_estimate || startup.team_size;
  if (teamSize && typeof teamSize === 'number' && teamSize > 0) {
    mentions.push({
      type: METRIC_TYPES.HEADCOUNT,
      value: teamSize,
      raw_text: `team_size=${teamSize}`,
      context: `DB team_size: ${teamSize}`,
      confidence: baseConf,
      source_field: 'team_size_column',
    });
  }

  // ─── customer_count ────────────────────────────────────────────────────
  if (startup.customer_count && typeof startup.customer_count === 'number' && startup.customer_count > 0) {
    mentions.push({
      type: METRIC_TYPES.CUSTOMERS,
      value: startup.customer_count,
      raw_text: `customer_count=${startup.customer_count}`,
      context: `DB customer_count: ${startup.customer_count}`,
      confidence: baseConf,
      source_field: 'customer_count_column',
    });
  }

  return mentions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: BEST MENTION SELECTION (Pass 2)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * For each metric type, select the "best" mention.
 * Precedence: confidence → recency → amount (higher generally more reliable fpr funding)
 *
 * @param {Array} mentions - All metric mentions
 * @returns {Object} Map of metric_type → best mention
 */

// Hard upper bounds — anything above these is almost certainly article noise
const PLAUSIBILITY_CAPS = {
  last_round_amount: 15e9,  // $15B — largest real round ever ~$13.8B (SpaceX)
  total_funding:     50e9,  // $50B cumulative
  valuation:         500e9, // $500B — only a handful of public cos exceed this
  arr:               50e9,
  revenue:           100e9,
  mrr:               5e9,
  gmv:               500e9,
  burn:              1e9,   // $1B/month burn — no startup burns this
};

function selectBestMentions(mentions) {
  if (!mentions || mentions.length === 0) return {};

  // Group by type
  const byType = {};
  for (const m of mentions) {
    if (!byType[m.type]) byType[m.type] = [];
    byType[m.type].push(m);
  }

  const best = {};
  for (const [type, typeMentions] of Object.entries(byType)) {
    // Filter out implausible amounts
    const cap = PLAUSIBILITY_CAPS[type];
    let plausible = cap
      ? typeMentions.filter(m => !m.amount_usd || m.amount_usd <= cap)
      : [...typeMentions];

    // Confidence-gated filter: extreme amounts need high confidence
    // $5B+ with conf < 0.5 is almost always article noise
    // $2B+ with conf < 0.7 is likely not a real startup round
    plausible = plausible.filter(m => {
      if (!m.amount_usd) return true;
      if (m.amount_usd >= 5e9) return m.confidence >= 0.5;
      if (m.amount_usd >= 2e9) return m.confidence >= 0.7;
      return true;
    });

    if (plausible.length === 0) continue; // all mentions were implausible

    // Sort: confidence desc → amount desc (for dollar metrics) / value desc (for counts)
    const sorted = [...plausible].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      // For dollar metrics, prefer higher confidence first, then higher amount
      if (a.amount_usd !== undefined) return (b.amount_usd || 0) - (a.amount_usd || 0);
      // For count metrics
      return (b.value || 0) - (a.value || 0);
    });
    best[type] = sorted[0];
  }

  return best;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the full startup metric parsing pipeline.
 *
 * @param {object} startup - Full startup row from DB
 * @returns {object} Parsed metrics ready for DB write
 */
function runStartupPipeline(startup) {
  // Pass 1: Extract ALL mentions from all sources
  const allMentions = [];

  // 1a: Dollar amounts from text fields
  const dollarMentions = extractDollarMetrics(startup);
  allMentions.push(...dollarMentions);

  // 1b: Count metrics from text fields  
  const allText = [startup.description, startup.pitch, startup.tagline].filter(Boolean).join(' ');
  const countMentions = extractCountMetrics(allText);
  allMentions.push(...countMentions);

  // 1c: Structured data from extracted_data JSONB
  const edMentions = extractFromStructuredData(startup);
  allMentions.push(...edMentions);

  // 1d: Existing DB fields
  const dbMentions = extractFromDbFields(startup);
  allMentions.push(...dbMentions);

  // Pass 2: Select best mention per metric type
  const best = selectBestMentions(allMentions);

  // Compute aggregate confidences
  const fundingTypes = [METRIC_TYPES.LAST_ROUND, METRIC_TYPES.TOTAL_FUNDING, METRIC_TYPES.VALUATION];
  const tractionTypes = [METRIC_TYPES.ARR, METRIC_TYPES.REVENUE, METRIC_TYPES.MRR, METRIC_TYPES.GMV, METRIC_TYPES.CUSTOMERS, METRIC_TYPES.USERS, METRIC_TYPES.HEADCOUNT];

  const fundingConfidences = fundingTypes.filter(t => best[t]).map(t => best[t].confidence);
  const tractionConfidences = tractionTypes.filter(t => best[t]).map(t => best[t].confidence);

  const avgFundingConf = fundingConfidences.length > 0
    ? Math.round((fundingConfidences.reduce((a, b) => a + b, 0) / fundingConfidences.length) * 100) / 100
    : 0;
  const avgTractionConf = tractionConfidences.length > 0
    ? Math.round((tractionConfidences.reduce((a, b) => a + b, 0) / tractionConfidences.length) * 100) / 100
    : 0;

  // Build result
  const result = {
    // Denormalized fields for fast DB queries
    last_round_amount_usd: best[METRIC_TYPES.LAST_ROUND]?.amount_usd || null,
    last_round_type: best[METRIC_TYPES.LAST_ROUND]?.round_type || null,
    total_funding_usd: best[METRIC_TYPES.TOTAL_FUNDING]?.amount_usd || null,
    valuation_usd: best[METRIC_TYPES.VALUATION]?.amount_usd || null,
    arr_usd: best[METRIC_TYPES.ARR]?.amount_usd || null,
    revenue_usd: best[METRIC_TYPES.REVENUE]?.amount_usd || null,
    burn_monthly_usd: best[METRIC_TYPES.BURN]?.amount_usd || null,
    runway_months: best[METRIC_TYPES.RUNWAY]?.value || null,
    parsed_headcount: best[METRIC_TYPES.HEADCOUNT]?.value || null,
    parsed_customers: best[METRIC_TYPES.CUSTOMERS]?.value || null,
    parsed_users: best[METRIC_TYPES.USERS]?.value || null,

    // Confidence scores
    funding_confidence: avgFundingConf,
    traction_confidence: avgTractionConf,

    // Full mention data for JSONB column
    startup_metrics: {
      version: 'v1',
      parsed_at: new Date().toISOString(),
      mentions_found: allMentions.length,
      best_mentions: Object.fromEntries(
        Object.entries(best).map(([type, mention]) => [type, {
          raw_text: mention.raw_text,
          amount_usd: mention.amount_usd || null,
          value: mention.value || null,
          confidence: mention.confidence,
          source_field: mention.source_field,
          context: (mention.context || '').substring(0, 200),
          round_type: mention.round_type || null,
          is_projection: mention.is_projection || false,
        }])
      ),
      // Raw mentions (capped at 20 to avoid huge JSONB)
      raw_mentions: allMentions.slice(0, 20).map(m => ({
        type: m.type,
        raw_text: m.raw_text,
        amount_usd: m.amount_usd || null,
        value: m.value || null,
        confidence: m.confidence,
        source_field: m.source_field,
      })),
    },

    metrics_version: 'v1',
    metrics_parsed_at: new Date().toISOString(),
  };

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: CLI / TEST MODE
// ═══════════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const testCases = [
    {
      name: 'Test: Basic raised',
      description: 'Anthropic Just Raised $30 Billion at a $380 Billion Valuation.',
      pitch: null,
      tagline: null,
      extracted_data: { funding_amount: 30000000000, valuation: 380000000000 },
    },
    {
      name: 'Test: Series A with round type',
      description: 'Mysa has raised USD 3.4 million in a pre-Series A round co-led by Blume Ventures.',
      pitch: null,
      tagline: null,
      extracted_data: { funding_amount: 3400000, funding_round: 'Series A' },
    },
    {
      name: 'Test: TAM should be skipped',
      description: 'The AI market is expected to reach $500 billion by 2030. We raised $5M seed.',
      pitch: null,
      tagline: null,
      extracted_data: null,
    },
    {
      name: 'Test: Revenue + ARR',
      description: 'The company has $10M ARR and growing 200% YoY. Revenue hit $12M last quarter.',
      pitch: null,
      tagline: null,
      extracted_data: { arr: 10000000 },
    },
    {
      name: 'Test: Team size + customers',
      description: 'With a team of 50 employees serving 200 enterprise customers, we raised $8M Series A.',
      pitch: null,
      tagline: null,
      extracted_data: { team_size: 45, customer_count: 180 },
    },
    {
      name: 'Test: GMV ≠ revenue',
      description: 'Our platform processes $100M GMV annually with $5M in revenue.',
      pitch: null,
      tagline: null,
      extracted_data: null,
    },
    {
      name: 'Test: Projection penalty',
      description: 'We expect to reach $50M ARR by 2027. Currently at $8M ARR.',
      pitch: 'AI-powered analytics platform',
      tagline: null,
      extracted_data: null,
    },
  ];

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  STARTUP METRIC PARSER v1 — Test Mode                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  for (const tc of testCases) {
    const result = runStartupPipeline(tc);
    console.log(`\n─── ${tc.name} ───`);
    console.log(`  Description: "${(tc.description || '').substring(0, 80)}..."`);
    console.log(`  Mentions found: ${result.startup_metrics.mentions_found}`);

    if (result.last_round_amount_usd) console.log(`  💰 Last Round: ${formatAmount(result.last_round_amount_usd)} (${result.last_round_type || 'unknown'}) conf=${result.funding_confidence}`);
    if (result.total_funding_usd) console.log(`  💰 Total Funding: ${formatAmount(result.total_funding_usd)}`);
    if (result.valuation_usd) console.log(`  📈 Valuation: ${formatAmount(result.valuation_usd)}`);
    if (result.arr_usd) console.log(`  📊 ARR: ${formatAmount(result.arr_usd)}`);
    if (result.revenue_usd) console.log(`  📊 Revenue: ${formatAmount(result.revenue_usd)}`);
    if (result.burn_monthly_usd) console.log(`  🔥 Burn: ${formatAmount(result.burn_monthly_usd)}/mo`);
    if (result.runway_months) console.log(`  ⏳ Runway: ${result.runway_months} months`);
    if (result.parsed_headcount) console.log(`  👥 Headcount: ${result.parsed_headcount}`);
    if (result.parsed_customers) console.log(`  🏢 Customers: ${result.parsed_customers}`);
    if (result.parsed_users) console.log(`  👤 Users: ${result.parsed_users}`);

    console.log(`  Funding Conf: ${result.funding_confidence}  Traction Conf: ${result.traction_confidence}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  runStartupPipeline,
  extractDollarMetrics,
  extractCountMetrics,
  extractFromStructuredData,
  extractFromDbFields,
  selectBestMentions,
  classifyMetricType,
  parseAmount,
  detectCurrency,
  convertToUsd,
  formatAmount,
  METRIC_TYPES,
  METRIC_CATEGORIES,
};
