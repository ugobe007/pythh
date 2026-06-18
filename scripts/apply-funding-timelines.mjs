#!/usr/bin/env node
/**
 * Apply funding-timeline-based valuations to all portfolio positions.
 * Timing first: entry = last verified round on/before pick; mark = next round or exit.
 *
 * Usage:
 *   node scripts/apply-funding-timelines.mjs
 *   node scripts/apply-funding-timelines.mjs --apply
 *   node scripts/apply-funding-timelines.mjs --apply --name Treeline
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolvePositionValuation } from '../server/lib/fundingTimelineService.js';
import { computePortfolioValue } from '../server/lib/portfolioAnalytics.js';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const nameArg = process.argv.indexOf('--name');
const ONLY_NAME = nameArg > -1 ? process.argv[nameArg + 1] : null;

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function calcIrr(entry, current, days) {
  if (!entry || !current || days < 1) return null;
  const raw = Math.pow(current / entry, 1 / (days / 365)) - 1;
  if (!Number.isFinite(raw)) return null;
  return Math.round(Math.min(raw, 9999.9999) * 10000) / 10000;
}

async function main() {
  console.log(`\n⏱️  Funding timeline valuation ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const { data: picks, error } = await sb
    .from('virtual_portfolio')
    .select('id, startup_id, status, entry_valuation_usd, current_valuation_usd, exit_valuation_usd, exit_date, entry_god_score, entry_date, moic')
    .neq('status', 'written_off');
  if (error) throw error;

  const ids = [...new Set((picks || []).map((p) => p.startup_id))];
  const [{ data: startups }, { data: allEvents }] = await Promise.all([
    sb.from('startup_uploads').select('id, name, stage').in('id', ids),
    sb.from('portfolio_events').select('*').in('startup_id', ids),
  ]);

  const meta = new Map((startups || []).map((s) => [s.id, s]));
  const eventsByStartup = new Map();
  for (const e of allEvents || []) {
    if (!eventsByStartup.has(e.startup_id)) eventsByStartup.set(e.startup_id, []);
    eventsByStartup.get(e.startup_id).push(e);
  }

  let rows = (picks || []).map((p) => ({ p, su: meta.get(p.startup_id) })).filter((r) => r.su);
  if (ONLY_NAME) rows = rows.filter((r) => r.su.name.toLowerCase().includes(ONLY_NAME.toLowerCase()));

  console.log(
    'company'.padEnd(20),
    'entry→mark'.padEnd(14),
    'basis'.padEnd(14),
    'old'.padStart(7),
    'new'.padStart(7),
    'moic'.padStart(7),
    'next'.padStart(6),
  );
  console.log('-'.repeat(82));

  let updated = 0;
  for (const { p, su } of rows) {
    const events = eventsByStartup.get(p.startup_id) || [];
    const resolved = resolvePositionValuation({
      events,
      entryDate: p.entry_date,
      exitDate: p.exit_date,
      status: p.status,
      exitValuationUsd: p.exit_valuation_usd,
      stage: su.stage,
      entryGodScore: p.entry_god_score,
    });

    const oldEntry = Number(p.entry_valuation_usd) || 0;
    const newEntry = resolved.entry_valuation_usd;
    const newMark = resolved.mark_valuation_usd;
    const isExit = ['acquired', 'ipo', 'exited'].includes(p.status);

    const entryLabel = resolved.entry_round_type || 'est';
    const markLabel = resolved.mark_round_type || resolved.mark_basis;
    const daysNext = resolved.days_to_next_round != null ? `${resolved.days_to_next_round}d` : '—';

    console.log(
      su.name.slice(0, 19).padEnd(20),
      `${entryLabel}→${markLabel}`.slice(0, 13).padEnd(14),
      resolved.entry_basis.slice(0, 13).padEnd(14),
      ('$' + (oldEntry / 1e6).toFixed(0) + 'M').padStart(7),
      ('$' + (newEntry / 1e6).toFixed(0) + 'M').padStart(7),
      (resolved.moic + 'x').padStart(7),
      daysNext.padStart(6),
    );

    if (APPLY) {
      const upd = {
        entry_valuation_usd: newEntry,
        moic: resolved.moic,
        holding_days: resolved.holding_days,
        irr_annualized: calcIrr(newEntry, newMark, resolved.holding_days),
      };
      if (isExit) {
        upd.current_valuation_usd = newMark;
      } else {
        upd.current_valuation_usd = newMark;
      }
      await sb.from('virtual_portfolio').update(upd).eq('id', p.id);
    }
    updated += 1;
  }

  console.log('-'.repeat(82));
  console.log(`\n${updated} position(s) ${APPLY ? 'updated' : 'previewed'}.`);

  if (APPLY) {
    const v = await computePortfolioValue(sb);
    console.log(
      `Fund MOIC ${v.avg_moic}× | realized $${(v.realized_value_usd / 1e6).toFixed(2)}M | total $${(v.current_value_usd / 1e6).toFixed(2)}M`,
    );
  } else {
    console.log('\n(dry-run — re-run with --apply to book timed valuations.)');
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
