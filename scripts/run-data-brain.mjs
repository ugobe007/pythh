#!/usr/bin/env node
/**
 * Daily data brain.
 *
 * Reads approved startups, their signal scores, and spoken investor quotes.
 * Writes one insight pack for the UTC day. Does not change GOD weights and
 * does not rewrite match clocks.
 *
 *   node scripts/run-data-brain.mjs --limit=400
 *   node scripts/run-data-brain.mjs --apply --limit=1500
 */
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('dotenv').config();
const { buildInsightPack, setActiveBrainPack } = require('../lib/dataBrain.js');

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Math.max(50, Math.min(5000, Number(limitArg?.split('=')[1]) || 1500));

function client() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const STARTUP_COLUMNS = 'id, name, tagline, description, sectors, total_god_score, traction_score, market_score, entity_gate, created_at';

async function loadStartups(supabase) {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const pageSize = 500;
  const rows = [];
  for (let from = 0; rows.length < limit; from += pageSize) {
    const to = Math.min(from + pageSize, limit) - 1;
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(STARTUP_COLUMNS)
      .eq('status', 'approved')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < (to - from + 1)) break;
  }
  return rows.slice(0, limit);
}

async function loadHighSignalStartups(supabase, seen) {
  const { data, error } = await supabase
    .from('startup_signal_scores')
    .select('startup_id, signals_total, news_momentum, investor_receptivity, capital_convergence, execution_velocity')
    .gte('signals_total', 6.5)
    .order('signals_total', { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const signals = new Map();
  const missing = [];
  for (const row of data || []) {
    if (!row.startup_id) continue;
    signals.set(row.startup_id, row);
    if (!seen.has(row.startup_id)) missing.push(row.startup_id);
  }
  const extras = [];
  for (let i = 0; i < missing.length; i += 150) {
    const slice = missing.slice(i, i + 150);
    const { data: uploads, error: uploadError } = await supabase
      .from('startup_uploads')
      .select(STARTUP_COLUMNS)
      .in('id', slice)
      .eq('status', 'approved');
    if (uploadError) throw new Error(uploadError.message);
    extras.push(...(uploads || []));
  }
  return { signals, extras };
}

async function loadSignals(supabase, ids) {
  const byId = new Map();
  const chunk = 150;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('startup_signal_scores')
      .select('startup_id, signals_total, news_momentum, investor_receptivity, capital_convergence, execution_velocity')
      .in('startup_id', slice);
    if (error) throw new Error(error.message);
    for (const row of data || []) byId.set(row.startup_id, row);
  }
  return byId;
}

async function loadQuotes(supabase) {
  const { data, error } = await supabase
    .from('investor_quotes')
    .select('firm, kind, quote')
    .eq('active', true)
    .in('kind', ['investing_in', 'looking_for'])
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.warn(`quotes skipped: ${error.message}`);
    return [];
  }
  return data || [];
}

function migrationStatements() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../supabase/migrations/20261008020000_data_brain_insights.sql');
  return fs.readFileSync(file, 'utf8')
    .split(/;\s*\n/)
    .map((stmt) => stmt.replace(/^--[^\n]*\n/gm, '').trim())
    .filter(Boolean)
    .map((stmt) => (stmt.endsWith(';') ? stmt : `${stmt};`));
}

async function applyMigration(supabase) {
  for (const stmt of migrationStatements()) {
    const { error } = await supabase.rpc('exec_sql_modify', { sql_query: stmt });
    if (error) throw new Error(error.message);
  }
  await supabase.rpc('exec_sql_modify', { sql_query: "notify pgrst, 'reload schema';" });
}

function printPack(pack) {
  console.log(`data brain ${pack.generated_at} corpus=${pack.corpus_n} weight_change=${pack.weight_change} prior_window_covered=${pack.prior_window_covered}`);
  const shape = pack.score_shape || {};
  console.log('sector mix:');
  for (const row of pack.sector_mix || []) {
    console.log(`  ${row.sector} count=${row.count} share=${row.share}`);
  }
  if (pack.tag_alerts?.length) {
    console.log(`tag alerts: ${pack.tag_alerts.map((row) => `${row.sector} ${row.share}`).join(', ')}`);
  }
  console.log(`score shape: traction@100=${shape.traction_saturated_share} market_49_56=${shape.market_cluster_share} headline=${shape.headline} boilerplate=${shape.boilerplate} review_gate=${shape.review_gate}`);
  if (shape.headline_names?.length) console.log(`headline names: ${shape.headline_names.join(', ')}`);
  if (shape.boilerplate_names?.length) console.log(`boilerplate names: ${shape.boilerplate_names.join(', ')}`);
  console.log('sector momentum:');
  for (const row of pack.trends || []) {
    console.log(`  ${row.direction} ${row.sector} recent=${row.recent_count} prior=${row.prior_count} ratio=${row.ratio}`);
  }
  console.log('keywords:');
  for (const row of (pack.keywords || []).slice(0, 8)) {
    console.log(`  ${row.term} lift=${row.lift} high=${row.high_signal_docs} sector=${row.sector || '—'}`);
  }
  console.log('match terms:');
  for (const row of (pack.match_context?.sector_terms || []).slice(0, 12)) {
    console.log(`  ${row.term} → ${row.sector} support=${row.support} lift=${row.lift}`);
  }
  console.log('thesis phrases:');
  for (const row of pack.thesis_terms || []) {
    console.log(`  ${row.count}× ${row.term} (${(row.firms || []).join(', ')})`);
  }
}

async function main() {
  const supabase = client();
  const startups = await loadStartups(supabase);
  const seen = new Set(startups.map((row) => row.id));
  const high = await loadHighSignalStartups(supabase, seen);
  for (const row of high.extras) {
    if (!seen.has(row.id)) startups.push(row);
  }
  const signalsById = await loadSignals(supabase, startups.map((row) => row.id).filter(Boolean));
  for (const [id, row] of high.signals) {
    if (!signalsById.has(id)) signalsById.set(id, row);
  }
  const quotes = await loadQuotes(supabase);
  const pack = buildInsightPack({ startups, signalsById, quotes, asOf: new Date().toISOString() });
  printPack(pack);
  if (!apply) {
    console.log('dry run — pass --apply to store the pack');
    return;
  }
  const insightDate = pack.generated_at.slice(0, 10);
  const { error } = await supabase
    .from('data_brain_insights')
    .upsert({
      insight_date: insightDate,
      pack,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'insight_date' });
  if (error) {
    if (!/data_brain_insights|schema cache|does not exist/i.test(error.message || '')) {
      console.error(`store failed: ${error.message}`);
      process.exit(1);
    }
    console.warn(`table missing (${error.message}); applying migration`);
    await applyMigration(supabase);
    const retry = await supabase
      .from('data_brain_insights')
      .upsert({
        insight_date: insightDate,
        pack,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'insight_date' });
    if (retry.error) {
      console.error(`store failed after migration: ${retry.error.message}`);
      process.exit(1);
    }
  }
  setActiveBrainPack(pack);
  console.log(`stored data_brain_insights ${insightDate}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
