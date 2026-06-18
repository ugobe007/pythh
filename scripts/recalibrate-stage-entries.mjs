#!/usr/bin/env node
/**
 * Recalibrate stage-based entry valuations to current benchmark bands.
 * Skips positions with a verified funding round on/before entry_date.
 *
 * Usage:
 *   node scripts/recalibrate-stage-entries.mjs
 *   node scripts/recalibrate-stage-entries.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { estimateEntryValuationUsd } from '../server/lib/stageValuationBenchmarks.js';
import { computePortfolioValue } from '../server/lib/portfolioAnalytics.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const MOIC_CAP = 50;
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function verifiedEntryRound(startupId, entryDate) {
  const { data } = await sb
    .from('portfolio_events')
    .select('post_money_usd, amount_usd, event_date, verified')
    .eq('startup_id', startupId)
    .eq('event_type', 'funding_round')
    .order('event_date', { ascending: false });
  const entryMs = entryDate ? new Date(entryDate).getTime() : Date.now();
  for (const e of data || []) {
    if (!e.verified) continue;
    const v = Number(e.post_money_usd) || Number(e.amount_usd) || 0;
    if (v > 0 && new Date(e.event_date).getTime() <= entryMs) return v;
  }
  return 0;
}

function calcMoic(entry, current) {
  if (!entry || !current) return 1;
  return Math.round((current / entry) * 100) / 100;
}

async function main() {
  console.log(`\n📐 Recalibrate stage entry valuations ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const { data: picks, error } = await sb
    .from('virtual_portfolio')
    .select('id, startup_id, status, entry_valuation_usd, current_valuation_usd, exit_valuation_usd, entry_god_score, entry_date, moic')
    .neq('status', 'written_off');
  if (error) throw error;

  const ids = [...new Set((picks || []).map((p) => p.startup_id))];
  const { data: startups } = await sb.from('startup_uploads').select('id, name, stage').in('id', ids);
  const meta = new Map((startups || []).map((s) => [s.id, s]));

  let updated = 0;
  console.log('company'.padEnd(22), 'stage'.padEnd(12), 'old'.padStart(8), 'new'.padStart(8), 'moic'.padStart(8));
  console.log('-'.repeat(66));

  for (const p of picks || []) {
    const su = meta.get(p.startup_id);
    if (!su) continue;
    const verified = await verifiedEntryRound(p.startup_id, p.entry_date);
    if (verified > 0) continue;

    const oldEntry = Number(p.entry_valuation_usd) || 0;
    const newEntry = estimateEntryValuationUsd(su.stage, p.entry_god_score);
    if (!newEntry || Math.abs(newEntry - oldEntry) < 50_000) continue;

    const mark = ['acquired', 'ipo', 'exited'].includes(p.status)
      ? Number(p.exit_valuation_usd) || Number(p.current_valuation_usd) || oldEntry
      : Number(p.current_valuation_usd) || oldEntry;
    const newMoic = Math.min(calcMoic(newEntry, mark), MOIC_CAP);

    console.log(
      su.name.slice(0, 21).padEnd(22),
      String(su.stage || 'pre-seed').slice(0, 11).padEnd(12),
      ('$' + (oldEntry / 1e6).toFixed(1) + 'M').padStart(8),
      ('$' + (newEntry / 1e6).toFixed(1) + 'M').padStart(8),
      (newMoic + 'x').padStart(8),
    );

    if (APPLY) {
      await sb.from('virtual_portfolio').update({
        entry_valuation_usd: newEntry,
        moic: newMoic,
      }).eq('id', p.id);
    }
    updated += 1;
  }

  console.log('-'.repeat(66));
  console.log(`\n${updated} position(s) ${APPLY ? 'updated' : 'to update'}.`);

  if (APPLY) {
    const v = await computePortfolioValue(sb);
    console.log(`Fund MOIC ${v.avg_moic}× | realized $${(v.realized_value_usd / 1e6).toFixed(2)}M | total $${(v.current_value_usd / 1e6).toFixed(2)}M`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
