#!/usr/bin/env node
/**
 * Remove junk / headline artifacts from the public GOD leaderboard cohort.
 *
 *   node scripts/cleanup-top-god-rankings.mjs --min-god=70
 *   node scripts/cleanup-top-god-rankings.mjs --min-god=70 --apply
 */
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { isRankingsEligibleStartup } = require('../lib/rankingsEligibility.js');

const APPLY = process.argv.includes('--apply');
const minGodArg = process.argv.find((a) => a.startsWith('--min-god='));
const minGod = Number(minGodArg?.split('=')[1] || 70);
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const scanLimit = Math.min(Number(limitArg?.split('=')[1] || 5000), 20000);

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const { data, error } = await sb
    .from('startup_uploads')
    .select('id,name,website,company_domain,total_god_score,entity_gate,status,source_type')
    .eq('status', 'approved')
    .gte('total_god_score', minGod)
    .order('total_god_score', { ascending: false })
    .limit(scanLimit);

  if (error) throw error;

  const flagged = [];
  for (const row of data || []) {
    const check = isRankingsEligibleStartup(row);
    if (!check.ok) flagged.push({ ...row, reason: check.reason });
  }

  console.log(
    `\n📊 Top GOD cleanup · min_god=${minGod} · scanned=${data?.length || 0} · flagged=${flagged.length} · ${APPLY ? 'APPLY' : 'dry-run'}\n`
  );

  for (const row of flagged.slice(0, 40)) {
    console.log(`  ${row.total_god_score} ${row.name?.slice(0, 42)} — ${row.reason}`);
  }
  if (flagged.length > 40) console.log(`  … and ${flagged.length - 40} more`);

  if (!APPLY) {
    console.log('\n   Pass --apply to reject flagged approved rows\n');
    return;
  }

  const now = new Date().toISOString();
  let rejected = 0;
  const BATCH = 80;

  for (let i = 0; i < flagged.length; i += BATCH) {
    const batch = flagged.slice(i, i + BATCH);
    const ids = batch.map((r) => r.id);
    const { data: updated, error: upErr } = await sb
      .from('startup_uploads')
      .update({
        status: 'rejected',
        entity_gate: 'junk',
        entity_gate_reason: 'top_god_rankings_cleanup',
        entity_gate_at: now,
        admin_notes: 'Rejected: not eligible for public GOD rankings (junk identity)',
        reviewed_at: now,
      })
      .in('id', ids)
      .eq('status', 'approved')
      .select('id');

    if (upErr) throw upErr;
    rejected += updated?.length || 0;
  }

  console.log(`\n✅ Rejected ${rejected} approved startups\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
