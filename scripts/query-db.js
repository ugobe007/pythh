#!/usr/bin/env node
/**
 * DATABASE QUERY HELPER
 * =====================
 * Quick CLI to query investors and startups from the database.
 * No code needed — just run from terminal.
 *
 * USAGE:
 *   node scripts/query-db.js investors                     # List all investors (summary)
 *   node scripts/query-db.js investors --top=20            # Top 20 by score
 *   node scripts/query-db.js investors --bottom=20         # Bottom 20 (enrichment candidates)
 *   node scripts/query-db.js investors --tier=elite        # Filter by tier
 *   node scripts/query-db.js investors --search="sequoia"  # Fuzzy name search
 *   node scripts/query-db.js investors --id=UUID           # Full details for one
 *   node scripts/query-db.js investors --missing=fund_size # Who's missing fund_size
 *   node scripts/query-db.js investors --stats             # Score distribution stats
 *   node scripts/query-db.js investors --csv               # Export to CSV
 *
 *   node scripts/query-db.js startups                      # List all startups (summary)
 *   node scripts/query-db.js startups --top=20             # Top 20 by GOD score
 *   node scripts/query-db.js startups --bottom=20          # Bottom 20
 *   node scripts/query-db.js startups --search="perplexity"
 *   node scripts/query-db.js startups --status=approved
 *   node scripts/query-db.js startups --stats
 *   node scripts/query-db.js startups --csv
 *
 *   node scripts/query-db.js counts                        # Quick table counts
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Parse CLI args
const args = process.argv.slice(2);
const entity = args[0] || 'help';
const getFlag = (name) => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : null;
};
const hasFlag = (name) => args.includes(`--${name}`);
const topN = parseInt(getFlag('top') || '0');
const bottomN = parseInt(getFlag('bottom') || '0');
const tier = getFlag('tier');
const search = getFlag('search');
const status = getFlag('status');
const idLookup = getFlag('id');
const missing = getFlag('missing');
const wantStats = hasFlag('stats');
const wantCsv = hasFlag('csv');

function pad(s, n) { return (s || '').toString().substring(0, n).padEnd(n); }
function formatScore(n) { return (n || 0).toFixed(1).padStart(5); }
function formatScoreAmount(n) {
  if (!n) return '';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

async function queryInvestors() {
  // NOTE: capital_type, capital_power_score, fund_size_estimate_usd, fund_size_confidence,
  // estimation_method are new columns NOT visible to PostGREST schema cache.
  // We fetch them via raw SQL when --id is used.
  const select = 'id, name, firm, investor_score, investor_tier, type, sectors, stage, active_fund_size, check_size_min, check_size_max, total_investments, successful_exits, geography_focus, investment_thesis, last_enrichment_date';
  
  let query = supabase.from('investors').select(select);

  if (idLookup) {
    // Use raw SQL to get ALL columns including inference fields hidden from PostGREST
    const { data: sqlResult, error: sqlErr } = await supabase.rpc('exec_sql', {
      sql_query: `SELECT * FROM investors WHERE id = '${idLookup}' LIMIT 1`
    });
    if (sqlErr) {
      // Fallback to PostGREST
      const { data, error } = await supabase.from('investors').select('*').eq('id', idLookup).single();
      if (error) { console.error('Error:', error.message); return; }
      console.log(JSON.stringify(data, null, 2));
    } else {
      const rows = typeof sqlResult === 'string' ? JSON.parse(sqlResult) : sqlResult;
      console.log(JSON.stringify(rows?.[0] || rows, null, 2));
    }
    return;
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,firm.ilike.%${search}%`);
  }
  if (tier) {
    query = query.eq('investor_tier', tier);
  }

  if (topN) {
    query = query.order('investor_score', { ascending: false }).limit(topN);
  } else if (bottomN) {
    query = query.order('investor_score', { ascending: true }).limit(bottomN);
  } else {
    query = query.order('investor_score', { ascending: false });
  }

  const { data: investors, error } = await query;
  if (error) { console.error('Error:', error.message); return; }

  if (wantStats) {
    printInvestorStats(investors);
    return;
  }

  if (missing) {
    const filtered = investors.filter(i => {
      const val = i[missing];
      return val === null || val === undefined || val === 0 || val === '' || (Array.isArray(val) && val.length === 0);
    });
    console.log(`\n${filtered.length} investors missing "${missing}":\n`);
    investors.length = 0;
    investors.push(...filtered);
  }

  if (wantCsv) {
    const csvPath = path.join(process.cwd(), 'data', 'investor-query-results.csv');
    const header = 'Name,Firm,Score,Tier,Type,Fund Size,Investments,Exits,Sectors,Geography\n';
    const rows = investors.map(i => [
      `"${(i.name || '').replace(/"/g, '""')}"`,
      `"${(i.firm || '').replace(/"/g, '""')}"`,
      i.investor_score || 0,
      i.investor_tier || '',
      i.type || '',
      i.active_fund_size || '',
      i.total_investments || 0,
      i.successful_exits || 0,
      `"${(i.sectors || []).join('; ')}"`,
      `"${(i.geography_focus || []).join('; ')}"`,
    ].join(',')).join('\n');
    fs.writeFileSync(csvPath, header + rows);
    console.log(`✅ Exported ${investors.length} investors to data/investor-query-results.csv`);
    return;
  }

  // Table output
  console.log(`\n  ${investors.length} investors found\n`);
  console.log(`  ${'#'.padStart(4)}  ${pad('Name', 32)} ${pad('Firm', 22)} ${'Score'.padStart(5)}  ${pad('Tier', 8)} ${pad('Type', 6)} ${'Fund'.padStart(10)}  ${pad('Enriched', 10)}`);
  console.log('  ' + '─'.repeat(100));

  investors.forEach((inv, i) => {
    const enriched = inv.last_enrichment_date ? '✓' : '';
    const fund = inv.active_fund_size ? formatScoreAmount(inv.active_fund_size) : '';
    console.log(`  ${(i + 1).toString().padStart(4)}  ${pad(inv.name, 32)} ${pad(inv.firm, 22)} ${formatScore(inv.investor_score)}  ${pad(inv.investor_tier, 8)} ${pad(inv.type, 6)} ${fund.padStart(10)}  ${pad(enriched, 10)}`);
  });
}

function printInvestorStats(investors) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  INVESTOR DATABASE STATS                  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`  Total investors: ${investors.length}`);

  // Tier distribution
  const tiers = {};
  investors.forEach(i => { tiers[i.investor_tier || 'unknown'] = (tiers[i.investor_tier || 'unknown'] || 0) + 1; });
  console.log('\n  Tier Distribution:');
  for (const [t, c] of Object.entries(tiers).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.round(c / investors.length * 40));
    console.log(`    ${t.padEnd(12)} ${c.toString().padStart(4)} (${(c / investors.length * 100).toFixed(1)}%) ${bar}`);
  }

  // Score stats
  const scores = investors.map(i => i.investor_score || 0);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sorted = [...scores].sort((a, b) => a - b);
  console.log(`\n  Score Stats:`);
  console.log(`    Mean:   ${avg.toFixed(2)}`);
  console.log(`    Median: ${sorted[Math.floor(sorted.length / 2)].toFixed(1)}`);
  console.log(`    Min:    ${sorted[0].toFixed(1)}`);
  console.log(`    Max:    ${sorted[sorted.length - 1].toFixed(1)}`);

  // Enrichment coverage
  const enriched = investors.filter(i => i.last_enrichment_date).length;
  const hasFundSize = investors.filter(i => i.active_fund_size > 0).length;
  const hasThesis = investors.filter(i => i.investment_thesis && i.investment_thesis.length > 20).length;
  const hasSectors = investors.filter(i => i.sectors && i.sectors.length > 0).length;
  console.log(`\n  Data Coverage:`);
  console.log(`    Enriched:        ${enriched.toString().padStart(4)} / ${investors.length} (${(enriched / investors.length * 100).toFixed(1)}%)`);
  console.log(`    Has fund size:   ${hasFundSize.toString().padStart(4)} / ${investors.length} (${(hasFundSize / investors.length * 100).toFixed(1)}%)`);
  console.log(`    Has thesis:      ${hasThesis.toString().padStart(4)} / ${investors.length} (${(hasThesis / investors.length * 100).toFixed(1)}%)`);
  console.log(`    Has sectors:     ${hasSectors.toString().padStart(4)} / ${investors.length} (${(hasSectors / investors.length * 100).toFixed(1)}%)`);

  // Type distribution
  const types = {};
  investors.forEach(i => { types[i.type || 'unknown'] = (types[i.type || 'unknown'] || 0) + 1; });
  console.log('\n  Investor Type Distribution:');
  for (const [t, c] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${t.padEnd(20)} ${c.toString().padStart(4)} (${(c / investors.length * 100).toFixed(1)}%)`);
  }
}

async function queryStartups() {
  const select = 'id, name, description, total_god_score, team_score, traction_score, market_score, product_score, vision_score, status, sectors, stage, raise_amount, raise_type, website, location, source_type, has_revenue, has_customers, team_size, created_at';

  let query = supabase.from('startup_uploads').select(select);

  if (idLookup) {
    const { data, error } = await supabase.from('startup_uploads').select('*').eq('id', idLookup).single();
    if (error) { console.error('Error:', error.message); return; }
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq('status', status);
  }

  if (topN) {
    query = query.order('total_god_score', { ascending: false }).limit(topN);
  } else if (bottomN) {
    query = query.order('total_god_score', { ascending: true }).limit(bottomN);
  } else {
    query = query.order('total_god_score', { ascending: false }).limit(100);
  }

  const { data: startups, error } = await query;
  if (error) { console.error('Error:', error.message); return; }

  if (wantStats) {
    // Fetch all for stats
    const { data: all } = await supabase.from('startup_uploads').select(select).eq('status', 'approved');
    printStartupStats(all || startups);
    return;
  }

  if (wantCsv) {
    const csvPath = path.join(process.cwd(), 'data', 'startup-query-results.csv');
    const header = 'Name,GOD Score,Team,Traction,Market,Product,Vision,Status,Stage,Raise,Sectors,Location\n';
    const rows = startups.map(s => [
      `"${(s.name || '').replace(/"/g, '""')}"`,
      s.total_god_score || 0,
      s.team_score || 0,
      s.traction_score || 0,
      s.market_score || 0,
      s.product_score || 0,
      s.vision_score || 0,
      s.status || '',
      s.stage || '',
      `"${(s.raise_amount || '').replace(/"/g, '""')}"`,
      `"${(s.sectors || []).join('; ')}"`,
      `"${(s.location || '').replace(/"/g, '""')}"`,
    ].join(',')).join('\n');
    fs.writeFileSync(csvPath, header + rows);
    console.log(`✅ Exported ${startups.length} startups to data/startup-query-results.csv`);
    return;
  }

  console.log(`\n  ${startups.length} startups found\n`);
  console.log(`  ${'#'.padStart(4)}  ${pad('Name', 30)} ${'GOD'.padStart(4)} ${' Team'.padStart(5)} ${'Trac'.padStart(5)} ${' Mkt'.padStart(5)} ${'Prod'.padStart(5)} ${'Visn'.padStart(5)}  ${pad('Status', 10)} ${pad('Stage', 6)} ${pad('Raise', 15)}`);
  console.log('  ' + '─'.repeat(115));

  startups.forEach((s, i) => {
    console.log(`  ${(i + 1).toString().padStart(4)}  ${pad(s.name, 30)} ${(s.total_god_score || 0).toString().padStart(4)} ${(s.team_score || 0).toString().padStart(5)} ${(s.traction_score || 0).toString().padStart(5)} ${(s.market_score || 0).toString().padStart(5)} ${(s.product_score || 0).toString().padStart(5)} ${(s.vision_score || 0).toString().padStart(5)}  ${pad(s.status, 10)} ${pad(s.stage, 6)} ${pad(s.raise_amount, 15)}`);
  });
}

function printStartupStats(startups) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  STARTUP DATABASE STATS                   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`  Total startups (approved): ${startups.length}`);

  const scores = startups.map(s => s.total_god_score || 0);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sorted = [...scores].sort((a, b) => a - b);

  console.log(`\n  GOD Score Stats:`);
  console.log(`    Mean:   ${avg.toFixed(1)}`);
  console.log(`    Median: ${sorted[Math.floor(sorted.length / 2)]}`);
  console.log(`    Min:    ${sorted[0]}`);
  console.log(`    Max:    ${sorted[sorted.length - 1]}`);

  // Score buckets
  const buckets = { '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, '50-59': 0, '40-49': 0, '<40': 0 };
  scores.forEach(s => {
    if (s >= 90) buckets['90-100']++;
    else if (s >= 80) buckets['80-89']++;
    else if (s >= 70) buckets['70-79']++;
    else if (s >= 60) buckets['60-69']++;
    else if (s >= 50) buckets['50-59']++;
    else if (s >= 40) buckets['40-49']++;
    else buckets['<40']++;
  });
  console.log('\n  GOD Score Distribution:');
  for (const [b, c] of Object.entries(buckets)) {
    const bar = '█'.repeat(Math.round(c / startups.length * 50));
    console.log(`    ${b.padEnd(8)} ${c.toString().padStart(4)} (${(c / startups.length * 100).toFixed(1)}%) ${bar}`);
  }

  // Component score averages
  const avgTeam = startups.reduce((a, s) => a + (s.team_score || 0), 0) / startups.length;
  const avgTraction = startups.reduce((a, s) => a + (s.traction_score || 0), 0) / startups.length;
  const avgMarket = startups.reduce((a, s) => a + (s.market_score || 0), 0) / startups.length;
  const avgProduct = startups.reduce((a, s) => a + (s.product_score || 0), 0) / startups.length;
  const avgVision = startups.reduce((a, s) => a + (s.vision_score || 0), 0) / startups.length;
  console.log('\n  Component Score Averages:');
  console.log(`    Team:     ${avgTeam.toFixed(1)}`);
  console.log(`    Traction: ${avgTraction.toFixed(1)}`);
  console.log(`    Market:   ${avgMarket.toFixed(1)}`);
  console.log(`    Product:  ${avgProduct.toFixed(1)}`);
  console.log(`    Vision:   ${avgVision.toFixed(1)}`);

  // Data coverage
  const hasRevenue = startups.filter(s => s.has_revenue).length;
  const hasCustomers = startups.filter(s => s.has_customers).length;
  const hasWebsite = startups.filter(s => s.website && s.website.length > 5).length;
  console.log('\n  Data Coverage:');
  console.log(`    Has revenue:   ${hasRevenue.toString().padStart(4)} / ${startups.length} (${(hasRevenue / startups.length * 100).toFixed(1)}%)`);
  console.log(`    Has customers: ${hasCustomers.toString().padStart(4)} / ${startups.length} (${(hasCustomers / startups.length * 100).toFixed(1)}%)`);
  console.log(`    Has website:   ${hasWebsite.toString().padStart(4)} / ${startups.length} (${(hasWebsite / startups.length * 100).toFixed(1)}%)`);
}

async function queryCounts() {
  const tables = ['investors', 'startup_uploads', 'startup_investor_matches', 'discovered_startups', 'rss_sources'];
  console.log('\n  Table Counts:');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    console.log(`    ${table.padEnd(30)} ${error ? 'ERROR' : count}`);
  }
  console.log('');
}

function printHelp() {
  console.log(`
  DATABASE QUERY HELPER
  =====================

  Usage: node scripts/query-db.js <entity> [options]

  Entities:
    investors     Query investor table
    startups      Query startup_uploads table
    counts        Quick row counts for all tables

  Options:
    --top=N           Top N by score (descending)
    --bottom=N        Bottom N by score (ascending)
    --search="text"   Fuzzy name/description search
    --tier=elite      Filter investors by tier (elite/strong/solid/emerging)
    --status=approved Filter startups by status
    --id=UUID         Full details for one record
    --missing=field   Show records missing a specific field
    --stats           Score distribution and data coverage stats
    --csv             Export results to CSV file

  Examples:
    node scripts/query-db.js investors --top=20
    node scripts/query-db.js investors --tier=elite
    node scripts/query-db.js investors --search="sequoia"
    node scripts/query-db.js investors --stats
    node scripts/query-db.js startups --top=20
    node scripts/query-db.js startups --bottom=50 --status=approved
    node scripts/query-db.js startups --stats
    node scripts/query-db.js counts
  `);
}

async function main() {
  switch (entity) {
    case 'investors': await queryInvestors(); break;
    case 'startups': await queryStartups(); break;
    case 'counts': await queryCounts(); break;
    default: printHelp(); break;
  }
}

main().catch(console.error);
