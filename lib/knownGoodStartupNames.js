'use strict';

/**
 * Exact-name allowlist for names that fail heuristic validators but are real portfolio rows.
 * Used by cleanup-garbage (legacy safety net) and startupNameValidator (single SSOT).
 */

const KNOWN_GOOD_STARTUPS = new Set(
  [
    '1password', 'deel', 'mews', 'wise', 'stripe', 'notion', 'linear',
    'vercel', 'supabase', 'airtable', 'figma', 'lattice', 'rippling',
    'ramp', 'brex', 'mercury', 'replit', 'rsc', 'mode', 'webflow', 'run labs',
    'gusto', 'ripple', 'opensea', 'dune', 'etherscan', 'foundry',
    'opyn', 'compound', 'aave', 'uniswap', 'dydx',
    'yc-backed denki', 'yc-backed diligent ai', 'yc-backed escape', 'yc-backed mandel ai',
    'yc alum mendel', 'yc alum pasito',
  ].map((s) => s.toLowerCase()),
);

function isKnownGoodStartupName(name) {
  if (!name || !String(name).trim()) return false;
  return KNOWN_GOOD_STARTUPS.has(String(name).trim().toLowerCase());
}

module.exports = { KNOWN_GOOD_STARTUPS, isKnownGoodStartupName };
