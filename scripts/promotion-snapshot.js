#!/usr/bin/env node
/**
 * PROMOTION SNAPSHOT
 * 
 * Outputs key numbers for marketing/promotion. Run before updating
 * docs/PYTHH_DATA_FOR_PROMOTION.md or one-pagers.
 * 
 * Usage: node scripts/promotion-snapshot.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('\n📊 PYTHH PROMOTION SNAPSHOT');
  console.log('═'.repeat(60));
  console.log('Run at:', new Date().toISOString());
  console.log('');

  // Core counts
  const [startupsRes, investorsRes, matchesRes, approvedRes] = await Promise.all([
    supabase.from('startup_uploads').select('*', { count: 'exact', head: true }),
    supabase.from('investors').select('*', { count: 'exact', head: true }),
    supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
    supabase.from('startup_uploads').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
  ]);

  const totalStartups = startupsRes.count ?? 0;
  const approvedStartups = approvedRes.count ?? 0;
  const investors = investorsRes.count ?? 0;
  const matches = matchesRes.count ?? 0;

  console.log('CORE COUNTS');
  console.log('─'.repeat(40));
  console.log(`  Startup uploads (total):  ${(totalStartups || 0).toLocaleString()}`);
  console.log(`  Startups (approved):      ${(approvedStartups || 0).toLocaleString()}`);
  console.log(`  Investors:                ${(investors || 0).toLocaleString()}`);
  console.log(`  Matches:                  ${(matches || 0).toLocaleString()}`);
  console.log('');

  // GOD score distribution (approved only)
  let allApproved = [];
  let page = 0;
  const PAGE = 1000;
  while (true) {
    const { data } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .range(page * PAGE, (page + 1) * PAGE - 1);
    allApproved = allApproved.concat(data || []);
    if (!data || data.length < PAGE) break;
    page++;
  }

  const dist = { '0-39': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90+': 0 };
  allApproved.forEach((s) => {
    const sc = s.total_god_score;
    if (sc == null) return;
    if (sc < 40) dist['0-39']++;
    else if (sc < 50) dist['40-49']++;
    else if (sc < 60) dist['50-59']++;
    else if (sc < 70) dist['60-69']++;
    else if (sc < 80) dist['70-79']++;
    else if (sc < 90) dist['80-89']++;
    else dist['90+']++;
  });

  const n = allApproved.length;
  const avg = n ? (allApproved.reduce((a, s) => a + (s.total_god_score || 0), 0) / n).toFixed(1) : '—';

  console.log('GOD SCORE (approved)');
  console.log('─'.repeat(40));
  console.log(`  Average:                  ${avg}`);
  Object.entries(dist).forEach(([k, v]) => {
    const pct = n ? ((v / n) * 100).toFixed(1) : 0;
    console.log(`  ${k.padEnd(8)} ${String(v).padStart(6)} (${pct}%)`);
  });
  console.log('');

  // Optional: discoveries, signals
  try {
    const { count: disc } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true });
    if (disc != null) console.log(`  Discovered (pending):     ${disc.toLocaleString()}`);
  } catch (_) {}

  console.log('');
  console.log('Copy these numbers into docs/PYTHH_DATA_FOR_PROMOTION.md');
  console.log('═'.repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
