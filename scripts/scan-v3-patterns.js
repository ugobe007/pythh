#!/usr/bin/env node
/**
 * Scan investor text for fund size patterns to inform v3 parser design
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data: investors } = await sb
    .from('investors')
    .select('id, name, firm, bio, investment_thesis, portfolio_performance, active_fund_size')
    .order('investor_score', { ascending: false })
    .limit(1000);

  const patterns = {
    fund_ordinals: [],
    currencies: [],
    statuses: [],
    multi_vehicle: [],
    aum_keywords: [],
    crore_mentions: [],
    dates: [],
  };

  const fundOrdinalRe = /(?:fund|capital|vehicle|growth)\s*(?:I{1,4}V?I{0,4}|[1-9]\d?|one|two|three|four|five)/gi;
  const currencyRe = /(?:€|£|A\$|C\$|S\$|₹|INR|EUR|GBP|AUD|CAD|SGD|CHF|SEK|NOK|DKK|KRW|JPY|CNY|HKD)\s*[\d,.]+\s*(?:M|B|million|billion|mn|bn|Cr|cr|crore)?/gi;
  const statusRe = /(?:final\s+close|first\s+close|closed\s+(?:at|on)|raised|announced|oversubscribed|target(?:ing)?|inaugurated|debut|launched)\s+/gi;
  const multiVehicleRe = /(?:across|combined|totaling|includes|between)\s+(?:\w+\s+)*(?:fund|vehicle)/gi;
  const aumRe = /(?:AUM|assets?\s+under\s+management|capital\s+under\s+management|evergreen|balance\s+sheet)/gi;
  const croreRe = /(?:₹|INR|Rs\.?)\s*[\d,.]+\s*(?:Cr|crore|cr\b)/gi;
  const dateRe = /(?:in|since|as\s+of|Q[1-4])\s+\d{4}/gi;

  for (const inv of investors) {
    const texts = [inv.bio, inv.investment_thesis, typeof inv.portfolio_performance === 'string' ? inv.portfolio_performance : ''].filter(Boolean);
    const combined = texts.join(' ');

    let m;
    while ((m = fundOrdinalRe.exec(combined)) !== null) patterns.fund_ordinals.push({ name: inv.name, match: m[0] });
    while ((m = currencyRe.exec(combined)) !== null) patterns.currencies.push({ name: inv.name, match: m[0] });
    while ((m = statusRe.exec(combined)) !== null) patterns.statuses.push({ name: inv.name, match: m[0].trim() });
    while ((m = multiVehicleRe.exec(combined)) !== null) patterns.multi_vehicle.push({ name: inv.name, match: m[0] });
    while ((m = aumRe.exec(combined)) !== null) patterns.aum_keywords.push({ name: inv.name, match: m[0] });
    while ((m = croreRe.exec(combined)) !== null) patterns.crore_mentions.push({ name: inv.name, match: m[0] });
    while ((m = dateRe.exec(combined)) !== null) patterns.dates.push({ name: inv.name, match: m[0] });
  }

  console.log('=== Fund Ordinals (' + patterns.fund_ordinals.length + ') ===');
  patterns.fund_ordinals.slice(0, 15).forEach(p => console.log(`  ${p.name}: "${p.match}"`));

  console.log('\n=== Non-USD Currencies (' + patterns.currencies.length + ') ===');
  patterns.currencies.slice(0, 15).forEach(p => console.log(`  ${p.name}: "${p.match}"`));

  console.log('\n=== Fund Statuses (' + patterns.statuses.length + ') ===');
  // Deduplicate by status keyword
  const statusCounts = {};
  patterns.statuses.forEach(p => {
    const key = p.match.toLowerCase().replace(/\s+/g, ' ').trim();
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  });
  Object.entries(statusCounts).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log('\n=== Multi-Vehicle Phrases (' + patterns.multi_vehicle.length + ') ===');
  patterns.multi_vehicle.slice(0, 10).forEach(p => console.log(`  ${p.name}: "${p.match}"`));

  console.log('\n=== AUM Keywords (' + patterns.aum_keywords.length + ') ===');
  const aumCounts = {};
  patterns.aum_keywords.forEach(p => { const k = p.match.toLowerCase(); aumCounts[k] = (aumCounts[k] || 0) + 1; });
  Object.entries(aumCounts).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

  console.log('\n=== Crore/INR Mentions (' + patterns.crore_mentions.length + ') ===');
  patterns.crore_mentions.slice(0, 10).forEach(p => console.log(`  ${p.name}: "${p.match}"`));

  console.log('\n=== Date Mentions (' + patterns.dates.length + ') ===');
  const dateSample = [...new Set(patterns.dates.map(p => p.match.trim()))].slice(0, 20);
  console.log('  Unique dates:', dateSample.join(', '));

  process.exit(0);
})();
