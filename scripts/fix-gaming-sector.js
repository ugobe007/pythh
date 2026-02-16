#!/usr/bin/env node
/**
 * Audit and fix Gaming sector over-classification
 * Gaming has 1,604 startups but avg GOD 41.2 - many are mis-tagged
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const DRY_RUN = !process.argv.includes('--run');

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');

  // Get all gaming-tagged startups
  let gaming = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb.from('startup_uploads')
      .select('id, name, sectors, total_god_score, description')
      .eq('status', 'approved')
      .contains('sectors', ['Gaming'])
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) console.log('Query error:', error.message);
    console.log('Page ' + page + ': got ' + (data ? data.length : 0) + ' results');
    gaming = gaming.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }

  console.log('Total gaming-tagged: ' + gaming.length);

  // Keywords that indicate ACTUAL gaming startups
  const gamingKeywords = [
    /\bgam(e|ing|er|es)\b/i,
    /\besport/i,
    /\bvideo game/i,
    /\bmobile game/i,
    /\bgame dev/i,
    /\bgame studio/i,
    /\bstreaming.*game/i,
    /\bgame.*stream/i,
    /\bplay.?to.?earn/i,
    /\bgamefi/i,
    /\bmetaverse/i,
    /\bgame.*engine/i,
    /\btwitch/i,
    /\bsteam(?! )/i,
    /\bxbox|playstation|nintendo/i,
    /\bunity|unreal/i,
    /\bRPG|MMORPG|MOBA|FPS/i,
    /\barcade|puzzle|casual game/i,
    /\bin.?game|game.?play/i,
    /\bVR game|AR game|XR game/i,
    /\bmobile.*entertain/i,
    /\bgame.*company/i,
    /\bplay.*earn/i,
    /\bgame.*platform/i,
    /\bgamified/i
  ];

  let actualGaming = 0;
  let misTagged = 0;
  const misTaggedList = [];

  for (const s of gaming) {
    const text = [s.description || '', s.name || ''].join(' ');
    const isActualGaming = gamingKeywords.some(k => k.test(text));
    
    if (isActualGaming) {
      actualGaming++;
    } else {
      misTagged++;
      misTaggedList.push(s);
    }
  }

  console.log('Actual gaming: ' + actualGaming);
  console.log('Mis-tagged (no gaming keywords): ' + misTagged);
  console.log();

  // Show sample of mis-tagged
  console.log('Sample mis-tagged startups:');
  misTaggedList.slice(0, 30).forEach(s => {
    console.log('  ' + s.name + ' | GOD: ' + s.total_god_score + ' | sectors: ' + JSON.stringify(s.sectors));
    console.log('    desc: ' + (s.description || '').substring(0, 80));
  });

  // What sectors do mis-tagged ones also have?
  const altSectors = {};
  misTaggedList.forEach(s => {
    (s.sectors || []).forEach(sec => {
      if (sec !== 'Gaming') {
        altSectors[sec] = (altSectors[sec] || 0) + 1;
      }
    });
  });
  console.log('\nAlternate sectors on mis-tagged:');
  Object.entries(altSectors).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([sec, count]) => {
    console.log('  ' + sec + ': ' + count);
  });

  if (DRY_RUN) {
    console.log('\nDry run. Use --run to remove Gaming tag from ' + misTagged + ' mis-tagged startups.');
    return;
  }

  // Remove 'Gaming' from sectors array for mis-tagged startups
  let fixed = 0;
  for (const s of misTaggedList) {
    const newSectors = (s.sectors || []).filter(sec => sec !== 'Gaming');
    
    // If sectors would be empty, assign 'Technology' as default
    if (newSectors.length === 0) {
      newSectors.push('Technology');
    }
    
    const { error } = await sb.from('startup_uploads')
      .update({ sectors: newSectors })
      .eq('id', s.id);
    
    if (error) {
      console.log('Error fixing ' + s.name + ': ' + error.message);
    } else {
      fixed++;
    }
  }

  console.log('Fixed ' + fixed + ' mis-tagged startups');
  
  // Verify
  const { count } = await sb.from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .contains('sectors', ['Gaming']);
  console.log('Gaming-tagged remaining: ' + count);
}

main().catch(console.error);
