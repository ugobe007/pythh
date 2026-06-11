#!/usr/bin/env node
/**
 * VIRTUAL FOLLOW-ON FUND — forward-only "double down" detector
 * ===========================================================
 * Thesis: if Pythia can spot winners early, she should press her bets. When a company
 * already in the seed portfolio closes a LATER-STAGE round GOING FORWARD, this records a
 * $500K virtual follow-on at the round's REAL post-money valuation. MOIC is tracked from
 * that honest entry — a secondary, late-stage performance variable.
 *
 * Forward-only: only funding rounds with event_date >= the fund's inception
 * (FOLLOWON_INCEPTION_DATE, default 2026-06-12) qualify. Everything already on the books
 * is excluded — the fund starts empty and fills as new rounds land. No backfilling past
 * events, no counterfactual entries.
 *
 * Eligibility for a follow-on:
 *   • the startup is a Pythia seed pick (present in virtual_portfolio), AND
 *   • it closed a verified funding_round on/after inception with post-money >= $100M
 *     (later stage — a "quickly growing" company), AND
 *   • that exact round hasn't already been followed on (unique on entry_event_id).
 *
 * Usage:
 *   node scripts/cron/followon-fund.mjs            # dry-run (default)
 *   node scripts/cron/followon-fund.mjs --apply
 *   node scripts/cron/followon-fund.mjs --apply --since 2026-01-01   # override inception (e.g. backtest)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const sinceArg = process.argv.indexOf('--since');
const INCEPTION =
  sinceArg > -1
    ? process.argv[sinceArg + 1]
    : process.env.FOLLOWON_INCEPTION_DATE || '2026-06-12T00:00:00Z';
const CHECK_USD = Number(process.env.FOLLOWON_CHECK_USD) || 500_000;
const LATE_STAGE_MIN_USD = Number(process.env.FOLLOWON_MIN_POSTMONEY_USD) || 100_000_000;
const MAX_PLAUSIBLE_USD = 15_000_000_000;

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const m = (n) => {
  const v = Number(n) || 0;
  return v < 1e6 ? '$' + Math.round(v / 1e3) + 'K' : '$' + (v / 1e6).toFixed(0) + 'M';
};

async function main() {
  console.log(`\n🎯 Follow-on fund scan ${APPLY ? '(APPLY)' : '(dry-run)'}`);
  console.log(`   Inception (forward-only): ${INCEPTION}`);
  console.log(`   Check: ${m(CHECK_USD)} · later-stage gate: post-money >= ${m(LATE_STAGE_MIN_USD)}\n`);

  // 1. Pythia's seed winners — map startup_id -> seed position (for the link + GOD score).
  const { data: seeds, error: seedErr } = await supabase
    .from('virtual_portfolio')
    .select('id, startup_id, entry_god_score');
  if (seedErr) throw new Error(seedErr.message);
  const seedByStartup = new Map();
  for (const s of seeds || []) if (s.startup_id) seedByStartup.set(s.startup_id, s);

  // 2. Forward-only later-stage rounds among those winners.
  const { data: rounds, error: evErr } = await supabase
    .from('portfolio_events')
    .select('id, startup_id, event_date, post_money_usd, round_type, headline, source_url, verified')
    .eq('event_type', 'funding_round')
    .eq('verified', true)
    .gte('event_date', INCEPTION)
    .gte('post_money_usd', LATE_STAGE_MIN_USD)
    .lte('post_money_usd', MAX_PLAUSIBLE_USD)
    .order('event_date', { ascending: true });
  if (evErr) throw new Error(evErr.message);

  // 3. Idempotency: skip rounds already followed, and skip startups that already have an
  // ACTIVE follow-on (one active follow-on per company — guards against duplicate event
  // rows for the same raise creating multiple positions).
  const { data: existing } = await supabase
    .from('virtual_followon_portfolio')
    .select('entry_event_id, startup_id, status');
  const followedEvents = new Set((existing || []).map((r) => r.entry_event_id).filter(Boolean));
  const activeFollowStartups = new Set(
    (existing || []).filter((r) => r.status === 'active').map((r) => r.startup_id)
  );

  // Earliest qualifying round per startup (dedupe noisy duplicate event rows).
  const firstRoundByStartup = new Map();
  for (const r of rounds || []) {
    if (!seedByStartup.has(r.startup_id)) continue; // must be a Pythia seed pick
    if (followedEvents.has(r.id)) continue; // this exact round already followed
    if (activeFollowStartups.has(r.startup_id)) continue; // already has an active follow-on
    if (!firstRoundByStartup.has(r.startup_id)) firstRoundByStartup.set(r.startup_id, r);
  }
  const candidates = [...firstRoundByStartup.values()];

  // Resolve names for output.
  const ids = [...new Set(candidates.map((c) => c.startup_id))];
  const nameMap = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from('startup_uploads').select('id, name').in('id', ids.slice(i, i + 200));
    (data || []).forEach((r) => nameMap.set(r.id, r.name));
  }

  if (!candidates.length) {
    console.log('No new qualifying later-stage rounds since inception. Fund unchanged.');
    console.log('(This is expected at launch — the fund fills as future rounds land.)');
    await summarize();
    return;
  }

  console.log(`${candidates.length} new follow-on candidate(s):\n`);
  let added = 0;
  for (const r of candidates) {
    const seed = seedByStartup.get(r.startup_id);
    const name = nameMap.get(r.startup_id) || r.startup_id;
    console.log(
      `  ${name.slice(0, 26).padEnd(27)} ${(r.round_type || 'round').padEnd(12)} ${m(r.post_money_usd).padStart(8)}  ${String(r.event_date).slice(0, 10)}`
    );

    if (APPLY) {
      const { error: insErr } = await supabase.from('virtual_followon_portfolio').insert({
        startup_id: r.startup_id,
        seed_portfolio_id: seed.id,
        entry_event_id: r.id,
        entry_date: r.event_date,
        entry_round_type: r.round_type || null,
        entry_valuation_usd: Math.round(Number(r.post_money_usd)),
        current_valuation_usd: Math.round(Number(r.post_money_usd)),
        moic: 1.0,
        entry_god_score: seed.entry_god_score || null,
        entry_rationale: `Follow-on: ${name} closed ${r.round_type || 'a later-stage round'} at ${m(r.post_money_usd)} post-money — doubling down on a Pythia seed winner.`,
        source_url: r.source_url || null,
        check_usd: CHECK_USD,
      });
      if (insErr) console.error(`     ✗ insert failed: ${insErr.message}`);
      else added += 1;
    }
  }

  console.log(`\n${APPLY ? `Added ${added} follow-on position(s).` : 'Dry-run — re-run with --apply to record.'}`);
  await summarize();
}

async function summarize() {
  const { data: pos } = await supabase
    .from('virtual_followon_portfolio')
    .select('check_usd, entry_valuation_usd, current_valuation_usd, status')
    .eq('status', 'active');
  const n = (pos || []).length;
  const deployed = (pos || []).reduce((a, p) => a + (Number(p.check_usd) || 0), 0);
  console.log(`\n📊 Follow-on fund: ${n} active position(s), ${m(deployed)} deployed.`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
