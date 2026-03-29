'use strict';

/**
 * Pythh Signal Parser
 *
 * Converts raw startup / investor / founder text into structured signal objects.
 *
 * Architecture:
 *   raw text
 *     → signal grammar parse   (actor / action / object / modality / ...)
 *     → functional tags        (signal_classes, posture, intent, context)
 *     → strategic inference    (inferred_meanings)
 *     → confidence score       (0.0 – 1.0)
 *
 * The sentence is not the product.
 * The interpreted strategic signal is the product.
 *
 * @example
 *   const { parseSignal } = require('./signalParser');
 *   const s = parseSignal("We're aggressively hiring senior enterprise sales leaders.");
 *   // s.primary_signal  → 'hiring_signal'
 *   // s.confidence      → 0.92
 *   // s.inferred_meanings → ['team_expansion', 'hypergrowth_posture', 'enterprise_gtm_build']
 */

const {
  ACTOR_PATTERNS,
  ACTION_MAP,
  MODALITY_MAP,
  INTENSITY_MAP,
  POSTURE_MAP,
  TIME_MAP,
  CONTEXT_MAP,
  INTENT_MAP,
  OBJECT_KEYWORDS,
  DESCRIPTOR_KEYWORDS,
  SIGNAL_CLASS_PRIORITY,
  CERTAINTY_WEIGHTS,
  WHO_CARES_MAP,
  SIGNAL_TYPE_MAP,
  INFERENCE_MAP,
  // Ambiguity layer
  NEGATION_PATTERNS,
  HEDGING_VOCAB,
  PROMOTIONAL_PHRASES,
  BOILERPLATE_PHRASES,
  REPORTED_SPEECH_PATTERNS,
  RUMOR_PATTERNS,
  EVIDENCE_QUALITY,
  CONFLICT_PAIRS,
  TIME_BUCKET,
} = require('./signalOntology');

// Pre-compile all regex patterns once at load time for performance
const _ACTION_RE   = ACTION_MAP.map(([p, m])  => [new RegExp(p, 'i'), m]);
const _MODALITY_RE = MODALITY_MAP;   // already RegExp
const _POSTURE_RE  = POSTURE_MAP;    // already RegExp
const _TIME_RE     = TIME_MAP;       // already RegExp
const _INTENT_RE   = INTENT_MAP.map(([p, m]) => [p instanceof RegExp ? p : new RegExp(p, 'i'), m]);

// ─── AMBIGUITY DETECTION SUITE ────────────────────────────────────────────────

/** Detect explicit negation around signal verbs — suppresses or inverts signals */
function detectNegation(text) {
  return NEGATION_PATTERNS.some(p => p.test(text));
}

/** Return list of hedging words present — weakens modality & confidence */
function detectHedges(text) {
  const lower = text.toLowerCase();
  return HEDGING_VOCAB.filter(h => lower.includes(h));
}

/** True if sentence is PR fluff with no operational action */
function detectPromotional(text) {
  const lower = text.toLowerCase();
  return PROMOTIONAL_PHRASES.some(p => lower.includes(p));
}

/** True if sentence is evergreen boilerplate (fake hiring/growth signal) */
function detectBoilerplate(text) {
  const lower = text.toLowerCase();
  return BOILERPLATE_PHRASES.some(p => lower.includes(p));
}

/** True if sentence contains second-hand attribution (reduces certainty) */
function detectReportedSpeech(text) {
  return REPORTED_SPEECH_PATTERNS.some(p => p.test(text));
}

/** True if sentence contains rumor/speculative journalism language */
function detectRumor(text) {
  return RUMOR_PATTERNS.some(p => p.test(text));
}

/**
 * Attribution type — what kind of source is making the claim?
 * Drives confidence: direct > reported > rumor > anonymous
 */
function detectAttributionType(text) {
  if (detectRumor(text))           return 'rumor';
  if (detectReportedSpeech(text))  return 'reported';
  // first-person actor = direct statement
  if (/\b(we|our team|i am|i.?m|the company)\b/i.test(text)) return 'direct';
  return 'indirect';
}

/**
 * Detect genuine signal tension — when two opposing signals coexist.
 * "Reducing burn but aggressively hiring sales" = real strategic pattern.
 * Do NOT collapse this contradiction. Preserve it as signal_tension = true.
 */
function detectSignalTension(actions) {
  const classes = actions.map(a => a.signal_class);
  for (const [a, b] of CONFLICT_PAIRS) {
    if (classes.includes(a) && classes.includes(b)) return true;
  }
  return false;
}

/**
 * Normalize time tags into discrete buckets.
 * "soon" → near-term (low precision). "this quarter" → near-term (high precision).
 */
function normalizeTimeBucket(timeArr) {
  if (!timeArr || timeArr.length === 0) return TIME_BUCKET.UNKNOWN;
  const top = timeArr[0];
  if (top.tag === 'time_recent')      return TIME_BUCKET.RECENT_PAST;
  if (top.proximity >= 0.95)          return TIME_BUCKET.IMMEDIATE;
  if (top.proximity >= 0.65)          return TIME_BUCKET.NEAR_TERM;
  if (top.proximity >= 0.40)          return TIME_BUCKET.MEDIUM_TERM;
  if (top.tag === 'time_long_horizon') return TIME_BUCKET.LONG_HORIZON;
  return TIME_BUCKET.UNKNOWN;
}

/**
 * Build the finite list of ambiguity flags for a parsed sentence.
 * These are surfaced in the UI and used to downrank weak signals.
 */
function buildAmbiguityFlags({ actions, actor, obj, timeArr, hedges,
  isNegated, isPromotional, isBoilerplate, isReported, isRumor, hasTension }) {

  const flags = [];
  if (hedges.length > 0)                                     flags.push('hedged_language');
  if (!obj || obj === 'object_unknown')                       flags.push('vague_object');
  if (!actor || actor === 'actor_unknown')                    flags.push('unclear_actor');
  if (!timeArr || timeArr.length === 0)                       flags.push('missing_time');
  if (isPromotional && actions.length === 0)                  flags.push('promotional_only');
  if (isBoilerplate)                                          flags.push('boilerplate_content');
  if (isNegated)                                              flags.push('negated_signal');
  if (isReported)                                             flags.push('reported_speech');
  if (isRumor)                                                flags.push('rumor_language');
  if (hasTension)                                             flags.push('conflicting_signals');
  // Multi-signal: 3+ distinct signal classes in one sentence
  const uniqueClasses = new Set(actions.map(a => a.signal_class));
  if (uniqueClasses.size >= 3)                                flags.push('multi_signal_sentence');

  return flags;
}

/**
 * Compute evidence quality tier: confirmed / inferred / speculative / negated / low-information.
 * This is the most important single output for the UI — drives how signals are displayed.
 *
 * Evidence quality is a function of:
 *   1. Linguistic clarity (modality certainty)
 *   2. Ambiguity flag count
 *   3. Negation
 *   4. Attribution type
 *   5. Promotional/boilerplate content
 */
function computeEvidenceQuality({ modality, ambiguity_flags, isNegated, isRumor,
  isPromotional, isBoilerplate, attributionType, actions }) {

  if (isNegated)   return EVIDENCE_QUALITY.NEGATED;
  if (isBoilerplate || (isPromotional && actions.length === 0))
                   return EVIDENCE_QUALITY.LOW_INFO;
  if (isRumor || attributionType === 'rumor')
                   return EVIDENCE_QUALITY.SPECULATIVE;
  // Investor-language signals are coded phrases whose meaning is clear
  // even without explicit actor/object. Check BEFORE generic flag-count cutoffs.
  const primaryClass = actions[0]?.signal_class ?? '';
  const isInvestorSignal = primaryClass === 'investor_interest_signal'
                        || primaryClass === 'investor_rejection_signal';
  if (isInvestorSignal && !isRumor && ambiguity_flags.length <= 4)
                   return EVIDENCE_QUALITY.INFERRED;

  if (modality?.certainty <= 0.30)
                   return EVIDENCE_QUALITY.SPECULATIVE;
  if (ambiguity_flags.includes('hedged_language') && modality?.certainty <= 0.65)
                   return EVIDENCE_QUALITY.SPECULATIVE;
  if (ambiguity_flags.length >= 3)
                   return EVIDENCE_QUALITY.SPECULATIVE;

  // Vague object alone caps at inferred — "we're scaling" ≠ confirmed
  if (ambiguity_flags.includes('vague_object'))
                   return EVIDENCE_QUALITY.INFERRED;

  // Exploratory signals are never confirmed — they are by definition speculative intent
  if (primaryClass === 'exploratory_signal')
                   return EVIDENCE_QUALITY.SPECULATIVE;

  if (modality?.certainty >= 0.85
    && ambiguity_flags.length <= 1
    && attributionType === 'direct'
    && !isRumor)   return EVIDENCE_QUALITY.CONFIRMED;
  if (modality?.certainty >= 0.75
    && ambiguity_flags.length <= 2)
                   return EVIDENCE_QUALITY.CONFIRMED;

  return EVIDENCE_QUALITY.INFERRED;
}

/**
 * 6-Dimensional Confidence Model
 *
 * Not just "did the keyword appear?" — every dimension contributes independently.
 *
 * Dim 1 — Linguistic clarity:   Was the sentence explicit? (modality certainty)
 * Dim 2 — Actor clarity:        Do we know who is acting?
 * Dim 3 — Object clarity:       Do we know what the action targets?
 * Dim 4 — Modality certainty:   Actual vs planned vs speculative?
 * Dim 5 — Negation & hedging:   Was the action denied or softened?
 * Dim 6 — Source reliability:   Direct statement vs reported vs rumor?
 *
 * Each dimension contributes 0–1. Final score is a weighted average.
 */
function computeConfidence6D({ modality, intensity, posture, time, actions, context,
  actor, obj, hedges, isNegated, isPromotional, isBoilerplate, isRumor, isReported }) {

  // If negated: signal is suppressed — very low confidence
  if (isNegated)    return 0.10;
  if (isBoilerplate || (isPromotional && actions.length === 0)) return 0.15;

  // Dim 1 — Linguistic clarity (modality certainty drives this heavily)
  const modalityCertainty = modality?.certainty ?? 0.50;

  // Dim 2 — Actor clarity
  const actorScore = !actor || actor === 'actor_unknown' ? 0.40 : 0.80;

  // Dim 3 — Object clarity
  const objectScore = (!obj || obj === 'object_unknown') ? 0.40 : 0.80;

  // Dim 4 — Hedging penalty: each hedge word reduces confidence
  const hedgePenalty = Math.min(hedges.length * 0.08, 0.35);

  // Dim 5 — Source reliability
  const sourceScore = isRumor     ? 0.30
                    : isReported  ? 0.65
                    : 0.90;   // direct statement

  // Dim 6 — Action presence and strength
  const actionScore = actions.length === 0 ? 0.20
    : actions[0].base_certainty ?? 0.60;

  // Intensity modifiers (amplifiers boost, dampeners reduce)
  let intensityAdj = 0;
  for (const { weight } of intensity) intensityAdj += weight;
  intensityAdj = Math.max(-0.20, Math.min(0.20, intensityAdj));

  // Context presence (more context = more specific = more confident)
  const contextScore = context.length > 0 ? 0.75 : 0.55;

  // Time proximity (having a time reference increases specificity)
  const timeScore = time.length > 0 ? (time[0]?.proximity ?? 0.50) : 0.45;

  // Posture modifier
  const postureMod = posture.some(p => p.posture === 'posture_confident') ? 0.05
                   : posture.some(p => p.posture === 'posture_distressed') ? -0.05
                   : 0;

  // Weighted average — modality and action are the strongest signals
  const raw = (
    modalityCertainty * 0.28 +
    actionScore       * 0.22 +
    sourceScore       * 0.15 +
    actorScore        * 0.10 +
    objectScore       * 0.08 +
    contextScore      * 0.07 +
    timeScore         * 0.06 +
    0.50              * 0.04   // baseline
  ) - hedgePenalty + intensityAdj + postureMod;

  return Math.max(0.05, Math.min(0.99, Math.round(raw * 100) / 100));
}

// ─── ACTOR DETECTION ─────────────────────────────────────────────────────────
function detectActor(text) {
  for (const [pattern, actorTag] of ACTOR_PATTERNS) {
    if (pattern.test(text)) return actorTag;
  }
  return 'actor_unknown';
}

// ─── ACTION DETECTION ─────────────────────────────────────────────────────────
function detectActions(text) {
  const found = [];
  const seen  = new Set();
  for (const [re, meta] of _ACTION_RE) {
    if (re.test(text) && !seen.has(meta.signal_class + meta.action_tag)) {
      seen.add(meta.signal_class + meta.action_tag);
      found.push({ ...meta });
    }
  }
  // Sort by signal class priority so primary signal is most important
  return found.sort((a, b) =>
    SIGNAL_CLASS_PRIORITY.indexOf(a.signal_class) - SIGNAL_CLASS_PRIORITY.indexOf(b.signal_class)
  );
}

// ─── MODALITY DETECTION ───────────────────────────────────────────────────────
// Walk from most to least certain — first match wins.
function detectModality(text) {
  for (const [pattern, meta] of _MODALITY_RE) {
    if (pattern.test(text)) return { ...meta };
  }
  // Fallback: present-progressive (is/are + -ing) → active
  if (/\b(is|are|we'?re)\s+\w+ing\b/i.test(text)) {
    return { class: 'modality_active', certainty: 0.75 };
  }
  return { class: 'modality_unknown', certainty: 0.50 };
}

// ─── INTENSITY / AMPLIFIER DETECTION ─────────────────────────────────────────
function detectIntensity(text) {
  const lc   = text.toLowerCase();
  const found = [];
  for (const [word, meta] of Object.entries(INTENSITY_MAP)) {
    if (new RegExp(`\\b${word}\\b`).test(lc)) {
      found.push({ word, ...meta });
    }
  }
  return found;
}

// ─── POSTURE DETECTION ────────────────────────────────────────────────────────
function detectPosture(text) {
  const found = [];
  const seenPostures = new Set();
  for (const [pattern, meta] of _POSTURE_RE) {
    if (pattern.test(text) && !seenPostures.has(meta.posture)) {
      seenPostures.add(meta.posture);
      found.push({ ...meta });
    }
  }
  return found;
}

// ─── TIME DETECTION ───────────────────────────────────────────────────────────
function detectTime(text) {
  const found = [];
  const seenTags = new Set();
  for (const [pattern, meta] of _TIME_RE) {
    if (pattern.test(text) && !seenTags.has(meta.tag)) {
      seenTags.add(meta.tag);
      found.push({ ...meta });
    }
  }
  return found;
}

// ─── CONTEXT DETECTION ────────────────────────────────────────────────────────
function detectContext(text) {
  const lc   = text.toLowerCase();
  const tags = new Set();
  for (const [term, ctxTags] of Object.entries(CONTEXT_MAP)) {
    // Use word-boundary aware match where possible
    if (new RegExp(`(^|\\W)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i').test(lc)) {
      ctxTags.forEach(t => tags.add(t));
    }
  }
  return [...tags];
}

// ─── INTENT DETECTION ─────────────────────────────────────────────────────────
function detectIntent(text) {
  const found = [];
  for (const [pattern, intentClass] of _INTENT_RE) {
    if (pattern.test(text) && !found.includes(intentClass)) {
      found.push(intentClass);
    }
  }
  return found;
}

// ─── OBJECT DETECTION ─────────────────────────────────────────────────────────
function detectObject(text, actions) {
  const lc = text.toLowerCase();
  // Try in OBJECT_KEYWORDS order (multi-word first, single-word after)
  for (const [phrase, tag] of OBJECT_KEYWORDS) {
    if (lc.includes(phrase)) return tag;
  }
  // Fallback: infer from action type
  if (actions.length > 0) {
    const tag = actions[0].action_tag || '';
    if (tag.includes('hiring') || tag.includes('recruit')) return 'object_team';
    if (tag.includes('rais') || tag.includes('round'))    return 'object_round';
    if (tag.includes('launch') || tag.includes('ship'))  return 'object_product';
    if (tag.includes('expand') || tag.includes('enter')) return 'object_market';
    if (tag.includes('partner') || tag.includes('integrat')) return 'object_partnership';
  }
  return 'object_unknown';
}

// ─── DESCRIPTOR DETECTION ─────────────────────────────────────────────────────
function detectDescriptors(text) {
  const lc = text.toLowerCase();
  return DESCRIPTOR_KEYWORDS.filter(d =>
    new RegExp(`(^|\\W)${d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\W|$)`, 'i').test(lc)
  );
}

// ─── CONFIDENCE SCORING ───────────────────────────────────────────────────────
// Combines modality certainty, intensity adjustments, action strength,
// time proximity, and context richness.
function computeConfidence({ modality, intensity, posture, time, actions, context }) {
  // Base: modality certainty
  let score = CERTAINTY_WEIGHTS[modality?.class] ?? 0.50;

  // Blend with action strength (average of modality + best action)
  if (actions.length > 0) {
    const bestAction = Math.max(...actions.map(a => a.base_certainty ?? 0.50));
    score = (score + bestAction) / 2;
  }

  // Intensity adjustments (each word shifts the score)
  for (const i of intensity) {
    score = Math.min(1.0, Math.max(0.0, score + i.weight));
  }

  // Time proximity: small bonus for temporal specificity
  if (time.length > 0) {
    const maxProximity = Math.max(...time.map(t => t.proximity));
    score = Math.min(1.0, score + maxProximity * 0.04);
  }

  // Distress bumps certainty (bad news is still high-signal)
  if (posture.some(p => p.posture === 'posture_distressed')) {
    score = Math.min(1.0, score + 0.08);
  }

  // Context richness: richer context = slightly more confident parse
  if (context.length >= 3) score = Math.min(1.0, score + 0.03);

  return Math.round(score * 100) / 100;  // 2 decimal precision
}

// ─── STRATEGIC INFERENCE ──────────────────────────────────────────────────────
// Layer 3: what does the combination of signals actually mean?
function inferMeanings({ actor, actions, modality, intensity, posture, context, intent }) {
  const meanings = new Set();

  // ── Hiring layer ────────────────────────────────────────────────────────────
  const isHiring = actions.some(a => a.action_tag?.includes('hiring') || a.action_tag?.includes('recruit'));
  if (isHiring) {
    meanings.add('team_expansion');
    if (intensity.some(i => i.tag === 'intensity_aggressive')) meanings.add('hypergrowth_posture');
    if (intensity.some(i => ['intensity_selective', 'intensity_cautious'].includes(i.tag))) meanings.add('cautious_hiring');
    if (context.includes('context_company_enterprise')) meanings.add('enterprise_gtm_build');
    if (actions.some(a => a.action_tag === 'action_leadership_hire')) meanings.add('leadership_change');
    if (modality.class === 'modality_actual') meanings.add('confirmed_headcount_growth');
  }

  // ── Fundraising layer ───────────────────────────────────────────────────────
  const isFundraising = actions.some(a => a.signal_class === 'fundraising_signal');
  if (isFundraising) {
    const certainty = modality.certainty ?? 0.5;
    if (certainty >= 0.90)      meanings.add('financing_confirmed');
    else if (certainty >= 0.75) meanings.add('fundraise_near_close');
    else if (certainty >= 0.60) meanings.add('fundraise_in_progress');
    else                        meanings.add('early_fundraising_signal');
    if (modality.class === 'modality_actual') meanings.add('budget_confidence_high');
  }

  // ── Investor interest layer ─────────────────────────────────────────────────
  if (actions.some(a => a.signal_class === 'investor_interest_signal')) {
    meanings.add('investor_evaluating');
    if (actions.some(a => a.action_tag === 'action_investor_diligence')) {
      meanings.add('serious_investor_interest');
      if (actions.some(a => a.base_certainty >= 0.90)) meanings.add('advanced_diligence');
    }
  }

  // ── Distress layer ──────────────────────────────────────────────────────────
  const isDistress = actions.some(a => a.signal_class === 'distress_signal');
  if (isDistress) {
    meanings.add('runway_pressure');
    if (actions.some(a => a.action_tag === 'action_layoffs'))      meanings.add('confirmed_headcount_reduction');
    if (actions.some(a => a.action_tag === 'action_restructuring')) meanings.add('operational_restructure');
    if (actions.some(a => a.action_tag === 'action_exit_prep'))     meanings.add('potential_distress_sale');
    if (actions.some(a => a.action_tag === 'action_survival'))      meanings.add('cash_conservation');
  }

  // ── Expansion layer ─────────────────────────────────────────────────────────
  const isExpanding = actions.some(a => a.signal_class === 'expansion_signal' || a.signal_class === 'enterprise_signal');
  if (isExpanding) {
    meanings.add('market_expansion');
    if (context.includes('context_geo_europe'))       meanings.add('europe_expansion');
    if (context.includes('context_geo_apac'))         meanings.add('apac_expansion');
    if (context.includes('context_company_enterprise')) meanings.add('enterprise_motion');
    if (posture.some(p => p.posture === 'posture_disciplined')) meanings.add('disciplined_expansion');
  }

  // ── Product layer ───────────────────────────────────────────────────────────
  if (actions.some(a => a.signal_class === 'product_signal')) {
    if (modality.class === 'modality_actual') meanings.add('product_live');
    else meanings.add('product_incoming');
    if (actions.some(a => a.action_tag === 'action_piloting')) meanings.add('market_validation');
  }

  // ── Efficiency / caution layer ──────────────────────────────────────────────
  if (actions.some(a => a.signal_class === 'efficiency_signal')) {
    meanings.add('efficiency_focus');
    if (!isDistress) meanings.add('disciplined_growth_not_distress');
  }

  // ── Exit layer ──────────────────────────────────────────────────────────────
  if (actions.some(a => a.signal_class === 'exit_signal')) {
    meanings.add('exit_preparation');
    if (actions.some(a => a.action_tag === 'action_exit_prep')) meanings.add('potential_acquisition_target');
  }

  // ── Intent overlays ─────────────────────────────────────────────────────────
  const INTENT_MEANING_MAP = {
    intent_expansion:            'market_expansion_planned',
    intent_fundraising:          'fundraise_intended',
    intent_survival:             'survival_mode',
    intent_exit_prep:            'exit_intended',
    intent_enterprise_push:      'enterprise_push',
    intent_efficiency:           'margin_focus',
    intent_team_growth:          'deliberate_team_build',
    intent_customer_growth:      'customer_acquisition_push',
    intent_validation:           'market_validation_phase',
    intent_product_launch:       'product_launch_imminent',
    intent_operational_efficiency:'operational_optimization',
  };
  for (const intentClass of intent) {
    if (INTENT_MEANING_MAP[intentClass]) meanings.add(INTENT_MEANING_MAP[intentClass]);
  }

  // ── Posture overlays ────────────────────────────────────────────────────────
  if (posture.some(p => p.posture === 'posture_confident') && isFundraising) {
    meanings.add('fundraise_with_high_conviction');
  }
  if (posture.some(p => p.posture === 'posture_reflective')) {
    meanings.add('possible_end_of_chapter_language');
  }

  return [...meanings];
}

// ─── SENTENCE SPLITTER ────────────────────────────────────────────────────────
// Split a paragraph into individual sentences for multi-signal parsing
function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?<=\.\s{2,})/g)
    .map(s => s.trim())
    .filter(s => s.length > 8 && /[a-z]/i.test(s));
}

// ─── MAIN: parseSignal ────────────────────────────────────────────────────────
/**
 * Parse a single sentence and return a structured signal object.
 *
 * @param {string} text
 * @returns {SignalObject|null}
 *
 * Signal object schema:
 * {
 *   raw_text:          string,
 *   actor:             string,           // actor_founder | actor_startup | ...
 *   action:            string,           // action_hiring | action_raising | ...
 *   object:            string,           // object_team | object_round | ...
 *   modality:          { class, certainty },
 *   intensity:         [{ word, weight, tag }],
 *   descriptors:       string[],
 *   time:              [{ tag, proximity }],
 *   context:           string[],
 *   posture:           [{ posture, meaning }],
 *   intent:            string[],
 *   signal_classes:    string[],         // all matching classes, priority-sorted
 *   primary_signal:    string,           // top-ranked signal class
 *   inferred_meanings: string[],         // strategic interpretation layer
 *   confidence:        number,           // 0.0 – 1.0
 *   _actions:          object[],         // raw matched action objects (debug)
 * }
 */
function parseSignal(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 5) return null;

  const cleaned = text.trim();

  // ── Standard grammar parse ──────────────────────────────────────────────────
  const actor       = detectActor(cleaned);
  const actions     = detectActions(cleaned);
  const modality    = detectModality(cleaned);
  const intensity   = detectIntensity(cleaned);
  const posture     = detectPosture(cleaned);
  const time        = detectTime(cleaned);
  const context     = detectContext(cleaned);
  const intent      = detectIntent(cleaned);
  const obj         = detectObject(cleaned, actions);
  const descriptors = detectDescriptors(cleaned);

  // ── Ambiguity detection suite ───────────────────────────────────────────────
  const isNegated      = detectNegation(cleaned);
  const hedges         = detectHedges(cleaned);
  const isPromotional  = detectPromotional(cleaned);
  const isBoilerplate  = detectBoilerplate(cleaned);
  const isReported     = detectReportedSpeech(cleaned);
  const isRumor        = detectRumor(cleaned);
  const attributionType = detectAttributionType(cleaned);
  const hasTension     = detectSignalTension(actions);
  const time_bucket    = normalizeTimeBucket(time);

  const ambiguity_flags = buildAmbiguityFlags({
    actions, actor, obj, timeArr: time, hedges,
    isNegated, isPromotional, isBoilerplate, isReported, isRumor, hasTension,
  });

  // ── Signal classes ──────────────────────────────────────────────────────────
  const seen = new Set();
  const signal_classes = actions
    .map(a => a.signal_class)
    .filter(c => c && !seen.has(c) && seen.add(c));

  // If negated, prepend reversal flag to signal classes
  const effective_signal_classes = isNegated
    ? ['negated_signal', ...signal_classes]
    : signal_classes;

  const primary_signal = isNegated
    ? 'negated_signal'
    : (effective_signal_classes[0] || 'unclassified_signal');

  const primary_action = actions[0]?.action_tag || 'action_unknown';

  // ── Alternate signals (secondary interpretations) ───────────────────────────
  // The top-N lower-ranked actions become alternate interpretations.
  // This is the "might mean Y" layer.
  const alternate_signals = actions.slice(1, 4).reduce((acc, a) => {
    if (a.signal_class !== primary_signal) {
      acc.push({
        class:      a.signal_class,
        confidence: Math.round((a.base_certainty ?? 0.5) * 100) / 100,
        meaning:    a.meaning,
        action_tag: a.action_tag,
      });
    }
    return acc;
  }, []);

  // ── 6-Dimensional confidence model ─────────────────────────────────────────
  const confidence = computeConfidence6D({
    modality, intensity, posture, time, actions, context,
    actor, obj, hedges, isNegated, isPromotional, isBoilerplate,
    isRumor, isReported,
  });

  // ── Evidence quality tier ───────────────────────────────────────────────────
  const evidence_quality = computeEvidenceQuality({
    modality, ambiguity_flags, isNegated, isRumor,
    isPromotional, isBoilerplate, attributionType, actions,
  });

  // ── Inferred meanings ───────────────────────────────────────────────────────
  const inferred_meanings = isNegated ? [] : inferMeanings({
    actor, actions, modality, intensity, posture, context, intent,
  });

  // ── Metadata layers ─────────────────────────────────────────────────────────
  const who_cares   = WHO_CARES_MAP[primary_signal]   || WHO_CARES_MAP.unclassified_signal;
  const signal_type = SIGNAL_TYPE_MAP[primary_signal]  || 'unknown';
  const inference   = INFERENCE_MAP[primary_signal]    || INFERENCE_MAP.unclassified_signal;

  // Signal strength: confidence × base_certainty of top action
  const base_certainty  = actions[0]?.base_certainty ?? 0.5;
  const signal_strength = Math.min(1.0, Math.round(confidence * base_certainty * 100) / 100);

  // needs_context = true when the signal cannot be interpreted alone
  const needs_context = ambiguity_flags.includes('insufficient_context')
    || ambiguity_flags.includes('unclear_actor')
    || (ambiguity_flags.includes('vague_object') && ambiguity_flags.includes('hedged_language'))
    || ambiguity_flags.length >= 4;

  return {
    raw_text:          cleaned,

    // ── Signal grammar ────────────────────────────────────────────────────
    actor,
    action:            primary_action,
    object:            obj,
    modality,
    intensity,
    descriptors,
    time,
    time_bucket,
    context,
    posture,
    intent,

    // ── Signal classification ─────────────────────────────────────────────
    signal_classes:    effective_signal_classes,
    primary_signal,
    alternate_signals,
    signal_type,

    // ── Confidence & evidence quality ─────────────────────────────────────
    confidence,
    signal_strength,
    evidence_quality,  // confirmed | inferred | speculative | negated | low-information

    // ── Ambiguity layer ───────────────────────────────────────────────────
    ambiguity_flags,
    needs_context,
    signal_tension:    hasTension,
    negation_detected: isNegated,
    attribution_type:  attributionType,

    // ── Strategic inference ───────────────────────────────────────────────
    inferred_meanings,
    who_cares,
    inference,

    _actions:          actions,
  };
}

// ─── MAIN: parseSignals ───────────────────────────────────────────────────────
/**
 * Parse a paragraph / multi-sentence block.
 * Returns an array of signal objects, one per sentence.
 *
 * @param {string} text
 * @returns {SignalObject[]}
 */
function parseSignals(text) {
  if (!text) return [];
  return splitSentences(text)
    .map(s => parseSignal(s))
    .filter(Boolean);
}

module.exports = { parseSignal, parseSignals };
