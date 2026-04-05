'use strict';

/**
 * Maps colloquial signalDetector labels (lib/signal-ontology.js `signal` field)
 * to grammar primary_signal classes (lib/signalOntology.js) for unified scoring
 * and needs inference.
 *
 * Not every colloquial signal has a 1:1 grammar class — unlisted keys fall back
 * to heuristic in consumers.
 */
const COLLOQUIAL_TO_GRAMMAR = {
  ACTIVELY_RAISING: 'fundraising_signal',
  RAISING_SOON: 'fundraising_signal',
  DEFINITELY_RAISING: 'fundraising_signal',
  INBOUND_INTEREST: 'investor_interest_signal',
  LAUNCH_INCOMING: 'product_signal',
  OVERSUBSCRIBED: 'fundraising_signal',
  HOT_DEAL: 'fundraising_signal',
  STRATEGIC_ROUND: 'fundraising_signal',
  BRIDGE_ROUND: 'fundraising_signal',
  FLAT_ROUND: 'fundraising_signal',
  DOWN_ROUND: 'distress_signal',
  ACQUIHIRE: 'acquisition_signal',
  ACQUISITION_RUMOR: 'acquisition_signal',
  SHUTDOWN_ANNOUNCE: 'exit_signal',
  LAYOFFS_MAJOR: 'distress_signal',
  HIRING_AGGRESSIVE: 'hiring_signal',
  HIRING_FREEZE: 'distress_signal',
  REVENUE_MILESTONE: 'revenue_signal',
  CUSTOMER_WIN: 'growth_signal',
  EXPANSION_GEO: 'expansion_signal',
  REGULATORY_HEADWIND: 'regulatory_signal',
  INVESTOR_PASS: 'investor_rejection_signal',
};

/**
 * @param {string} colloquial
 * @returns {string|null}
 */
function colloquialToGrammarPrimarySignal(colloquial) {
  if (!colloquial || typeof colloquial !== 'string') return null;
  return COLLOQUIAL_TO_GRAMMAR[colloquial] || null;
}

module.exports = {
  COLLOQUIAL_TO_GRAMMAR,
  colloquialToGrammarPrimarySignal,
};
