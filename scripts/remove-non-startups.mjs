/**
 * Remove known non-startups from virtual_portfolio and mark them rejected
 * in startup_uploads so they never get re-seeded.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const REMOVE = [
  { portfolioId: '384f3b65-2981-48c1-a44f-fcac14945d29', startupId: 'aaad74a9-e9c8-4188-92be-2cf45278e03d', name: 'Bloomberg' },
  { portfolioId: '864c1fa9-d0e1-4ea7-bcd2-3413a82a052b', startupId: 'a236733d-8f57-4ab6-93db-105d15130b01', name: 'BingX' },
];

console.log('\n🧹 Removing non-startups from virtual portfolio\n');

for (const r of REMOVE) {
  const { error: pe } = await sb.from('virtual_portfolio').delete().eq('id', r.portfolioId);
  console.log(`  Removed from virtual_portfolio [${r.name}]:`, pe?.message ?? '✅ OK');

  const { error: se } = await sb.from('startup_uploads').update({ status: 'rejected' }).eq('id', r.startupId);
  console.log(`  Marked rejected in startup_uploads [${r.name}]:`, se?.message ?? '✅ OK');
}

// Fix Yotta: null stage got old $3M base — correct to $15M pre-seed floor
const { error: ye } = await sb.from('virtual_portfolio')
  .update({ entry_valuation_usd: 15000000, current_valuation_usd: 15000000 })
  .eq('id', '028a8c48-060a-4aa9-9568-9f67d18236c6');
console.log('\n  Corrected Yotta valuation (null stage → $15M):', ye?.message ?? '✅ OK');

console.log('\n✅ Done\n');
