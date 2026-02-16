#!/usr/bin/env node
// Quick script to analyze investor data quality for live feed filtering
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  // 1. Check investor_score and investor_tier distribution
  console.log('=== INVESTOR TIER DISTRIBUTION ===');
  const { data: allInvestors } = await supabase
    .from('investors')
    .select('investor_tier')
    .not('investor_tier', 'is', null);
  
  const tierCounts = {};
  allInvestors?.forEach(i => {
    tierCounts[i.investor_tier] = (tierCounts[i.investor_tier] || 0) + 1;
  });
  console.log(tierCounts);

  // 2. Check investor_score distribution
  console.log('\n=== INVESTOR SCORE DISTRIBUTION ===');
  const { data: scored } = await supabase
    .from('investors')
    .select('investor_score')
    .not('investor_score', 'is', null)
    .order('investor_score', { ascending: false })
    .limit(5000);
  
  if (scored && scored.length > 0) {
    const scores = scored.map(s => s.investor_score);
    console.log(`Count with score: ${scores.length}`);
    console.log(`Max: ${Math.max(...scores)}, Min: ${Math.min(...scores)}, Avg: ${(scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1)}`);
    // Buckets
    const buckets = { '90+': 0, '80-89': 0, '70-79': 0, '60-69': 0, '50-59': 0, '40-49': 0, '<40': 0 };
    scores.forEach(s => {
      if (s >= 90) buckets['90+']++;
      else if (s >= 80) buckets['80-89']++;
      else if (s >= 70) buckets['70-79']++;
      else if (s >= 60) buckets['60-69']++;
      else if (s >= 50) buckets['50-59']++;
      else if (s >= 40) buckets['40-49']++;
      else buckets['<40']++;
    });
    console.log('Score buckets:', buckets);
  } else {
    console.log('No investors have scores');
  }

  // 3. Top 20 investors by score
  console.log('\n=== TOP 20 BY INVESTOR_SCORE ===');
  const { data: top20 } = await supabase
    .from('investors')
    .select('name, firm, investor_score, investor_tier, is_verified, type, sectors')
    .not('investor_score', 'is', null)
    .order('investor_score', { ascending: false })
    .limit(20);
  
  top20?.forEach((inv, i) => {
    console.log(`${i+1}. ${inv.name} | firm: ${inv.firm || '-'} | score: ${inv.investor_score} | tier: ${inv.investor_tier || '-'} | verified: ${inv.is_verified} | type: ${inv.type || '-'} | sectors: ${inv.sectors?.slice(0,3)?.join(',') || '-'}`);
  });

  // 4. Check is_verified distribution
  console.log('\n=== VERIFIED DISTRIBUTION ===');
  const { count: verified } = await supabase.from('investors').select('*', { count: 'exact', head: true }).eq('is_verified', true);
  const { count: notVerified } = await supabase.from('investors').select('*', { count: 'exact', head: true }).eq('is_verified', false);
  const { count: nullVerified } = await supabase.from('investors').select('*', { count: 'exact', head: true }).is('is_verified', null);
  console.log(`Verified: ${verified}, Not verified: ${notVerified}, Null: ${nullVerified}`);

  // 5. Check what recent investors look like (the garbage ones)
  console.log('\n=== 10 NEWEST INVESTORS (by created_at) ===');
  const { data: newest } = await supabase
    .from('investors')
    .select('name, firm, investor_score, investor_tier, is_verified, type, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  newest?.forEach((inv, i) => {
    console.log((i+1) + '. ' + inv.name + ' | firm: ' + (inv.firm || '-') + ' | score: ' + (inv.investor_score || '-') + ' | tier: ' + (inv.investor_tier || '-') + ' | type: ' + (inv.type || '-') + ' | created: ' + (inv.created_at || '').slice(0,10));
  });

  // 6. Quality filter candidates: elite/strong tier with score >= 6.5
  console.log('\n=== QUALITY FILTER: elite+strong with score>=6.5 ===');
  const { data: quality, count: qualityCount } = await supabase
    .from('investors')
    .select('name, firm, investor_score, investor_tier, sectors', { count: 'exact' })
    .or('investor_tier.eq.elite,investor_tier.eq.strong')
    .not('investor_score', 'is', null)
    .gte('investor_score', 6.5)
    .order('investor_score', { ascending: false })
    .limit(20);
  
  console.log('Total quality investors: ' + qualityCount);
  quality?.forEach((inv, i) => {
    console.log((i+1) + '. ' + inv.name + ' (' + (inv.firm || '-') + ') score:' + inv.investor_score + ' tier:' + inv.investor_tier + ' sectors:' + (inv.sectors || []).slice(0,3).join(','));
  });

  // 7. Also check: investors with NULL tier/score (unscored)
  console.log('\n=== NULL TIER/SCORE COUNT ===');
  const { count: nullTier } = await supabase.from('investors').select('*', { count: 'exact', head: true }).is('investor_tier', null);
  const { count: nullScore } = await supabase.from('investors').select('*', { count: 'exact', head: true }).is('investor_score', null);
  console.log('Null tier: ' + nullTier + ', Null score: ' + nullScore);
}

main().catch(console.error);
