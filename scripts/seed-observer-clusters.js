#!/usr/bin/env node
/**
 * SEED OBSERVER CLUSTERS - Critical for Day 2 Completion
 * ======================================================
 * Creates CLUSTERED observer events (not random scatter)
 * This produces real FOMO/surge/acceleration patterns
 * 
 * Strategy:
 * - Pick 10-20 high-quality startups
 * - For each: 5 heavy observers + 10 medium + 20 light
 * - Cluster events in time to show acceleration
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Observer patterns
const PATTERNS = {
  HEAVY: { min: 6, max: 12, days: 3 },   // Surge candidates
  MEDIUM: { min: 3, max: 5, days: 7 },   // Warming
  LIGHT: { min: 1, max: 2, days: 7 }     // Watch
};

// Source weights (from user's spec)
const SOURCES = [
  { name: 'partner_view', weight: 2.0 },
  { name: 'portfolio_overlap', weight: 1.5 },
  { name: 'browse_similar', weight: 1.2 },
  { name: 'search', weight: 1.0 },
  { name: 'forum', weight: 0.8 },
  { name: 'news', weight: 0.6 }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSource() {
  // Weighted random selection
  const rand = Math.random();
  if (rand < 0.3) return SOURCES[0]; // partner_view (30%)
  if (rand < 0.5) return SOURCES[1]; // portfolio_overlap (20%)
  if (rand < 0.7) return SOURCES[2]; // browse_similar (20%)
  if (rand < 0.85) return SOURCES[3]; // search (15%)
  if (rand < 0.95) return SOURCES[4]; // forum (10%)
  return SOURCES[5]; // news (5%)
}

function generateTimestamp(daysAgo, hoursVariation = 24) {
  const now = new Date();
  const daysMs = daysAgo * 24 * 60 * 60 * 1000;
  const variationMs = Math.random() * hoursVariation * 60 * 60 * 1000;
  return new Date(now.getTime() - daysMs + variationMs);
}

async function seedObserverCluster(startup, investors, pattern, label) {
  const events = [];
  
  for (const investor of investors) {
    const eventCount = randomInt(pattern.min, pattern.max);
    
    // Generate clustered events
    for (let i = 0; i < eventCount; i++) {
      const daysAgo = Math.random() * pattern.days;
      const source = randomSource();
      
      events.push({
        investor_id: investor.id,
        startup_id: startup.id,
        source: source.name,
        weight: source.weight,
        occurred_at: generateTimestamp(daysAgo).toISOString()
      });
    }
  }
  
  console.log(`   ${label}: ${investors.length} investors, ${events.length} events`);
  
  // Insert in batches of 100
  for (let i = 0; i < events.length; i += 100) {
    const batch = events.slice(i, i + 100);
    const { error } = await supabase
      .from('investor_startup_observers')
      .insert(batch);
    
    if (error) {
      console.error(`   ❌ Batch ${i / 100 + 1} failed:`, error.message);
    }
  }
  
  return events.length;
}

async function main() {
  console.log('🌱 SEEDING OBSERVER CLUSTERS');
  console.log('=============================\n');
  
  // Step 1: Get high-quality startups (GOD score >= 60)
  console.log('📊 Fetching high-quality startups...');
  const { data: startups, error: startupError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score')
    .eq('status', 'approved')
    .gte('total_god_score', 60)
    .order('total_god_score', { ascending: false })
    .limit(20);
  
  if (startupError || !startups?.length) {
    console.error('❌ No startups found:', startupError?.message);
    process.exit(1);
  }
  
  console.log(`✅ Found ${startups.length} startups\n`);
  
  // Step 2: Get investors pool
  console.log('📊 Fetching investors...');
  const { data: allInvestors, error: investorError } = await supabase
    .from('investors')
    .select('id, name, sectors, stage')
    .limit(500);
  
  if (investorError || !allInvestors?.length) {
    console.error('❌ No investors found:', investorError?.message);
    process.exit(1);
  }
  
  console.log(`✅ Found ${allInvestors.length} investors\n`);
  
  // Step 3: Seed clusters for each startup
  let totalEvents = 0;
  let startupCount = 0;
  
  for (const startup of startups.slice(0, 10)) {
    console.log(`\n🎯 ${startup.name} (GOD: ${startup.total_god_score})`);
    
    // Shuffle investors
    const shuffled = [...allInvestors].sort(() => Math.random() - 0.5);
    
    // Split into clusters
    const heavy = shuffled.slice(0, 5);
    const medium = shuffled.slice(5, 15);
    const light = shuffled.slice(15, 35);
    
    // Seed each cluster
    const heavyEvents = await seedObserverCluster(startup, heavy, PATTERNS.HEAVY, '🔥 HEAVY (surge)');
    const mediumEvents = await seedObserverCluster(startup, medium, PATTERNS.MEDIUM, '🌡 MEDIUM (warming)');
    const lightEvents = await seedObserverCluster(startup, light, PATTERNS.LIGHT, '👀 LIGHT (watch)');
    
    const startupTotal = heavyEvents + mediumEvents + lightEvents;
    console.log(`   📈 Total: ${startupTotal} events`);
    
    totalEvents += startupTotal;
    startupCount++;
  }
  
  console.log('\n\n📊 SEEDING SUMMARY');
  console.log('==================');
  console.log(`✅ Startups seeded: ${startupCount}`);
  console.log(`✅ Total events: ${totalEvents}`);
  console.log(`✅ Avg events per startup: ${Math.round(totalEvents / startupCount)}`);
  
  // Step 4: Verify FOMO states
  console.log('\n🔍 VERIFYING FOMO STATES...\n');
  
  const { data: fomoCheck } = await supabase
    .from('investor_startup_fomo_triggers')
    .select('fomo_state, COUNT(*)')
    .in('startup_id', startups.slice(0, 10).map(s => s.id));
  
  if (fomoCheck) {
    console.log('FOMO State Distribution:');
    const states = {};
    fomoCheck.forEach(row => {
      states[row.fomo_state] = (states[row.fomo_state] || 0) + 1;
    });
    Object.entries(states).forEach(([state, count]) => {
      const emoji = state === 'breakout' ? '🚀' : 
                    state === 'surge' ? '🔥' : 
                    state === 'warming' ? '🌡' : '👀';
      console.log(`   ${emoji} ${state}: ${count}`);
    });
  }
  
  // Step 5: Show observer counts
  console.log('\n📊 OBSERVER COUNTS (7d):\n');
  
  for (const startup of startups.slice(0, 5)) {
    const { data: observers } = await supabase
      .from('startup_observers_7d')
      .select('observers_7d')
      .eq('startup_id', startup.id)
      .single();
    
    if (observers) {
      console.log(`   ${startup.name}: ${observers.observers_7d} observers`);
    }
  }
  
  console.log('\n\n🎉 SEEDING COMPLETE!');
  console.log('\nNext steps:');
  console.log('1. Restart API server: pm2 restart api-server');
  console.log('2. Test convergence: curl "http://localhost:3002/api/discovery/convergence?url=<startup-url>"');
  console.log('3. Check status.observers_7d (should be > 0)');
  console.log('4. Check visible_investors[].signal_state (should see breakout/surge)');
  console.log('5. Check why.bullets (should see real behavioral evidence)');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
