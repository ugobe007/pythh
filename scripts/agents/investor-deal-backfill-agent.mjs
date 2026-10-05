#!/usr/bin/env node
/**
 * Investor deal backfill — evidence onto profiles so investor cards can show deals.
 *
 * 1. Verified or corroborated funding-ledger rows already linked to the investor.
 * 2. The firm's own site, when portfolio logos are labeled with a company name.
 * 3. News only when those two are empty: one reviewed source, or two independent
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
  dealsFromFirmSite,
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

async function fetchFirmHtml(rawUrl) {
  let target;
  try { target = new URL(rawUrl); } catch { return null; }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 500_000);
    return { html, finalUrl: res.url || target.toString() };
  } catch {
    return null;
  }
}

async function recentCardInvestorIds() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ids = [];
  const seen = new Set();
  for (let from = 0; from < 12000; from += 1000) {
    const { data, error } = await db
      .from('startup_investor_matches')
      .select('investor_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(`match scan: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      if (!row.investor_id || seen.has(row.investor_id)) continue;
      seen.add(row.investor_id);
      ids.push(row.investor_id);
    }
    if (data.length < 1000) break;
  }
  return ids;
}

async function linkedInvestorIds() {
  const ids = [];
  const seen = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('funding_evidence_participants')
      .select('id, investor_id')
      .not('investor_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`participant scan: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      if (!row.investor_id || seen.has(row.investor_id)) continue;
      seen.add(row.investor_id);
      ids.push(row.investor_id);
    }
    if (data.length < 1000) break;
  }
  return ids;
}

async function loadInvestors(ids) {
  const rows = [];
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const { data, error } = await db
      .from('investors')
      .select('id, name, firm, url, type, investor_type, notable_investments, portfolio_companies, last_investment_date, entity_gate, status, investor_score')
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
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db
        .from('funding_evidence_participants')
        .select('investor_id, funding_event_id, participant_role')
        .in('investor_id', slice)
        .order('id', { ascending: true })
        .range(offset, offset + 999);
      if (error) throw new Error(`participants: ${error.message}`);
      rows.push(...(data || []));
      if (!data?.length || data.length < 1000) break;
    }
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
  const recentIds = await recentCardInvestorIds();
  const recentRank = new Map(recentIds.map((id, index) => [id, index]));
  const linkedIds = await linkedInvestorIds();
  const universe = [...recentIds];
  const seen = new Set(recentIds);
  for (const id of linkedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    universe.push(id);
  }
  const loaded = await loadInvestors(universe);
  const empty = loaded.filter((row) => {
    const status = String(row.status || '').toLowerCase();
    return (
      String(row.entity_gate || '') === 'qualified'
      && (status === '' || status === 'active')
      && !hasStoredDeals(row)
    );
  });
  const participants = await loadParticipants(empty.map((row) => row.id));
  const withLedger = new Set(participants.map((row) => String(row.investor_id)));
  const ledgerQueue = empty
    .filter((row) => withLedger.has(String(row.id)))
    .sort((a, b) => {
      const aRecent = recentRank.has(a.id) ? recentRank.get(a.id) : 100000;
      const bRecent = recentRank.has(b.id) ? recentRank.get(b.id) : 100000;
      if (aRecent !== bRecent) return aRecent - bRecent;
      return (Number(b.investor_score) || 0) - (Number(a.investor_score) || 0);
    })
    .slice(0, limit);
  const batch = ledgerQueue;
  const batchIds = new Set(batch.map((row) => String(row.id)));
  const batchParticipants = participants.filter((row) => batchIds.has(String(row.investor_id)));
  const eventsById = await loadEvents([...new Set(batchParticipants.map((row) => row.funding_event_id).filter(Boolean))]);
  const startupsById = await loadStartups([...new Set([...eventsById.values()].map((event) => event.startup_id).filter(Boolean))]);

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    recent_card_investors: recentIds.length,
    ledger_linked_investors: linkedIds.length,
    card_investors_scanned: loaded.length,
    missing_deals: empty.length,
    batch: batch.length,
    ledger_writes: 0,
    firm_site_writes: 0,
    news_writes: 0,
    written_names: [],
    samples: [],
  };

  const filled = new Set();
  for (const investor of batch) {
    const incoming = dealsFromLedger({
      investorId: investor.id,
      participants: batchParticipants,
      eventsById,
      startupsById,
    });
    const patch = profilePatch(investor, incoming);
    if (!patch) continue;
    filled.add(investor.id);
    summary.ledger_writes += 1;
    if (summary.written_names.length < 40) summary.written_names.push(investor.name);
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
        if (firmPatch) {
          await writePatch(firm, firmPatch);
          filled.add(firm.id);
        }
      }
    }
  }

  const newsQueue = empty
    .filter((row) => recentRank.has(row.id) && !filled.has(row.id))
    .sort((a, b) => recentRank.get(a.id) - recentRank.get(b.id))
    .slice(0, skipSearch ? 0 : searchLimit);
  let searched = 0;
  if (!skipSearch) {
    for (const investor of newsQueue) {
      searched += 1;
      let incoming = [];
      let source = 'news';
      const site = investor.url ? await fetchFirmHtml(investor.url) : null;
      if (site) {
        incoming = dealsFromFirmSite(site.html, site.finalUrl, investor);
        if (incoming.length) source = 'firm_site';
      }
      if (!incoming.length) {
        const articles = await searchInvestorNews(investor.name, investor.firm);
        incoming = dealsFromEvidenceArticles(articles, investor);
        source = 'news';
      }
      const patch = profilePatch(investor, incoming);
      if (!patch) {
        if (delay) await sleep(delay);
        continue;
      }
      if (source === 'firm_site') summary.firm_site_writes += 1;
      else summary.news_writes += 1;
      if (summary.samples.length < 12) {
        summary.samples.push({
          name: investor.name,
          firm: investor.firm,
          source,
          deals: patch.notable_investments.map((deal) => deal.company),
        });
      }
      if (apply) {
        await writePatch(investor, patch);
        const firm = await firmProfile(investor);
        if (firm) {
          const firmPatch = profilePatch(firm, incoming);
          if (firmPatch) {
            await writePatch(firm, firmPatch);
            filled.add(firm.id);
          }
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
