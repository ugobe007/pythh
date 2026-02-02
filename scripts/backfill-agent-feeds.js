/**
 * Backfill agent_feed_items from current startup data
 * 
 * This script generates signals and movements from startup_uploads
 * to seed the agent_feed_items SSOT table.
 * 
 * Run once during transition: node scripts/backfill-agent-feeds.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { clampEvidence } = require('../server/lib/agentFeedWriter');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Generate signals by aggregating startup data by sector
 */
async function generateSignals() {
  console.log('📊 Generating signals from startup data...');
  
  // Fetch recent startup activity (last 30 days)
  const cutoff = new Date(Date.now() - 30 * 24 * 3600000);
  
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, sectors, total_god_score, updated_at, created_at')
    .eq('status', 'approved')
    .gte('total_god_score', 40)
    .gte('updated_at', cutoff.toISOString())
    .order('updated_at', { ascending: false });
  
  if (error) {
    console.error('Failed to fetch startups:', error);
    return [];
  }
  
  console.log(`  Found ${startups?.length || 0} active startups`);
  
  // Aggregate by sector
  const sectorData = {};
  for (const startup of (startups || [])) {
    const sectors = Array.isArray(startup.sectors) 
      ? startup.sectors 
      : (startup.sectors ? [startup.sectors] : ['General']);
    
    for (const sec of sectors) {
      if (!sectorData[sec]) {
        sectorData[sec] = {
          count: 0,
          scores: [],
          timestamps: [],
          startups: []
        };
      }
      sectorData[sec].count++;
      sectorData[sec].scores.push(startup.total_god_score);
      sectorData[sec].timestamps.push(new Date(startup.updated_at).getTime());
      sectorData[sec].startups.push({
        id: startup.id,
        name: startup.name,
        score: startup.total_god_score
      });
    }
  }
  
  // Convert to signal feed items
  const signals = [];
  for (const [sectorName, data] of Object.entries(sectorData)) {
    const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const latestTimestamp = Math.max(...data.timestamps);
    
    // Calculate velocity
    const recentActivity = data.timestamps.filter(t => t > Date.now() - 24 * 3600000).length;
    const velocityRatio = data.count > 0 ? recentActivity / data.count : 0;
    
    let velocity = 'flat';
    let timingState = 'stable';
    if (velocityRatio > 0.5) {
      velocity = 'up';
      timingState = avgScore > 65 ? 'hot' : 'warming';
    } else if (velocityRatio < 0.2) {
      velocity = 'down';
      timingState = 'cooling';
    }
    
    const strength = Math.min(100, Math.round((avgScore * 0.6) + (Math.min(data.count, 20) * 2)));
    
    const topStartup = data.startups.sort((a, b) => b.score - a.score)[0];
    let label = '';
    if (velocity === 'up') {
      label = `Rising activity in ${sectorName}`;
    } else if (velocity === 'down') {
      label = `Cooling momentum in ${sectorName}`;
    } else {
      label = `Steady movement in ${sectorName}`;
    }
    if (topStartup && topStartup.score >= 70) {
      label += ` (led by ${topStartup.name})`;
    }
    
    // Build evidence
    const evidence = [];
    if (data.count > 0) {
      evidence.push({
        claim: `${data.count} startup${data.count > 1 ? 's' : ''} active in this sector`,
        source: 'activity_tracker',
        confidence: data.count >= 5 ? 'high' : 'medium',
        timestamp: new Date(latestTimestamp).toISOString(),
        recency: 'recent',
        visibility: 'public'
      });
    }
    if (topStartup) {
      evidence.push({
        claim: `Top performer: ${topStartup.name} (score: ${Math.round(topStartup.score)})`,
        source: 'god_scoring',
        confidence: topStartup.score >= 75 ? 'high' : 'medium',
        timestamp: new Date(latestTimestamp).toISOString(),
        recency: 'recent',
        visibility: 'public'
      });
    }
    
    signals.push({
      kind: 'signal',
      lens_id: 'god',
      sector: sectorName,
      label,
      strength,
      velocity,
      timing_state: timingState,
      evidence: clampEvidence(evidence),  // Use clampEvidence for safety
      entity_refs: {
        startups: data.startups.slice(0, 5).map(s => ({ id: s.id, name: s.name }))
      },
      poke: {
        ui_paths: {
          signals_page: `/signals?sector=${encodeURIComponent(sectorName)}`,
          trends_lens: `/trends?lens=god&window=24h`,
          matches: `/matches?sector=${encodeURIComponent(sectorName)}`
        }
      },
      source: 'backfill_script',
      created_at: new Date(latestTimestamp).toISOString()
    });
  }
  
  console.log(`  Generated ${signals.length} signals from ${Object.keys(sectorData).length} sectors`);
  return signals;
}

/**
 * Generate movements from recent startup changes
 */
async function generateMovements() {
  console.log('🔄 Generating movements from startup data...');
  
  const cutoff = new Date(Date.now() - 7 * 24 * 3600000);
  
  // 1. Recently updated high-scoring startups
  const { data: updates } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, sectors, updated_at')
    .eq('status', 'approved')
    .gte('total_god_score', 60)
    .gte('updated_at', cutoff.toISOString())
    .order('updated_at', { ascending: false })
    .limit(50);
  
  const movements = [];
  
  for (const s of (updates || [])) {
    movements.push({
      kind: 'movement',
      lens_id: 'god',
      sector: Array.isArray(s.sectors) ? s.sectors[0] : (s.sectors || 'General'),
      label: `${s.name} updated (score: ${Math.round(s.total_god_score)})`,
      strength: Math.round(s.total_god_score),
      velocity: 'up',
      timing_state: 'warming',
      evidence: clampEvidence([{
        claim: `Score refresh completed for ${s.name}`,
        source: 'scoring_engine',
        confidence: 'high',
        timestamp: s.updated_at,
        recency: 'recent',
        visibility: 'public'
      }]),
      entity_refs: {
        startups: [{ id: s.id, name: s.name }]
      },
      poke: {
        ui_paths: {
          startup_detail: `/startups/${s.id}`,
          matches: `/matches?startup=${s.id}`
        }
      },
      source: 'backfill_script',
      created_at: s.updated_at
    });
  }
  
  // 2. New high-scoring entrants
  const { data: newEntrants } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, sectors, created_at')
    .eq('status', 'approved')
    .gte('total_god_score', 75)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  for (const s of (newEntrants || [])) {
    movements.push({
      kind: 'movement',
      lens_id: 'god',
      sector: Array.isArray(s.sectors) ? s.sectors[0] : (s.sectors || 'General'),
      label: `${s.name} entered with score ${Math.round(s.total_god_score)}`,
      strength: Math.round(s.total_god_score),
      velocity: 'up',
      timing_state: 'hot',
      evidence: clampEvidence([{
        claim: `New high-scoring startup discovered`,
        source: 'discovery_engine',
        confidence: 'high',
        timestamp: s.created_at,
        recency: 'recent',
        visibility: 'public'
      }]),
      entity_refs: {
        startups: [{ id: s.id, name: s.name }]
      },
      poke: {
        ui_paths: {
          startup_detail: `/startups/${s.id}`,
          matches: `/matches?startup=${s.id}`
        }
      },
      source: 'backfill_script',
      created_at: s.created_at
    });
  }
  
  console.log(`  Generated ${movements.length} movements`);
  return movements;
}

/**
 * Insert feed items into agent_feed_items table
 */
async function insertFeedItems(items) {
  if (items.length === 0) {
    console.log('  No items to insert');
    return 0;
  }
  
  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const { error } = await supabase
      .from('agent_feed_items')
      .insert(batch);
    
    if (error) {
      console.error(`  Batch insert error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  
  return inserted;
}

async function main() {
  console.log('🚀 Backfilling agent_feed_items SSOT...\n');
  
  // Check if table already has data
  const { count: existingCount } = await supabase
    .from('agent_feed_items')
    .select('*', { count: 'exact', head: true });
  
  if (existingCount > 0) {
    console.log(`⚠️  Table already has ${existingCount} items.`);
    console.log('   Use --force to clear and re-seed, or skip if already populated.\n');
    
    if (!process.argv.includes('--force')) {
      console.log('Exiting without changes. Pass --force to override.');
      return;
    }
    
    console.log('--force flag detected. Clearing existing data...');
    await supabase.from('agent_feed_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('  Cleared.\n');
  }
  
  // Generate and insert signals
  const signals = await generateSignals();
  const signalsInserted = await insertFeedItems(signals);
  console.log(`  ✅ Inserted ${signalsInserted} signals\n`);
  
  // Generate and insert movements
  const movements = await generateMovements();
  const movementsInserted = await insertFeedItems(movements);
  console.log(`  ✅ Inserted ${movementsInserted} movements\n`);
  
  // Summary
  const { count: finalCount } = await supabase
    .from('agent_feed_items')
    .select('*', { count: 'exact', head: true });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Backfill complete. Total items: ${finalCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
