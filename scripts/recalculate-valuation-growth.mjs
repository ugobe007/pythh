#!/usr/bin/env node
/**
 * Recalculate portfolio valuation growth from FROZEN entry valuations.
 *
 * Policy:
 *   • entry_valuation_usd is set once at virtual investment — NEVER updated here
 *   • current_valuation_usd + moic grow only from evidence AFTER pick date
 *   • verified funding rounds (latest post-pick) + post-pick signal accretion
 *
 *   node scripts/recalculate-valuation-growth.mjs
 *   node scripts/recalculate-valuation-growth.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();
const require = createRequire(import.meta.url);
const { syncPortfolioMoicToDb, computePortfolioValue } = require('../server/lib/portfolioAnalytics.js');
const { computeTrackRecord } = require('../server/lib/portfolioTrackRecord.js');

const APPLY = process.argv.includes('--apply');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  console.log(`\n📈 Valuation growth recalc (frozen entry) · ${APPLY ? 'APPLY' : 'dry-run'}\n`);

  const result = await syncPortfolioMoicToDb(sb, { apply: APPLY });

  const movers = (result.changes || [])
    .filter((c) => Math.abs(c.delta || 0) >= 0.1)
    .sort((a, b) => (b.delta || 0) - (a.delta || 0));

  console.log(`   ${APPLY ? 'Updated' : 'Would update'}: ${APPLY ? result.updated : result.would_update} positions`);
  if (movers.length) {
    console.log('\n   Largest MOIC changes:');
    for (const c of movers.slice(0, 15)) {
      const sign = c.delta > 0 ? '+' : '';
      console.log(`     ${(c.name || c.id).slice(0, 28).padEnd(28)} ${c.prior_moic}× → ${c.moic}× (${sign}${c.delta}) [${c.basis}]`);
    }
  }

  if (APPLY) {
    const [value, track, { data: metrics }] = await Promise.all([
      computePortfolioValue(sb),
      computeTrackRecord(sb),
      sb.from('portfolio_metrics').select('avg_moic, best_moic').maybeSingle(),
    ]);
    console.log('\n   After recalc:');
    console.log(`     Headline avg MOIC (early): ${metrics?.avg_moic ?? '—'}×`);
    console.log(`     Verified avg MOIC:         ${track.oracle?.verified_avg_moic ?? '—'}×`);
    console.log(`     TVPI:                      ${value.tvpi ?? '—'}×`);
    console.log(`     Best MOIC:                 ${metrics?.best_moic ?? '—'}×`);
  } else {
    console.log('\n   Pass --apply to write marks (entry valuations untouched)\n');
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
