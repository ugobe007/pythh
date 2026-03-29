'use strict';

/**
 * Pythh Signal Scorer
 *
 * Aggregates multiple signal objects (from parseSignals) into a ranked,
 * document-level signal summary. Useful when an article or message
 * contains several sentences that each contribute partial signals.
 *
 * Key concepts:
 *   - Signal strength  = confidence × priority_weight
 *   - Document score   = weighted average of sentence-level signals
 *   - Signal feed      = ranked list of unique signals from a document
 */

const SIGNAL_CLASS_PRIORITY = require('./signalOntology').SIGNAL_CLASS_PRIORITY;

// ─── PRIORITY WEIGHTS ─────────────────────────────────────────────────────────
// Higher = more important to surface in the feed.
// Maps signal_class → weight multiplier (1.0 = baseline)
const SIGNAL_PRIORITY_WEIGHT = {
  fundraising_signal:        2.0,
  acquisition_signal:        2.0,
  exit_signal:               1.9,
  distress_signal:           1.8,
  revenue_signal:            1.8,
  investor_interest_signal:  1.7,
  investor_rejection_signal: 1.5,
  regulatory_signal:         1.5,
  market_position_signal:    1.4,
  product_signal:            1.4,
  hiring_signal:             1.3,
  enterprise_signal:         1.2,
  expansion_signal:          1.2,
  gtm_signal:                1.1,
  demand_signal:             1.1,
  growth_signal:             1.0,
  partnership_signal:        1.0,
  efficiency_signal:         0.9,
  infrastructure_signal:     0.8,
  exploratory_signal:        0.6,
  unclassified_signal:       0.3,
};

// ─── RELEVANCE: INVESTOR ──────────────────────────────────────────────────────
// How relevant is each signal class to an investor's perspective?
const INVESTOR_RELEVANCE = {
  fundraising_signal:        1.0,
  acquisition_signal:        0.9,
  exit_signal:               0.9,
  investor_interest_signal:  1.0,
  investor_rejection_signal: 0.7,
  hiring_signal:             0.7,
  distress_signal:           0.8,
  revenue_signal:            0.95,
  regulatory_signal:         0.7,
  market_position_signal:    0.8,
  product_signal:            0.6,
  expansion_signal:          0.8,
  enterprise_signal:         0.8,
  demand_signal:             0.8,
  growth_signal:             0.7,
  gtm_signal:                0.6,
  partnership_signal:        0.5,
  efficiency_signal:         0.6,
  exploratory_signal:        0.4,
};

// ─── RELEVANCE: BUYER / ENTERPRISE ────────────────────────────────────────────
const BUYER_RELEVANCE = {
  product_signal:            1.0,
  partnership_signal:        0.9,
  enterprise_signal:         1.0,
  revenue_signal:            0.7,
  regulatory_signal:         0.9,
  market_position_signal:    0.8,
  demand_signal:             0.8,
  expansion_signal:          0.7,
  gtm_signal:                0.8,
  hiring_signal:             0.6,
  growth_signal:             0.6,
  fundraising_signal:        0.5,
  distress_signal:           0.3,
  efficiency_signal:         0.5,
  exploratory_signal:        0.3,
};

// ─── SCORE A SINGLE SIGNAL ────────────────────────────────────────────────────
/**
 * Compute the ranked strength score for one signal object.
 *
 * @param {object} signal - Output of parseSignal()
 * @param {'investor'|'buyer'|'general'} perspective
 * @returns {number} 0.0 – 1.0
 */
function scoreSignal(signal, perspective = 'general') {
  if (!signal || !signal.primary_signal) return 0;

  const priorityWeight  = SIGNAL_PRIORITY_WEIGHT[signal.primary_signal] ?? 0.5;
  const relevanceTable  = perspective === 'investor' ? INVESTOR_RELEVANCE
                        : perspective === 'buyer'    ? BUYER_RELEVANCE
                        : null;
  const relevanceWeight = relevanceTable ? (relevanceTable[signal.primary_signal] ?? 0.5) : 1.0;

  // Raw score = confidence × priority × relevance, capped at 1.0
  const raw = signal.confidence * priorityWeight * relevanceWeight;
  return Math.min(1.0, Math.round(raw * 100) / 100);
}

// ─── SCORE A DOCUMENT ────────────────────────────────────────────────────────
/**
 * Aggregate multiple sentence-level signals into a document-level summary.
 *
 * @param {object[]} signals   - Array of parseSignal() outputs
 * @param {string}   [source]  - Optional source label (article title, etc.)
 * @param {'investor'|'buyer'|'general'} [perspective]
 * @returns {DocumentSignal}
 */
function scoreDocument(signals, source = '', perspective = 'general') {
  if (!Array.isArray(signals) || signals.length === 0) {
    return { source, signals: [], primary_signal: null, document_score: 0, signal_feed: [], inferred_meanings: [] };
  }

  // Score each signal
  const scored = signals
    .filter(Boolean)
    .map(s => ({ ...s, _score: scoreSignal(s, perspective) }))
    .sort((a, b) => b._score - a._score);

  // Aggregate signal classes across all sentences (deduplicated)
  const allClasses = new Set();
  const allMeanings = new Set();
  const allContexts = new Set();

  for (const s of scored) {
    s.signal_classes.forEach(c => allClasses.add(c));
    s.inferred_meanings.forEach(m => allMeanings.add(m));
    s.context.forEach(c => allContexts.add(c));
  }

  // Primary signal = highest priority class present
  const signalClassesByPriority = [...allClasses].sort(
    (a, b) => SIGNAL_CLASS_PRIORITY.indexOf(a) - SIGNAL_CLASS_PRIORITY.indexOf(b)
  );
  const primary_signal = signalClassesByPriority[0] || null;

  // Document score = weighted average of top-3 sentence scores
  const topScores = scored.slice(0, 3).map(s => s._score);
  const document_score = topScores.length
    ? Math.round((topScores.reduce((a, b) => a + b, 0) / topScores.length) * 100) / 100
    : 0;

  // Signal feed: deduplicated, ordered signal classes with scores
  const signal_feed = signalClassesByPriority.map(cls => {
    const best = scored.find(s => s.signal_classes.includes(cls));
    return { signal_class: cls, score: best?._score ?? 0, sentence: best?.raw_text ?? '' };
  });

  return {
    source,
    signals:           scored,
    primary_signal,
    document_score,
    signal_feed,
    all_signal_classes: signalClassesByPriority,
    inferred_meanings: [...allMeanings],
    context:           [...allContexts],
  };
}

// ─── COMPARE TWO COMPANIES ────────────────────────────────────────────────────
/**
 * Given two document signal summaries, rank them by document_score.
 * Useful for building a ranked company signal feed.
 *
 * @param {DocumentSignal[]} docs
 * @param {'investor'|'buyer'|'general'} perspective
 * @returns {DocumentSignal[]} sorted highest-score first
 */
function rankDocuments(docs, perspective = 'general') {
  return [...docs].sort((a, b) => b.document_score - a.document_score);
}

// ─── CERTAINTLY LABEL ─────────────────────────────────────────────────────────
/**
 * Convert a modality certainty number to a human-readable label.
 * Matches the spec's 5-level certainty scale.
 */
function certaintyLabel(certainty) {
  if (certainty >= 0.95) return 'confirmed_actual';     // Level 5
  if (certainty >= 0.80) return 'committed_near_action'; // Level 4
  if (certainty >= 0.60) return 'stated_plan';           // Level 3
  if (certainty >= 0.35) return 'exploratory';           // Level 2
  return 'speculative';                                   // Level 1
}

module.exports = { scoreSignal, scoreDocument, rankDocuments, certaintyLabel };
