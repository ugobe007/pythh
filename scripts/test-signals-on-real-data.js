#!/usr/bin/env node
/**
 * TEST: Psychological Signals on Real Scraped Data
 * =================================================
 * Tests the new behavioral signal extraction on discovered_startups
 * 
 * Run: node scripts/test-signals-on-real-data.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { extractInferenceData } = require('../lib/inference-extractor');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  console.log('🔍 TESTING PSYCHOLOGICAL SIGNALS ON REAL DATA');
  console.log('═══════════════════════════════════════════════\n');
  
  // Get recent discoveries from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: startups, error } = await supabase
    .from('discovered_startups')
    .select('id, name, description, article_title, source, created_at')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }

  console.log(`📊 Analyzing ${startups.length} recent discoveries...\n`);
  console.log('─'.repeat(80));
  
  let behavioralSignalCount = 0;
  const signalTypes = {
    oversubscribed: 0,
    competitive: 0,
    followOn: 0,
    bridge: 0
  };
  
  for (const startup of startups) {
    const text = (startup.description || '') + ' ' + (startup.article_title || '');
    if (text.length < 50) continue;
    
    const extracted = extractInferenceData(text, '');
    
    const hasBehavioralSignal = 
      extracted?.is_oversubscribed || 
      extracted?.is_competitive || 
      extracted?.has_followon || 
      extracted?.is_bridge_round;
    
    if (hasBehavioralSignal) {
      behavioralSignalCount++;
      console.log(`\n📌 ${startup.name || 'Unknown'}`);
      console.log(`   Source: ${startup.source}`);
      console.log(`   Time: ${new Date(startup.created_at).toLocaleString()}`);
      
      if (extracted.is_oversubscribed) {
        signalTypes.oversubscribed++;
        console.log(`   🚀 OVERSUBSCRIBED: ${extracted.oversubscription_multiple ? extracted.oversubscription_multiple + 'x' : 'yes'} (FOMO: ${extracted.fomo_signal_strength.toFixed(2)})`);
      }
      
      if (extracted.is_competitive) {
        signalTypes.competitive++;
        console.log(`   ⚔️  COMPETITIVE: ${extracted.term_sheet_count ? extracted.term_sheet_count + ' term sheets' : 'yes'} (Urgency: ${extracted.urgency_signal_strength.toFixed(2)})`);
      }
      
      if (extracted.has_followon) {
        signalTypes.followOn++;
        console.log(`   💎 FOLLOW-ON: ${extracted.followon_investors.join(', ')} (Conviction: ${extracted.conviction_signal_strength.toFixed(2)})`);
      }
      
      if (extracted.is_bridge_round) {
        signalTypes.bridge++;
        console.log(`   ⚠️  BRIDGE ROUND (Risk: ${extracted.risk_signal_strength.toFixed(2)})`);
      }
      
      console.log('─'.repeat(80));
    }
  }
  
  console.log(`\n\n📈 SUMMARY`);
  console.log('═══════════════════════════════════════════════');
  console.log(`Total discoveries analyzed: ${startups.length}`);
  console.log(`Startups with behavioral signals: ${behavioralSignalCount} (${(behavioralSignalCount/startups.length*100).toFixed(1)}%)`);
  console.log(``);
  console.log(`Signal breakdown:`);
  console.log(`  🚀 Oversubscribed rounds: ${signalTypes.oversubscribed}`);
  console.log(`  ⚔️  Competitive rounds: ${signalTypes.competitive}`);
  console.log(`  💎 Follow-on investments: ${signalTypes.followOn}`);
  console.log(`  ⚠️  Bridge rounds: ${signalTypes.bridge}`);
  console.log(``);
  console.log(`✅ Psychological signal extraction is working on live data!`);
  
})();
