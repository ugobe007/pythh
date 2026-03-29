/**
 * PYTHH SIGNAL DETECTOR — v3
 *
 * Scans text for colloquial phrases from the Pythh Signal Ontology and
 * returns a structured signal report with 11 weighted composite scores
 * and a master PYTHH_SCORE.
 *
 *   "opening up conversations"    →  FUNDRAISING / ACTIVELY_RAISING
 *   "exploring strategic options" →  ACQUISITION / SEEKING_ACQUIRER
 *   "rightsizing the team"        →  TROUBLE / LAYOFFS
 *
 * Scoring model:
 *   Each detected signal has a compound confidence (0–1) from
 *   anchor matching + multi-article corroboration. Composite scores
 *   are weighted dot products of (signal_confidence × explicit_weight),
 *   normalized to 0–100.
 *
 *   PYTHH_SCORE = 0.20*Momentum + 0.15*Talent + 0.15*Investor
 *              + 0.15*PMF + 0.10*Product + 0.10*Fundraising
 *              + 0.10*Sector + 0.05*Hype − 0.20*Distress
 *   (clamped to 0–100)
 *
 * Usage:
 *   const { detectSignals } = require('./signalDetector');
 *   const report = detectSignals(articles, startupName);
 *   // report.scores.pythh_score  — master intelligence score 0-100
 *   // report.scores.momentumScore, .fundraisingProbability, etc.
 */

'use strict';

const { ANCHOR_INDEX } = require('../../lib/signal-ontology');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const SNIPPET_WINDOW   = 120;   // chars of context around a match
const MIN_ANCHOR_LEN   = 8;     // ignore anchors shorter than this

// Category priority for PRIMARY signal selection (higher = surfaced first)
const CATEGORY_PRIORITY = {
  TROUBLE:                   10,
  DISTRESS_LANGUAGE:         10,
  ACQUISITION:               10,
  TALENT_OUTBOUND:            9,
  GITHUB_NEGATIVE:            9,
  COMPENSATION_NEGATIVE:      9,
  FOUNDER_PSYCHOLOGY_NEG:     9,
  HIRING_TROUBLE:             8,
  FUNDRAISING:                8,
  ROUND_DYNAMICS:             7,
  GOVT_GRANT:                 7,
  ACCELERATOR:                7,
  ROUND_STAGE:                6,
  INVESTOR_INTEREST:          6,
  INVESTOR_PASS:              5,
  HYPE_FOMO:                  5,
  PRESS_LANGUAGE:             4,
  TRACTION:                   4,
  GROWTH_METRICS:             4,
  CUSTOMER_ADOPTION:          4,
  PRODUCT_LAUNCH:             4,
  NEWSLETTER_MEDIA:           4,
  PATENT:                     4,
  CONFERENCE:                 3,
  PODCAST:                    3,
  HIRING_ROLE_SIGNAL:         3,
  HIRING_GROWTH:              3,
  TALENT_INBOUND:             3,
  INVESTOR_THESIS:            3,
  GITHUB_POSITIVE:            3,
  VC_BEHAVIOR:                3,
  UNIVERSITY_SPINOUT:         3,
  CUSTOMER_TRIAL:             2,
  COMPENSATION_POSITIVE:      2,
  FOUNDER_PSYCHOLOGY_POS:     2,
  VC_HIRING:                  2,
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL WEIGHTS — explicit contribution of each signal to each composite score
//
// Each signal listed below contributes (weight × detection_confidence) points
// to the named composite score. Positive weights add, negative weights subtract.
// The normalized result is scaled 0-100.
//
// Weight guide:
//   10 = defining signal for this score (e.g., DARPA award → deepTechScore)
//    7 = strong contributor
//    5 = moderate contributor
//    3 = supporting evidence
//   -N = penalty against this score
// ─────────────────────────────────────────────────────────────────────────────
const SCORE_WEIGHTS = {

  // ── Fundraising Probability ─────────────────────────────────────────────
  fundraisingProbability: {
    FUNDRAISE_PREP_HIRE:       10,   // CFO / IR / FP&A hire = preparing for round
    INVESTOR_DILIGENCE:        10,   // data room, diligence in progress
    INVESTOR_LEADING:          10,   // term sheet received
    ROUND_CLOSING:             10,   // last few spots / closing
    DEMO_DAY_HOT:              10,   // top of demo day = fundraise imminent
    ACTIVELY_RAISING:           8,   // explicit language
    DEMO_DAY:                   9,   // demo day window is open
    INBOUND_INTEREST:           8,   // lots of investor inbound
    DEFINITELY_RAISING:         9,   // "not raising but…"
    OVERSUBSCRIBED:             8,   // demand > supply
    RAISING_SOON:               6,   // "thinking about raising"
    REVENUE_GROWTH:             6,   // strong metrics = fundable
    GENERAL_HIRING:             5,   // hiring = growth = fundable
    GOVT_CONTRACT_REVENUE:      5,   // government contract = real revenue
    TIER1_COVERAGE:             4,   // press creates investor inbound
    VC_AI_THESIS:               5,   // VC entering sector → startups raise
    TOP_ACCELERATOR_ACCEPTANCE: 7,   // YC = guaranteed fundraise conversation
    FUNDRAISE_SENTIMENT:        5,   // "grateful for our investors"
    PARTNER_MEETING:            7,   // partner meeting = active process
    CONFERENCE_FUNDRAISING:     5,   // VC attention at booth
    // Penalties
    LAYOFFS:                  -10,
    EXTENSION_TROUBLE:         -6,
    FOUNDER_DEPARTURE:        -10,
    HIRING_FREEZE:             -6,
    SHUTDOWN:                 -15,
    CODED_DISTRESS:            -5,
  },

  // ── Momentum Score ──────────────────────────────────────────────────────
  momentumScore: {
    HYPERGROWTH_RATE:          10,   // quantitative hypergrowth = defining signal
    RETENTION_ENGAGEMENT:       9,   // strong retention = PMF + momentum
    REVENUE_GROWTH:             9,   // revenue growing = top momentum signal
    ENTERPRISE_SIGNAL:          8,   // enterprise deals = scaling
    ORGANIC_GROWTH:             8,   // word of mouth = best growth signal
    CLEVEL_HIRE:                8,   // exec hires = scaling
    ACTIVE_DEVELOPMENT:         8,   // active GitHub = product shipping
    BREAKOUT_SIGNAL:            8,   // viral / went viral
    STRONG_DEMAND:              7,   // waitlist, sold out
    PUBLIC_LAUNCH:              7,   // shipped a product
    BIG_PARTNERSHIP:            7,   // AWS/Salesforce partnership
    SALES_PUSH:                 6,   // hiring sales = revenue push
    GENERAL_HIRING:             6,   // hiring broadly
    CONFERENCE_RISING:          6,   // speaking / award at conference
    INFRA_SCALING:              6,   // scaling infra = usage growing
    TOP_ACCELERATOR_ACCEPTANCE: 8,   // YC/a16z = peer-validated momentum
    DEMO_DAY_HOT:               8,   // top of demo day
    TOP_PODCAST_APPEARANCE:     7,   // major podcast = visibility spike
    HOT_STARTUP_FRAMING:        7,   // "raised quietly", "hot startup" in media
    DEMAND_INDICATORS:          6,   // viral, sold out
    // Penalties
    LAYOFFS:                  -10,
    SHUTDOWN:                 -15,
    GROWTH_STALLED:            -7,
    RUNWAY_CONCERN:            -5,
  },

  // ── Product Velocity Score ──────────────────────────────────────────────
  productVelocityScore: {
    ACTIVE_DEVELOPMENT:         8,   // rapid commits = shipping fast
    DEVELOPER_ADOPTION:         7,   // stars, forks = real adoption
    PUBLIC_LAUNCH:              7,   // product is live
    PLATFORM_STRATEGY:          7,   // API / developer platform
    EXPANSION:                  6,   // v2.0, new product line
    ENTERPRISE_COMPLIANCE:      5,   // SOC2 / HIPAA = enterprise feature
    BIG_PARTNERSHIP:            6,   // AWS/GCP marketplace = distribution
    AI_PUSH:                    6,   // ML engineer hires = product investment
    INFRA_SCALING:              5,   // devops/SRE hiring = scaling product
    // Penalties
    DEAD_CODEBASE:            -10,
    STRUGGLING_PRODUCT:        -6,
    PIVOT:                     -5,
  },

  // ── Talent Magnet Score ─────────────────────────────────────────────────
  talentMagnetScore: {
    TOP_CO_ALUMNI:              9,   // ex-OpenAI/Stripe = strongest signal
    CLEVEL_HIRE:                9,   // C-suite hire = scaling + credibility
    PEOPLE_SCALING:             8,   // head of people = team growing fast
    COMPETITIVE_COMP:           7,   // above-market pay = talent war
    GENERAL_HIRING:             7,   // hiring broadly
    AI_PUSH:                    6,   // ML hires = technical talent magnet
    SENIOR_HIRE_MOMENTUM:       6,   // "joins from" notable companies
    INFRA_SCALING:              6,   // engineering depth growing
    LATE_STAGE_EQUITY:          7,   // RSUs / pre-IPO = attracting senior talent
    // Penalties
    FOUNDER_DEPARTURE:         -8,
    EXEC_DEPARTURE:            -8,
    MASS_EXODUS:               -9,
    HIRING_FREEZE:             -6,
    HEADCOUNT_REDUCTION:       -9,
    CASH_CONSTRAINED:          -7,
  },

  // ── Investor Interest Score ─────────────────────────────────────────────
  investorInterestScore: {
    INVESTOR_DILIGENCE:        10,   // diligence = very serious
    INVESTOR_LEADING:          10,   // term sheet / preempt = closing
    PARTNER_MEETING:            9,   // partner meeting = serious
    OVERSUBSCRIBED:             9,   // oversubscribed = hot deal
    INVESTOR_SOCIAL_PROOF:      8,   // "who else is in?" = momentum
    FAST_FOLLOW:                8,   // fast follow = very hot
    INBOUND_INTEREST:           7,   // lots of investor inbound
    HOT_ROUND:                  8,   // "hot round" language
    VC_HIGH_CONVICTION:         8,   // preempt offer = conviction
    DEMO_DAY_HOT:               6,   // VCs at demo day
    CONFERENCE_FUNDRAISING:     6,   // VCs at booth
    INVESTOR_WATCHING:          4,   // investor commenting on posts
    ACTIVELY_LOOKING:           5,   // VC actively sourcing
    TIER1_COVERAGE:             4,   // press creates investor pipeline
    // Penalties
    SOFT_PASS:                 -5,
    CONCERNS:                  -4,
  },

  // ── Market Hype Score ───────────────────────────────────────────────────
  hypeScore: {
    HOT_STARTUP_FRAMING:        8,   // "raised quietly", "top VCs competed"
    OVERSUBSCRIBED:             9,   // oversubscribed = maximum hype
    BREAKOUT_SIGNAL:            8,   // went viral, product hunt #1
    HYPE_LANGUAGE:              6,   // "unicorn potential", "disrupting"
    TIER1_COVERAGE:             7,   // The Information, Axios = hype amplifier
    TOP_PODCAST_APPEARANCE:     7,   // All-In / 20VC = hype
    CONFERENCE_RISING:          6,   // keynote = buzz
    VC_HIGH_CONVICTION:         7,   // preempt = competitive = hype
    DEMO_DAY_HOT:               7,   // top of demo day
    PODCAST_MOMENTUM_SIGNAL:    6,   // same startup on multiple shows
    MAJOR_TECH_CONFERENCE:      5,   // presence at major conference
    HOT_ROUND:                  8,   // "competitive round"
  },

  // ── Distress Score ──────────────────────────────────────────────────────
  distressScore: {
    LAYOFFS:                   10,
    FOUNDER_DEPARTURE:         10,
    SHUTDOWN:                  10,
    SEEKING_ACQUIRER:          10,   // "exploring strategic options"
    CODED_DISTRESS:             8,
    HEADCOUNT_REDUCTION:        9,
    SALARY_CUTS:                9,   // below market / offer rescinded
    CASH_CONSTRAINED:           9,
    TALENT_EXODUS:              8,
    EXEC_DEPARTURE:             8,
    SHUTDOWN_IMMINENT:          9,
    RESTRUCTURING:              9,   // maps to LAYOFFS signal
    RUNWAY_CONCERN:             7,
    GROWTH_STALLED:             7,
    NEGATIVE_PRESS:             7,
    DOWN_ROUND_RISK:            8,
    EXTENSION_TROUBLE:          6,   // bridge / extension round
    HIRING_FREEZE:              6,
    SOMETHING_FAILED:           6,
    PIVOT:                      5,   // pivot often signals original idea failed
  },

  // ── Acquisition Score ───────────────────────────────────────────────────
  acquisitionScore: {
    SEEKING_ACQUIRER:          10,   // "exploring strategic options"
    SOFT_LANDING:               9,   // acqui-hire / joining forces
    ACQUIRED:                  10,   // already acquired
    ACQUISITION_PREP_HIRE:      8,   // hiring corp dev = acquisitions coming
    CORPORATE_INTEREST:         7,   // strategic investor = potential acquirer
    ENTERPRISE_DEAL:            7,   // enterprise → acquisition path
    BIG_PARTNERSHIP:            8,   // AWS / Salesforce partnership = M&A pipeline
    PATENT_MOMENTUM:            6,   // strong IP = acquisition target
    REVENUE_GROWTH:             6,   // growing revenue = attractive target
    TALENT_EXODUS:              6,   // key people leaving → acqui-hire possible
    SHUTDOWN_IMMINENT:          8,   // shutdown → soft landing / acqui-hire
    TIER1_COVERAGE:             5,   // "could be an acquisition target" in press
  },

  // ── PMF Score ───────────────────────────────────────────────────────────
  pmfScore: {
    RETENTION_ENGAGEMENT:      10,   // strong retention = product-market fit
    STRONG_PMF:                 9,   // "mission critical", "rolled out company-wide"
    ORGANIC_GROWTH:             9,   // word of mouth = PMF signal
    ENTERPRISE_DEAL:            9,   // multi-year enterprise = strong PMF
    SOCIAL_PROOF:               7,   // case study / testimonial
    ENTERPRISE_SIGNAL:          8,   // enterprise pilots → deal
    DEMAND_INDICATORS:          6,   // sold out, waitlist
    STRONG_DEMAND:              7,   // supply constrained
    COMMUNITY:                  7,   // developer / user community
    // Penalties
    CUSTOMER_TRIAL:             3,   // still a trial = weak PMF only
    PIVOT_INCOMING:            -5,
    PIVOT:                     -6,
  },

  // ── Sector Heat Score ───────────────────────────────────────────────────
  sectorHeatScore: {
    VC_HIGH_CONVICTION:         9,   // VCs preempting deals in sector
    VC_ENTERING_SECTOR:         6,   // VC publishing market map / thesis
    VC_ACTIVELY_SOURCING:       6,   // VCs tweeting, hosting office hours
    VC_AI_THESIS:               8,   // VC hiring domain partner = sector thesis
    DOMAIN_CONFERENCE:          5,   // NeurIPS, ICML, RSA, etc.
    TIER1_COVERAGE:             7,   // The Information, Axios writing about sector
    HOT_STARTUP_FRAMING:        7,   // media calling companies hot
    DEMO_DAY_HOT:               7,   // top of demo day = sector validation
    THESIS_FORMING:             6,   // VCs articulating thesis
    INVESTOR_THESIS_FORMING:    6,   // (alias)
    ACQUIRED:                   9,   // big exit in sector = validation
    BREAKOUT_SIGNAL:            8,   // viral company = sector heat
    TOP_ACCELERATOR_ACCEPTANCE: 6,   // YC batch in sector = sector validated
    HYPE_LANGUAGE:              5,   // "category defining" in press
    NEW_FUND:                   8,   // VC raising new fund focused on sector
  },

  // ── Deep Tech Score ─────────────────────────────────────────────────────
  deepTechScore: {
    DARPA_DOD:                 10,   // DARPA = highest bar, strongest signal
    PATENT_DEEP_TECH:           9,   // patents in AI, robotics, semiconductors
    PATENT_GLOBAL:              9,   // patents across multiple jurisdictions (US + EU + PCT)
    PATENT_MOMENTUM:            8,   // growing citation count
    SBIR_STTR:                  8,   // SBIR Phase II = science validated
    NIH_BIOTECH:                8,   // NIH = peer-reviewed biotech
    ENERGY_GRANT:               8,   // DOE / ARPA-E = energy deep tech
    PATENT_FILED:               7,   // any patent = real technology
    GOVT_CONTRACT_REVENUE:      7,   // government contract = real revenue + trust
    GRANTS_GOV_AWARD:           7,   // Grants.gov listed grant = federal validation
    RESEARCH_ORIGIN:            7,   // "based on research from..."
    TOP_UNIVERSITY_ORIGIN:      7,   // MIT / Stanford / ETH origin
    ACADEMIC_FUNDING:           6,   // NSF, NIH, DARPA in research phase
  },

  // ── Visibility Score ────────────────────────────────────────────────────
  visibilityScore: {
    TIER1_COVERAGE:             8,   // The Information, Axios, Bloomberg
    HOT_STARTUP_FRAMING:        8,   // "raised quietly", "serial founder"
    FOUNDER_CREDIBILITY:        7,   // media covering founder pedigree
    TOP_PODCAST_APPEARANCE:     7,   // All-In, 20VC, Latent Space
    PODCAST_MOMENTUM_SIGNAL:    6,   // on multiple shows
    CONFERENCE_RISING:          6,   // keynote, award
    CONFERENCE_FUNDRAISING:     5,   // VC booth attention
    MAJOR_TECH_CONFERENCE:      5,   // TechCrunch Disrupt, Web Summit
    DOMAIN_CONFERENCE:          5,   // NeurIPS, RSA, Money20/20
    STRONG_PRESS_SIGNAL:        5,   // "successfully raised", "led by top VC"
  },
};

// Precompute normalization ceiling for each composite score.
//
// We normalize against the SUM OF THE TOP 5 POSITIVE WEIGHTS rather than
// the theoretical all-signals-firing maximum. Rationale: a strong company
// realistically fires 4-6 signals per score category — not all of them.
// Using top-5 means:
//   · Hitting 5 key signals at full confidence  → score of ~100
//   · Hitting 3 strong signals                  → score of ~60-75
//   · Hitting 1-2 signals                       → score of ~20-40
// This produces the 0-100 distribution users expect.
const SCORE_MAX = {};
for (const [scoreName, weights] of Object.entries(SCORE_WEIGHTS)) {
  SCORE_MAX[scoreName] = Object.values(weights)
    .filter(w => w > 0)
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((a, b) => a + b, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER PYTHH_SCORE FORMULA
//
// Weighted composite of all individual scores minus distress penalty.
// Scores are 0-100 so the result is also 0-100 (clamped).
//
// Weights chosen to prioritize forward-looking growth signals over hype.
// ─────────────────────────────────────────────────────────────────────────────
const PYTHH_FORMULA = {
  momentumScore:            0.20,
  talentMagnetScore:        0.15,
  investorInterestScore:    0.15,
  pmfScore:                 0.15,
  productVelocityScore:     0.10,
  fundraisingProbability:   0.10,
  sectorHeatScore:          0.10,
  hypeScore:                0.05,
  distressScore:           -0.20,  // penalty
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL DECAY — half-lives in days per category
//
// Older signals should contribute less. A hiring signal from 18 months ago
// is largely irrelevant. A DARPA contract from 3 years ago still matters.
//
// Decay formula: effectiveStrength = strength × 2^(−age_days / halfLife)
// A signal at exactly its half-life age contributes 50% of its base strength.
// ─────────────────────────────────────────────────────────────────────────────
const SIGNAL_HALF_LIVES = {
  // Fast decay — ephemeral market signals
  HYPE_FOMO:              30,
  ROUND_DYNAMICS:         45,
  INVESTOR_PASS:          60,

  // Medium decay — hiring and investor signals
  HIRING_GROWTH:          60,
  HIRING_ROLE_SIGNAL:     60,
  HIRING_TROUBLE:         90,
  FUNDRAISING:            90,
  INVESTOR_INTEREST:      60,
  INVESTOR_THESIS:        90,
  TALENT_INBOUND:         90,
  TALENT_OUTBOUND:        120,
  COMPENSATION_POSITIVE:  90,
  COMPENSATION_NEGATIVE:  90,
  FOUNDER_PSYCHOLOGY_POS: 60,
  FOUNDER_PSYCHOLOGY_NEG: 90,

  // Slow decay — product and traction signals
  TRACTION:               180,
  GROWTH_METRICS:         120,
  CUSTOMER_ADOPTION:      180,
  CUSTOMER_TRIAL:         90,
  PRODUCT_LAUNCH:         120,
  GITHUB_POSITIVE:        90,
  GITHUB_NEGATIVE:        180,
  PRESS_LANGUAGE:         90,
  NEWSLETTER_MEDIA:       90,
  CONFERENCE:             90,
  PODCAST:                90,

  // Very slow decay — structural signals that persist
  TROUBLE:                180,
  DISTRESS_LANGUAGE:      180,
  ACQUISITION:            365,
  ROUND_STAGE:            365,
  VC_HIRING:              180,
  VC_BEHAVIOR:            120,
  ACCELERATOR:            365,
  UNIVERSITY_SPINOUT:     999,  // essentially permanent
  PATENT:                 999,  // patents persist indefinitely
  PATENT_GLOBAL:          999,  // multi-jurisdiction patents persist indefinitely
  GOVT_GRANT:             730,
  GRANTS_GOV_AWARD:       730,  // Grants.gov awards persist like other gov grants
};

const DEFAULT_HALF_LIFE = 120; // days — fallback for unlisted categories

/**
 * Apply time-based decay to a signal strength.
 * If detectedAt is not provided, no decay is applied (assume current).
 *
 * @param {number} strength — base strength 0-1
 * @param {string} category — signal category (used for half-life lookup)
 * @param {number} [detectedAt] — Unix timestamp ms when signal was detected
 * @returns {number} effective strength after decay
 */
function applyDecay(strength, category, detectedAt) {
  if (!detectedAt) return strength;
  const ageDays    = (Date.now() - detectedAt) / 86_400_000;
  const halfLife   = SIGNAL_HALF_LIVES[category] || DEFAULT_HALF_LIFE;
  const decayFactor = Math.pow(2, -ageDays / halfLife);
  return strength * decayFactor;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT DETECTOR
//
// Identifies contradictory signal combinations that real intelligence
// platforms flag rather than silently ignoring. Returns an array of
// conflict objects: { type, description, signals }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check for contradictory score combinations and return conflict flags.
 *
 * @param {Object} scores — all composite scores 0-100
 * @returns {Array<{type, description, confidence}>}
 */
function detectConflicts(scores) {
  const conflicts = [];

  // Extension/bridge round context — "raising" but distressed
  if (scores.fundraisingProbability > 55 && scores.distressScore > 55) {
    conflicts.push({
      type:        'EXTENSION_ROUND_CONTEXT',
      description: 'Company appears to be raising while in distress — likely a bridge or extension round, not a growth raise',
      confidence:  Math.round((scores.fundraisingProbability + scores.distressScore) / 2),
    });
  }

  // Hot acquisition target — momentum + acquisition interest
  if (scores.acquisitionScore > 60 && scores.momentumScore > 65) {
    conflicts.push({
      type:        'STRATEGIC_HOT_TARGET',
      description: 'High momentum + high acquisition signals — company may be an attractive strategic acquisition target, not a distress sale',
      confidence:  Math.round((scores.acquisitionScore + scores.momentumScore) / 2),
    });
  }

  // Stealth competitor forming — talent leaving + new company signals
  if (scores.talentMagnetScore < 20 && scores.acquisitionScore > 50) {
    conflicts.push({
      type:        'TALENT_EXODUS_EXIT',
      description: 'Key talent leaving while M&A signals are elevated — likely acqui-hire or talent exodus before shutdown',
      confidence:  Math.round((100 - scores.talentMagnetScore + scores.acquisitionScore) / 2),
    });
  }

  // Hype vs. distress contradiction
  if (scores.hypeScore > 70 && scores.distressScore > 60) {
    conflicts.push({
      type:        'HYPE_DISTRESS_MISMATCH',
      description: 'High hype with significant distress signals — possible narrative management or down round being spun positively',
      confidence:  Math.round((scores.hypeScore + scores.distressScore) / 2),
    });
  }

  // Fundraise probability high but no investor interest
  if (scores.fundraisingProbability > 70 && scores.investorInterestScore < 20) {
    conflicts.push({
      type:        'FUNDRAISE_NO_INVESTOR_SIGNAL',
      description: 'Founder is signaling a raise but no corresponding investor activity detected — early in process or struggling to get meetings',
      confidence:  Math.round(scores.fundraisingProbability * 0.7),
    });
  }

  return conflicts;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function scanText(text) {
  if (!text || typeof text !== 'string') return [];
  const lower   = text.toLowerCase();
  const matches = [];

  for (const entry of ANCHOR_INDEX) {
    if (entry.anchor.length < MIN_ANCHOR_LEN) continue;
    const idx = lower.indexOf(entry.anchor);
    if (idx === -1) continue;

    const start   = Math.max(0, idx - SNIPPET_WINDOW);
    const end     = Math.min(text.length, idx + entry.anchor.length + SNIPPET_WINDOW);
    const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();

    matches.push({
      signal:   entry.signal,
      category: entry.category,
      meaning:  entry.meaning,
      strength: entry.strength,
      anchor:   entry.anchor,
      snippet,
    });
  }
  return matches;
}

/**
 * Aggregate raw matches into a per-signal map with compound confidence scores.
 *
 * Compound rule: confidence = baseStrength × √(matchCount), capped at 0.99.
 * Seeing the same signal in multiple articles increases confidence with
 * diminishing returns — corroboration matters, spam doesn't.
 *
 * Time decay is applied to the effective score: older signals contribute less.
 * A signal at half-life age contributes 50% of its compound score.
 */
function aggregate(rawMatches) {
  const bySignal = {};

  for (const m of rawMatches) {
    if (!bySignal[m.signal]) {
      bySignal[m.signal] = {
        signal:      m.signal,
        category:    m.category,
        meaning:     m.meaning || '',
        count:       0,
        maxStrength: 0,
        detectedAt:  m.detectedAt || null,
        source:      m.source    || 'news',
        evidence:    m.evidence  || null,
        snippets:    [],
      };
    }
    const entry = bySignal[m.signal];
    entry.count++;
    // Keep the highest strength; keep the most recent detectedAt
    if (m.strength > entry.maxStrength) {
      entry.maxStrength = m.strength;
    }
    if (m.detectedAt && (!entry.detectedAt || m.detectedAt > entry.detectedAt)) {
      entry.detectedAt = m.detectedAt;
    }
    if (m.snippet && entry.snippets.length < 3) entry.snippets.push(m.snippet);
    if (m.evidence && !entry.evidence) entry.evidence = m.evidence;
  }

  for (const entry of Object.values(bySignal)) {
    const raw          = Math.min(0.99, entry.maxStrength * Math.sqrt(entry.count));
    entry.rawScore     = raw;
    // Apply temporal decay using the signal's detectedAt timestamp
    entry.score        = applyDecay(raw, entry.category, entry.detectedAt);
  }

  return bySignal;
}

/**
 * Select the primary signal — the single most important thing happening
 * to this company, surfaced by category priority then score.
 */
function selectPrimary(bySignal) {
  let best = null;
  for (const entry of Object.values(bySignal)) {
    const p = CATEGORY_PRIORITY[entry.category] || 0;
    if (!best ||
        p > (CATEGORY_PRIORITY[best.category] || 0) ||
        (p === (CATEGORY_PRIORITY[best.category] || 0) && entry.score > best.score)) {
      best = entry;
    }
  }
  return best;
}

/**
 * Build all composite scores using explicit weighted accumulation.
 *
 * For each composite score:
 *   raw = Σ (signalWeight × signalConfidence) for all detected signals
 *   normalized = clamp(raw / maxPossiblePositive × 100, 0, 100)
 *
 * All scores are integers 0–100.
 *
 * ┌────────────────────────┬──────────────────────────────────────────────────┐
 * │ fundraisingProbability │ Likelihood company raises soon                   │
 * │ momentumScore          │ Company accelerating                             │
 * │ productVelocityScore   │ Product improving fast                           │
 * │ talentMagnetScore      │ Talent magnet vs. talent loss                    │
 * │ investorInterestScore  │ VCs circling                                     │
 * │ hypeScore              │ Media / Twitter heat                             │
 * │ distressScore          │ Risk — higher = worse                            │
 * │ acquisitionScore       │ Likely M&A target or imminent exit               │
 * │ pmfScore               │ Product-market fit depth                         │
 * │ sectorHeatScore        │ Sector getting hot — upstream funding signal     │
 * │ deepTechScore          │ IP, patents, grants, university origin           │
 * │ visibilityScore        │ Earned media, conferences, podcasts              │
 * │ pythh_score            │ MASTER — Pythh Intelligence Score 0-100          │
 * └────────────────────────┴──────────────────────────────────────────────────┘
 */
function buildScores(bySignal) {
  const scores = {};

  // Compute each composite score
  for (const [scoreName, weights] of Object.entries(SCORE_WEIGHTS)) {
    let raw = 0;
    for (const [signal, weight] of Object.entries(weights)) {
      const confidence = bySignal[signal]?.score || 0;
      raw += weight * confidence;
    }
    const maxPositive = SCORE_MAX[scoreName] || 1;
    const normalized  = Math.max(0, Math.min(100, (raw / maxPositive) * 100));
    scores[scoreName] = Math.round(normalized);
  }

  // Compute PYTHH_SCORE master formula
  let pythhRaw = 0;
  for (const [scoreName, weight] of Object.entries(PYTHH_FORMULA)) {
    pythhRaw += weight * (scores[scoreName] || 0);
  }
  scores.pythh_score = Math.max(0, Math.min(100, Math.round(pythhRaw)));

  return scores;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZERO SCORES — returned when no articles are provided
// ─────────────────────────────────────────────────────────────────────────────
const ZERO_SCORES = Object.fromEntries([
  ...Object.keys(SCORE_WEIGHTS).map(k => [k, 0]),
  ['pythh_score', 0],
]);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point.
 *
 * Accepts both:
 *   (a) articles — raw text scanned for anchor phrases (existing behavior)
 *   (b) prebuiltSignals — structured signals from data sources (GitHub, patents,
 *       grants, LinkedIn jobs) that bypass text scanning and go directly into
 *       the aggregation and scoring pipeline.
 *
 * @param {Array<{title, content, link, pubDate, source}>} articles
 * @param {string} [startupName] — company name for context
 * @param {Object} [opts]
 * @param {Array<SignalResult>} [opts.prebuiltSignals] — signals from data sources
 * @returns {{
 *   signals:       Array    — detected signals sorted by effective score desc
 *   primarySignal: Object   — the most important single signal
 *   scores:        Object   — all composite scores (0-100) + pythh_score
 *   conflicts:     Array    — contradictory signal combinations flagged
 *   articleCount:  number
 *   matchCount:    number
 * }}
 */
function detectSignals(articles, startupName = '', opts = {}) {
  const { prebuiltSignals = [] } = opts;

  if ((!articles || articles.length === 0) && prebuiltSignals.length === 0) {
    return { signals: [], primarySignal: null, scores: ZERO_SCORES, conflicts: [], articleCount: 0, matchCount: 0 };
  }

  // --- Text-based matching from articles ---
  const textMatches = [];
  for (const article of (articles || [])) {
    const text       = `${article.title || ''} ${article.content || ''}`;
    const pubMs      = article.pubDate ? new Date(article.pubDate).getTime() : null;
    const raw        = scanText(text);
    // Attach publication timestamp to each text match for decay
    for (const m of raw) {
      m.detectedAt = pubMs || Date.now();
      m.source     = article.source || 'news';
    }
    textMatches.push(...raw);
  }

  // --- Prebuilt signals from data sources ---
  // Convert to the same shape as raw text matches so aggregate() handles both.
  const prebuiltMatches = prebuiltSignals.map(s => ({
    signal:     s.signal,
    category:   s.category,
    meaning:    s.meaning  || '',
    strength:   s.strength || 0.70,
    detectedAt: s.detectedAt || Date.now(),
    source:     s.source   || 'external',
    evidence:   s.evidence || null,
    anchor:     s.signal,   // synthetic anchor for compat
    snippet:    s.evidence  || '',
  }));

  const allMatches = [...textMatches, ...prebuiltMatches];
  const bySignal   = aggregate(allMatches);
  const signals    = Object.values(bySignal).sort((a, b) => b.score - a.score);
  const primary    = selectPrimary(bySignal);
  const scores     = buildScores(bySignal);
  const conflicts  = detectConflicts(scores);

  return {
    signals,
    primarySignal: primary,
    scores,
    conflicts,
    articleCount: (articles || []).length,
    matchCount:   allMatches.length,
  };
}

/**
 * Format a signal report for console output.
 * All scores displayed as 0-100 integers.
 */
function formatSignalReport(report) {
  if (!report || report.signals.length === 0) return '  (no signals detected)';
  const lines = [];
  const sc = report.scores;

  if (report.primarySignal) {
    lines.push(
      `  PRIMARY  [${report.primarySignal.category}] ${report.primarySignal.signal}` +
      ` — ${report.primarySignal.meaning}`
    );
  }

  lines.push(`  ┌─ PYTHH SCORE: ${String(sc.pythh_score).padStart(3)} / 100`);
  lines.push(
    `  │  raise:${String(sc.fundraisingProbability).padStart(3)}` +
    `  momentum:${String(sc.momentumScore).padStart(3)}` +
    `  pmf:${String(sc.pmfScore).padStart(3)}` +
    `  talent:${String(sc.talentMagnetScore).padStart(3)}` +
    `  product:${String(sc.productVelocityScore).padStart(3)}`
  );
  lines.push(
    `  └  distress:${String(sc.distressScore).padStart(3)}` +
    `  investor:${String(sc.investorInterestScore).padStart(3)}` +
    `  hype:${String(sc.hypeScore).padStart(3)}` +
    `  sector:${String(sc.sectorHeatScore).padStart(3)}` +
    `  acq:${String(sc.acquisitionScore).padStart(3)}` +
    `  deeptech:${String(sc.deepTechScore).padStart(3)}`
  );

  for (const s of report.signals.slice(0, 6)) {
    const src   = s.source ? ` [${s.source}]` : '';
    const decay = s.rawScore && s.rawScore !== s.score
      ? ` (raw ${(s.rawScore * 100).toFixed(0)}% → decayed ${(s.score * 100).toFixed(0)}%)`
      : ` → ${(s.score * 100).toFixed(0)}%`;
    lines.push(`  · [${s.category}] ${s.signal} ×${s.count}${decay}${src}`);
  }
  if (report.conflicts && report.conflicts.length > 0) {
    lines.push('  ⚠ CONFLICTS:');
    for (const c of report.conflicts) {
      lines.push(`    ${c.type} (${c.confidence}%) — ${c.description}`);
    }
  }
  return lines.join('\n');
}

module.exports = {
  detectSignals,
  formatSignalReport,
  detectConflicts,
  applyDecay,
  SCORE_WEIGHTS,
  PYTHH_FORMULA,
  SIGNAL_HALF_LIVES,
};
