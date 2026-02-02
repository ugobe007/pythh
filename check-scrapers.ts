#!/usr/bin/env node
/**
 * SCRAPER HEALTH CHECK
 * ====================
 * Checks all scrapers and their performance
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkScrapers() {
  console.log('\n🔍 SCRAPER HEALTH CHECK');
  console.log('═'.repeat(60));
  
  // 1. Check RSS sources
  console.log('\n📰 RSS SOURCES:');
  const { data: rssSources, error: rssError } = await supabase
    .from('rss_sources')
    .select('*')
    .order('last_checked', { ascending: false });
  
  if (rssError) {
    console.log('❌ Error fetching RSS sources:', rssError.message);
  } else {
    console.log(`   Total sources: ${rssSources?.length || 0}`);
    
    const active = rssSources?.filter(s => s.is_active) || [];
    const recent = rssSources?.filter(s => {
      if (!s.last_checked) return false;
      const lastCheck = new Date(s.last_checked);
      const hoursSince = (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60);
      return hoursSince < 2; // Checked in last 2 hours
    }) || [];
    
    console.log(`   Active: ${active.length}`);
    console.log(`   Recently checked (< 2h): ${recent.length}`);
    
    if (active.length > 0) {
      console.log('\n   Top 5 sources:');
      active.slice(0, 5).forEach(s => {
        const lastCheck = s.last_checked 
          ? new Date(s.last_checked).toLocaleString()
          : 'Never';
        console.log(`   - ${s.name}: ${lastCheck}`);
      });
    }
  }
  
  // 2. Check discovered startups
  console.log('\n\n🆕 DISCOVERED STARTUPS:');
  const { count: totalDiscovered } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true });
  
  console.log(`   Total discovered: ${totalDiscovered || 0}`);
  
  // Last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: last24h } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday);
  
  console.log(`   Last 24 hours: ${last24h || 0}`);
  
  // Last 7 days
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: last7days } = await supabase
    .from('discovered_startups')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastWeek);
  
  console.log(`   Last 7 days: ${last7days || 0}`);
  console.log(`   Rate: ${((last7days || 0) / 7).toFixed(1)} per day`);
  
  // 3. Check approved startups (moved from discovered)
  console.log('\n\n✅ APPROVED STARTUPS:');
  const { count: totalApproved } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');
  
  console.log(`   Total approved: ${totalApproved || 0}`);
  
  const { count: approved24h } = await supabase
    .from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gte('created_at', yesterday);
  
  console.log(`   Last 24 hours: ${approved24h || 0}`);
  
  // 4. Check GOD score coverage
  console.log('\n\n⚡ GOD SCORE COVERAGE:');
  const { data: scoredStartups } = await supabase
    .from('startup_uploads')
    .select('id, total_god_score')
    .eq('status', 'approved');
  
  const withScores = scoredStartups?.filter(s => s.total_god_score && s.total_god_score > 0) || [];
  const coverage = scoredStartups?.length ? (withScores.length / scoredStartups.length) * 100 : 0;
  
  console.log(`   Approved with GOD scores: ${withScores.length}/${scoredStartups?.length || 0} (${coverage.toFixed(1)}%)`);
  
  // 5. Check investor discovery
  console.log('\n\n💼 INVESTORS:');
  const { count: totalInvestors } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });
  
  console.log(`   Total investors: ${totalInvestors || 0}`);
  
  const { count: investors24h } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday);
  
  console.log(`   Last 24 hours: ${investors24h || 0}`);
  
  const { count: investors7days } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastWeek);
  
  console.log(`   Last 7 days: ${investors7days || 0}`);
  console.log(`   Rate: ${((investors7days || 0) / 7).toFixed(1)} per day`);
  
  // 6. Check AI logs for scraper activity
  console.log('\n\n📝 SCRAPER ACTIVITY (ai_logs):');
  const { data: scraperLogs } = await supabase
    .from('ai_logs')
    .select('type, created_at')
    .or('type.eq.scraper,type.eq.discovery,type.eq.enrichment')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (scraperLogs && scraperLogs.length > 0) {
    const types = scraperLogs.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`   Last 24h scraper events: ${scraperLogs.length}`);
    Object.entries(types).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
  } else {
    console.log('   ⚠️  No scraper activity in last 24 hours');
  }
  
  // 7. Health assessment
  console.log('\n\n🏥 HEALTH ASSESSMENT:');
  const issues = [];
  const warnings = [];
  
  if ((last24h || 0) === 0) {
    issues.push('❌ No new startups discovered in 24 hours');
  } else if ((last24h || 0) < 5) {
    warnings.push('⚠️  Low discovery rate (< 5/day)');
  }
  
  if ((investors24h || 0) === 0 && (totalInvestors || 0) < 100) {
    warnings.push('⚠️  No new investors found in 24 hours');
  }
  
  if (coverage < 80) {
    warnings.push(`⚠️  GOD score coverage at ${coverage.toFixed(1)}% (target: 80%+)`);
  }
  
  if ((rssSources?.filter(s => s.is_active).length || 0) === 0) {
    issues.push('❌ No active RSS sources');
  }
  
  if (issues.length === 0 && warnings.length === 0) {
    console.log('   ✅ All systems healthy!');
  } else {
    if (issues.length > 0) {
      console.log('   ISSUES:');
      issues.forEach(i => console.log(`   ${i}`));
    }
    if (warnings.length > 0) {
      console.log('   WARNINGS:');
      warnings.forEach(w => console.log(`   ${w}`));
    }
  }
  
  // 8. Recommendations
  console.log('\n\n💡 RECOMMENDATIONS:');
  
  if ((last24h || 0) === 0) {
    console.log('   1. Check RSS scraper: pm2 status rss-scraper');
    console.log('   2. Restart scraper: pm2 restart rss-scraper');
    console.log('   3. Check RSS sources: Are they active and valid?');
  }
  
  if (coverage < 80) {
    console.log('   - Run GOD score calculation: npx tsx scripts/recalculate-scores.ts');
  }
  
  if ((rssSources?.filter(s => s.is_active).length || 0) < 10) {
    console.log('   - Add more RSS sources to increase discovery');
  }
  
  console.log('\n');
}

checkScrapers().catch(console.error);
