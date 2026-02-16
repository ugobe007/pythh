#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Check top 30 by GOD score - look at their URLs and data
  const { data: top } = await sb.from('startup_uploads')
    .select('id, name, website, total_god_score, team_score, traction_score, market_score, product_score, vision_score, description, sectors, created_at')
    .eq('status', 'approved')
    .order('total_god_score', { ascending: false })
    .limit(30);

  console.log('TOP 30 STARTUPS - FULL DETAIL:');
  top.forEach((s, i) => {
    console.log((i+1) + '. GOD ' + s.total_god_score + ' | ' + s.name);
    console.log('   URL: ' + (s.website || 'NONE'));
    console.log('   Desc: ' + (s.description || 'NONE').substring(0, 100));
    console.log('   Sectors: ' + JSON.stringify(s.sectors));
    console.log('   Created: ' + s.created_at);
    console.log('   T:' + s.team_score + ' Tr:' + s.traction_score + ' M:' + s.market_score + ' P:' + s.product_score + ' V:' + s.vision_score);
    console.log();
  });

  // Count fake-looking names in DB
  const fakePatterns = [
    'SparkOps', 'RapidLabs', 'SparkSecurity', 'UltraSpace', 'DataWorks',
    'SwiftSense', 'SmartData', 'SparkWorks', 'StellarAnalytics', 'VertexSolutions',
    'SwiftFinance', 'GridCloud', 'NextAI', 'WaveSolutions', 'DigitalAI',
    'WaveSense', 'AutoWorks', 'AutoSolutions', 'RapidMind', 'AutoOps'
  ];
  
  console.log('\n\nFAKE NAME PATTERN SEARCH:');
  // Check for CamelCase compound names that look auto-generated
  let all = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('id, name, website, total_god_score')
      .eq('status', 'approved')
      .range(page * 1000, (page + 1) * 1000 - 1);
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }

  // Identify auto-generated looking names
  const techPrefixes = ['Smart', 'Swift', 'Rapid', 'Ultra', 'Grid', 'Wave', 'Auto', 'Digital', 'Spark', 'Vertex', 'Stellar', 'Data', 'Next', 'Cloud', 'Proto', 'Quantum', 'Cyber', 'Neo', 'Hyper', 'Flux', 'Nova', 'Pulse', 'Core', 'Logic', 'Tera', 'Edge'];
  const techSuffixes = ['Ops', 'Labs', 'Works', 'AI', 'Cloud', 'Data', 'Solutions', 'Analytics', 'Finance', 'Security', 'Space', 'Mind', 'Sense', 'Tech', 'IO', 'Hub', 'Net', 'Link', 'Ware', 'Stack'];
  
  const suspectFake = all.filter(s => {
    const name = s.name || '';
    // Match pattern: TechPrefix + TechSuffix (CamelCase, no spaces)
    return techPrefixes.some(p => name.startsWith(p)) && 
           techSuffixes.some(sf => name.endsWith(sf)) &&
           !name.includes(' ') &&
           name.length < 20;
  });
  
  console.log('Suspect auto-generated names: ' + suspectFake.length);
  suspectFake.sort((a, b) => b.total_god_score - a.total_god_score);
  suspectFake.slice(0, 30).forEach(s => {
    console.log('  GOD ' + String(s.total_god_score).padStart(3) + ' | ' + s.name + ' | URL: ' + (s.website || 'NONE'));
  });

  // Also check: bottom-20 garbage
  console.log('\n\nBOTTOM GARBAGE CHECK - Non-startup names:');
  const garbagePatterns = [
    /^(Sony|Pitchbook|Producthunt|Techcrunch|Deutsche|U\.?S\.?|Price|Claim|large|Optimist|Newswire|Frontrow|Imprivata|Gleanai|Mccormack|Graves|Didero|Jimeng|Ex-SafeMoon|Valley Authority)$/i
  ];
  const garbage = all.filter(s => garbagePatterns.some(p => p.test(s.name)));
  console.log('Found ' + garbage.length + ' of the known garbage names');
  garbage.forEach(s => console.log('  ' + s.name + ' (GOD ' + s.total_god_score + ')'));

  // Gaming sector audit
  console.log('\n\nGAMING SECTOR AUDIT:');
  const { data: gamingStartups } = await sb.from('startup_uploads')
    .select('id, name, sectors, total_god_score, description')
    .eq('status', 'approved')
    .contains('sectors', ['Gaming'])
    .order('total_god_score', { ascending: true })
    .limit(30);
  
  console.log('Sample Gaming-tagged startups (lowest scores):');
  (gamingStartups || []).forEach(s => {
    console.log('  GOD ' + String(s.total_god_score).padStart(3) + ' | ' + s.name + ' | ' + (s.description || '').substring(0, 60));
  });

  // Component scores > 100
  console.log('\n\nCOMPONENT SCORES > 100:');
  const overScored = all.filter(s => {
    // Need to re-fetch with component scores
    return false; // placeholder
  });
  
  // Re-fetch a sample
  const { data: oversample } = await sb.from('startup_uploads')
    .select('name, team_score, market_score, product_score')
    .eq('status', 'approved')
    .or('team_score.gt.100,market_score.gt.100,product_score.gt.100')
    .limit(20);
  
  console.log('Startups with component scores > 100: ' + (oversample ? oversample.length : 0));
  (oversample || []).forEach(s => {
    const issues = [];
    if (s.team_score > 100) issues.push('team:' + s.team_score);
    if (s.market_score > 100) issues.push('market:' + s.market_score);
    if (s.product_score > 100) issues.push('product:' + s.product_score);
    console.log('  ' + s.name + ' | ' + issues.join(', '));
  });

  // Get total count of > 100
  const { count: overTeam } = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').gt('team_score', 100);
  const { count: overMarket } = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').gt('market_score', 100);
  const { count: overProduct } = await sb.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved').gt('product_score', 100);
  console.log('Total with team_score > 100: ' + overTeam);
  console.log('Total with market_score > 100: ' + overMarket);
  console.log('Total with product_score > 100: ' + overProduct);
}

main().catch(console.error);
