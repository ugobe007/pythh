#!/usr/bin/env node
/**
 * Seed Pythh_2: top GOD first, then mix industry types.
 *
 * Usage:
 *   npm run portfolio:seed-pythh-2
 *   npm run portfolio:seed-pythh-2:apply
 */
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

const __dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dir, '../.env') });

const require = createRequire(import.meta.url);
const { isFundLocked, lockNote } = require('../server/lib/fundLock.js');
const { PYTHH_2 } = require('../server/lib/portfolioFunds.js');
const {
  DEFAULTS,
  selectPythh2Book,
  buildPythh2InsertRow,
} = require('../server/lib/pythh2Construction.js');

if (isFundLocked(PYTHH_2)) {
  console.error('🔒  ' + lockNote(PYTHH_2));
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const targetArg = process.argv.find((a) => a.startsWith('--target='));
const minGodArg = process.argv.find((a) => a.startsWith('--min-god='));
const target = targetArg ? parseInt(targetArg.split('=')[1], 10) : DEFAULTS.target;
const minGod = minGodArg ? parseInt(minGodArg.split('=')[1], 10) : DEFAULTS.minGod;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
  console.error('Missing SUPABASE_URL');
  process.exit(1);
}

async function fetchQualified() {
  const page = 1000;
  let from = 0;
  const rows = [];
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, website, tagline, sectors, stage, status, entity_gate, total_god_score, valuation_usd, total_funding_usd')
      .eq('status', 'approved')
      .eq('entity_gate', 'qualified')
      .gte('total_god_score', DEFAULTS.minGodFloor)
      .order('total_god_score', { ascending: false })
      .range(from, from + page - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < page) break;
    from += page;
  }
  return rows;
}

async function main() {
  console.log(`\n📘  Pythh_2 construction  ${APPLY ? 'APPLY' : 'dry-run'}`);
  console.log(`    target ${target} · min GOD ${minGod} · sector cap ${DEFAULTS.sectorCap}\n`);

  const startups = await fetchQualified();
  const { data: existing, error: exErr } = await supabase
    .from('virtual_portfolio')
    .select('startup_id, fund_key');
  if (exErr) throw exErr;
  const takenIds = (existing || []).map((r) => r.startup_id);
  const alreadyTwo = (existing || []).filter((r) => r.fund_key === PYTHH_2).length;

  const effectiveTarget = Math.max(0, target - alreadyTwo);
  const book = selectPythh2Book(startups, { takenIds, target: effectiveTarget, minGod });
  console.log(`   pool ${book.stats.considered} · eligible ${book.stats.eligible} · pick ${book.stats.picked}`);
  console.log(`   GOD ${book.stats.minGod}–${book.stats.maxGod} avg ${book.stats.avgGod}`);
  console.log(`   industries: ${book.stats.byIndustry.map((s) => `${s.industry} ${s.count}`).join(' · ')}`);
  console.log('');
  for (const p of book.picks) {
    const sector = Array.isArray(p.sectors) ? p.sectors[0] : p.sectors || '';
    console.log(`   ${String(p.god).padStart(3)}  ${(p.name || '').padEnd(28)}  ${(p.industry || '').padEnd(22)}  ${sector}`);
  }

  const reportDir = join(__dir, '../reports');
  mkdirSync(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(reportDir, `pythh-2-seed-${stamp}.json`);
  writeFileSync(reportPath, JSON.stringify({
    apply: APPLY,
    already_pythh_2: alreadyTwo,
    stats: book.stats,
    picks: book.picks.map((p) => ({
      id: p.id,
      name: p.name,
      god: p.god,
      industry: p.industry,
      sectors: p.sectors,
      website: p.website,
      stage: p.stage,
    })),
  }, null, 2));
  console.log(`\n   report ${reportPath}`);

  if (!APPLY) {
    console.log('\n🔍  Dry run — pass --apply to write Pythh_2. Marks stay 1.0×.\n');
    return;
  }

  if (alreadyTwo > 0) {
    console.log(`\n   Pythh_2 already has ${alreadyTwo} rows — inserting only new picks.\n`);
  }

  const now = new Date();
  let added = 0;
  let failed = 0;
  for (const su of book.picks) {
    const row = buildPythh2InsertRow(su, { now, addedBy: 'pythh-2-construction' });
    const { error } = await supabase.from('virtual_portfolio').insert(row);
    if (error) {
      console.warn(`  ⚠  ${su.name}: ${error.message}`);
      failed += 1;
    } else {
      added += 1;
    }
  }
  console.log(`\n✅  Pythh_2 seeded — added ${added}, failed ${failed}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
