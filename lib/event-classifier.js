/**
 * EVENT CLASSIFIER (Inference Engine)
 * =====================================
 * Fast, free event classification using pattern matching
 * Replaces 80% of GPT-4 calls with zero-cost inference
 * 
 * Used by:
 * - Frame parser (first-pass classification)
 * - Event rescue agent (misclassified events)
 * - RSS scrapers (real-time classification)
 */

// Non-event patterns (filter these out immediately)
const NON_EVENT_PATTERNS = [
  /^(why|how|what|opinion|analysis|commentary|podcast|interview|explainer|guide)/i,
  /^ask hn:/i,
  /^show hn:/i,
  /^tell hn:/i,
  /\?$/,  // Questions
  /\b(will|plans to|aims to|expects to|intends to|looking to|seeking to)\b/i,  // Future tense
  /\b(should|could|might|may|would)\b.*\b(raise|launch|acquire)/i,  // Hypotheticals
];

const EVENT_PATTERNS = {
  FUNDING: {
    verbs: [
      'raise', 'raises', 'raised', 'raising',
      'secure', 'secures', 'secured', 'securing',
      'close', 'closes', 'closed', 'closing',
      'land', 'lands', 'landed', 'landing',
      'bag', 'bags', 'bagged', 'bagging',
      'snag', 'snags', 'snagged', 'snagging',
      'grab', 'grabs', 'grabbed', 'grabbing',
      'score', 'scores', 'scored', 'scoring',
      'receive', 'receives', 'received', 'receiving',
      'get', 'gets', 'got', 'getting',
      'announce', 'announces', 'announced', 'announcing',
      'unveil', 'unveils', 'unveiled', 'unveiling',
      'reveal', 'reveals', 'revealed', 'revealing',
      'complete', 'completes', 'completed', 'completing'
    ],
    nouns: [
      'funding', 'investment', 'round', 'capital',
      'seed', 'series', 'financing', 'cash', 'raise'
    ],
    amounts: /\$\d+(?:\.\d+)?\s*(?:million|M|billion|B|mil|bil)/i,
    confidence: 0.85
  },

  ACQUISITION: {
    verbs: [
      'acquire', 'acquires', 'acquired', 'acquiring',
      'buy', 'buys', 'bought', 'buying',
      'purchase', 'purchases', 'purchased', 'purchasing',
      'take over', 'takes over', 'took over', 'taking over',
      'snap up', 'snaps up', 'snapped up', 'snapping up',
      'buy out', 'buys out', 'bought out', 'buying out',
      'snap', 'snaps', 'snapped', 'snapping' // for "snaps up"
    ],
    nouns: [
      'acquisition', 'buyout', 'takeover', 'purchase', 'deal', 'startup', 'company', 'firm'
    ],
    confidence: 0.90
  },

  LAUNCH: {
    verbs: [
      'launch', 'launches', 'launched', 'launching',
      'debut', 'debuts', 'debuted', 'debuting',
      'unveil', 'unveils', 'unveiled', 'unveiling',
      'introduce', 'introduces', 'introduced', 'introducing',
      'release', 'releases', 'released', 'releasing',
      'announce', 'announces', 'announced', 'announcing',
      'reveal', 'reveals', 'revealed', 'revealing',
      'roll out', 'rolls out', 'rolled out', 'rolling out'
    ],
    nouns: [
      'launch', 'debut', 'product', 'platform', 'service',
      'app', 'feature', 'beta', 'release'
    ],
    confidence: 0.75
  },

  PARTNERSHIP: {
    verbs: [
      'partner', 'partners', 'partnered', 'partnering',
      'team up', 'teams up', 'teamed up', 'teaming up',
      'collaborate', 'collaborates', 'collaborated', 'collaborating',
      'join forces', 'joins forces', 'joined forces', 'joining forces',
      'sign', 'signs', 'signed', 'signing',
      'ink', 'inks', 'inked', 'inking'
    ],
    nouns: [
      'partnership', 'collaboration', 'alliance', 'deal',
      'agreement', 'contract', 'pact'
    ],
    confidence: 0.70
  }
};

/**
 * Classify event type from headline
 * @param {string} title - Event headline/title
 * @returns {object} { type: 'FUNDING'|'ACQUISITION'|'LAUNCH'|'PARTNERSHIP'|'OTHER', confidence: 0-1, reasoning: string }
 */
function classifyEvent(title) {
  if (!title || title.length < 10) {
    return { type: 'OTHER', confidence: 0.0, name: null, reasoning: 'Title too short' };
  }

  // FILTER: Reject non-events immediately
  for (const pattern of NON_EVENT_PATTERNS) {
    if (pattern.test(title)) {
      return { 
        type: 'FILTERED', 
        confidence: 1.0, 
        name: null, 
        reasoning: `Non-event pattern: ${pattern.source}` 
      };
    }
  }

  const titleLower = title.toLowerCase();
  const scores = {};

  // Score each event type
  for (const [eventType, patterns] of Object.entries(EVENT_PATTERNS)) {
    let score = 0;
    const matches = [];

    // Check verbs
    for (const verb of patterns.verbs) {
      const verbRegex = new RegExp(`\\b${verb}\\b`, 'i');
      if (verbRegex.test(titleLower)) {
        score += 0.4;
        matches.push(`verb:${verb}`);
        break; // Only count first verb match
      }
    }

    // Check nouns
    for (const noun of patterns.nouns) {
      const nounRegex = new RegExp(`\\b${noun}\\b`, 'i');
      if (nounRegex.test(titleLower)) {
        score += 0.3;
        matches.push(`noun:${noun}`);
        break; // Only count first noun match
      }
    }

    // Check special patterns (funding amounts)
    if (eventType === 'FUNDING' && patterns.amounts.test(title)) {
      score += 0.3;
      matches.push('amount');
    }

    // Normalize score to 0-1
    score = Math.min(score, 1.0);

    if (score > 0) {
      scores[eventType] = {
        score: score * patterns.confidence,
        matches,
        baseConfidence: patterns.confidence
      };
    }
  }

  // Find best match
  let bestType = 'OTHER';
  let bestScore = 0;
  let bestMatches = [];

  for (const [type, data] of Object.entries(scores)) {
    if (data.score > bestScore) {
      bestScore = data.score;
      bestType = type;
      bestMatches = data.matches;
    }
  }

  // Extract startup name (first titlecase entity)
  let startupName = null;
  const nameMatch = title.match(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b/);
  if (nameMatch) {
    startupName = nameMatch[1];
  }

  // Confidence threshold: 0.4 minimum
  if (bestScore < 0.4) {
    return {
      type: 'OTHER',
      confidence: bestScore,
      name: startupName,
      reasoning: `Low confidence (${bestScore.toFixed(2)}), best match: ${bestType}`
    };
  }

  return {
    type: bestType,
    confidence: bestScore,
    name: startupName,
    reasoning: `Matched: ${bestMatches.join(', ')}`
  };
}

/**
 * Batch classify multiple events
 * @param {Array<{title: string}>} events
 * @returns {Array} Classifications
 */
function classifyBatch(events) {
  return events.map(event => ({
    ...event,
    classification: classifyEvent(event.title)
  }));
}

module.exports = {
  classifyEvent,
  classifyBatch,
  EVENT_PATTERNS,
  NON_EVENT_PATTERNS
};
