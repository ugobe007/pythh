#!/usr/bin/env node
/**
 * Investor deal backfill — evidence onto profiles so investor cards can show deals.
 *
 * 1. Verified or corroborated funding-ledger rows already linked to the investor.
 * 2. News only when the ledger has nothing: one reviewed source, or two independent
 *    publishers, and the firm is an explicit participant in the headline.
 *
 * Dry-run unless --apply. Does not call a paid model.
 *
 *   npm run investors:deals:backfill -- --limit=40
 *   npm run investors:deals:backfill -- --apply --limit=40 --search-limit=12 --delay=800
 *   npm run investors:deals:backfill -- --apply --skip-search --limit=80
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  dealsFromLedger,
  dealsFromEvidenceArticles,
  profilePatch,
  hasStoredDeals,
} = require('../../lib/investorDealBackfill.js');
const { searchInvestorNews } = require('../../server/services/investorInferenceService.js');

const apply = process.argv.includes('--apply');
const skipSearch = process.argv.includes('--skip-search');
const limit = Math.max(1, Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 40));
const searchLimit = Math.max(0, Number(process.argv.find((arg) => arg.startsWith('--search-limit='))?.split('=')[1] || 12));
const delay = Math.max(0, Number(process.argv.find((arg) => arg.startsWith('--delay='))?.split('=')[1] || 800));

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase service environment');
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cardInvestorIds() {
  const { data, error } = await db
    .from('startup_investor_matches')
    .select('investor_id, match_score')
    .order('match_score', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`match scan: ${error.message}`);
  const ids = [];
  const seen = new Set();
  for (const row of data || []) {
    const id = row.investor_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function loadInvestors(ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data, error } = await db
      .from('investors')
      .select('id, name, firm, type, investor_type, notable_investments, portfolio_companies, last_investment_date, entity_gate, status, investor_score')
      .in('id', slice);
    if (error) throw new Error(`investor load: ${error.message}`);
    rows.push(...(data || []));
  }
  return rows;
}

async function loadParticipants(ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 40) {
    const slice = ids.slice(i, i + 40);
    const { data, error } = await db
      .from('funding_evidence_participants')
      .select('investor_id, funding_event_id, participant_role')
      .in('investor_id', slice)
      .limit(1000);
    if (error) throw new Error(`participants: ${error.message}`);
    rows.push(...(data || []));
  }
  return rows;
}

async function loadEvents(ids) {
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 80) {
    const slice = ids.slice(i, i + 80);
    const { data, error } = await db
      .from('funding_evidence_events')
      .select('id, startup_id, amount_usd, announced_at, occurred_at, round_type, verification_status')
      .in('id', slice)
      .in('verification_status', ['verified', 'corroborated']);
    if (error) throw new Error(`events: ${error.message}`);
    for (const row of data || []) byId.set(String(row.id), row);
  }
  return byId;
}

async function loadStartups(ids) {
  const byId = new Map();
  for (let i = 0; i < ids.length; i += 80) {
    const slice = ids.slice(i, i + 80);
    const { data, error } = await db
      .from('startup_uploads')
      .select('id, name, entity_gate, status')
      .in('id', slice);
    if (error) throw new Error(`startups: ${error.message}`);
    for (const row of data || []) byId.set(String(row.id), row);
  }
  return byId;
}

async function firmProfile(investor) {
  const firm = String(investor.firm || '').trim();
  if (!firm || firm.toLowerCase() === String(investor.name || '').trim().toLowerCase()) return null;
  const { data, error } = await db
    .from('investors')
    .select('id, name, firm, notable_investments, portfolio_companies, last_investment_date')
    .eq('name', firm)
    .eq('firm', firm)
    .eq('entity_gate', 'qualified')
    .limit(2);
  if (error) throw new Error(`firm profile: ${error.message}`);
  const row = (data || []).find((item) => item.id !== investor.id);
  return row || null;
}

async function writePatch(investor, patch) {
  const { error } = await db.from('investors').update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq('id', investor.id);
  if (error) throw new Error(`update ${investor.name}: ${error.message}`);
}

async function main() {
  const matchIds = await cardInvestorIds();
  const loaded = await loadInvestors(matchIds);
  const empty = loaded.filter((row) => (
    String(row.entity_gate || '') === 'qualified'
    && String(row.status || '') === 'active'
    && !hasStoredDeals(row)
  ));
  const participants = await loadParticipants(empty.map((row) => row.id));
  const withLedger = new Set(participants.map((row) => String(row.investor_id)));
  empty.sort((a, b) => {
    const aLedger = withLedger.has(String(a.id)) ? 1 : 0;
    const bLedger = withLedger.has(String(b.id)) ? 1 : 0;
    return bLedger - aLedger || (Number(b.investor_score) || 0) - (Number(a.investor_score) || 0);
  });
  const batch = empty.slice(0, limit);
  const batchIds = new Set(batch.map((row) => String(row.id)));
  const batchParticipants = participants.filter((row) => batchIds.has(String(row.investor_id)));
  const eventsById = await loadEvents([...new Set(batchParticipants.map((row) => row.funding_event_id).filter(Boolean))]);
  const startupsById = await loadStartups([...new Set([...eventsById.values()].map((event) => event.startup_id).filter(Boolean))]);

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    card_investors_scanned: loaded.length,
    missing_deals: empty.length,
    batch: batch.length,
    ledger_writes: 0,
    news_writes: 0,
    unchanged: 0,
    samples: [],
  };

  const stillEmpty = [];
  for (const investor of batch) {
    const incoming = dealsFromLedger({
      investorId: investor.id,
      participants: batchParticipants,
      eventsById,
      startupsById,
    });
    const patch = profilePatch(investor, incoming);
    if (!patch) {
      stillEmpty.push(investor);
      summary.unchanged += 1;
      continue;
    }
    summary.ledger_writes += 1;
    if (summary.samples.length < 8) {
      summary.samples.push({
        name: investor.name,
        firm: investor.firm,
        source: 'funding_ledger',
        deals: patch.notable_investments.map((deal) => deal.company),
      });
    }
    if (apply) {
      await writePatch(investor, patch);
      const firm = await firmProfile(investor);
      if (firm) {
        const firmPatch = profilePatch(firm, incoming);
        if (firmPatch) await writePatch(firm, firmPatch);
      }
    }
  }

  let searched = 0;
  if (!skipSearch) {
    for (const investor of stillEmpty) {
      if (searched >= searchLimit) break;
      searched += 1;
      const articles = await searchInvestorNews(investor.name, investor.firm);
      const incoming = dealsFromEvidenceArticles(articles, investor);
      const patch = profilePatch(investor, incoming);
      if (!patch) {
        if (delay) await sleep(delay);
        continue;
      }
      summary.news_writes += 1;
      summary.unchanged -= 1;
      if (summary.samples.length < 12) {
        summary.samples.push({
          name: investor.name,
          firm: investor.firm,
          source: 'news',
          deals: patch.notable_investments.map((deal) => deal.company),
        });
      }
      if (apply) {
        await writePatch(investor, patch);
        const firm = await firmProfile(investor);
        if (firm) {
          const firmPatch = profilePatch(firm, incoming);
          if (firmPatch) await writePatch(firm, firmPatch);
        }
      }
      if (delay) await sleep(delay);
    }
  }

  summary.searched = searched;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
