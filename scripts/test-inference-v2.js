#!/usr/bin/env node
/**
 * Test Capital Intelligence v2 on specific investors
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { runInferencePipeline, extractReportedFundSize, formatAmount } = require('./fund-size-inference');

const TARGET_NAMES = [
  'Katie Haun',
  'GGV Capital',
  'Dragoneer Investment Group',
  'Temasek',
  'Sequoia Capital',
  'Breakthrough Energy',
  'Josh Kopelman',
  'Michael Seibel',
  'Andreessen Horowitz',
  'SoftBank'
];

(async () => {
  console.log('=== Capital Intelligence v2 — Test Run ===\n');

  for (const name of TARGET_NAMES) {
    const { data } = await sb
      .from('investors')
      .select('*')
      .ilike('name', '%' + name + '%')
      .limit(1);

    if (!data || !data.length) {
      console.log(name + ': NOT FOUND\n');
      continue;
    }

    const inv = data[0];
    
    // Test text extraction separately
    const extracted = extractReportedFundSize(inv);
    
    // Run full pipeline
    const result = runInferencePipeline(inv);

    console.log('━━━ ' + inv.name + ' ━━━');
    console.log('  Known fund_size:', inv.active_fund_size || 'none');
    if (extracted) {
      console.log('  TEXT EXTRACTION: $' + formatAmount(extracted.reported_amount) +
        (extracted.is_aum ? ' (AUM)' : ' (single fund)') +
        ' | field: ' + extracted.source_field +
        ' | conf: ' + extracted.confidence);
      console.log('  Context: "' + extracted.context + '"');
    } else {
      console.log('  TEXT EXTRACTION: none found');
    }
    console.log('  Method:', result.estimation_method);
    console.log('  Estimate:', formatAmount(result.fund_size_estimate_usd));
    console.log('  Confidence:', result.fund_size_confidence);
    console.log('  Capital Type:', result.capital_type);
    console.log('  Power:', result.capital_power_score, '| Effective:', result.effective_capital_power);
    console.log('  Velocity:', result.deployment_velocity_index,
      '(' + result.deployment_velocity_label + ')');
    console.log('  Signals:', result.estimation_signals);
    console.log('  Velocity Detail:', JSON.stringify(result.deployment_velocity_signals));
    console.log('');
  }

  console.log('Done.');
  process.exit(0);
})();
