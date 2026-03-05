#!/usr/bin/env node
/**
 * Quick audit: break down the no-URL startup population
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  let all = [];
  let from = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('name, website, company_website, pitch, description, tagline, sectors, total_god_score, extracted_data')
      .eq('status', 'approved')
      .range(from, from + 999);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const noUrl = all.filter(s => !s.website && !s.company_website);
  const withUrl = all.filter(s => s.website || s.company_website);

  // For no-URL: bucket by how much real text they have
  const buckets = { substantial: [], thin: [], empty: [] };
  for (const s of noUrl) {
    const pitch = (s.pitch || s.description || '');
    const tagline = (s.tagline || '');
    const ed = s.extracted_data || {};
    const hasSubstance = pitch.length > 80 || tagline.length > 20 || s.sectors?.length > 0 || ed.description?.length > 50;
    const hasAnything = pitch.length > 10 || tagline.length > 5;
    
    if (hasSubstance) buckets.substantial.push(s);
    else if (hasAnything) buckets.thin.push(s);
    else buckets.empty.push(s);
  }

  console.log(`\n📊 NO-URL STARTUP BREAKDOWN (${noUrl.length} of ${all.length})\n`);
  console.log(`  Has real content (pitch/tagline/sectors): ${buckets.substantial.length} (${Math.round(buckets.substantial.length/all.length*100)}%)`);
  console.log(`  Has thin content (short pitch only):      ${buckets.thin.length} (${Math.round(buckets.thin.length/all.length*100)}%)`);
  console.log(`  Completely empty (name only):             ${buckets.empty.length} (${Math.round(buckets.empty.length/all.length*100)}%)`);

  const avgEmpty = buckets.empty.reduce((a,b) => a+(b.total_god_score||0),0)/(buckets.empty.length||1);
  const avgThin = buckets.thin.reduce((a,b) => a+(b.total_god_score||0),0)/(buckets.thin.length||1);
  const avgSubst = buckets.substantial.reduce((a,b) => a+(b.total_god_score||0),0)/(buckets.substantial.length||1);
  console.log(`\n  Avg GOD score:`);
  console.log(`    Substantial: ${Math.round(avgSubst)}`);
  console.log(`    Thin:        ${Math.round(avgThin)}`);
  console.log(`    Empty:       ${Math.round(avgEmpty)}`);

  console.log(`\n  Sample empty entries:`);
  buckets.empty.slice(0, 15).forEach(s => console.log(`    [${s.total_god_score}] ${s.name}`));

  console.log(`\n  Sample thin entries:`);
  buckets.thin.slice(0, 8).forEach(s => {
    const pitch = (s.pitch || s.description || '').slice(0, 60);
    console.log(`    [${s.total_god_score}] ${(s.name||'').slice(0,30).padEnd(30)} | "${pitch}"`);
  });

  console.log(`\n🎯 Recommended cleanup:`);
  console.log(`  Remove empty (${buckets.empty.length}) + thin with score < 40 (${buckets.thin.filter(s=>s.total_god_score<40).length})`);
  console.log(`  Total removable: ~${buckets.empty.length + buckets.thin.filter(s=>s.total_god_score<40).length}`);
})();
