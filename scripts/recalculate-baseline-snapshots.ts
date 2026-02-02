#!/usr/bin/env npx tsx
/**
 * Canonical Score Recalculation Script
 * 
 * Creates baseline score_snapshots for all startups.
 * Session 1 version: ensures every startup has at least 1 snapshot.
 * 
 * Usage:
 *   npm run recalculate:baseline
 *   npx tsx scripts/recalculate-baseline-snapshots.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Feature weights (canonical)
const FEATURE_WEIGHTS = {
  traction: 0.20,
  founder_velocity: 0.15,
  investor_intent: 0.15,
  market_belief_shift: 0.10,
  capital_convergence: 0.10,
  team_strength: 0.15,
  product_quality: 0.10,
  market_size: 0.05
};

interface Startup {
  id: string;
  name: string;
  total_god_score: number | null;
  team_score: number | null;
  traction_score: number | null;
  market_score: number | null;
  product_score: number | null;
  vision_score: number | null;
}

async function getStartupsWithoutSnapshots(): Promise<Startup[]> {
  // Get all approved startups
  const { data: startups, error: startupError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved');
  
  if (startupError) {
    console.error('Failed to fetch startups:', startupError);
    return [];
  }
  
  // Get startups that already have snapshots
  const { data: existingSnapshots } = await supabase
    .from('score_snapshots_v2')
    .select('startup_id');
  
  const startupsWithSnapshots = new Set((existingSnapshots || []).map(s => s.startup_id));
  
  // Filter to only those without snapshots
  return (startups || []).filter(s => !startupsWithSnapshots.has(s.id));
}

async function computeFeatures(startup: Startup): Promise<Record<string, any>> {
  const features: Record<string, any> = {};
  
  // Map existing component scores to features
  if (startup.traction_score) {
    features.traction = {
      value: startup.traction_score * FEATURE_WEIGHTS.traction * 100,
      verification: 0.20, // Baseline = unverified
      lastUpdated: new Date().toISOString()
    };
  }
  
  if (startup.team_score) {
    features.team_strength = {
      value: startup.team_score * FEATURE_WEIGHTS.team_strength * 100,
      verification: 0.20,
      lastUpdated: new Date().toISOString()
    };
  }
  
  if (startup.market_score) {
    features.market_belief_shift = {
      value: startup.market_score * FEATURE_WEIGHTS.market_belief_shift * 100,
      verification: 0.20,
      lastUpdated: new Date().toISOString()
    };
  }
  
  if (startup.product_score) {
    features.product_quality = {
      value: startup.product_score * FEATURE_WEIGHTS.product_quality * 100,
      verification: 0.20,
      lastUpdated: new Date().toISOString()
    };
  }
  
  if (startup.vision_score) {
    features.investor_intent = {
      value: startup.vision_score * FEATURE_WEIGHTS.investor_intent * 100,
      verification: 0.20,
      lastUpdated: new Date().toISOString()
    };
  }
  
  // Add baseline for other features
  features.founder_velocity = {
    value: 0,
    verification: 0.20,
    lastUpdated: new Date().toISOString()
  };
  
  features.capital_convergence = {
    value: 0,
    verification: 0.20,
    lastUpdated: new Date().toISOString()
  };
  
  features.market_size = {
    value: 0,
    verification: 0.20,
    lastUpdated: new Date().toISOString()
  };
  
  return features;
}

function computeSignalScore(features: Record<string, any>): number {
  let total = 0;
  for (const [featureId, feature] of Object.entries(features)) {
    if (feature && typeof feature.value === 'number') {
      total += feature.value;
    }
  }
  return Math.max(0, Math.min(100, total));
}

async function createBaselineSnapshot(startup: Startup): Promise<boolean> {
  try {
    const features = await computeFeatures(startup);
    const signalScore = computeSignalScore(features);
    const godScore = startup.total_god_score || 50;
    
    const { error } = await supabase
      .from('score_snapshots_v2')
      .insert({
        startup_id: startup.id,
        as_of: new Date().toISOString(),
        features,
        total_signal: signalScore,
        total_god: godScore
      });
    
    if (error) {
      console.error(`  ❌ Failed to create snapshot for ${startup.name}:`, error.message);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`  ❌ Error processing ${startup.name}:`, err);
    return false;
  }
}

async function main() {
  console.log('🔄 Canonical Baseline Snapshot Creation');
  console.log('=====================================\n');
  
  // Check if tables exist
  const { error: tableCheck } = await supabase
    .from('score_snapshots_v2')
    .select('id')
    .limit(1);
  
  if (tableCheck && tableCheck.code === '42P01') {
    console.error('❌ score_snapshots_v2 table does not exist.');
    console.error('   Please apply the migration first:');
    console.error('   - Copy supabase/migrations/20260201_canonical_verification_v2.sql');
    console.error('   - Run in Supabase SQL Editor');
    process.exit(1);
  }
  
  // Get startups without snapshots
  const startups = await getStartupsWithoutSnapshots();
  
  if (startups.length === 0) {
    console.log('✅ All startups already have snapshots!');
    return;
  }
  
  console.log(`📊 Found ${startups.length} startups without snapshots\n`);
  
  let created = 0;
  let failed = 0;
  
  for (const startup of startups) {
    process.stdout.write(`  Creating snapshot for ${startup.name}...`);
    const success = await createBaselineSnapshot(startup);
    
    if (success) {
      console.log(' ✅');
      created++;
    } else {
      failed++;
    }
  }
  
  console.log('\n=====================================');
  console.log(`✅ Created: ${created}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${startups.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
