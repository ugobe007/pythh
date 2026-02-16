#!/usr/bin/env node
/**
 * Fix Gaming sector: remove "Gaming" tag from startups that aren't actually gaming-related.
 * Uses a simple approach: fetch all gaming-tagged, check text, update in batch.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const gamingKeywords = [
  /\bgam(e|ing|er|es)\b/i, /\besport/i, /\bvideo game/i, /\bmobile game/i,
  /\bgame dev/i, /\bgame studio/i, /\bplay.?to.?earn/i, /\bgamefi/i,
  /\bmetaverse/i, /\bgame.*engine/i, /\btwitch/i, /\bunity|unreal/i,
  /\bRPG|MMORPG|MOBA|FPS/i, /\barcade|casual game/i, /\bin.?game|game.?play/i,
  /\bgame.*company/i, /\bgamified/i, /\bgame.*platform/i, /\bVR game/i,
  /\bsteam(?!\s)/i
];

async function main() {
  // Fetch ALL gaming-tagged startups in one paginated pass
  let gaming = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb.from('startup_uploads')
      .select('id, name, sectors, description')
      .eq('status', 'approved')
      .contains('sectors', ['Gaming'])
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error('Fetch error:', error.message); break; }
    gaming = gaming.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }
  
  console.log('Total gaming-tagged: ' + gaming.length);
  
  const misTagged = gaming.filter(s => {
    const text = [s.description || '', s.name || ''].join(' ');
    return !gamingKeywords.some(k => k.test(text));
  });
  
  console.log('Mis-tagged (not actually gaming): ' + misTagged.length);
  console.log('Actual gaming: ' + (gaming.length - misTagged.length));
  
  if (!process.argv.includes('--run')) {
    console.log('Dry run. Use --run to fix.');
    return;
  }
  
  // Update: remove 'Gaming' from sectors
  let fixed = 0;
  let errors = 0;
  for (let i = 0; i < misTagged.length; i++) {
    const s = misTagged[i];
    const newSectors = (s.sectors || []).filter(sec => sec !== 'Gaming');
    if (newSectors.length === 0) newSectors.push('Technology');
    
    const { error } = await sb.from('startup_uploads')
      .update({ sectors: newSectors })
      .eq('id', s.id);
    
    if (error) { errors++; }
    else { fixed++; }
    
    if ((i + 1) % 100 === 0) process.stdout.write('  Progress: ' + (i + 1) + '/' + misTagged.length + '\r');
  }
  
  console.log('\nFixed: ' + fixed + ', Errors: ' + errors);
  
  const { count } = await sb.from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .contains('sectors', ['Gaming']);
  console.log('Gaming-tagged remaining: ' + count);
}

main().catch(console.error);
