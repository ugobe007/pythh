#!/usr/bin/env node
/**
 * Update Oracle portfolio verified outcomes + MOIC.
 *
 * 1. Optionally re-run press verification (`--news` → Google RSS for no-URL stubs).
 * 2. Stamp stored URL + classifier-safe headlines as verified.
 * 3. Reclassify acquire headlines that were stored as funding_round.
 * 4. Fill post_money_usd on verified rows only (headline valuation, else dilution).
 * 5. Recalculate virtual_portfolio.moic from post-entry verified marks.
 *
 * Never rewrites existing plausible post-money. Never prices rumors or unverified Writer-style marks.
 *
 * Usage:
 *   node scripts/update-portfolio-verified-outcomes.mjs
 *   node scripts/update-portfolio-verified-outcomes.mjs --apply
 *   node scripts/update-portfolio-verified-outcomes.mjs --apply --news
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();
const require = createRequire(import.meta.url);
const {
  verifyStoredFundingEvent,
  shouldReclassifyAsAcquisition,
  proposeVerifiedPostMoney,
} = require('../server/lib/portfolioFundingVerify.js');
const { syncPortfolioMoicToDb, computeVerifiedMoic } = require('../server/lib/portfolioAnalytics.js');
const { applyCleanPortfolioMetrics, enrichPortfolioMetrics, computeTrackRecord } = require('../server/lib/portfolioTrackRecord.js');

const APPLY = process.argv.includes('--apply');
const USE_NEWS = process.argv.includes('--news');
const PAGE = 1000;
const WRITE_OFF = new Set(['written_off', 'dead', 'shutdown']);
const ROOT = path.dirname(fileURLToPath(import.meta.url));

function sb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  }
  return createClient(url, key);
}

async function fetchAll(client, table, columns, applyFilter) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = client.from(table).select(columns).range(from, from + PAGE - 1);
    if (applyFilter) q = applyFilter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function snapshotScoreboard(client) {
  const [metricsRow, positions, outcomeEvents, track] = await Promise.all([
    client.from('portfolio_metrics').select('*').maybeSingle(),
    fetchAll(client, 'virtual_portfolio', 'id, status, entry_date, entity_quarantined, entered_late, virtual_check_usd, moic'),
    fetchAll(
      client,
      'portfolio_events',
      'portfolio_id, event_type, event_date, verified',
      (q) => q.in('event_type', ['funding_round', 'acquisition', 'ipo'])
    ),
    computeTrackRecord(client),
  ]);
  const metrics = applyCleanPortfolioMetrics(
    enrichPortfolioMetrics(metricsRow.data || {}),
    positions,
    outcomeEvents
  );
  const cleanMoics = positions
    .filter((p) => !p.entity_quarantined && p.moic != null)
    .map((p) => Number(p.moic))
    .filter((n) => Number.isFinite(n));
  const positionAvg = cleanMoics.length
    ? Math.round((cleanMoics.reduce((a, b) => a + b, 0) / cleanMoics.length) * 100) / 100
    : null;
  return {
    verified_funded_picks: metrics.verified_funded_picks,
    verified_funded_rate_pct: metrics.verified_funded_rate_pct,
    funded_picks: metrics.funded_picks,
    headline_avg_moic: metrics.avg_moic ?? null,
    verified_avg_moic: track?.oracle?.verified_avg_moic ?? null,
    position_avg_moic: positionAvg,
    best_moic: metrics.best_moic ?? null,
    total_picks: metrics.total_picks,
    clean_picks: metrics.total_picks,
  };
}

function printScoreboard(label, snap) {
  console.log(`\n${label}`);
  console.log(`   Verified funded: ${snap.verified_funded_picks} / ${snap.total_picks} (${snap.verified_funded_rate_pct}%)`);
  console.log(`   Funded (incl. signal): ${snap.funded_picks}`);
  console.log(`   Headline avg MOIC: ${snap.headline_avg_moic ?? '—'}×`);
  console.log(`   Verified avg MOIC: ${snap.verified_avg_moic ?? '—'}×`);
  console.log(`   Position avg MOIC (clean): ${snap.position_avg_moic ?? '—'}×`);
  console.log(`   Best MOIC: ${snap.best_moic ?? '—'}×`);
}

function runNewsVerification() {
  const script = path.join(ROOT, 'verify-portfolio-funding.mjs');
  const args = [script];
  if (APPLY) args.push('--apply');
  else args.push('--dry-run');
  args.push('--news');
  console.log(`\n📰 Running stored + Google News verification (${APPLY ? 'apply' : 'dry-run'})…`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`verify-portfolio-funding exited ${result.status}`);
  }
}

async function main() {
  console.log(`\n📒 Portfolio verified outcomes + MOIC · ${APPLY ? 'APPLY' : 'dry-run'}${USE_NEWS ? ' · news' : ''}\n`);

  const client = sb();
  if (USE_NEWS) runNewsVerification();

  const before = await snapshotScoreboard(client);
  printScoreboard('Before', before);

  const events = await fetchAll(
    client,
    'portfolio_events',
    'id, startup_id, portfolio_id, event_type, event_date, verified, headline, amount_usd, post_money_usd, round_type, lead_investor, source_url, source_name'
  );
  const picks = await fetchAll(
    client,
    'virtual_portfolio',
    'id, startup_id, status, entry_date, entity_quarantined, entry_valuation_usd, exit_valuation_usd, moic, startup_uploads(id, name, website)'
  );
  const pickByStartup = new Map();
  const companyById = new Map();
  const writeOffStartups = new Set();
  for (const p of picks) {
    if (p.startup_id) pickByStartup.set(p.startup_id, p);
    const su = Array.isArray(p.startup_uploads) ? p.startup_uploads[0] : p.startup_uploads;
    if (su?.id) companyById.set(su.id, su);
    if (WRITE_OFF.has(p.status) && p.startup_id) writeOffStartups.add(p.startup_id);
  }

  const startupIds = [...new Set(events.map((e) => e.startup_id).filter((id) => id && !companyById.has(id)))];
  for (let i = 0; i < startupIds.length; i += 200) {
    const chunk = startupIds.slice(i, i + 200);
    const { data, error } = await client.from('startup_uploads').select('id, name, website').in('id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data || []) companyById.set(row.id, row);
  }

  let verified = 0;
  let reclassified = 0;
  let postMoney = 0;
  const postMoneySamples = [];

  for (const ev of events) {
    const company = companyById.get(ev.startup_id);
    const name = company?.name || ev.startup_id || 'unknown';

    if (shouldReclassifyAsAcquisition(ev, company || name)) {
      console.log(`  ↔ acquisition ${name}: ${(ev.headline || '').slice(0, 72)}`);
      if (APPLY) {
        const { error } = await client
          .from('portfolio_events')
          .update({ event_type: 'acquisition' })
          .eq('id', ev.id);
        if (error) throw new Error(error.message);
      }
      reclassified += 1;
      ev.event_type = 'acquisition';
      continue;
    }

    if (ev.event_type === 'funding_round' && !ev.verified) {
      const hit = verifyStoredFundingEvent(ev, company || name);
      if (hit) {
        console.log(`  ✓ verify ${name}: ${(hit.headline || ev.headline || '').slice(0, 72)}`);
        if (APPLY) {
          const { error } = await client
            .from('portfolio_events')
            .update({
              verified: true,
              source_url: hit.source_url,
              source_name: hit.source_name,
              headline: hit.headline,
              amount_usd: hit.amount_usd || ev.amount_usd,
              round_type: hit.round_type || ev.round_type,
              lead_investor: hit.lead_investor || ev.lead_investor,
            })
            .eq('id', ev.id);
          if (error) throw new Error(error.message);
        }
        ev.verified = true;
        ev.headline = hit.headline || ev.headline;
        ev.amount_usd = hit.amount_usd || ev.amount_usd;
        ev.round_type = hit.round_type || ev.round_type;
        verified += 1;
      }
    }

    if (writeOffStartups.has(ev.startup_id)) continue;
    const proposal = proposeVerifiedPostMoney(ev, company || name);
    if (!proposal) continue;
    console.log(
      `  $ ${name}: post-money ${proposal.post_money_usd.toLocaleString('en-US')} (${proposal.basis}) · ${(ev.headline || '').slice(0, 56)}`
    );
    if (APPLY) {
      const { error } = await client
        .from('portfolio_events')
        .update({ post_money_usd: proposal.post_money_usd })
        .eq('id', ev.id);
      if (error) throw new Error(error.message);
    }
    ev.post_money_usd = proposal.post_money_usd;
    postMoney += 1;
    if (postMoneySamples.length < 12) {
      postMoneySamples.push({ name, ...proposal });
    }
  }

  const pricedLifts = [];
  const roundsByPortfolio = new Map();
  for (const ev of events) {
    if (ev.event_type !== 'funding_round' || !ev.verified || !Number(ev.post_money_usd)) continue;
    if (!ev.portfolio_id) continue;
    if (!roundsByPortfolio.has(ev.portfolio_id)) roundsByPortfolio.set(ev.portfolio_id, []);
    roundsByPortfolio.get(ev.portfolio_id).push(ev);
  }
  for (const p of picks) {
    if (p.entity_quarantined) continue;
    const su = Array.isArray(p.startup_uploads) ? p.startup_uploads[0] : p.startup_uploads;
    const result = computeVerifiedMoic({
      status: p.status,
      entryValuation: p.entry_valuation_usd,
      exitValuation: p.exit_valuation_usd,
      verifiedRounds: roundsByPortfolio.get(p.id) || [],
      signalEvents: [],
      entryDate: p.entry_date,
    });
    const prior = Number(p.moic) || 1;
    if (result.basis === 'verified_round' && result.moic > prior + 0.01) {
      pricedLifts.push({
        name: su?.name || p.id,
        prior_moic: Math.round(prior * 100) / 100,
        moic: Math.round(result.moic * 100) / 100,
        basis: result.basis,
        delta: Math.round((result.moic - prior) * 100) / 100,
      });
    }
  }
  pricedLifts.sort((a, b) => b.delta - a.delta);

  let moic = { updated: 0, would_update: picks.length, changes: pricedLifts };
  if (APPLY) {
    console.log('\n📐 Recalculating MOIC (apply)…');
    moic = await syncPortfolioMoicToDb(client, { apply: true });
  } else {
    console.log('\n📐 MOIC preview from priced verified rounds (dry-run, no signal accretion)…');
  }
  const lifted = pricedLifts.slice(0, 12);

  const after = APPLY ? await snapshotScoreboard(client) : null;
  if (after) printScoreboard('After', after);
  else {
    console.log('\nAfter (preview — pass --apply to write)');
    console.log(`   Would verify: ${verified}`);
    console.log(`   Would reclassify acquisitions: ${reclassified}`);
    console.log(`   Would fill post-money: ${postMoney}`);
    console.log(`   Would touch MOIC rows: ${moic.would_update}`);
  }

  console.log('\nSummary');
  console.log(`   Newly verified stored events: ${verified}`);
  console.log(`   Reclassified as acquisition: ${reclassified}`);
  console.log(`   Verified post-money fills: ${postMoney}`);
  console.log(`   MOIC ${APPLY ? 'updated' : 'would update'}: ${APPLY ? moic.updated : moic.would_update}`);
  if (lifted.length) {
    console.log('   Largest MOIC lifts:');
    for (const row of lifted) {
      console.log(`     ${row.name || row.id}: ${row.prior_moic}× → ${row.moic}× (${row.basis})`);
    }
  }
  if (!APPLY) console.log('\n   Pass --apply to write. Add --news to search Google RSS for no-URL stubs.\n');
  else console.log('');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
