#!/usr/bin/env node
/**
 * Report portfolio picks with junk/rejected/quarantined identity.
 *
 *   node scripts/audit-portfolio-identity.mjs
 *   node scripts/audit-portfolio-identity.mjs --apply   # write off active ineligible picks
 */
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { isPortfolioPublicEligible } = require('../lib/portfolioServeGate.js');

const APPLY = process.argv.includes('--apply');
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const { data: rows, error } = await sb
    .from('virtual_portfolio')
    .select(
      'id, startup_id, status, entity_quarantined, entity_quarantine_reason, notes, startup_uploads(name, website, entity_gate, status, source_type)'
    )
    .in('status', ['active', 'acquired', 'ipo', 'exited', 'written_off']);

  if (error) throw error;

  const ineligible = [];
  let writtenOff = 0;

  for (const row of rows || []) {
    const su = Array.isArray(row.startup_uploads) ? row.startup_uploads[0] : row.startup_uploads;
    const entry = {
      entity_quarantined: row.entity_quarantined,
      startup_name: su?.name,
    };
    const eligible = isPortfolioPublicEligible(entry, su);
    if (!eligible) {
      ineligible.push({
        portfolio_id: row.id,
        startup_id: row.startup_id,
        name: su?.name,
        website: su?.website,
        vp_status: row.status,
        entity_gate: su?.entity_gate,
        su_status: su?.status,
        quarantined: row.entity_quarantined,
        quarantine_reason: row.entity_quarantine_reason,
        source_type: su?.source_type,
      });

      if (APPLY && row.status === 'active') {
        const reason =
          row.entity_quarantine_reason ||
          (su?.entity_gate === 'junk'
            ? `entity_gate=${su?.entity_gate}`
            : `status=${su?.status}`);
        const { error: upErr } = await sb
          .from('virtual_portfolio')
          .update({
            status: 'written_off',
            notes: `Auto-written off: identity gate (${reason})`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        if (upErr) console.warn(`  ⚠ write-off failed ${su?.name}: ${upErr.message}`);
        else writtenOff++;
      }
    }
  }

  console.log(`\n📋 Portfolio identity audit — ${ineligible.length} ineligible / ${rows?.length || 0} total`);
  for (const r of ineligible.slice(0, 40)) {
    console.log(
      `  • ${r.name} (${r.startup_id}) vp=${r.vp_status} gate=${r.entity_gate} su=${r.su_status} quarantine=${r.quarantined}`
    );
  }
  if (ineligible.length > 40) console.log(`  … and ${ineligible.length - 40} more`);

  if (APPLY) console.log(`\n✅ Written off ${writtenOff} active picks`);
  else if (ineligible.some((r) => r.vp_status === 'active')) {
    console.log('\n   Pass --apply to write off active ineligible picks\n');
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
