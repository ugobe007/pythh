'use strict';

// Reviewed allowlist for single-source funding verification. Keep deliberately
// small: additions change training-label quality and must be code-reviewed.
const TRUSTED_DOMAINS = Object.freeze(new Map([
  ['reuters.com', 'tier_1_editorial'],
  ['bloomberg.com', 'tier_1_editorial'],
  ['ft.com', 'tier_1_editorial'],
  ['wsj.com', 'tier_1_editorial'],
  ['techcrunch.com', 'specialist_editorial'],
  ['pitchbook.com', 'specialist_editorial'],
  ['crunchbase.com', 'specialist_editorial'],
  ['businesswire.com', 'issuer_primary_wire'],
  ['globenewswire.com', 'issuer_primary_wire'],
  ['prnewswire.com', 'issuer_primary_wire'],
]));

const TRUSTED_PUBLISHERS = Object.freeze(new Map([
  ['reuters', 'tier_1_editorial'],
  ['bloomberg', 'tier_1_editorial'],
  ['financial times', 'tier_1_editorial'],
  ['the wall street journal', 'tier_1_editorial'],
  ['techcrunch', 'specialist_editorial'],
  ['pitchbook', 'specialist_editorial'],
  ['crunchbase news', 'specialist_editorial'],
  ['business wire', 'issuer_primary_wire'],
  ['globe newswire', 'issuer_primary_wire'],
  ['pr newswire', 'issuer_primary_wire'],
]));

function sourceDomain(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
}

function normalizedPublisher(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function domainTrust(domain) {
  if (!domain) return null;
  for (const [trusted, tier] of TRUSTED_DOMAINS) {
    if (domain === trusted || domain.endsWith(`.${trusted}`)) return { trusted: true, tier, identity: trusted };
  }
  return null;
}

function assessFundingSource({ source_url, source_publisher } = {}) {
  const domain = sourceDomain(source_url);
  const byDomain = domainTrust(domain);
  if (byDomain) return { ...byDomain, basis: 'domain' };
  const publisher = normalizedPublisher(source_publisher);
  const tier = TRUSTED_PUBLISHERS.get(publisher);
  if (tier) return { trusted: true, tier, identity: `publisher:${publisher}`, basis: 'publisher' };
  return { trusted: false, tier: 'unreviewed', identity: domain || (publisher ? `publisher:${publisher}` : null), basis: domain ? 'domain' : publisher ? 'publisher' : 'missing' };
}

module.exports = { TRUSTED_DOMAINS, TRUSTED_PUBLISHERS, sourceDomain, normalizedPublisher, assessFundingSource };
