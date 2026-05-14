'use strict';

/**
 * Entity resolution gate — classify rows before RSS / sparse / scoring pipelines.
 *
 * Name validation order (algebra-first, not lookup-first):
 *   1. Logic engine     — structural template: startup | investor | descriptor | headline
 *                          (startupNameLogicEngine — position/slot “conjugation” of tokens)
 *   2. Ontology + inference — pendingNameOntology (parseSignal) confirms headline / wire junk
 *   3. Entity ontology  — nameEntityOntology: geographic / person / brand disambiguation
 *   4. Legacy safety net — cleanup-garbage isGarbage + isValidStartupName for test shards,
 *                          patterns the engine should not need to duplicate
 *
 * Only names that pass (1)–(4) as a startup-like string proceed to URL gating → needs_url | qualified.
 *
 * Use evaluateStartupNameForPipeline() for name-only checks (pre-gate, batch jobs)
 * so all paths share one ordering.
 */

const { isGarbageInvestorName, investorHasResolvableUrl } = require('./investorNameHeuristics');
const { evaluateStartupNameForPipeline } = require('./startupNameGate');

/**
 * @param {{ name?: string|null, website?: string|null, company_website?: string|null }} row
 * @returns {{ gate: 'junk'|'needs_url'|'qualified', reason: string|null }}
 */
function classifyStartup(row) {
  const ev = evaluateStartupNameForPipeline(row.name);
  if (!ev.ok) {
    return { gate: 'junk', reason: ev.reason };
  }

  const url = `${row.website || ''}${row.company_website || ''}`.trim();
  if (!url || url.length < 4) {
    return { gate: 'needs_url', reason: 'no_website' };
  }
  return { gate: 'qualified', reason: null };
}

/**
 * @param {{ name?: string|null, linkedin_url?: string|null, crunchbase_url?: string|null, blog_url?: string|null, twitter_url?: string|null }} row
 * @returns {{ gate: 'junk'|'needs_url'|'qualified', reason: string|null }}
 */
function classifyInvestor(row) {
  const name = row.name && String(row.name).trim();
  if (!name) {
    return { gate: 'junk', reason: 'empty_name' };
  }
  if (isGarbageInvestorName(name)) {
    return { gate: 'junk', reason: 'investor_headline_heuristic' };
  }
  if (!investorHasResolvableUrl(row)) {
    return { gate: 'needs_url', reason: 'no_http_url' };
  }
  return { gate: 'qualified', reason: null };
}

const { evaluateStartupCorrelatePolicy } = require('./startupCorrelatePolicy');

module.exports = {
  classifyStartup,
  classifyInvestor,
  evaluateStartupNameForPipeline,
  evaluateStartupCorrelatePolicy,
};
