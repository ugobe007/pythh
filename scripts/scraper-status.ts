/**
 * SCRAPER STATUS DASHBOARD
 * Shows all data collection pipelines and their status
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();
const execAsync = promisify(exec);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function getScraperStatus() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    SCRAPER STATUS DASHBOARD');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. PM2 Process Status
  console.log('1️⃣  PM2 PROCESSES\n');
  try {
    const { stdout } = await execAsync('pm2 jlist 2>/dev/null');
    const processes = JSON.parse(stdout);
    
    const scraperProcesses = processes.filter((p: any) => 
      ['rss-scraper', 'pythia-collector', 'pythia-scorer', 'pythia-sync', 'html-scraper', 'ml-ontology-agent'].includes(p.name)
    );
    
    console.log('Process               Status      Restarts  Memory     Last Restart');
    console.log('─'.repeat(75));
    
    scraperProcesses.forEach((p: any) => {
      const status = p.pm2_env.status;
      const restarts = p.pm2_env.restart_time || 0;
      const memory = p.monit?.memory ? `${Math.round(p.monit.memory / 1024 / 1024)}MB` : 'N/A';
      const lastRestart = p.pm2_env.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString().slice(0, 19) : 'N/A';
      
      const statusIcon = status === 'online' ? '✅' : status === 'stopped' ? '⏸️' : '❌';
      console.log(`${statusIcon} ${p.name.padEnd(20)} ${status.padEnd(12)} ${String(restarts).padEnd(10)} ${memory.padEnd(10)} ${lastRestart}`);
    });
  } catch (e) {
    console.log('   Could not fetch PM2 status');
  }

  // 2. RSS Sources Status
  console.log('\n2️⃣  RSS SOURCES\n');
  
  // Query RSS sources directly
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('name, url, category, active, last_scraped')
    .eq('active', true)
    .order('last_scraped', { ascending: false, nullsFirst: false })
    .limit(100);

  if (sources) {
    const total = sources.length;
    const scrapedToday = sources.filter(s => {
      if (!s.last_scraped) return false;
      const scraped = new Date(s.last_scraped);
      const now = new Date();
      return (now.getTime() - scraped.getTime()) < 24 * 60 * 60 * 1000;
    }).length;
    
    const scrapedLastHour = sources.filter(s => {
      if (!s.last_scraped) return false;
      const scraped = new Date(s.last_scraped);
      const now = new Date();
      return (now.getTime() - scraped.getTime()) < 60 * 60 * 1000;
    }).length;

    console.log(`   Active sources: ${total}`);
    console.log(`   Scraped in last hour: ${scrapedLastHour}`);
    console.log(`   Scraped in last 24h: ${scrapedToday}`);
    
    // By category
    const categories: Record<string, number> = {};
    sources.forEach(s => {
      const cat = s.category || 'uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    });
    
    console.log('\n   BY CATEGORY:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([cat, count]) => {
        console.log(`     ${cat}: ${count}`);
      });
  }

  // 3. Discovery Pipeline
  console.log('\n3️⃣  DISCOVERY PIPELINE\n');
  
  const { data: discoveryStats } = await supabase
    .from('discovered_startups')
    .select('id, name, website, funding_amount, sectors, imported_to_startups, created_at');
  
  if (discoveryStats) {
    const total = discoveryStats.length;
    const withName = discoveryStats.filter(d => d.name && d.name !== 'Unknown').length;
    const withWebsite = discoveryStats.filter(d => d.website).length;
    const withFunding = discoveryStats.filter(d => d.funding_amount).length;
    const withSectors = discoveryStats.filter(d => d.sectors && d.sectors.length > 0).length;
    const imported = discoveryStats.filter(d => d.imported_to_startups).length;
    
    const thisWeek = discoveryStats.filter(d => {
      const created = new Date(d.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return created > weekAgo;
    }).length;

    console.log('   DISCOVERED STARTUPS:');
    console.log(`     Total: ${total}`);
    console.log(`     This week: ${thisWeek}`);
    console.log(`     With valid name: ${withName} (${(withName/total*100).toFixed(1)}%)`);
    console.log(`     With website: ${withWebsite} (${(withWebsite/total*100).toFixed(1)}%)`);
    console.log(`     With funding info: ${withFunding} (${(withFunding/total*100).toFixed(1)}%)`);
    console.log(`     With sectors: ${withSectors} (${(withSectors/total*100).toFixed(1)}%)`);
    console.log(`     Imported to main DB: ${imported} (${(imported/total*100).toFixed(1)}%)`);
  }

  // 4. Raw Signals Pipeline
  console.log('\n4️⃣  RAW SIGNALS (startup_signals)\n');
  
  const { data: signalStats } = await supabase
    .from('startup_signals')
    .select('signal_type, weight, created_at');
  
  if (signalStats) {
    const total = signalStats.length;
    
    // Group by type
    const byType: Record<string, { count: number; avgWeight: number }> = {};
    signalStats.forEach(s => {
      if (!byType[s.signal_type]) {
        byType[s.signal_type] = { count: 0, avgWeight: 0 };
      }
      byType[s.signal_type].count++;
      byType[s.signal_type].avgWeight += s.weight;
    });
    
    // Calculate averages
    Object.keys(byType).forEach(k => {
      byType[k].avgWeight = byType[k].avgWeight / byType[k].count;
    });

    console.log(`   Total raw signals: ${total.toLocaleString()}`);
    console.log('\n   TOP SIGNAL TYPES:');
    
    Object.entries(byType)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .forEach(([type, stats]) => {
        console.log(`     ${type}: ${stats.count.toLocaleString()} (avg weight: ${stats.avgWeight.toFixed(2)})`);
      });
  }

  // 5. Main Startups Database
  console.log('\n5️⃣  MAIN DATABASE (startup_uploads)\n');
  
  const { data: startupStats } = await supabase
    .from('startup_uploads')
    .select('status, total_god_score, team_score, traction_score, market_score, vision_score, product_score, signals_bonus, sectors, description');
  
  if (startupStats) {
    const total = startupStats.length;
    const approved = startupStats.filter(s => s.status === 'approved').length;
    const pending = startupStats.filter(s => s.status === 'pending').length;
    const withGod = startupStats.filter(s => s.total_god_score !== null).length;
    const withTeam = startupStats.filter(s => s.team_score && s.team_score > 0).length;
    const withTraction = startupStats.filter(s => s.traction_score && s.traction_score > 0).length;
    const withMarket = startupStats.filter(s => s.market_score && s.market_score > 0).length;
    const withVision = startupStats.filter(s => s.vision_score && s.vision_score > 0).length;
    const withProduct = startupStats.filter(s => s.product_score && s.product_score > 0).length;
    const withSignals = startupStats.filter(s => s.signals_bonus && s.signals_bonus > 0).length;
    const withSectors = startupStats.filter(s => s.sectors && s.sectors.length > 0).length;
    const withDesc = startupStats.filter(s => s.description && s.description.length > 0).length;

    console.log(`   Total startups: ${total.toLocaleString()}`);
    console.log(`   Approved: ${approved.toLocaleString()}`);
    console.log(`   Pending review: ${pending}`);
    console.log('\n   DATA COMPLETENESS:');
    console.log(`     GOD score: ${withGod} (${(withGod/total*100).toFixed(1)}%)`);
    console.log(`     Team score: ${withTeam} (${(withTeam/total*100).toFixed(1)}%)`);
    console.log(`     Traction score: ${withTraction} (${(withTraction/total*100).toFixed(1)}%)`);
    console.log(`     Market score: ${withMarket} (${(withMarket/total*100).toFixed(1)}%)`);
    console.log(`     Vision score: ${withVision} (${(withVision/total*100).toFixed(1)}%)`);
    console.log(`     Product score: ${withProduct} (${(withProduct/total*100).toFixed(1)}%)`);
    console.log(`     Signals bonus: ${withSignals} (${(withSignals/total*100).toFixed(1)}%)`);
    console.log(`     Sectors: ${withSectors} (${(withSectors/total*100).toFixed(1)}%)`);
    console.log(`     Description: ${withDesc} (${(withDesc/total*100).toFixed(1)}%)`);
    
    // GOD score distribution
    const approvedWithScore = startupStats.filter(s => s.status === 'approved' && s.total_god_score);
    if (approvedWithScore.length > 0) {
      const scores = approvedWithScore.map(s => s.total_god_score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      
      console.log('\n   GOD SCORE STATS (approved):');
      console.log(`     Average: ${avg.toFixed(1)}`);
      console.log(`     Min: ${min.toFixed(1)}`);
      console.log(`     Max: ${max.toFixed(1)}`);
    }
  }

  // 6. Data Flow Summary
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('                    DATA FLOW SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  console.log('RSS Sources (151 active)');
  console.log('    ↓');
  console.log('discovered_startups (2,876 records)');
  console.log('    ↓ [import pipeline]');
  console.log('startup_uploads (6,012 startups, 5,458 approved)');
  console.log('    ↓ [Pythia + scrapers]');
  console.log('startup_signals (105,118 raw signals)');
  console.log('    ↓ [GOD scoring + signal application]');
  console.log('Final: GOD score + signals_bonus → investor matching');

  console.log('\n═══════════════════════════════════════════════════════════════════\n');
}

getScraperStatus();
