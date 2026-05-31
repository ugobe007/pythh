#!/usr/bin/env node
/**
 * @deprecated Removed — legacy pillar-only scorer corrupted total_god_score.
 *
 * Use the SSOT batch scorer instead:
 *   npx tsx scripts/recalculate-scores.ts
 *
 * Portfolio holdings:
 *   node scripts/rescore-portfolio-holdings.mjs
 *
 * Archived copy: scripts/archive/deprecated/god-score-formula.js
 */
console.error(`
❌ scripts/core/god-score-formula.js was removed (legacy scorer).

It overwrote total_god_score without the approved-startup floor and ignored
funding/traction in extracted_data — corrupting portfolio health tiers.

Use instead:
  npx tsx scripts/recalculate-scores.ts          # fleet recalc (GitHub Actions)
  node scripts/rescore-portfolio-holdings.mjs    # repair active portfolio picks
`);
process.exit(1);
