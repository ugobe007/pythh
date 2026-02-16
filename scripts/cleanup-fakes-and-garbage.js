#!/usr/bin/env node
/**
 * CLEANUP: Remove fake seed/auto-generated startups AND bottom garbage entries
 * 
 * Two categories:
 * 1. Auto-generated fake startups (SparkOps, RapidLabs, etc.) - all created 2025-12-13
 *    with templated descriptions "We're building the next generation of..."
 * 2. Bottom garbage entries - non-startups (Sony, Pitchbook, Producthunt, news headlines, etc.)
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const DRY_RUN = !process.argv.includes('--run');

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (use --run to execute) ===' : '=== LIVE RUN ===');
  console.log();

  // ═══════════════════════════════════════════════════════════════
  // PHASE 1: Auto-generated fake startups
  // All have: created_at on 2025-12-13, CamelCase names, template descriptions
  // ═══════════════════════════════════════════════════════════════
  console.log('PHASE 1: Auto-generated fake startups');
  
  // Find by template description pattern + creation date
  let fakes = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('id, name, website, description, created_at, total_god_score')
      .eq('status', 'approved')
      .gte('created_at', '2025-12-13T00:00:00')
      .lte('created_at', '2025-12-14T00:00:00')
      .range(page * 1000, (page + 1) * 1000 - 1);
    fakes = fakes.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }
  
  // Filter to those with template descriptions
  const templateFakes = fakes.filter(s => {
    const desc = (s.description || '').toLowerCase();
    return desc.includes("we're building the next generation") ||
           desc.includes("enterprise-grade") ||
           desc.includes("ai-powered") && desc.includes("platform that helps") ||
           desc.includes("revolutionizing") && desc.includes("with machine learning") ||
           desc.includes("automating") && desc.includes("with cutting-edge ai") ||
           desc.includes("the operating system for") ||
           desc.includes("all-in-one") && desc.includes("solution for enterprises") ||
           desc.includes("infrastructure for the next generation");
  });
  
  console.log('  Found ' + fakes.length + ' startups created on 2025-12-13');
  console.log('  Template-matching fakes: ' + templateFakes.length);
  templateFakes.forEach(s => {
    console.log('    ' + s.name + ' (GOD ' + s.total_god_score + ') - ' + (s.description || '').substring(0, 60));
  });

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2: Named garbage entries (non-startups)
  // ═══════════════════════════════════════════════════════════════
  console.log('\nPHASE 2: Named garbage entries');
  
  const garbageNames = [
    'Sony', 'Pitchbook', 'Producthunt', 'TechCrunch', 'Inc42', 'VCCircle',
    'Newswire', 'Imprivata', 'Valley Authority', 'McKinsey', 'Deutsche Boerse',
    'Gleanai', 'Mccormack', 'Graves', 'Didero', 'Jimeng', 'Ex-SafeMoon',
    'Frontrow', 'Price', 'Claim', 'large', 'Optimist', 'Sophos', 'GitLab',
    'The EU', 'UAE', 'U.S', 'U.S.', 'US', 'SpaceX-xAI', 'Davos',
    'Insights', 'Tem', 'Humanoid', 'Plato', 'Helin', 'Learned',
    'EquipmentShare', 'Magic Eden', 'Juspay', 'helps enterprising',
  ];
  
  // Also find garbage by description patterns (news headlines, not startup descriptions)
  let allApproved = [];
  page = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('id, name, description, total_god_score')
      .eq('status', 'approved')
      .range(page * 1000, (page + 1) * 1000 - 1);
    allApproved = allApproved.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }
  
  const garbageByName = allApproved.filter(s => {
    return garbageNames.some(g => s.name === g || s.name === g.toLowerCase());
  });
  
  // Headline fragments as names (be CONSERVATIVE - only clear non-startup patterns)
  const headlineGarbage = allApproved.filter(s => {
    const name = s.name || '';
    // ONLY match clear news headline patterns, NOT concatenated YC names
    // Pattern: "more Bullish as stock jumps over 16" - starts with common headline words
    if (/^(more |Post |Money |Beyond |Pushing |Sales |Measuring |Nuclear |Former |To Sell |Startup Goodfire)/i.test(name)) return true;
    if (/^(Deeptech-Focussed|Sleeptech Startup|Military Robot|London-based Tem$)/i.test(name)) return true;
    // DO NOT match names > 40 chars — many are real YC startups with concatenated data
    return false;
  });
  
  console.log('  Garbage by name: ' + garbageByName.length);
  garbageByName.forEach(s => console.log('    ' + s.name + ' (GOD ' + s.total_god_score + ')'));
  console.log('  Headline fragments: ' + headlineGarbage.length);
  headlineGarbage.forEach(s => console.log('    "' + s.name + '" (GOD ' + s.total_god_score + ')'));
  
  // ═══════════════════════════════════════════════════════════════
  // COMBINE & DELETE
  // ═══════════════════════════════════════════════════════════════
  const deleteSet = new Set();
  templateFakes.forEach(s => deleteSet.add(s.id));
  garbageByName.forEach(s => deleteSet.add(s.id));
  headlineGarbage.forEach(s => deleteSet.add(s.id));
  
  const deleteIds = [...deleteSet];
  console.log('\nTOTAL TO DELETE: ' + deleteIds.length);
  
  if (DRY_RUN) {
    console.log('\nDry run complete. Use --run to execute deletion.');
    return;
  }
  
  // Delete related records first (foreign key constraints)
  const tables = [
    'startup_investor_matches',
    'score_history', 
    'match_gen_logs',
    'faith_alignment_matches',
    'feature_snapshots',
    'action_events_v2',
    'score_deltas_v2',
  ];
  
  for (const table of tables) {
    try {
      const { error } = await sb.from(table).delete().in('startup_id', deleteIds);
      if (error && !error.message.includes('does not exist')) {
        console.log('  Warning cleaning ' + table + ': ' + error.message);
      }
    } catch (e) {}
  }
  
  // Delete in batches of 50
  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += 50) {
    const batch = deleteIds.slice(i, i + 50);
    const { error } = await sb.from('startup_uploads').delete().in('id', batch);
    if (error) {
      console.log('Error deleting batch at ' + i + ': ' + error.message);
    } else {
      deleted += batch.length;
      process.stdout.write('  Deleted: ' + deleted + '/' + deleteIds.length + '\r');
    }
  }
  
  console.log('\nDeleted ' + deleted + ' fake/garbage entries');
  
  // Verify
  const { count } = await sb.from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved');
  console.log('Remaining approved startups: ' + count);
}

main().catch(console.error);
