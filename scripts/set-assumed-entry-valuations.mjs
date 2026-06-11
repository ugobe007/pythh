#!/usr/bin/env node
/**
 * SET ASSUMED SEED ENTRY VALUATIONS (signal-accretion model)
 * ==========================================================
 * Pythia's virtual fund invests at an assumed seed-stage entry. Per the fund's stated
 * methodology, every pick is entered at a uniform assumed post-money valuation in the
 * $10–15M band (default $12M). Value then accrues from press-verified rounds and
 * accumulated material signals (see server/lib/portfolioAnalytics.js).
 *
 * This normalizes entry_valuation_usd so MOIC reflects appreciation since the Oracle's
 * virtual seed check — NOT a recently-picked mature company measured against itself.
 *
 * Usage:
 *   node scripts/set-assumed-entry-valuations.mjs            # dry-run (default)
 *   node scripts/set-assumed-entry-valuations.mjs --apply
 *   node scripts/set-assumed-entry-valuations.mjs --apply --entry 12000000
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { computePortfolioValue } from '../server/lib/portfolioAnalytics.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const entryArg = process.argv.indexOf('--entry');
const ASSUMED_ENTRY = entryArg > -1 ? Number(process.argv[entryArg + 1]) : 12_000_000;

function sb() {
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function main() {
  const supabase = sb();
  const { data: rows, error } = await supabase
    .from('virtual_portfolio')
    .select('id, startup_id, status, entry_valuation_usd');
  if (error) throw new Error(error.message);

  const active = (rows || []).filter((r) => r.status !== 'written_off' && r.status !== 'dead');
  let changed = 0;
  for (const r of active) {
    if (Number(r.entry_valuation_usd) === ASSUMED_ENTRY) continue;
    changed += 1;
    if (APPLY) {
      const { error: upErr } = await supabase
        .from('virtual_portfolio')
        .update({ entry_valuation_usd: ASSUMED_ENTRY })
        .eq('id', r.id);
      if (upErr) console.error(`  ✗ ${r.id}: ${upErr.message}`);
    }
  }

  console.log(
    `${APPLY ? 'APPLIED' : 'DRY-RUN'} — assumed entry $${(ASSUMED_ENTRY / 1e6).toFixed(1)}M on ` +
      `${changed}/${active.length} active positions${APPLY ? ' updated' : ' would change'}.`
  );

  if (APPLY) {
    const pv = await computePortfolioValue(supabase);
    console.log('\n=== Portfolio after re-basing entry valuations ===');
    console.log(`Positions:        ${pv.positions} (${pv.early_positions} early · ${pv.entered_late_positions} entered-late)`);
    console.log(`Cost basis:       $${(pv.cost_basis_usd / 1e6).toFixed(2)}M`);
    console.log(`Current value:    $${(pv.current_value_usd / 1e6).toFixed(2)}M`);
    console.log(`Avg MOIC (early): ${pv.avg_moic_early}x   <- headline`);
    console.log(`Avg MOIC (all):   ${pv.avg_moic_capped}x   (incl. entered-late)`);
    console.log(`Entered-late MOIC:${pv.entered_late_avg_moic}x  across ${pv.entered_late_positions}`);
    console.log(`TVPI:             ${pv.tvpi}x`);
    console.log(`Above cost:       ${pv.marked_positions}/${pv.positions}`);
    console.log(`Quarantined:      ${pv.quarantined_positions}`);
    console.log(`\nTop contributors:`);
    for (const c of pv.top_contributors || []) {
      console.log(`  ${c.name}: ${c.moic}x (${c.basis})  +$${(c.gain_usd / 1e6).toFixed(2)}M`);
    }
    console.log(`\nNote: ${pv.note}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
