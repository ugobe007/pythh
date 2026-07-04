#!/usr/bin/env node
/**
 * Emit typed investor_signal_events from recent DB changes:
 *   - portfolio_add  (new investor_investments in last N days)
 *   - partner_join     (new investor_partners)
 *   - thesis_shift     (rolling_thesis_sectors changed)
 *   - news_mention     (new investor_news)
 *
 * Usage:
 *   node scripts/emit-investor-signal-events.mjs
 *   node scripts/emit-investor-signal-events.mjs --apply --days=14
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : 14;

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function signalId(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 40);
}

async function upsertEvents(events) {
  if (!events.length) return 0;
  if (!APPLY) return events.length;
  const { error } = await sb.from('investor_signal_events').upsert(events, { onConflict: 'signal_id' });
  if (error) throw new Error(error.message);
  return events.length;
}

async function portfolioAdds(cutoff) {
  const { data } = await sb
    .from('investor_investments')
    .select('id, investor_id, company_name, round_type, investment_date, scraped_date')
    .or(`investment_date.gte.${cutoff},scraped_date.gte.${cutoff}`)
    .order('scraped_date', { ascending: false })
    .limit(500);

  return (data || []).map((row) => ({
    investor_id: row.investor_id,
    event_type: 'portfolio_add',
    signal_id: signalId(['portfolio_add', row.investor_id, row.company_name, row.investment_date || row.id]),
    title: `Portfolio add: ${row.company_name}`,
    summary: row.round_type ? `${row.round_type} round` : null,
    magnitude: 0.7,
    source_table: 'investor_investments',
    source_id: row.id,
    metadata: { company_name: row.company_name, round_type: row.round_type },
    detected_at: row.scraped_date || row.investment_date || new Date().toISOString(),
  }));
}

async function partnerJoins(cutoff) {
  const { data } = await sb
    .from('investor_partners')
    .select('id, investor_id, name, title, created_at')
    .gte('created_at', cutoff)
    .limit(200);

  return (data || []).map((row) => ({
    investor_id: row.investor_id,
    event_type: 'partner_join',
    signal_id: signalId(['partner_join', row.investor_id, row.name, row.id]),
    title: `Partner: ${row.name}`,
    summary: row.title || null,
    magnitude: 0.6,
    source_table: 'investor_partners',
    source_id: row.id,
    metadata: { name: row.name, title: row.title },
    detected_at: row.created_at || new Date().toISOString(),
  }));
}

async function newsMentions(cutoff) {
  const { data } = await sb
    .from('investor_news')
    .select('id, investor_id, title, summary, url, published_date, scraped_date')
    .or(`scraped_date.gte.${cutoff},published_date.gte.${cutoff}`)
    .limit(300);

  return (data || []).map((row) => ({
    investor_id: row.investor_id,
    event_type: 'news_mention',
    signal_id: signalId(['news_mention', row.investor_id, row.url || row.id]),
    title: row.title,
    summary: (row.summary || '').slice(0, 400) || null,
    magnitude: 0.45,
    source_table: 'investor_news',
    source_id: row.id,
    metadata: { url: row.url },
    detected_at: row.scraped_date || row.published_date || new Date().toISOString(),
  }));
}

async function thesisShifts() {
  const { data } = await sb
    .from('investors')
    .select('id, name, rolling_thesis_summary, rolling_thesis_sectors, rolling_thesis_updated_at')
    .not('rolling_thesis_updated_at', 'is', null)
    .gte('rolling_thesis_updated_at', new Date(Date.now() - DAYS * 86400000).toISOString())
    .limit(200);

  return (data || [])
    .filter((r) => Array.isArray(r.rolling_thesis_sectors) && r.rolling_thesis_sectors.length)
    .map((row) => ({
      investor_id: row.id,
      event_type: 'thesis_shift',
      signal_id: signalId(['thesis_shift', row.id, (row.rolling_thesis_sectors || []).join(',')]),
      title: `Thesis shift: ${row.name}`,
      summary: (row.rolling_thesis_summary || '').slice(0, 500) || null,
      magnitude: 0.55,
      source_table: 'investors',
      source_id: row.id,
      metadata: { sectors: row.rolling_thesis_sectors },
      detected_at: row.rolling_thesis_updated_at,
    }));
}

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString();
  console.log(`\n📡 Emit investor signal events (${DAYS}d)`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'}\n`);

  const batches = await Promise.all([
    portfolioAdds(cutoff),
    partnerJoins(cutoff),
    newsMentions(cutoff),
    thesisShifts(),
  ]);

  const all = batches.flat();
  const byType = {};
  for (const e of all) byType[e.event_type] = (byType[e.event_type] || 0) + 1;

  console.log('  Candidates:', byType);
  const n = await upsertEvents(all);
  console.log(`\n✅ ${APPLY ? 'Wrote' : 'Would write'} ${n} signal events\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
