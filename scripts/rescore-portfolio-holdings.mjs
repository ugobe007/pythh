#!/usr/bin/env node
/**
 * Re-score active virtual_portfolio holdings using hotGod SSOT + guardrails.
 *
 *   node scripts/rescore-portfolio-holdings.mjs
 *   node scripts/rescore-portfolio-holdings.mjs --dry-run
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { healPortfolioHoldings } = require('../lib/portfolioScoreGuardrails.js');

const DRY = process.argv.includes('--dry-run');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log(`\n🛡️  Portfolio score guardrails${DRY ? ' (dry-run)' : ''}\n`);

const results = await healPortfolioHoldings(sb, {
  dryRun: DRY,
  log: (msg) => console.log(msg),
});

console.log(
  `\nChecked: ${results.checked} | Healed: ${results.healed} | OK: ${results.ok} | Errors: ${results.errors.length}\n`
);

if (results.errors.length) {
  results.errors.forEach((e) => console.error(`  ✗ ${e.startup_id}: ${e.message}`));
  process.exit(1);
}
