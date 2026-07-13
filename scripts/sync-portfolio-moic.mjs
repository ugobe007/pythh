#!/usr/bin/env node
/**
 * Sync virtual_portfolio.moic + current_valuation from frozen-entry growth model.
 * Never writes entry_valuation_usd. See recalculate-valuation-growth.mjs.
 *
 *   node scripts/sync-portfolio-moic.mjs
 *   node scripts/sync-portfolio-moic.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();
const require = createRequire(import.meta.url);
const { syncPortfolioMoicToDb } = require('../server/lib/portfolioAnalytics.js');
const { computeTrackRecord } = require('../server/lib/portfolioTrackRecord.js');

const APPLY = process.argv.includes('--apply');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  console.log(`\n📐 Portfolio MOIC sync · ${APPLY ? 'APPLY' : 'dry-run'}\n`);

  const result = await syncPortfolioMoicToDb(sb, { apply: APPLY });
  const track = await computeTrackRecord(sb);

  console.log(`   ${APPLY ? 'Updated' : 'Would update'}: ${APPLY ? result.updated : result.would_update} positions`);
  console.log(`   Headline avg MOIC (clean early): ${result.headline_avg_moic ?? '—'}×`);
  console.log(`   Verified avg MOIC: ${track.oracle?.verified_avg_moic ?? '—'}×`);
  console.log(`   Best MOIC: ${result.best_moic ?? '—'}×\n`);

  if (!APPLY) console.log('   Pass --apply to write\n');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
