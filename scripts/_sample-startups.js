#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Sample 5 startups with dollar amounts in description + extracted_data
  const { data: rows1 } = await sb
    .from('startup_uploads')
    .select('id, name, website, source_url, pitch, description, raise_amount, raise_type, stage, source_type, extracted_data')
    .not('extracted_data', 'is', null)
    .ilike('description', '%raised%')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('=== Startups with "raised" in description ===');
  for (const r of (rows1 || [])) {
    console.log(`\n--- ${r.name} ---`);
    console.log('  website:', r.website);
    console.log('  source_url:', (r.source_url || '').substring(0, 100));
    console.log('  description:', (r.description || '').substring(0, 300));
    console.log('  raise_amount:', r.raise_amount);
    console.log('  raise_type:', r.raise_type);
    console.log('  stage:', r.stage);
    console.log('  source_type:', r.source_type);
    // Show interesting extracted_data keys
    const ed = r.extracted_data || {};
    const interesting = ['funding_amount', 'funding_round', 'funding_stage', 'raise', 'revenue', 'arr', 'mrr',
      'valuation', 'market_size', 'team_size', 'investors', 'investors_mentioned',
      'funding', 'traction', 'traction_signals', 'customer_count', 'customers',
      'growth_rate', 'has_revenue', 'has_customers', 'canonical_domain'];
    const found = {};
    for (const k of interesting) {
      if (ed[k] !== undefined && ed[k] !== null && ed[k] !== '') found[k] = ed[k];
    }
    console.log('  extracted_data (interesting):', JSON.stringify(found));
  }

  // Sample website vs source_url patterns
  const { data: rows2 } = await sb
    .from('startup_uploads')
    .select('name, website, source_url')
    .not('website', 'is', null)
    .not('source_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n\n=== Website vs Source URL (20 samples) ===');
  for (const r of (rows2 || [])) {
    const ws = (r.website || '').substring(0, 60);
    const su = (r.source_url || '').substring(0, 80);
    console.log(`  ${(r.name || '').padEnd(30)} website=${ws.padEnd(40)} source_url=${su}`);
  }

  // Check extracted_data.canonical_domain population
  const { data: cdCount } = await sb.rpc('exec_sql', {
    sql_text: "SELECT json_build_object('cnt', count(*)) FROM startup_uploads WHERE extracted_data->>'canonical_domain' IS NOT NULL AND extracted_data->>'canonical_domain' != ''"
  });
  console.log('\n\nextracted_data.canonical_domain populated:', cdCount);

  // Sample extracted_data with funding info
  const { data: rows3 } = await sb
    .from('startup_uploads')
    .select('name, extracted_data')
    .not('extracted_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('\n\n=== Full extracted_data examples (3 rows) ===');
  for (const r of (rows3 || [])) {
    console.log(`\n--- ${r.name} ---`);
    console.log(JSON.stringify(r.extracted_data, null, 2));
  }
}

main().catch(console.error);
