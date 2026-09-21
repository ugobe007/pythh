#!/usr/bin/env node
/**
 * Press-verified MOIC proof for Pythh_1 and Pythh_2.
 *
 * Marks only from computeVerifiedMoic (post-entry verified rounds + signals).
 * Optionally attach trusted funding_evidence_events after each pick's entry
 * date as portfolio_events, then sync stored MOICs so leaked current_valuation
 * cannot keep a 30× mark with zero events.
 *
 *   npm run portfolio:moic-proof
 *   npm run portfolio:moic-proof -- --json
 *   npm run portfolio:moic-proof -- --apply
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';
import { loadFundingEvidenceLedger } from '../lib/loadFundingLibs.mjs';

const require = createRequire(import.meta.url);
const { computeVerifiedMoic, syncPortfolioMoicToDb } = require('../server/lib/portfolioAnalytics.js');
const { filterByFund, listFunds } = require('../server/lib/portfolioFunds.js');
const { applyCleanPortfolioMetrics, averageVerifiedMoic, postEntryFundingSets } = require('../server/lib/portfolioTrackRecord.js');
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const { classifyFundingEvidence } = loadFundingEvidenceLedger();

const APPLY = process.argv.includes('--apply');
const asJson = process.argv.includes('--json');
const PAGE = 1000;

const url = resolveSupabaseRestUrl().url;
const key = resolveSupabaseServiceKey();
const db = createClient(url, key, { auth: { persistSession: false } });

async function all(table, select, applyFilter) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    let q = db.from(table).select(select).range(offset, offset + PAGE - 1);
    if (applyFilter) q = applyFilter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function trustedLedgerEvent(event) {
  if (event.verification_status === 'rejected') return false;
  if (!classifyFundingEvidence({
    event_type: 'FUNDING',
    source_title: event.source_title,
    frame_confidence: 1,
    extraction_meta: { decision: 'ACCEPT', graph_safe: true },
  }).eligible) return false;
  if (['verified', 'corroborated'].includes(event.verification_status)) return true;
  return event.verification_status === 'observed' && assessFundingSource(event).trusted;
}

function scoreFund(fund, positions, events) {
  const metrics = applyCleanPortfolioMetrics({}, positions, events);
  const { verifiedFundedIds } = postEntryFundingSets(positions, events);
  const eventsByPortfolio = new Map();
  const eventsByStartup = new Map();
  for (const ev of events) {
    if (ev.event_type !== 'funding_round' || !ev.verified) continue;
    if (ev.portfolio_id) {
      if (!eventsByPortfolio.has(ev.portfolio_id)) eventsByPortfolio.set(ev.portfolio_id, []);
      eventsByPortfolio.get(ev.portfolio_id).push(ev);
    }
    if (ev.startup_id) {
      if (!eventsByStartup.has(ev.startup_id)) eventsByStartup.set(ev.startup_id, []);
      eventsByStartup.get(ev.startup_id).push(ev);
    }
  }

  const marks = [];
  for (const p of positions) {
    if (p.entity_quarantined) continue;
    const verifiedRounds = eventsByPortfolio.get(p.id) || eventsByStartup.get(p.startup_id) || [];
    const result = computeVerifiedMoic({
      status: p.status,
      entryValuation: p.entry_valuation_usd,
      exitValuation: p.exit_valuation_usd,
      verifiedRounds,
      signalEvents: [],
      entryDate: p.entry_date,
    });
    marks.push({
      id: p.id,
      startup_id: p.startup_id,
      name: p.startup_uploads?.name || p.startup_id,
      stored_moic: p.moic,
      verified_moic: result.moic,
      basis: result.basis,
      entered_late: result.enteredLate || p.entered_late,
      post_entry_verified_rounds: verifiedRounds.filter((ev) => {
        if (!p.entry_date || !ev.event_date) return false;
        return new Date(ev.event_date) >= new Date(p.entry_date);
      }).length,
    });
  }

  const marked = marks
    .filter((row) => row.basis === 'verified_round' || row.basis === 'exit')
    .sort((a, b) => b.verified_moic - a.verified_moic);

  return {
    fund: fund.key,
    name: fund.name,
    locked: fund.locked,
    positions: positions.length,
    verified_funded_picks: metrics.verified_funded_picks,
    verified_funded_rate_pct: metrics.verified_funded_rate_pct,
    verified_avg_moic: averageVerifiedMoic(positions, verifiedFundedIds),
    computed_verified_avg_moic: marked.length
      ? Math.round((marked.reduce((sum, row) => sum + row.verified_moic, 0) / marked.length) * 100) / 100
      : null,
    leaked_marks: marks.filter((row) => Number(row.stored_moic) > 1.05 && row.basis === 'cost').length,
    top_verified: marked.slice(0, 8),
  };
}

async function main() {
  const [positions, portfolioEvents, ledgerEvents] = await Promise.all([
    all(
      'virtual_portfolio',
      'id, startup_id, fund_key, status, entry_date, entry_valuation_usd, exit_valuation_usd, current_valuation_usd, moic, entity_quarantined, entered_late, startup_uploads(name)'
    ),
    all(
      'portfolio_events',
      'id, portfolio_id, startup_id, event_type, event_date, verified, post_money_usd, amount_usd, headline, source_url'
    ),
    all(
      'funding_evidence_events',
      'id,startup_id,announced_at,occurred_at,verification_status,source_url,source_publisher,source_title,metadata'
    ),
  ]);

  const pickByStartup = new Map(positions.map((p) => [p.startup_id, p]));
  const existingKeys = new Set(
    portfolioEvents
      .filter((ev) => ev.event_type === 'funding_round' && ev.startup_id && ev.event_date)
      .map((ev) => `${ev.startup_id}:${String(ev.event_date).slice(0, 10)}`)
  );

  const attach = [];
  for (const event of ledgerEvents) {
    const pick = pickByStartup.get(event.startup_id);
    if (!pick?.entry_date) continue;
    if (!trustedLedgerEvent(event)) continue;
    const at = event.occurred_at || event.announced_at;
    if (!at || new Date(at) < new Date(pick.entry_date)) continue;
    const key = `${event.startup_id}:${String(at).slice(0, 10)}`;
    if (existingKeys.has(key)) continue;
    const meta = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
    const post = Number(meta.post_money_usd || meta.valuation_usd || 0) || null;
    const amount = Number(meta.amount_usd || 0) || null;
    attach.push({
      startup_id: event.startup_id,
      portfolio_id: pick.id,
      fund_key: pick.fund_key || 'pythh_1',
      name: pick.startup_uploads?.name || event.startup_id,
      event_type: 'funding_round',
      event_date: at,
      headline: event.source_title,
      source_url: event.source_url,
      source_name: event.source_publisher,
      verified: true,
      post_money_usd: post,
      amount_usd: amount,
    });
    existingKeys.add(key);
  }

  let attached = 0;
  if (APPLY && attach.length) {
    for (const row of attach) {
      const { fund_key, name, ...payload } = row;
      const { error } = await db.from('portfolio_events').insert(payload);
      if (!error) attached += 1;
    }
  }

  const sync = await syncPortfolioMoicToDb(db, { apply: APPLY });

  const eventsAfter = APPLY
    ? await all(
        'portfolio_events',
        'id, portfolio_id, startup_id, event_type, event_date, verified, post_money_usd, amount_usd, headline, source_url'
      )
    : portfolioEvents;
  const positionsAfter = APPLY
    ? await all(
        'virtual_portfolio',
        'id, startup_id, fund_key, status, entry_date, entry_valuation_usd, exit_valuation_usd, current_valuation_usd, moic, entity_quarantined, entered_late, startup_uploads(name)'
      )
    : positions;

  const funds = listFunds().map((fund) =>
    scoreFund(fund, filterByFund(positionsAfter, fund.key), eventsAfter)
  );

  const report = {
    apply: APPLY,
    attached_post_entry_events: APPLY ? attached : 0,
    would_attach: attach.length,
    attach_examples: attach.slice(0, 20).map((row) => ({
      fund: row.fund_key,
      name: row.name,
      event_date: row.event_date,
      headline: row.headline,
      source_url: row.source_url,
    })),
    sync: {
      updated: sync.updated,
      would_update: sync.would_update,
      reset_examples: (sync.changes || [])
        .filter((row) => Math.abs(Number(row.delta) || 0) >= 0.5)
        .slice(0, 20),
    },
    funds,
    computed_at: new Date().toISOString(),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\nPortfolio MOIC proof · ${APPLY ? 'APPLY' : 'dry-run'}\n`);
  for (const fund of funds) {
    console.log(`  ${fund.name}  ${fund.locked ? 'LOCKED' : 'OPEN'}  picks ${fund.positions}`);
    console.log(`    verified funded: ${fund.verified_funded_picks} (${fund.verified_funded_rate_pct}%)`);
    console.log(`    verified avg MOIC: ${fund.verified_avg_moic ?? '—'}×`);
    console.log(`    leaked stored marks (no post-entry proof): ${fund.leaked_marks}`);
    for (const row of fund.top_verified.slice(0, 5)) {
      console.log(`      • ${row.name}  ${row.verified_moic}×  ${row.basis}  ${row.post_entry_verified_rounds} post-entry rounds`);
    }
    console.log('');
  }
  console.log(`  Would attach ${attach.length} trusted ledger events after entry`);
  console.log(`  Sync ${APPLY ? 'updated' : 'would update'} ${APPLY ? sync.updated : sync.would_update} stored MOICs\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
