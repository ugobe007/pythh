#!/usr/bin/env node
require('dotenv').config();
const { supabase } = require('../server/lib/supabaseClient');

(async () => {
  const domain = process.argv[2] || 'joinpapa.com';
  const website = `https://${domain.replace(/^https?:\/\//, '')}`;
  
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('id, name, sectors, stage, total_god_score')
    .eq('website', website)
    .single();
  
  if (!startup) {
    console.log('Startup not found for', website);
    process.exit(0);
  }
  
  console.log('Startup:', startup.name, '| GOD:', startup.total_god_score, '| Sectors:', startup.sectors);
  
  const { data: matches, error } = await supabase
    .from('startup_investor_matches')
    .select('match_score, reasoning, fit_analysis, confidence_level, why_you_match, investors(name, firm, sectors)')
    .eq('startup_id', startup.id)
    .order('match_score', { ascending: false })
    .limit(10);
  
  console.log(`\nTop ${matches?.length || 0} matches:`);
  if (error) console.log('Error:', error.message);
  
  for (const m of (matches || [])) {
    console.log(`\n  Score: ${m.match_score} | Confidence: ${m.confidence_level || 'N/A'}`);
    console.log(`  Investor: ${m.investors?.name || 'unknown'} (${m.investors?.firm || ''})`);
    console.log(`  Fit analysis:`, m.fit_analysis ? JSON.stringify(m.fit_analysis) : 'NONE');
    console.log(`  Why you match:`, m.why_you_match ? JSON.stringify(m.why_you_match) : 'NONE');
    console.log(`  Reasoning: ${(m.reasoning || '').slice(0, 150)}`);
  }
  
  // Count total
  const { count } = await supabase
    .from('startup_investor_matches')
    .select('id', { count: 'exact', head: true })
    .eq('startup_id', startup.id);
  
  console.log(`\nTotal matches: ${count}`);
  
  // Check if any have fit_analysis (= new scorer)
  const { count: newCount } = await supabase
    .from('startup_investor_matches')
    .select('id', { count: 'exact', head: true })
    .eq('startup_id', startup.id)
    .not('fit_analysis', 'is', null);
  
  console.log(`Matches with fit_analysis (new scorer): ${newCount}`);
  console.log(`Matches WITHOUT fit_analysis (old scorer): ${count - newCount}`);
  
  process.exit(0);
})();
