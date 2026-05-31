#!/usr/bin/env node
'use strict';

/**
 * Quarantine data directories / aggregators misclassified as investors.
 * Marks investors inactive, sets entity_gate junk, deletes match rows.
 *
 *   node scripts/remove-non-investor-aggregators.js
 *   node scripts/remove-non-investor-aggregators.js --dry-run
 */

require('dotenv').config({ quiet: true });

const { createClient } = require('@supabase/supabase-js');
const { isNonInvestorAggregator } = require('../lib/investorAggregatorBlocklist');

const dryRun = process.argv.includes('--dry-run');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function fetchAllInvestors() {
  const out = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('investors')
      .select('id, name, firm, status, entity_gate')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return out;
}

async function deleteMatchesForInvestor(investorId) {
  let deleted = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_investor_matches')
      .select('id')
      .eq('investor_id', investorId)
      .limit(500);
    if (error) throw error;
    if (!data?.length) break;
    const ids = data.map((r) => r.id);
    if (dryRun) {
      deleted += ids.length;
      if (ids.length < 500) break;
      continue;
    }
    const { error: delErr } = await supabase
      .from('startup_investor_matches')
      .delete()
      .in('id', ids);
    if (delErr) throw delErr;
    deleted += ids.length;
    if (ids.length < 500) break;
  }
  return deleted;
}

async function main() {
  console.log(dryRun ? '🔍 Dry run — no writes' : '🧹 Removing non-investor aggregators…');

  const investors = await fetchAllInvestors();
  const hits = investors.filter(isNonInvestorAggregator);

  if (hits.length === 0) {
    console.log('✅ No aggregator investors found');
    return;
  }

  console.log(`Found ${hits.length} aggregator(s):`);
  for (const inv of hits) {
    console.log(`  - ${inv.name} | ${inv.firm} (${inv.id}) status=${inv.status}`);
  }

  for (const inv of hits) {
    const matchCount = await deleteMatchesForInvestor(inv.id);
    console.log(`  ${inv.name}: ${matchCount} match row(s) ${dryRun ? 'would delete' : 'deleted'}`);

    if (!dryRun) {
      const { error } = await supabase
        .from('investors')
        .update({
          status: 'inactive',
          entity_gate: 'junk',
          updated_at: new Date().toISOString(),
        })
        .eq('id', inv.id);
      if (error) throw error;
    }
  }

  console.log(dryRun ? 'Done (dry run).' : '✅ Aggregators quarantined');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
