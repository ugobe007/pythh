/**
 * Shared helpers for match-validation evidence source quality.
 */
'use strict';

function sourceTier(url) {
  const u = String(url || '');
  if (!u) return 'low';
  if (/\.com\/blog|\/newsroom\/|\/news\/company|prnewswire|businesswire|globenewswire/i.test(u)) {
    return 'high';
  }
  // Ontology T0 filings — raise happened; roster usually incomplete (not alone for Hit@5 verify).
  if (/sec\.gov\/Archives\/edgar|sec\.gov\/.*form.?d/i.test(u)) {
    return 'medium';
  }
  if (/dealroom|crunchbase|techcrunch|bloomberg|reuters|pitchbook/i.test(u)) {
    return 'medium';
  }
  if (/sbir\.gov|nsf\.gov|usaspending\.gov/i.test(u)) {
    return 'medium';
  }
  return 'low';
}

function isIssuerPrimary(url) {
  return sourceTier(url) === 'high';
}

module.exports = { sourceTier, isIssuerPrimary };
