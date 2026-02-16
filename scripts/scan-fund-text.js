#!/usr/bin/env node
/**
 * Quick scan: find investors with dollar amounts in text fields
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const dollarRegex = /\$[\d,.]+\s*(M|B|million|billion|mn|bn)/gi;
const fundContextRegex = /(clos|rais|manag|fund|deploy|aum|vehicle|capital|invest)\w*/gi;

async function main() {
  const { data, error } = await sb
    .from('investors')
    .select('name, firm, bio, investment_thesis, active_fund_size')
    .or('bio.ilike.%$%M%,bio.ilike.%$%B%,investment_thesis.ilike.%$%M%,investment_thesis.ilike.%$%B%')
    .limit(50);
  
  if (error) { console.error('ERR:', error.message); return; }
  
  console.log(`Found ${data.length} investors with dollar amounts in text\n`);
  
  let withoutKnownSize = 0;
  
  for (const inv of data) {
    const bio = inv.bio || '';
    const thesis = inv.investment_thesis || '';
    const combined = bio + ' ' + thesis;
    
    const matches = combined.match(dollarRegex) || [];
    if (matches.length === 0) continue;
    
    const known = inv.active_fund_size ? `has fund: $${(inv.active_fund_size/1e6).toFixed(0)}M` : 'NO fund_size';
    if (!inv.active_fund_size) withoutKnownSize++;
    
    console.log(`--- ${inv.name} (${inv.firm || 'no firm'}) [${known}] ---`);
    console.log(`  Dollar amounts found: ${matches.join(', ')}`);
    console.log(`  Bio: ${bio.substring(0, 200)}`);
    if (thesis && thesis.length > 30) console.log(`  Thesis: ${thesis.substring(0, 200)}`);
    console.log('');
  }
  
  console.log(`\nInvestors with $ in text but NO known fund size: ${withoutKnownSize}`);
}

main().catch(console.error);
