#!/usr/bin/env node
/**
 * Scan startup_uploads for real data patterns to inform parsing engine design.
 * Discovers: what fields exist, what text patterns appear, domain quality, etc.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function q(label, sql) {
  const { data, error } = await sb.rpc('exec_sql', { sql_query: sql });
  if (error) console.log(`${label}: ERR ${error.message}`);
  else console.log(`${label}:`, JSON.stringify(data));
}

(async () => {
  console.log('=== Startup Uploads Schema & Data Audit ===\n');

  // Column list
  await q('columns', `SELECT json_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_name = 'startup_uploads'`);

  // Row counts
  await q('total rows', `SELECT json_build_object('total', count(*)) FROM startup_uploads`);
  await q('by status', `SELECT json_agg(r) FROM (SELECT status, count(*) as cnt FROM startup_uploads GROUP BY status ORDER BY cnt DESC) r`);

  // Field population rates
  const fields = ['name','pitch','description','tagline','website','source_url','linkedin','deck_filename','source_type',
    'total_god_score','team_score','traction_score','market_score','product_score','vision_score',
    'value_proposition','problem','solution','team','investment',
    'extracted_data','sector','stage','location','founded_year'];
  for (const f of fields) {
    await q(`  ${f} populated`, `SELECT json_build_object('cnt', count(*), 'pct', round(count(*)::numeric / greatest(1, (SELECT count(*) FROM startup_uploads)) * 100, 1)) FROM startup_uploads WHERE ${f} IS NOT NULL AND ${f}::text != '' AND ${f}::text != '[]' AND ${f}::text != '{}'`);
  }

  // Sample text lengths
  await q('pitch avg length', `SELECT json_build_object('avg', round(avg(length(pitch))), 'max', max(length(pitch)), 'min', min(length(pitch))) FROM startup_uploads WHERE pitch IS NOT NULL AND pitch != ''`);
  await q('description avg length', `SELECT json_build_object('avg', round(avg(length(description))), 'max', max(length(description)), 'min', min(length(description))) FROM startup_uploads WHERE description IS NOT NULL AND description != ''`);

  // Website domain patterns
  await q('website samples (first 20)', `SELECT json_agg(r) FROM (SELECT website FROM startup_uploads WHERE website IS NOT NULL AND website != '' LIMIT 20) r`);
  await q('source_url samples (first 20)', `SELECT json_agg(r) FROM (SELECT source_url FROM startup_uploads WHERE source_url IS NOT NULL AND source_url != '' LIMIT 20) r`);

  // Check for dollar amounts in text
  await q('pitch has $amount', `SELECT json_build_object('cnt', count(*)) FROM startup_uploads WHERE pitch ~ '\\$[0-9]'`);
  await q('description has $amount', `SELECT json_build_object('cnt', count(*)) FROM startup_uploads WHERE description ~ '\\$[0-9]'`);

  // Check for funding keywords
  await q('pitch has raised/funding', `SELECT json_build_object('cnt', count(*)) FROM startup_uploads WHERE pitch ~* '(raised|funding|seed|series|round|valuation|arr|revenue)'`);
  await q('description has raised/funding', `SELECT json_build_object('cnt', count(*)) FROM startup_uploads WHERE description ~* '(raised|funding|seed|series|round|valuation|arr|revenue)'`);

  // extracted_data type check
  await q('extracted_data type', `SELECT json_build_object('jsonb', count(*) FILTER (WHERE jsonb_typeof(extracted_data) IS NOT NULL), 'null', count(*) FILTER (WHERE extracted_data IS NULL)) FROM startup_uploads`);

  // Sample extracted_data keys
  await q('extracted_data keys sample', `SELECT json_agg(DISTINCT k) FROM startup_uploads, jsonb_object_keys(extracted_data) k WHERE extracted_data IS NOT NULL LIMIT 30`);

  // Source type distribution
  await q('source_type dist', `SELECT json_agg(r) FROM (SELECT source_type, count(*) as cnt FROM startup_uploads GROUP BY source_type ORDER BY cnt DESC) r`);

  // Stage distribution
  await q('stage dist', `SELECT json_agg(r) FROM (SELECT stage, count(*) as cnt FROM startup_uploads WHERE stage IS NOT NULL GROUP BY stage ORDER BY cnt DESC LIMIT 20) r`);

  // Sector distribution
  await q('sector dist (top 15)', `SELECT json_agg(r) FROM (SELECT sector, count(*) as cnt FROM startup_uploads WHERE sector IS NOT NULL GROUP BY sector ORDER BY cnt DESC LIMIT 15) r`);

  console.log('\nDone.');
})();
