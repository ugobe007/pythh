#!/usr/bin/env node
/**
 * Diagnose why low-scoring startups score poorly
 * Checks presence of key data fields and web signals
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // Sample low-scoring startups (bottom tier)
  const { data: lowScorers } = await sb.from('startup_uploads')
    .select('name, website, total_god_score, extracted_data')
    .eq('status', 'approved')
    .lt('total_god_score', 40)
    .not('extracted_data->web_signals', 'is', null)
    .order('total_god_score', { ascending: true })
    .limit(20);

  console.log('\n📉 LOW SCORERS (< 40) — Data completeness audit\n');
  console.log('Score | Name                           | blog  t1  t2  rdt | team trac fund mkt | desc  vp   prob sol');
  console.log('------+--------------------------------+-------------------+--------------------+--------------------');

  const stats = { noTeam: 0, noTraction: 0, noFunding: 0, noMarket: 0, noDesc: 0, noBlog: 0, noPress: 0, noReddit: 0 };

  for (const s of lowScorers) {
    const ed = s.extracted_data || {};
    const ws = ed.web_signals || {};

    // Structural data
    const hasTeam     = !!(ed.team || ed.founders || ed.team_size || ed.team_background);
    const hasTraction = !!(ed.revenue || ed.mrr || ed.arr || ed.customers || ed.users || ed.traction || ed.growth);
    const hasFunding  = !!(ed.funding || ed.raised || ed.backed_by || ed.investors || ed.funding_stage);
    const hasMarket   = !!(ed.market_size || ed.tam || ed.market || ed.target_market);
    const hasDesc     = !!(ed.description || ed.summary || s.description);
    const hasVP       = !!(ed.value_proposition || s.value_proposition);
    const hasProb     = !!(ed.problem || s.problem);
    const hasSol      = !!(ed.solution || s.solution);

    // Web signals
    const blog   = ws.blog?.post_count_estimate || 0;
    const t1     = ws.press_tier?.tier1_count || 0;
    const t2     = ws.press_tier?.tier2_count || 0;
    const reddit = ws.reddit?.mention_count || 0;

    if (!hasTeam)     stats.noTeam++;
    if (!hasTraction) stats.noTraction++;
    if (!hasFunding)  stats.noFunding++;
    if (!hasMarket)   stats.noMarket++;
    if (!hasDesc)     stats.noDesc++;
    if (blog === 0)   stats.noBlog++;
    if (t1 === 0)     stats.noPress++;
    if (reddit === 0) stats.noReddit++;

    const score = String(s.total_god_score).padStart(3);
    const name  = (s.name || '').slice(0, 30).padEnd(30);
    const webStr = String(blog).padStart(4) + ' ' + String(t1).padStart(3) + ' ' +
                   String(t2).padStart(3) + ' ' + String(reddit).padStart(4);
    const structStr = (hasTeam?'Y':'N') + '    ' + (hasTraction?'Y':'N') + '    ' +
                      (hasFunding?'Y':'N') + '    ' + (hasMarket?'Y':'N');
    const textStr = (hasDesc?'Y':'N') + '     ' + (hasVP?'Y':'N') + '    ' +
                    (hasProb?'Y':'N') + '    ' + (hasSol?'Y':'N');
    console.log(` ${score}  | ${name} | ${webStr} | ${structStr} | ${textStr}`);
  }

  console.log('\n📊 Missing data summary (out of 20 sampled):');
  console.log(`  No team info:     ${stats.noTeam}/20`);
  console.log(`  No traction data: ${stats.noTraction}/20`);
  console.log(`  No funding info:  ${stats.noFunding}/20`);
  console.log(`  No market info:   ${stats.noMarket}/20`);
  console.log(`  No description:   ${stats.noDesc}/20`);
  console.log(`  No blog posts:    ${stats.noBlog}/20`);
  console.log(`  No tier-1 press:  ${stats.noPress}/20`);
  console.log(`  No reddit/comm:   ${stats.noReddit}/20`);

  // Also check the full distribution of missing fields at scale
  console.log('\n🔬 Full scale check (all low scorers < 40)...');
  const { data: all } = await sb.from('startup_uploads')
    .select('extracted_data')
    .eq('status', 'approved')
    .lt('total_god_score', 40)
    .limit(2000);

  let total = all.length;
  let missingTeam = 0, missingTraction = 0, missingFunding = 0, missingMarket = 0;
  let missingT1 = 0, missingBlog = 0;

  for (const s of all) {
    const ed = s.extracted_data || {};
    const ws = ed.web_signals || {};
    if (!(ed.team || ed.founders || ed.team_size || ed.team_background)) missingTeam++;
    if (!(ed.revenue || ed.mrr || ed.arr || ed.customers || ed.users || ed.traction || ed.growth)) missingTraction++;
    if (!(ed.funding || ed.raised || ed.backed_by || ed.investors || ed.funding_stage)) missingFunding++;
    if (!(ed.market_size || ed.tam || ed.market || ed.target_market)) missingMarket++;
    if (!(ws.press_tier?.tier1_count)) missingT1++;
    if (!(ws.blog?.post_count_estimate)) missingBlog++;
  }

  console.log(`  n=${total}`);
  console.log(`  Missing team:     ${missingTeam} (${Math.round(missingTeam/total*100)}%)`);
  console.log(`  Missing traction: ${missingTraction} (${Math.round(missingTraction/total*100)}%)`);
  console.log(`  Missing funding:  ${missingFunding} (${Math.round(missingFunding/total*100)}%)`);
  console.log(`  Missing market:   ${missingMarket} (${Math.round(missingMarket/total*100)}%)`);
  console.log(`  No tier-1 press:  ${missingT1} (${Math.round(missingT1/total*100)}%)`);
  console.log(`  No blog:          ${missingBlog} (${Math.round(missingBlog/total*100)}%)`);
})();
