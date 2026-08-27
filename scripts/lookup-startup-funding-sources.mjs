#!/usr/bin/env node
/**
 * Look up funding events for a startup across ontology public sources.
 *
 * Usage:
 *   node scripts/lookup-startup-funding-sources.mjs --name="Astranis"
 *   node scripts/lookup-startup-funding-sources.mjs --name="Luna Innovations" --after=2020-01-01
 *   node scripts/lookup-startup-funding-sources.mjs --startup-id=<uuid> --apply
 *   node scripts/lookup-startup-funding-sources.mjs --name="Anduril" --sources=sec,nsf,usaspending
 *
 * Writes (with --apply + --startup-id or resolved queue startup):
 *   funding_evidence_search_results + funding_evidence_events
 *
 * Grants are financing_type=grant (never equity Hit@5). Form D is observed equity evidence.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { resolveSupabaseRestUrl, resolveSupabaseServiceKey } from '../lib/supabaseEnv.mjs';

const require = createRequire(import.meta.url);
const ledger = require('../server/lib/fundingEvidenceLedger.js');
const {
  lookupStartupFundingEvents,
  toLedgerEventRow,
  toSearchResultRow,
} = require('../server/lib/fundingSourceLookup.js');

const apply = process.argv.includes('--apply');
const nameArg = process.argv.find((a) => a.startsWith('--name='))?.split('=').slice(1).join('=');
const startupIdArg = process.argv.find((a) => a.startsWith('--startup-id='))?.split('=')[1];
const afterArg = process.argv.find((a) => a.startsWith('--after='))?.split('=')[1];
const sourcesArg = process.argv.find((a) => a.startsWith('--sources='))?.split('=')[1];
const sources = sourcesArg
  ? sourcesArg.split(',').map((s) => s.trim()).filter(Boolean)
  : ['sec', 'nsf', 'sbir', 'usaspending'];

if (!nameArg && !startupIdArg) {
  console.error('Need --name="Startup" and/or --startup-id=<uuid>');
  process.exit(1);
}

const { url } = resolveSupabaseRestUrl();
const serviceKey = resolveSupabaseServiceKey();
if (!url || !serviceKey) throw new Error('Missing Supabase service environment');
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

let startup = null;
if (startupIdArg) {
  const { data, error } = await db
    .from('startup_uploads')
    .select('id,name,website')
    .eq('id', startupIdArg)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`startup not found: ${startupIdArg}`);
  startup = data;
}

const name = (nameArg || startup?.name || '').trim();
if (!name) throw new Error('Startup name is empty');

const afterDate = afterArg || null;
const { events, errors, sources_queried } = await lookupStartupFundingEvents({
  name,
  website: startup?.website || null,
  afterDate,
  sources,
});

const preview = events.map((e) => ({
  financing_type: e.financing_type,
  evidence_type: e.evidence_type,
  event_date: e.event_date,
  round_type: e.round_type,
  amount_usd: e.amount_usd,
  source_provider: e.source_provider,
  source_title: e.source_title,
  source_url: e.source_url,
  investor_or_agency: e.investor_name_raw,
}));

let writtenSearch = 0;
let writtenLedger = 0;

if (apply) {
  if (!startup?.id) {
    throw new Error('--apply requires --startup-id so rows attach to a startup');
  }
  for (const event of events) {
    const searchRow = toSearchResultRow(event, { startupId: startup.id });
    const { error: searchError } = await db.from('funding_evidence_search_results').upsert(searchRow, {
      onConflict: 'startup_id,source_url,investor_name_raw,event_date',
      ignoreDuplicates: true,
    });
    if (searchError) throw new Error(searchError.message);
    writtenSearch += 1;

    const ledgerRow = toLedgerEventRow(event, {
      startupId: startup.id,
      startupName: startup.name,
    });
    ledgerRow.canonical_round_key = ledger.canonicalRoundKey({
      startupId: startup.id,
      startupName: startup.name,
      roundType: event.round_type,
      amountUsd: event.amount_usd,
      announcedAt: ledgerRow.announced_at,
    });
    const { error: ledgerError } = await db
      .from('funding_evidence_events')
      .upsert(ledgerRow, { onConflict: 'source_event_key' });
    if (ledgerError) throw new Error(ledgerError.message);
    writtenLedger += 1;
  }
}

console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      startup_id: startup?.id || null,
      name,
      after: afterDate,
      sources_queried,
      events_found: events.length,
      equity_form_d: events.filter((e) => e.evidence_type === 'sec_filing').length,
      grants: events.filter((e) => e.financing_type === 'grant').length,
      errors,
      written_search: apply ? writtenSearch : 0,
      written_ledger: apply ? writtenLedger : 0,
      preview,
    },
    null,
    2,
  ),
);
