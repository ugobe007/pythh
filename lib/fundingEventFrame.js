'use strict';

/**
 * Funding event frame — structured view over RSS / news rows for downstream logic.
 *
 *   verbAssociations → derived from fundingEventLexicon groups (not raw regex verbs)
 *   string           → full text blob (title + fields)
 *   names            → populated by callers (e.g. rssDealMentions + headline extractors)
 *
 * Order of resolution elsewhere: frame context → logic engine → ontologies → lookups.
 */

const { buildEventTextBlob } = require('./rssDealMentions.js');
const { matchFundingContext, textHasDealLanguage } = require('./fundingEventLexicon.js');

/**
 * @param {Array<{ group: string, phrase: string }>} matches
 */
function summarizeGroups(matches) {
  /** @type {Record<string, Set<string>>} */
  const by = {};
  for (const { group, phrase } of matches) {
    if (!by[group]) by[group] = new Set();
    by[group].add(phrase);
  }
  return Object.entries(by).map(([group, set]) => ({
    group,
    phrases: [...set],
  }));
}

/**
 * @param {Record<string, unknown>|null|undefined} event startup_events-shaped row
 * @param {{ extraText?: string }} [opts]
 * @returns {{
 *   string: string,
 *   verbAssociations: { group: string, phrases: string[] }[],
 *   hasStrongDealContext: boolean,
 *   hasDealLanguage: boolean,
 *   names: string[],
 * }}
 */
function analyzeFundingEventFrame(event, opts = {}) {
  let string = buildEventTextBlob(event);
  if (opts.extraText) {
    string = `${string} ${opts.extraText}`.replace(/\s+/g, ' ').trim();
  }
  const ctx = matchFundingContext(string);
  return {
    string,
    verbAssociations: summarizeGroups(ctx.matches),
    hasStrongDealContext: ctx.hasStrongContext,
    hasDealLanguage: textHasDealLanguage(string),
    names: [],
  };
}

module.exports = {
  analyzeFundingEventFrame,
  summarizeGroups,
};
