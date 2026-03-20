#!/usr/bin/env node
/**
 * Query GOD scores from Supabase (uses REST API, no direct DB connection needed)
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_URL in .env');
    process.exit(1);
  }
  console.log(`\n📊 GOD Scores from ${url}\n`);

  // Summary stats (paginate to get ALL startups with scores — Supabase defaults to 1000)
  const { count: totalApproved } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');

  const PAGE = 1000;
  const allScores = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .range(offset, offset + PAGE - 1);
    if (!data?.length) break;
    allScores.push(...data.map((s) => s.total_god_score));
    if (data.length < PAGE) break;
  }

  if (allScores.length > 0) {
    const sum = allScores.reduce((a, b) => a + b, 0);
    const avg = (sum / allScores.length).toFixed(1);
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    const elite = allScores.filter((s) => s >= 80).length;
    const excellent = allScores.filter((s) => s >= 70 && s < 80).length;
    const strong = allScores.filter((s) => s >= 60 && s < 70).length;

    console.log('SUMMARY');
    console.log('─'.repeat(50));
    console.log(`  Total approved:     ${totalApproved ?? '?'}`);
    console.log(`  With GOD score:     ${allScores.length}`);
    console.log(`  Avg score:          ${avg}`);
    console.log(`  Min / Max:          ${min} / ${max}`);
    console.log(`  Elite (80+):        ${elite}`);
    console.log(`  Excellent (70-79):  ${excellent}`);
    console.log(`  Strong (60-69):     ${strong}`);
    console.log('');
  }

  // Top 20
  const { data: top } = await supabase
    .from('startup_uploads')
    .select('name, website, total_god_score, company_status')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(20);

  console.log('TOP 20 BY GOD SCORE');
  console.log('─'.repeat(50));
  top?.forEach((row, i) => {
    const status = row.company_status ? ` [${row.company_status}]` : '';
    console.log(`  ${(i + 1).toString().padStart(2)}. ${row.name} — ${row.total_god_score}${status}`);
  });
  console.log('');
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
